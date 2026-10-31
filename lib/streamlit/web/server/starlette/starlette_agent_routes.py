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

``POST /_stcore/agent/interact`` drives the app for a client without a
browser, and ``GET /_stcore/agent/openapi.json`` describes how, so a caller
that found the app can learn the protocol without being handed documentation.
Both are always registered, so a request with the API off, or with any other
method, is answered here instead of falling through to the app's HTML. With
the API off, the document only reports that. Every response from either route
carries a `Link` header to it.

When ``server.enableAgentApi`` is on, the interact route is served wherever
the app is, to any caller the app would serve: the WebSocket's Host allow-list
applies, and the same trusted identity headers are mapped into ``st.user``.
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import json
from typing import TYPE_CHECKING, Any, Final, TypeVar

from streamlit import config
from streamlit.logger import get_logger
from streamlit.runtime import runtime_util
from streamlit.runtime.agent import errors, interaction, protocol, snapshot, usage
from streamlit.web.server import server_util
from streamlit.web.server.starlette import starlette_websocket
from streamlit.web.server.starlette.starlette_routes import (
    BASE_ROUTE_APP_STATIC,
    BASE_ROUTE_MEDIA,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from starlette.requests import Request
    from starlette.responses import Response
    from starlette.routing import BaseRoute

    from streamlit.runtime.runtime import Runtime
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        UserInfoType,
    )

_LOGGER: Final = get_logger(__name__)

_T = TypeVar("_T")

_ROUTE_AGENT_INTERACT: Final = "_stcore/agent/interact"
_ROUTE_AGENT_SCHEMA: Final = "_stcore/agent/openapi.json"

# Every method a route registers, so none falls through to the static files
# mount. Starlette adds HEAD to GET.
_ROUTE_METHODS: Final = ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")

# Points a caller at the protocol's description from every response, errors
# most of all (RFC 8631). Relative to the request, like every URL here: the
# document sits beside the route that answered.
_SERVICE_DESC_LINK: Final = '<openapi.json>; rel="service-desc"'

# Where media URLs start, relative to the app's root: media storage, and the
# app's own static files, which a media element may name directly.
_MEDIA_PATHS: Final = (f"/{BASE_ROUTE_MEDIA}", f"/{BASE_ROUTE_APP_STATIC}")

# Every URL a response carries is relative to the request that returned it,
# because a proxy that strips a path prefix before forwarding leaves the app no
# way to see where it is. This climbs from the route back to the app's root.
_APP_ROOT_FROM_ROUTE: Final = "/".join([".."] * _ROUTE_AGENT_INTERACT.count("/"))

_DISABLED_MESSAGE: Final = (
    "This app does not serve the agent API. Its operator can turn it on with "
    "`server.enableAgentApi`."
)
_HOST_MESSAGE: Final = (
    "This request's Host is not in `server.allowedHosts`, which the app enforces "
    "for its WebSocket too."
)
_ORIGIN_MESSAGE: Final = (
    "This request came from a web page (it has an `Origin` header) whose origin "
    "is not in `server.corsAllowedOrigins`. Call the API from a program, which "
    "sends no `Origin` header."
)
_PAGE_CONTENT_TYPE_MESSAGE: Final = (
    "A request from a web page (it has an `Origin` header) must send "
    "`Content-Type: application/json`."
)


class _ClientGoneError(Exception):
    """The client closed the connection before its interaction settled."""


class _BodyTooLargeError(Exception):
    """The request body is larger than the route accepts."""


def _render_json(content: Any) -> bytes:
    """Render ``content`` exactly as Starlette's ``JSONResponse`` does."""
    return json.dumps(
        content,
        ensure_ascii=False,
        allow_nan=False,
        indent=None,
        separators=(",", ":"),
    ).encode("utf-8")


def _encode_snapshot(document: dict[str, Any]) -> bytes:
    """The response body for a snapshot, with media URLs relative to the request."""
    snapshot.rebase_media_urls(
        document, paths=_MEDIA_PATHS, prefix=_APP_ROOT_FROM_ROUTE
    )
    return _render_json(document)


def _relative_server_url(schema_path: str) -> str:
    """The OpenAPI document's server, relative to the document's own URL.

    The documented paths include ``server.baseUrlPath``, so the server climbs
    one ``..`` per directory of ``schema_path``, the document's served path,
    back to where those paths start. An empty segment between two slashes
    counts, as it does when a URL is resolved.
    """
    return "/".join([".."] * (schema_path.count("/") - 1))


def _with_service_desc_link(
    answer: Callable[[Request], Awaitable[Response]],
) -> Callable[[Request], Awaitable[Response]]:
    """Wrap a route's endpoint so every response it gives links the description.

    Set here rather than where each response is built, so no branch, such as a
    405 or a disconnect, can leave it out.
    """

    @functools.wraps(answer)
    async def endpoint(request: Request) -> Response:
        response = await answer(request)
        response.headers["Link"] = _SERVICE_DESC_LINK
        return response

    return endpoint


def _refused_host(request: Request) -> bool:
    """Whether the request's Host is outside `server.allowedHosts`.

    The allow-list the WebSocket enforces. Where an operator configures one, it
    also stops DNS rebinding; `_refused_origin` stops it where they do not.
    """
    host = request.headers.get("Host")
    if starlette_websocket.is_host_allowed(host):
        return False
    # Debug, not warning: the value is the caller's, and a warning per refused
    # request would let anyone fill the log.
    _LOGGER.debug("Refusing agent API request with disallowed Host: %r", host)
    return True


def _refused_origin(request: Request) -> bool:
    """Whether the request came from a web page the operator did not allow.

    Browsers send `Origin` on every cross-origin request and every POST, and
    agents and other programmatic clients send none, so any `Origin` not
    listed in `server.corsAllowedOrigins` is refused, same-origin included.
    This is what stops DNS rebinding where no Host allow-list is configured: a
    page whose domain was rebound to the app's address is same-origin with the
    Host it sends, but it still sends its own `Origin`. Nothing legitimate is
    lost: this route sends no CORS headers, so no page on another origin could
    read a response anyway.

    The WebSocket's Origin check is not reused because it admits same-origin
    requests, and every origin when `server.enableCORS` is off.
    """
    origin = request.headers.get("Origin")
    if origin is None or server_util.is_allowed_origin(origin):
        return False
    _LOGGER.debug("Refusing agent API request from Origin %r", origin)
    return True


def _page_request_without_json(request: Request) -> bool:
    """Whether a web page sent the request without a JSON media type.

    A page on a listed origin gets this far. With `application/json` its
    browser sends a preflight first, which this route refuses, so a page on
    another origin cannot reach it. Without it, as `text/plain`, a form
    encoding, or an empty body, the browser sends the request as is: the page
    could run the app even though it cannot read the answer. Programmatic
    clients send no `Origin`, so this never applies to them.
    """
    if request.headers.get("Origin") is None:
        return False
    content_type = request.headers.get("Content-Type", "")
    return content_type.split(";", 1)[0].strip().lower() != "application/json"


def _refusal_before_body(request: Request) -> tuple[errors.AgentErrorCode, str] | None:
    """The code and message to refuse ``request`` with before reading its body.

    ``None`` when the request passes the Host, Origin and content-type checks.
    Both the on and off paths run it, so with the API off only a request the
    on path would pass is counted.
    """
    if _refused_host(request):
        return "host_not_allowed", _HOST_MESSAGE
    if _refused_origin(request):
        return "origin_not_allowed", _ORIGIN_MESSAGE
    if _page_request_without_json(request):
        return "invalid_request", _PAGE_CONTENT_TYPE_MESSAGE
    return None


async def _read_body(request: Request, limit: int) -> bytes:
    """The request body, which is empty when the client sent none.

    Checked while reading rather than after, so an oversized body is refused
    without being held in memory first.

    Raises
    ------
    _BodyTooLargeError
        Once the body is larger than ``limit`` bytes.
    """
    declared = request.headers.get("Content-Length", "")
    # Compared by length first: `int` refuses to parse thousands of digits.
    if (
        declared.isascii()
        and declared.isdigit()
        and (len(declared) > len(str(limit)) or int(declared) > limit)
    ):
        raise _BodyTooLargeError
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise _BodyTooLargeError
        chunks.append(chunk)
    return b"".join(chunks)


def _reject_constant(constant: str) -> None:
    """Refuse NaN and Infinity, which Python's json module accepts but JSON does not."""
    raise json.JSONDecodeError(f"{constant} is not valid JSON", constant, 0)


def _parse_body(body: bytes) -> Any:
    """Parse a request body as strict JSON, which has no NaN or Infinity.

    An empty or whitespace-only body is an empty request, ``{}``.

    Raises
    ------
    ValueError
        With a short reason, for every body that is not strict JSON. Besides
        malformed JSON, that is bytes that are not UTF-8, an integer longer
        than Python converts from text, and nesting deeper than the
        interpreter allows.
    """
    if not body.strip():
        return {}
    try:
        # Decoded first: `json.loads` would also accept bytes in UTF-16 or
        # UTF-32, and surrogates encoded as UTF-8.
        return json.loads(body.decode("utf-8"), parse_constant=_reject_constant)
    except UnicodeDecodeError as exc:
        raise ValueError("it is not UTF-8") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(exc.msg) from exc
    except RecursionError as exc:
        raise ValueError("it is nested too deeply") from exc
    except ValueError as exc:
        raise ValueError("it holds an integer too long to read") from exc


async def _until_disconnected(request: Request) -> None:
    """Return once the client has closed the connection.

    Only awaited after the body has been read, so the next message the server
    delivers for this request is the disconnect.
    """
    while (await request.receive())["type"] != "http.disconnect":
        pass


async def _unless_disconnected(request: Request, work: Awaitable[_T]) -> _T:
    """Await ``work``, cancelling it as soon as the client has gone away.

    A client whose own timeout is shorter than `server.agentWaitTimeout` would
    otherwise leave its interaction in flight until the server's timeout, so its
    retry is told the session is busy. Cancelling turns the wait into a
    timed-out run, which the retry collects.
    """
    task = asyncio.ensure_future(work)
    disconnected = asyncio.ensure_future(_until_disconnected(request))
    try:
        await asyncio.wait({task, disconnected}, return_when=asyncio.FIRST_COMPLETED)
    except asyncio.CancelledError:
        task.cancel()
        raise
    finally:
        disconnected.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await disconnected
    if task.done():
        return task.result()
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
    raise _ClientGoneError


def create_agent_routes(runtime: Runtime, base_url: str | None) -> list[BaseRoute]:
    """Create the agent API routes.

    Both are registered even when the API is off. The app's HTML links to the
    schema path, and an unregistered path falls through to the single-page-app
    handler, which answers with the app's HTML and a 200, so following the link
    would read as success. Answered here instead, the link is never a dead end,
    and turning the API on needs no change to any cached HTML.

    Parameters
    ----------
    runtime : Runtime
        The runtime agent sessions run in.
    base_url : str or None
        The ``server.baseUrlPath`` the routes are served under.

    Returns
    -------
    list[BaseRoute]
        The routes for ``_stcore/agent/interact`` and
        ``_stcore/agent/openapi.json``.
    """
    from starlette.requests import ClientDisconnect
    from starlette.responses import JSONResponse, Response
    from starlette.routing import Route

    from streamlit.url_util import make_url_path

    enabled = bool(config.get_option("server.enableAgentApi"))
    registry = interaction.AgentSessionRegistry(runtime) if enabled else None
    interact_path = make_url_path(base_url or "", _ROUTE_AGENT_INTERACT)
    schema_path = make_url_path(base_url or "", _ROUTE_AGENT_SCHEMA)

    # Built on the first request so an app that never serves it pays nothing,
    # then cached: it depends only on `enabled`, read once above, and on the
    # installed release.
    @functools.cache
    def schema_body() -> bytes:
        return _render_json(
            protocol.build_openapi_document(
                interact_path=interact_path,
                schema_path=schema_path,
                server_url=_relative_server_url(schema_path),
                enabled=enabled,
            )
        )

    def error_response(
        code: errors.AgentErrorCode,
        message: str,
        *,
        session_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> Response:
        body: dict[str, Any] = {"error": {"code": code, "message": message}}
        if details:
            body["error"].update(details)
        if session_id is not None:
            # Set when the remedy is a request on a session: a creating call
            # that already produced one, or a run still going after the timeout.
            body["session_id"] = session_id
        return JSONResponse(body, status_code=errors.error_status(code))

    async def run_interaction(
        request: Request,
        session_registry: interaction.AgentSessionRegistry,
        payload: dict[str, Any],
    ) -> Response:
        # The same trusted headers the WebSocket maps for a browser. Never the
        # auth cookie: it is only honored on the WebSocket behind an XSRF token,
        # which a cross-site request here could otherwise ride.
        user_info: UserInfoType = {
            **starlette_websocket.gather_user_info(request.headers)
        }
        try:
            body = await _unless_disconnected(
                request,
                interaction.interact(
                    session_registry,
                    payload,
                    transport="http",
                    user_info=user_info,
                    headers=request.headers.items(),
                    encode=_encode_snapshot,
                ),
            )
        except _ClientGoneError:
            # Nobody reads this. A retry collects the run of a session the
            # client already held; a creating call's session is closed instead,
            # since the client never received its `session_id`.
            return error_response(
                "wait_timed_out", "The client disconnected before the run settled."
            )
        except errors.AgentRequestError as exc:
            return error_response(
                exc.code,
                exc.message,
                session_id=exc.session_id,
                details=exc.details,
            )
        except Exception:
            _LOGGER.exception("Agent API interaction failed.")
            # The cause is in the server log; the response does not name it.
            return error_response(
                "internal_error", "The interaction could not be completed."
            )
        return Response(body, media_type="application/json")

    async def answer_schema(request: Request) -> Response:  # noqa: RUF029 - endpoints are async
        """Serve the OpenAPI document, whether or not the API is on.

        It is documentation rather than access, so none of the interact
        route's checks apply, as none apply to the app's own HTML. A caller
        that followed the app's link is better told what this is and whether
        it is on than refused without a reason.
        """
        if request.method not in {"GET", "HEAD"}:
            # Registered for every method, as the interact route is, so the
            # static files mount never answers here with its own 405, which
            # carries no `Link` and exists only where the app serves its
            # frontend.
            return Response(status_code=405, headers={"Allow": "GET, HEAD"})
        return Response(
            schema_body(),
            media_type="application/json",
            # Revalidated, since the document changes when the API is turned
            # on and with each release.
            headers={"Cache-Control": "no-cache"},
        )

    async def answer_interact(request: Request) -> Response:
        if request.method != "POST":
            # Registered for every method so every other one is refused here.
            # Otherwise the static files mount would answer: a GET or HEAD
            # with the app's HTML and a 200, anything else with a 405 that
            # names GET as allowed.
            return Response(status_code=405, headers={"Allow": "POST"})
        refusal = _refusal_before_body(request)
        if registry is None:
            # Count only a request that passes the checks: a web page or a
            # refused Host is not an agent. The answer is `not_available`
            # either way, and the body is never read.
            if refusal is None:
                usage.record_interaction("http")
            return error_response("not_available", _DISABLED_MESSAGE)
        if refusal is not None:
            return error_response(*refusal)

        # The bound the WebSocket handler applies to an inbound frame, so the
        # agent path is no more permissive than the browser path.
        max_request_bytes = runtime_util.get_max_widget_state_size_bytes()
        try:
            body = await _read_body(request, max_request_bytes)
        except ClientDisconnect:
            # Nobody reads this: the client left while sending the body.
            return Response(status_code=400)
        except _BodyTooLargeError:
            return error_response(
                "request_too_large",
                f"The request body exceeds {max_request_bytes} bytes.",
            )
        try:
            # Off the event loop, since a body can be as large as a message
            # from the browser and parsing it would stall every session.
            payload = await asyncio.to_thread(_parse_body, body)
        except ValueError as exc:
            return error_response(
                "invalid_request", f"The body is not valid JSON: {exc}."
            )
        if not isinstance(payload, dict):
            return error_response("invalid_request", "The body must be a JSON object.")

        return await run_interaction(request, registry, payload)

    return [
        Route(
            interact_path,
            _with_service_desc_link(answer_interact),
            methods=_ROUTE_METHODS,
        ),
        Route(
            schema_path,
            _with_service_desc_link(answer_schema),
            methods=_ROUTE_METHODS,
        ),
    ]
