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
endpoint can learn the protocol without being handed documentation; and
``POST /_stcore/agent/v1/mcp`` offers the same interaction as an MCP server,
for AI applications that connect to servers by URL.

All three are always registered, because the app's HTML always links the
schema; with ``server.enableAgentApi`` off they only say so. When it is on,
they are served wherever the app is, to any caller the app would serve: the
WebSocket's Host allow-list applies, and the same trusted identity headers are
mapped into ``st.user``.
"""

from __future__ import annotations

# ruff: noqa: RUF029  # Async route handlers are idiomatic even without await
import json
from typing import TYPE_CHECKING, Any, Final

from streamlit import config
from streamlit.logger import get_logger
from streamlit.runtime.agent import mcp
from streamlit.runtime.agent.interaction import (
    AgentSessionRegistry,
    interact,
)
from streamlit.runtime.agent.protocol import build_openapi_document, error_status
from streamlit.runtime.agent.snapshot import rebase_media_urls
from streamlit.runtime.agent.widget_patch import AgentRequestError
from streamlit.runtime.runtime_util import get_max_widget_state_size_bytes
from streamlit.web.server.starlette.starlette_routes import BASE_ROUTE_MEDIA
from streamlit.web.server.starlette.starlette_websocket import (
    _gather_user_info,
    _is_host_allowed,
)

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import JSONResponse, Response
    from starlette.routing import BaseRoute

    from streamlit.runtime.runtime import Runtime

_LOGGER: Final = get_logger(__name__)

_ROUTE_AGENT_INTERACT: Final = "_stcore/agent/v1/interact"
_ROUTE_AGENT_SCHEMA: Final = "_stcore/agent/v1/openapi.json"
_ROUTE_AGENT_MCP: Final = "_stcore/agent/v1/mcp"

# How many path segments every agent route sits below the app's root, so how
# far a URL relative to the request has to climb to reach it.
_ROUTE_DEPTH: Final = _ROUTE_AGENT_INTERACT.count("/")

# Where media storage's URLs start, relative to the app's root.
_MEDIA_PATH: Final = f"/{BASE_ROUTE_MEDIA}"


def _climb(levels: int) -> str:
    """A relative URL that climbs this many path segments, such as ``../../..``."""
    return "/".join([".."] * levels)


def _refused_host(request: Request) -> bool:
    """Whether the request's Host is outside `server.allowedHosts`.

    The allow-list the WebSocket enforces, and the defense against DNS
    rebinding. The Origin is deliberately not checked: these routes read no
    cookies, so a page on another site that sends a request here gains nothing
    over opening the app's URL, and a client that legitimately calls from a
    browser on another origin is not turned away.
    """
    host = request.headers.get("Host")
    if _is_host_allowed(host):
        return False
    _LOGGER.warning("Refusing agent API request with disallowed Host: %s", host)
    return True


def _error_body(
    code: str,
    message: str,
    *,
    session_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details:
        body["error"].update(details)
    if session_id is not None:
        # Only set when a creating call already produced a usable session.
        body["session_id"] = session_id
    return body


def create_agent_routes(runtime: Runtime, base_url: str | None) -> list[BaseRoute]:
    """Create the agent API routes.

    Registered even when the API is disabled, because the app's HTML always
    links to the schema path and an unregistered path is worse than an
    unhelpful one: it falls through to the single-page-app handler, so following
    the link would return the app's HTML with a 200. Answering from here instead
    means the link is never a dead end, and turning the API on needs no change
    to any cached HTML.
    """
    from starlette.responses import JSONResponse, Response
    from starlette.routing import Route

    from streamlit.url_util import make_url_path

    enabled = bool(config.get_option("server.enableAgentApi"))
    registry = AgentSessionRegistry(runtime) if enabled else None
    interact_path = make_url_path(base_url or "", _ROUTE_AGENT_INTERACT)
    schema_path = make_url_path(base_url or "", _ROUTE_AGENT_SCHEMA)
    mcp_path = make_url_path(base_url or "", _ROUTE_AGENT_MCP)

    # Every URL a response carries is relative to the request that returned it,
    # because that is the one base that is always right. A proxy that serves the
    # app under a prefix and strips it before forwarding -- Community Cloud's
    # `/~/+/` -- leaves nothing on the request that says where the app is, so a
    # URL built from the request points at the hosting platform instead.
    media_prefix = _climb(_ROUTE_DEPTH)
    # The documented paths include the base URL path, so the server sits above
    # it as well.
    base_segments = len([segment for segment in (base_url or "").split("/") if segment])
    server_url = _climb(_ROUTE_DEPTH + base_segments)

    disabled_message = (
        "This app does not serve the agent API. Its operator can turn it on with "
        f"`server.enableAgentApi`; see {schema_path} for what it would offer."
    )
    host_message = (
        "This request's Host is not in `server.allowedHosts`, which the app "
        "enforces for its WebSocket too."
    )

    async def _schema_endpoint(_request: Request) -> JSONResponse:
        """Serve the OpenAPI document, so the protocol is discoverable.

        Answered whether or not the API is on. It is documentation rather than
        access: a caller that followed the app's link is better told what this
        is and whether it is on than given a bare refusal it cannot interpret.
        """
        response = JSONResponse(
            build_openapi_document(
                interact_path=interact_path,
                schema_path=schema_path,
                availability="available" if enabled else "disabled",
                server_url=server_url,
                mcp_path=mcp_path,
            )
        )
        response.headers["Cache-Control"] = "no-cache"
        return response

    async def _run_interact(
        request: Request, payload: dict[str, Any]
    ) -> tuple[int, dict[str, Any]]:
        """Run one interaction and return its HTTP status and JSON body."""
        try:
            assert registry is not None  # noqa: S101 - guarded by `enabled`
            snapshot = await interact(
                runtime,
                registry,
                payload,
                # The same trusted headers the WebSocket maps for a browser.
                # Never the auth cookie: it is only honored on the WebSocket
                # behind an XSRF token, which a cross-site request here could
                # otherwise ride.
                user_info=_gather_user_info(request.headers),
            )
        except AgentRequestError as exc:
            return error_status(exc.code), _error_body(
                exc.code,
                exc.message,
                session_id=exc.session_id,
                details=exc.details,
            )
        except Exception as exc:
            _LOGGER.exception("Agent API interaction failed")
            return error_status("internal_error"), _error_body(
                "internal_error",
                f"The interaction could not be completed: {type(exc).__name__}.",
            )
        rebase_media_urls(snapshot, media_path=_MEDIA_PATH, prefix=media_prefix)
        return 200, snapshot

    def _error(code: str, message: str, *, status: int) -> JSONResponse:
        return _json_response(_error_body(code, message), status)

    def _json_response(body: dict[str, Any], status: int) -> JSONResponse:
        response = JSONResponse(body, status_code=status)
        # Point a caller at the protocol description from every response,
        # errors most of all.
        response.headers["Link"] = f'<{schema_path}>; rel="service-desc"'
        return response

    async def _interact_endpoint(request: Request) -> JSONResponse:
        if not enabled:
            return _error(
                "not_available", disabled_message, status=error_status("not_available")
            )
        if _refused_host(request):
            return _error(
                "host_not_allowed",
                host_message,
                status=error_status("host_not_allowed"),
            )

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
            return _error(
                "invalid_request", f"Body is not valid JSON: {exc.msg}.", status=400
            )

        if not isinstance(payload, dict):
            return _error("invalid_request", "Body must be a JSON object.", status=400)

        status, result = await _run_interact(request, payload)
        return _json_response(result, status)

    async def _mcp_endpoint(request: Request) -> Response:
        """Serve the agent API as an MCP server, over MCP's HTTP transport."""
        if request.method != "POST":
            # Registered for every method so a GET is answered here rather than
            # by the single-page-app fallback, which would return the app's HTML
            # with a 200. A GET would open a stream for messages the server
            # sends on its own, and this server sends none.
            return Response(status_code=405, headers={"Allow": "POST"})
        if not enabled:
            return JSONResponse(
                mcp.error_response(None, mcp.SERVER_ERROR, disabled_message),
                status_code=403,
            )
        if _refused_host(request):
            return JSONResponse(
                mcp.error_response(None, mcp.SERVER_ERROR, host_message),
                status_code=403,
            )

        max_request_bytes = get_max_widget_state_size_bytes()
        body = await request.body()
        if len(body) > max_request_bytes:
            return JSONResponse(
                mcp.error_response(
                    None,
                    mcp.INVALID_REQUEST,
                    f"Request body exceeds {max_request_bytes} bytes.",
                ),
                status_code=413,
            )
        try:
            message: Any = json.loads(body)
        except json.JSONDecodeError as exc:
            return JSONResponse(
                mcp.error_response(
                    None, mcp.PARSE_ERROR, f"Body is not valid JSON: {exc.msg}."
                ),
                status_code=400,
            )

        async def call_interact(
            arguments: dict[str, Any],
        ) -> tuple[dict[str, Any], bool]:
            status, result = await _run_interact(request, arguments)
            return result, status >= 400

        response = await mcp.handle(message, call_interact)
        if response is None:
            # Only notifications, which the transport acknowledges without a body.
            return Response(status_code=202)
        return JSONResponse(response)

    return [
        Route(interact_path, _interact_endpoint, methods=["POST"]),
        Route(schema_path, _schema_endpoint, methods=["GET"]),
        Route(mcp_path, _mcp_endpoint, methods=["GET", "POST", "DELETE"]),
    ]
