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

"""The agent API routes.

``POST /_stcore/agent/v1/interact`` drives the app; ``GET
/_stcore/agent/v1/openapi.json`` describes how, so a caller that found the
endpoint can learn the protocol without being handed documentation.

Served only when ``server.enableAgentApi`` is on, and only to loopback peers.

That is the same conservative gate the skills-install operation uses, and it
keeps the first release useful for local verification and CI while remote
enablement (identity mapping into ``st.user``, Origin and XSRF handling, and
response and rate budgets) is settled separately.
"""

from __future__ import annotations

# ruff: noqa: RUF029  # Async route handlers are idiomatic even without await
import json
from ipaddress import ip_address
from typing import TYPE_CHECKING, Any, Final

from streamlit import config
from streamlit.logger import get_logger
from streamlit.runtime.agent.interaction import (
    AgentSessionRegistry,
    interact,
)
from streamlit.runtime.agent.protocol import build_openapi_document, error_status
from streamlit.runtime.agent.widget_patch import AgentRequestError
from streamlit.runtime.runtime_util import get_max_widget_state_size_bytes

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    from starlette.routing import BaseRoute

    from streamlit.runtime.runtime import Runtime

_LOGGER: Final = get_logger(__name__)

_ROUTE_AGENT_INTERACT: Final = "_stcore/agent/v1/interact"
_ROUTE_AGENT_SCHEMA: Final = "_stcore/agent/v1/openapi.json"


def _is_loopback_peer(request: Request) -> bool:
    """True when the TCP peer is on a loopback address.

    Uses the raw peer address rather than a forwarded header, so a proxy cannot
    present a remote caller as local.
    """
    client = request.client
    if client is None or not client.host:
        return False
    try:
        return ip_address(client.host).is_loopback
    except ValueError:
        return False


def create_agent_routes(runtime: Runtime, base_url: str | None) -> list[BaseRoute]:
    """Create the agent API routes.

    Registered even when the API is disabled, because the app's HTML always
    links to the schema path and an unregistered path is worse than an
    unhelpful one: it falls through to the single-page-app handler, so following
    the link would return the app's HTML with a 200. Answering from here instead
    means the link is never a dead end, and turning the API on needs no change
    to any cached HTML.
    """
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    from streamlit.url_util import make_url_path

    enabled = bool(config.get_option("server.enableAgentApi"))
    registry = AgentSessionRegistry(runtime) if enabled else None
    interact_path = make_url_path(base_url or "", _ROUTE_AGENT_INTERACT)
    schema_path = make_url_path(base_url or "", _ROUTE_AGENT_SCHEMA)

    def _refuse_non_loopback(request: Request) -> JSONResponse:
        _LOGGER.warning(
            "Refusing agent API request from non-loopback peer %s",
            request.client.host if request.client else "unknown",
        )
        return _error(
            "not_available",
            "The agent API is only served to loopback callers.",
            status=error_status("not_available"),
        )

    async def _schema_endpoint(request: Request) -> JSONResponse:
        """Serve the OpenAPI document, so the protocol is discoverable.

        Unlike the operation it describes, this is answered for any caller. It
        is documentation rather than access: a remote caller that followed the
        app's link is better told what this is, that it is loopback-only, and
        whether it is even on, than given a bare refusal it cannot interpret.
        """
        if not enabled:
            availability = "disabled"
        elif not _is_loopback_peer(request):
            availability = "loopback-only"
        else:
            availability = "available"

        response = JSONResponse(
            build_openapi_document(
                interact_path=interact_path,
                schema_path=schema_path,
                availability=availability,
            )
        )
        response.headers["Cache-Control"] = "no-cache"
        return response

    async def _interact_endpoint(request: Request) -> JSONResponse:
        if not enabled:
            return _error(
                "not_available",
                "This app does not serve the agent API. Its operator can turn "
                "it on with `server.enableAgentApi`; see "
                f"{schema_path} for what it would offer.",
                status=error_status("not_available"),
            )
        if not _is_loopback_peer(request):
            return _refuse_non_loopback(request)

        # The same bound the WebSocket handler applies to an inbound frame, so
        # the agent path is no more permissive than the browser path.
        max_request_bytes = get_max_widget_state_size_bytes()
        body = await request.body()
        if len(body) > max_request_bytes:
            return _error(
                "invalid_request",
                f"Request body exceeds {max_request_bytes} bytes.",
                status=413,
            )

        try:
            payload: Any = json.loads(body) if body.strip() else {}
        except json.JSONDecodeError as exc:
            return _error("invalid_request", f"Body is not valid JSON: {exc.msg}.")

        if not isinstance(payload, dict):
            return _error("invalid_request", "Body must be a JSON object.")

        try:
            assert registry is not None  # noqa: S101 - guarded by `enabled`
            snapshot = await interact(runtime, registry, payload)
        except AgentRequestError as exc:
            return _error(
                exc.code,
                exc.message,
                status=error_status(exc.code),
                session_id=exc.session_id,
            )
        except Exception as exc:
            _LOGGER.exception("Agent API interaction failed")
            return _error(
                "internal_error",
                f"The interaction could not be completed: {type(exc).__name__}.",
                status=error_status("internal_error"),
            )

        response = JSONResponse(snapshot)
        # Point a caller that found the endpoint at its own description, so the
        # protocol is reachable from any response.
        response.headers["Link"] = f'<{schema_path}>; rel="service-desc"'
        return response

    def _error(
        code: str,
        message: str,
        *,
        status: int = 400,
        session_id: str | None = None,
    ) -> JSONResponse:
        body: dict[str, Any] = {"error": {"code": code, "message": message}}
        if session_id is not None:
            # Only set when a creating call already produced a usable session.
            body["session_id"] = session_id
        response = JSONResponse(body, status_code=status)
        # Errors are where a caller most needs the protocol description, so
        # they carry the same pointer to it that successful responses do.
        response.headers["Link"] = f'<{schema_path}>; rel="service-desc"'
        return response

    return [
        Route(interact_path, _interact_endpoint, methods=["POST"]),
        Route(schema_path, _schema_endpoint, methods=["GET"]),
    ]
