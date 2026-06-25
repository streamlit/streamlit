# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Handler system for backend operations.

Backend operations are server-side operations that don't require a script rerun,
such as lazy dataframe chunk loading, server-side validation, and autocompletion.
"""

from __future__ import annotations

import asyncio
from ipaddress import ip_address
from typing import TYPE_CHECKING, Final, Protocol

from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import (
    BackendOperationResponse,
    DeferredFileResponsePayload,
    DismissSkillsNudgeResponsePayload,
    InstallSkillsResponsePayload,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
    from streamlit.runtime.media_file_manager import MediaFileManager

_LOGGER: Final = get_logger(__name__)


def connection_locality(session_id: str) -> str:
    """Classify the WebSocket peer of ``session_id`` for the skills nudge.

    Returns one of:
      - ``"loopback"`` — the browser is connected directly over a loopback
        address (``127.0.0.0/8``, ``::1``). The only class treated as eligible
        local development for the nudge.
      - ``"private"`` — a private/LAN address (RFC1918, link-local, ULA), i.e.
        Docker / VM / reverse-proxy / LAN topologies.
      - ``"other"`` — any other (public / relayed) address.
      - ``"unknown"`` — the peer IP is unavailable (no client context, the
        runtime is not running, or an unparseable address).

    Uses the raw ``client_context.remote_ip`` (the unforgeable TCP peer), NOT
    ``st.context.ip_address`` which normalizes loopback to ``None``. This is an
    intentionally conservative *eligibility* signal, not a security control:
    only a direct-loopback connection recommends the nudge or may run the
    install, so a shared/deployed-ish topology (where someone other than the
    developer might reach the app) never triggers an unintended filesystem write.
    """
    from streamlit.runtime import exists, get_instance

    if not exists():
        return "unknown"
    client = get_instance().get_client(session_id)
    if client is None or client.client_context is None:
        return "unknown"
    remote_ip = client.client_context.remote_ip
    if remote_ip is None:
        return "unknown"
    try:
        ip = ip_address(remote_ip)
    except ValueError:
        return "unknown"
    if ip.is_loopback:
        return "loopback"
    if ip.is_private:
        return "private"
    return "other"


class BackendOperationHandler(Protocol):
    """Protocol for backend operation request handlers."""

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        """Handle a backend operation request and return a response."""
        ...


class BackendOperationDispatcher:
    """Dispatches backend operation requests to registered handlers."""

    def __init__(self) -> None:
        self._handlers: dict[str, BackendOperationHandler] = {}

    def register(self, payload_type: str, handler: BackendOperationHandler) -> None:
        """Register a handler for a specific payload type (e.g., "deferred_file")."""
        self._handlers[payload_type] = handler

    async def dispatch(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        """Dispatch a request to the appropriate handler."""
        payload_type = request.WhichOneof("payload")

        if payload_type is None:
            _LOGGER.warning(
                "Backend operation request %s has no payload", request.request_id
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="No payload specified in request",
            )

        handler = self._handlers.get(payload_type)
        if handler is None:
            _LOGGER.warning(
                "No handler registered for backend operation payload type: %s",
                payload_type,
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg=f"No handler registered for payload type: {payload_type}",
            )

        try:
            return await handler.handle(request, session_id)
        except Exception:
            _LOGGER.exception(
                "Error handling backend operation request %s (type: %s)",
                request.request_id,
                payload_type,
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Failed to process backend operation",
            )


class DeferredFileHandler(BackendOperationHandler):
    """Handler for deferred file download requests."""

    def __init__(self, get_media_file_mgr: Callable[[], MediaFileManager]) -> None:
        """Initialize with a callable that returns the MediaFileManager."""
        self._get_media_file_mgr = get_media_file_mgr

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,  # noqa: ARG002
    ) -> BackendOperationResponse:
        """Execute the deferred callable and return the generated file URL."""
        payload = request.deferred_file
        file_id = payload.file_id

        try:
            # Execute in a separate thread to avoid blocking the event loop
            url = await asyncio.to_thread(
                self._get_media_file_mgr().execute_deferred,
                file_id,
            )

            return BackendOperationResponse(
                request_id=request.request_id,
                deferred_file=DeferredFileResponsePayload(url=url),
            )
        except Exception:
            _LOGGER.exception(
                "Error executing deferred callable for file_id %s", file_id
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Failed to generate file for download",
            )


class InstallSkillsHandler(BackendOperationHandler):
    """Handler for one-click "install skills" requests from the in-app nudge."""

    def __init__(self, get_app_dir: Callable[[], str]) -> None:
        """Initialize with a callable returning the running app's directory.

        The app dir is used both to gate the install (same detection as the
        nudge) and to resolve the install target, so the offer and the action
        operate on the same project tree.
        """
        self._get_app_dir = get_app_dir

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        """Install the bundled Streamlit skills in project mode."""
        from streamlit import config
        from streamlit.web import skills

        app_dir = self._get_app_dir()

        # Gate the ACTION on install *safety*, not on the nudge's display
        # predicate. Three conditions make a request anomalous and unsafe to honor:
        #   - headless mode (deployments / CI / SiS): the nudge is never shown
        #     there, so the request is a replayed/spoofed BackMsg; refuse the
        #     filesystem writes (and the GitHub download in the global fallback).
        #   - no agent harness present: nothing would consume the skills.
        #   - the browser is not on a direct-loopback connection: the same
        #     conservative eligibility rule the nudge display uses, so a
        #     shared/deployed-ish topology (Docker/VM/reverse-proxy/SSH-tunnel)
        #     can never trigger a filesystem write by a non-developer visitor.
        # We deliberately do NOT gate on "skills already installed" (which
        # should_show_skills_nudge does): re-installing is idempotent (it reports
        # "up to date"), whereas refusing it would reject a legitimate RETRY
        # after a dropped connection whose first attempt already completed
        # server-side — surfacing a success as an unrecoverable error and
        # logging it as a failed install. Idempotent retry is the correct path.
        if (
            config.get_option("server.headless")
            or not skills.detect_installed_agents()
            or connection_locality(session_id) != "loopback"
        ):
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Skills install is not available in this environment.",
            )

        try:
            # Run off the event loop: installing does filesystem I/O (and, in
            # the global fallback, a network download). Resolve the install root
            # from the app dir so it lands in the tree the nudge detection scans.
            result = await asyncio.to_thread(
                skills.install_skills, global_mode=False, yes=True, app_dir=app_dir
            )
        except Exception as ex:
            _LOGGER.warning("One-click skills install failed", exc_info=ex)
            # click.ClickException carries a clean, user-facing message.
            format_message = getattr(ex, "format_message", None)
            detail = format_message() if callable(format_message) else str(ex)
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg=detail or "Failed to install skills.",
            )

        # Invalidate the cached "skills installed" detection so a later session
        # in this same process does not re-show the nudge.
        skills.clear_installed_skills_cache()

        return BackendOperationResponse(
            request_id=request.request_id,
            install_skills=InstallSkillsResponsePayload(
                detail=skills.summarize_install(result)
            ),
        )


class DismissSkillsNudgeHandler(BackendOperationHandler):
    """Handler that permanently dismisses the in-app "install skills" nudge."""

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        """Write the server-side marker so the nudge is no longer shown."""
        from streamlit import config
        from streamlit.web import skills

        if (
            config.get_option("server.headless")
            or connection_locality(session_id) != "loopback"
        ):
            # The nudge is never shown in headless mode or to a non-loopback
            # connection, so a dismissal request from there is anomalous; refuse
            # rather than write a marker file under the server's config dir
            # (mirrors the install handler's gating).
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Skills nudge is not available in this environment.",
            )

        try:
            await asyncio.to_thread(skills.write_nudge_dismissed_marker)
        except Exception as ex:
            _LOGGER.warning("Failed to persist skills nudge dismissal", exc_info=ex)
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Failed to save your preference.",
            )

        # The ack payload's presence signals success (error_msg stays empty).
        return BackendOperationResponse(
            request_id=request.request_id,
            dismiss_skills_nudge=DismissSkillsNudgeResponsePayload(),
        )
