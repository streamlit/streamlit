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
import logging
import time
from typing import TYPE_CHECKING, Any, Final

from streamlit import config
from streamlit.logger import get_logger
from streamlit.runtime.agent import data_access, mcp
from streamlit.runtime.agent.errors import AgentRequestError
from streamlit.runtime.agent.fork import FrozenClientContext
from streamlit.runtime.agent.interaction import (
    AgentSessionRegistry,
    interact,
    session_digest,
)
from streamlit.runtime.agent.protocol import build_openapi_document, error_status
from streamlit.runtime.agent.snapshot import rebase_media_urls
from streamlit.runtime.runtime_util import get_max_widget_state_size_bytes
from streamlit.web.server.server_util import is_allowed_origin
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

    The allow-list the WebSocket enforces. Where an operator configures one, it
    also stops DNS rebinding; `_refused_origin` stops it where they do not.
    """
    host = request.headers.get("Host")
    if _is_host_allowed(host):
        return False
    # Debug, not warning: the value is the caller's, and a warning per refused
    # request would let anyone fill the log.
    _LOGGER.debug("Refusing agent API request with disallowed Host: %r", host)
    return True


def _refused_origin(request: Request) -> bool:
    """Whether the request came from a web page the operator did not allow.

    Browsers send `Origin` on every cross-origin request and every POST, and
    agents and other programmatic clients send none, so any `Origin` not
    listed in `server.corsAllowedOrigins` is refused. This is what stops DNS
    rebinding where no Host allow-list is configured: a page whose domain was
    rebound to the app's address is same-origin with the Host it sends, which
    a same-origin rule would accept, but it still sends its own `Origin`.
    Nothing legitimate is lost: these routes send no CORS headers, so no page
    on another origin could read a response anyway.
    """
    origin = request.headers.get("Origin")
    if origin is None or is_allowed_origin(origin):
        return False
    _LOGGER.debug("Refusing agent API request from Origin %r", origin)
    return True


async def _read_body(request: Request, limit: int) -> bytes | None:
    """The request body, or None once it is larger than ``limit`` bytes.

    Checked while reading rather than after, so an oversized body is refused
    without being held in memory first.
    """
    declared = request.headers.get("Content-Length", "")
    if declared.isdigit() and int(declared) > limit:
        return None
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            return None
        chunks.append(chunk)
    return b"".join(chunks)


def _reject_constant(constant: str) -> None:
    raise json.JSONDecodeError(f"{constant} is not valid JSON", constant, 0)


def _parse_body(body: bytes) -> Any:
    """Parse a request body as strict JSON, which has no NaN or Infinity.

    Every way a body can fail to parse surfaces as ``JSONDecodeError``: the
    parser also raises plain ``ValueError`` (bytes that are not UTF-8, an
    integer longer than Python converts from text) and ``RecursionError``
    (nesting deeper than the interpreter allows).
    """
    try:
        return json.loads(body, parse_constant=_reject_constant)
    except json.JSONDecodeError:
        raise
    except (ValueError, RecursionError) as exc:
        raise json.JSONDecodeError(str(exc), "", 0) from exc


def _log_interaction(
    payload: dict[str, Any],
    session_id: Any,
    outcome: str,
    status: int,
    started: float,
) -> None:
    """Log an interaction without its content.

    What was asked for, never what was sent: the request's fields, not its
    keys or values, and a digest of the session handle, never the handle.
    """
    if not _LOGGER.isEnabledFor(logging.DEBUG):
        return
    handle = payload.get("session_id") or session_id
    session = session_digest(handle) if isinstance(handle, str) else "new"
    _LOGGER.debug(
        "Agent interaction session=%s fields=%s outcome=%s status=%d %.0fms",
        session,
        ",".join(sorted(name for name in payload if name != "session_id")) or "-",
        outcome,
        status,
        (time.monotonic() - started) * 1000,
    )


# Request headers an agent session never sees: credentials for reaching this
# endpoint, not facts about the user. The auth cookie in particular is only
# honored on the WebSocket, behind an XSRF token.
_WITHHELD_HEADERS: Final = frozenset({"cookie", "authorization"})


def _request_client_context(request: Request) -> FrozenClientContext:
    """SPIKE: the request's headers, as `st.context.headers` reads them."""
    return FrozenClientContext(
        headers=tuple(
            (name, value)
            for name, value in request.headers.items()
            if name.lower() not in _WITHHELD_HEADERS
        ),
        cookies={},
        remote_ip=request.client.host if request.client else None,
    )


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
        # Set when the remedy is a request on a session: a creating call that
        # already produced one, or a run still going after the timeout.
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
    registry = (
        AgentSessionRegistry(runtime, media_path=_MEDIA_PATH) if enabled else None
    )
    interact_path = make_url_path(base_url or "", _ROUTE_AGENT_INTERACT)
    schema_path = make_url_path(base_url or "", _ROUTE_AGENT_SCHEMA)
    mcp_path = make_url_path(base_url or "", _ROUTE_AGENT_MCP)

    # Every URL a response carries is relative to the request that returned it,
    # because a proxy that strips a path prefix before forwarding leaves the app
    # no way to see where it is (for example, Community Cloud's `/~/+/`).
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
    origin_message = (
        "This request came from a web page (it has an `Origin` header) whose "
        "origin is not in `server.corsAllowedOrigins`. Call the API from a "
        "program rather than from a page, or have the operator allow the origin."
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
        started = time.monotonic()
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
                client_context=_request_client_context(request),
            )
        except AgentRequestError as exc:
            status = error_status(exc.code)
            _log_interaction(payload, exc.session_id, exc.code, status, started)
            return status, _error_body(
                exc.code,
                exc.message,
                session_id=exc.session_id,
                details=exc.details,
            )
        except Exception:
            _LOGGER.exception("Agent API interaction failed")
            # The cause is in the server log; the response does not name it.
            return error_status("internal_error"), _error_body(
                "internal_error", "The interaction could not be completed."
            )
        _log_interaction(payload, snapshot.get("session_id"), "ok", 200, started)
        rebase_media_urls(snapshot, media_path=_MEDIA_PATH, prefix=media_prefix)
        return 200, snapshot

    def _error(code: str, message: str, *, status: int) -> JSONResponse:
        return _json_response(_error_body(code, message), status)

    def _json_response(body: dict[str, Any], status: int) -> JSONResponse:
        try:
            response = JSONResponse(body, status_code=status)
        except ValueError:
            # A value strict JSON cannot carry, such as NaN, slipped into the
            # document. Fail as an error the client can read, not a bare 500.
            _LOGGER.exception("Agent API response is not valid JSON")
            response = JSONResponse(
                _error_body(
                    "internal_error",
                    "The response could not be encoded as JSON.",
                ),
                status_code=error_status("internal_error"),
            )
        # Point a caller at the protocol description from every response,
        # errors most of all. Relative to the request, like every URL here: the
        # document sits beside the operation that answered.
        response.headers["Link"] = '<openapi.json>; rel="service-desc"'
        return response

    async def _interact_endpoint(request: Request) -> Response:
        if request.method != "POST":
            # Registered for every method so anything else is answered here.
            # Otherwise a GET falls through to the single-page-app fallback
            # wherever the app serves its own frontend, and returns the app's
            # HTML with a 200.
            return Response(status_code=405, headers={"Allow": "POST"})
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
        if _refused_origin(request):
            return _error(
                "origin_not_allowed",
                origin_message,
                status=error_status("origin_not_allowed"),
            )

        # The same bound the WebSocket handler applies to an inbound frame, so
        # the agent path is no more permissive than the browser path.
        max_request_bytes = get_max_widget_state_size_bytes()
        body = await _read_body(request, max_request_bytes)
        if body is None:
            return _error(
                "request_too_large",
                f"Request body exceeds {max_request_bytes} bytes.",
                status=error_status("request_too_large"),
            )

        try:
            payload: Any = _parse_body(body) if body.strip() else {}
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
        if _refused_origin(request):
            # The MCP transport requires servers to validate `Origin`, for the
            # same DNS-rebinding reason.
            return JSONResponse(
                mcp.error_response(None, mcp.SERVER_ERROR, origin_message),
                status_code=403,
            )
        version = request.headers.get("mcp-protocol-version")
        if version is not None and version not in mcp.SUPPORTED_PROTOCOL_VERSIONS:
            # The MCP transport requires a 400 here rather than a guess at
            # what an unknown version means.
            return JSONResponse(
                mcp.error_response(
                    None,
                    mcp.INVALID_REQUEST,
                    "Unsupported `MCP-Protocol-Version`. This server supports "
                    + ", ".join(mcp.SUPPORTED_PROTOCOL_VERSIONS)
                    + ".",
                ),
                status_code=400,
            )

        max_request_bytes = get_max_widget_state_size_bytes()
        body = await _read_body(request, max_request_bytes)
        if body is None:
            return JSONResponse(
                mcp.error_response(
                    None,
                    mcp.INVALID_REQUEST,
                    f"Request body exceeds {max_request_bytes} bytes.",
                ),
                status_code=413,
            )
        try:
            message: Any = _parse_body(body)
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
            # A run still going after the timeout (202) is not a failure: the
            # result says to call again, and the retry collects the run.
            return result, status >= 400

        def call_get_data(
            arguments: dict[str, Any],
        ) -> tuple[data_access.FileContent | dict[str, Any], bool]:
            assert registry is not None  # noqa: S101 - guarded by `enabled`
            try:
                return data_access.get_data(
                    runtime,
                    registry,
                    arguments,
                    user_info=_gather_user_info(request.headers),
                ), False
            except AgentRequestError as exc:
                return _error_body(exc.code, exc.message), True
            except Exception:
                _LOGGER.exception("Agent API get_data failed")
                return _error_body(
                    "internal_error", "The file could not be read."
                ), True

        response = await mcp.handle(message, call_interact, call_get_data)
        if response is None:
            # Only notifications, which the transport acknowledges without a body.
            return Response(status_code=202)
        try:
            return JSONResponse(response)
        except ValueError:
            _LOGGER.exception("Agent API MCP response is not valid JSON")
            return JSONResponse(
                mcp.error_response(
                    None, mcp.SERVER_ERROR, "The response could not be encoded."
                ),
                status_code=500,
            )

    return [
        Route(
            interact_path,
            _interact_endpoint,
            methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        ),
        Route(schema_path, _schema_endpoint, methods=["GET"]),
        Route(mcp_path, _mcp_endpoint, methods=["GET", "POST", "DELETE"]),
    ]
