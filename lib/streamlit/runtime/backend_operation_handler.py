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
        session_id: str,  # noqa: ARG002
    ) -> BackendOperationResponse:
        """Install the bundled Streamlit skills in project mode."""
        from streamlit.runtime import metrics_util
        from streamlit.web import skills

        app_dir = self._get_app_dir()

        # Gate the action on exactly the same recommendation the nudge was shown
        # under: should_show_skills_nudge covers not-headless, an agent harness
        # present, skills not already installed, and no "don't show again"
        # marker. A request that fails this gate is stale or anomalous (a
        # replayed BackMsg, a server that should never have offered it) and must
        # not trigger a server-side install (filesystem writes, and a GitHub
        # download in the global fallback).
        if not skills.should_show_skills_nudge(app_dir):
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
        metrics_util.clear_installed_skills_cache()

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
        session_id: str,  # noqa: ARG002
    ) -> BackendOperationResponse:
        """Write the server-side marker so the nudge is no longer shown."""
        from streamlit import config
        from streamlit.web import skills

        if config.get_option("server.headless"):
            # The nudge is never shown in headless mode, so a dismissal request
            # there is anomalous; refuse rather than write a marker file under
            # the server's config dir (mirrors the install handler's gating).
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
