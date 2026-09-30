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
they are served wherever the app is. A caller gets no more access than the app
gives a browser, so the operations apply the checks the WebSocket does: the
same Host and Origin rules, and the same trusted identity headers mapped into
``st.user``.
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
    _is_origin_allowed,
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

# Where media storage's URLs start, relative to the app's root.
_MEDIA_PATH: Final = f"/{BASE_ROUTE_MEDIA}"


def _server_prefix(request: Request, schema_path: str) -> str:
    """Whatever sits in front of the API paths on the way this caller reached it.

    A hosted app is not always served at the root a client would guess. Community
    Cloud serves embedded apps under `/~/+/`, so an agent that joins the public
    origin with `/_stcore/agent/v1/interact` gets a redirect to a login page and
    never reaches the app. The document has to say where it is, and the only
    authority on that is the request that just arrived.

    Deliberately a path and not an absolute URL: behind a proxy the scheme and
    host this process sees are not necessarily the ones the client used, and a
    relative OpenAPI server URL resolves against wherever the document was
    fetched from, which is exactly right.
    """
    path = request.url.path
    prefix = (
        path[: -len(schema_path)] if schema_path and path.endswith(schema_path) else ""
    )

    if not prefix:
        # A proxy that strips its prefix before forwarding has to announce it,
        # or nothing here can know. Trusting the header is safe for this one
        # use: it only changes where this caller is told to look, so a forged
        # value misdirects the caller that forged it.
        prefix = request.headers.get("X-Forwarded-Prefix", "").rstrip("/")

    # "/" rather than "" so the field is never an empty string, which OpenAPI
    # does not allow as a server URL.
    return prefix or "/"


def _absolute_app_root(request: Request, route: str) -> str:
    """The app's root as an absolute URL, the way this caller reached it.

    An MCP client has no OpenAPI server entry to resolve a root-relative
    `/media/...` against, so the URLs it is given have to be absolute. Forwarded
    headers are honored where a proxy supplies them, for the same reason as in
    `_server_prefix`: they only change where this caller is told to fetch from.
    """
    path = request.url.path
    root = path[: -len(route)] if path.endswith(route) else "/"
    forwarded_prefix = request.headers.get("X-Forwarded-Prefix", "").rstrip("/")
    if forwarded_prefix and not root.startswith(forwarded_prefix + "/"):
        root = forwarded_prefix + root

    scheme = (
        request.headers.get("X-Forwarded-Proto", "").split(",")[0].strip()
        or request.url.scheme
    )
    host = (
        request.headers.get("X-Forwarded-Host", "").split(",")[0].strip()
        or request.headers.get("Host")
        or request.url.netloc
    )
    return f"{scheme}://{host}{root.rstrip('/')}"


def _refused_origin(request: Request) -> bool:
    """Whether the WebSocket would refuse this request's Origin or Host.

    A web page on another origin must not drive the app through these routes
    when it could not through the socket. A non-browser client sends no Origin
    and passes; the Host allow-list (`server.allowedHosts`) applies either way.
    """
    origin = request.headers.get("Origin")
    if _is_origin_allowed(origin, request.headers.get("Host")):
        return False
    _LOGGER.warning(
        "Refusing agent API request with disallowed Origin or Host: origin=%s, host=%s",
        origin,
        request.headers.get("Host"),
    )
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
    # Media URLs are relative to the app's root, which a browser prepends and a
    # client of this API has no way to know.
    base_path = f"/{base_url.strip('/')}" if base_url and base_url.strip("/") else ""
    disabled_message = (
        "This app does not serve the agent API. Its operator can turn it on with "
        f"`server.enableAgentApi`; see {schema_path} for what it would offer."
    )
    origin_message = (
        "Requests from a web page on another origin are refused, as they are "
        "for the app's WebSocket."
    )

    async def _schema_endpoint(request: Request) -> JSONResponse:
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
                server_prefix=_server_prefix(request, schema_path),
                mcp_path=mcp_path,
            )
        )
        response.headers["Cache-Control"] = "no-cache"
        return response

    async def _run_interact(
        request: Request, payload: dict[str, Any], media_prefix: str
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
        if _refused_origin(request):
            return _error(
                "origin_not_allowed",
                origin_message,
                status=error_status("origin_not_allowed"),
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

        status, result = await _run_interact(request, payload, base_path)
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
        if _refused_origin(request):
            # The MCP transport requires this check, against DNS rebinding.
            return JSONResponse(
                mcp.error_response(None, mcp.SERVER_ERROR, origin_message),
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

        media_prefix = _absolute_app_root(request, _ROUTE_AGENT_MCP)

        async def call_interact(
            arguments: dict[str, Any],
        ) -> tuple[dict[str, Any], bool]:
            status, result = await _run_interact(request, arguments, media_prefix)
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
