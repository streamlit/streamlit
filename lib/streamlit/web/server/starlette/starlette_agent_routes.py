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

"""The agent API route.

``POST /_stcore/agent/interact`` drives the app for a client without a
browser. It is always registered, so a request with the API off, or with any
other method, is answered here instead of falling through to the app's HTML.
When ``server.enableAgentApi`` is on, it is served wherever the app is, to any
caller the app would serve: the WebSocket's Host allow-list applies, and the
same trusted identity headers are mapped into ``st.user``.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
from typing import TYPE_CHECKING, Any, Final, TypeVar

from streamlit import config
from streamlit.logger import get_logger
from streamlit.runtime import runtime_util
from streamlit.runtime.agent import errors, interaction, snapshot
from streamlit.web.server import server_util
from streamlit.web.server.starlette import starlette_websocket
from streamlit.web.server.starlette.starlette_routes import BASE_ROUTE_MEDIA

if TYPE_CHECKING:
    from collections.abc import Awaitable

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

# Where media storage's URLs start, relative to the app's root.
_MEDIA_PATH: Final = f"/{BASE_ROUTE_MEDIA}"

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
    "is not in `server.corsAllowedOrigins`. Call the API from a program rather "
    "than from a page, or have the operator allow the origin."
)


class _ClientGoneError(Exception):
    """The client closed the connection before its interaction settled."""


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
        document, media_path=_MEDIA_PATH, prefix=_APP_ROOT_FROM_ROUTE
    )
    return _render_json(document)


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
    """
    origin = request.headers.get("Origin")
    if origin is None or server_util.is_allowed_origin(origin):
        return False
    _LOGGER.debug("Refusing agent API request from Origin %r", origin)
    return True


async def _read_body(request: Request, limit: int) -> bytes | None:
    """The request body, or None once it is larger than ``limit`` bytes.

    Checked while reading rather than after, so an oversized body is refused
    without being held in memory first.
    """
    declared = request.headers.get("Content-Length", "")
    # Compared by length first: `int` refuses to parse thousands of digits.
    if (
        declared.isascii()
        and declared.isdigit()
        and (len(declared) > len(str(limit)) or int(declared) > limit)
    ):
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

    A client whose own timeout is shorter than `server.agentRunTimeout` would
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
    """Create the agent API route.

    Registered even when the API is off, because an unregistered path falls
    through to the single-page-app handler, which answers with the app's HTML
    and a 200.

    Parameters
    ----------
    runtime : Runtime
        The runtime agent sessions run in.
    base_url : str or None
        The ``server.baseUrlPath`` the route is served under.

    Returns
    -------
    list[BaseRoute]
        The route for ``_stcore/agent/interact``.
    """
    from starlette.requests import ClientDisconnect
    from starlette.responses import JSONResponse, Response
    from starlette.routing import Route

    from streamlit.url_util import make_url_path

    enabled = bool(config.get_option("server.enableAgentApi"))
    registry = interaction.AgentSessionRegistry(runtime) if enabled else None

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
                    runtime,
                    session_registry,
                    payload,
                    user_info=user_info,
                    headers=request.headers.items(),
                    encode=_encode_snapshot,
                ),
            )
        except _ClientGoneError:
            # Nobody reads this; the run is collectable by a retry.
            return error_response(
                "run_timed_out", "The client disconnected before the run settled."
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

    async def interact_endpoint(request: Request) -> Response:
        if request.method != "POST":
            # Registered for every method so anything else is answered here.
            # Otherwise a GET falls through to the single-page-app fallback
            # wherever the app serves its own frontend.
            return Response(status_code=405, headers={"Allow": "POST"})
        if registry is None:
            return error_response("not_available", _DISABLED_MESSAGE)
        if _refused_host(request):
            return error_response("host_not_allowed", _HOST_MESSAGE)
        if _refused_origin(request):
            return error_response("origin_not_allowed", _ORIGIN_MESSAGE)

        # The bound the WebSocket handler applies to an inbound frame, so the
        # agent path is no more permissive than the browser path.
        max_request_bytes = runtime_util.get_max_widget_state_size_bytes()
        try:
            body = await _read_body(request, max_request_bytes)
        except ClientDisconnect:
            # Nobody reads this: the client left while sending the body.
            return Response(status_code=400)
        if body is None:
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
            make_url_path(base_url or "", _ROUTE_AGENT_INTERACT),
            interact_endpoint,
            methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        )
    ]
