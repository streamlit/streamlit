# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Starlette application usable as alternative to Tornado."""

from __future__ import annotations

import asyncio
import binascii
import json
import os
from contextlib import suppress
from pathlib import Path
from shlex import quote
from typing import TYPE_CHECKING, Any, Final
from urllib.parse import urlparse

from streamlit import config, file_util
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.runtime.media_file_storage import MediaFileKind, MediaFileStorageError
from streamlit.runtime.memory_media_file_storage import (
    MemoryMediaFileStorage,
    get_extension_for_mimetype,
)
from streamlit.runtime.runtime_util import serialize_forward_msg
from streamlit.runtime.session_manager import (
    SessionClient,
    SessionClientDisconnectedError,
)
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from streamlit.web.server.app_static_file_handler import (
    MAX_APP_STATIC_FILE_SIZE,
    SAFE_APP_STATIC_FILE_EXTENSIONS,
)
from streamlit.web.server.component_file_utils import (
    build_safe_abspath,
    guess_content_type,
)
from streamlit.web.server.routes import (
    _DEFAULT_ALLOWED_MESSAGE_ORIGINS,
    NO_CACHE_PATTERN,
    STATIC_ASSET_CACHE_MAX_AGE_SECONDS,
    allow_all_cross_origin_requests,
    is_allowed_origin,
)
from streamlit.web.server.server_util import get_cookie_secret, get_url, is_xsrf_enabled
from streamlit.web.server.starlette import starlette_app_utils
from streamlit.web.server.stats_request_handler import StatsRequestHandler

if TYPE_CHECKING:
    from collections.abc import MutableMapping

    from starlette.applications import Starlette
    from starlette.datastructures import Headers
    from starlette.requests import Request
    from starlette.responses import Response
    from starlette.websockets import WebSocket

    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
    from streamlit.runtime import Runtime
    from streamlit.runtime.media_file_manager import MediaFileManager
    from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager

_LOGGER = get_logger(__name__)
_RESERVED_STATIC_PATH_SUFFIXES: Final = ("_stcore/health", "_stcore/host-config")


def _with_base(path: str, base_url: str | None = None) -> str:
    base = (
        base_url if base_url is not None else config.get_option("server.baseUrlPath")
    ) or ""
    base = base.strip("/")
    if base:
        return f"/{base}/{path.lstrip('/')}"
    return f"/{path.lstrip('/')}"


async def _set_cors_headers(request: Request, response: Response) -> None:
    if allow_all_cross_origin_requests():
        response.headers["Access-Control-Allow-Origin"] = "*"
        return

    origin = request.headers.get("Origin")
    if origin and is_allowed_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin


def _parse_subprotocols(
    headers: Headers,
) -> tuple[str | None, str | None, str | None]:
    """Parse the Sec-WebSocket-Protocol header.

    Returns a tuple of (selected_subprotocol, xsrf_token, existing_session_id).

    The subprotocol header is repurposed to pass tokens from client to server:
    - First entry: subprotocol to select (e.g., "streamlit")
    - Second entry: XSRF token for authentication validation
    - Third entry: existing session ID for reconnection
    """
    raw = headers.get("sec-websocket-protocol")
    if not raw:
        return None, None, None

    entries = [value.strip() for value in raw.split(",") if value.strip()]
    selected = entries[0] if entries else None
    xsrf_token = entries[1] if len(entries) >= 2 else None
    existing_session = entries[2] if len(entries) >= 3 else None
    return selected, xsrf_token, existing_session


def _gather_user_info(headers: Headers) -> dict[str, str | bool | None]:
    user_info: dict[str, str | bool | None] = {}
    mapping = config.get_option("server.trustedUserHeaders")
    if not isinstance(mapping, dict):
        return user_info

    for header_name, user_key in mapping.items():
        values = headers.getlist(header_name)
        user_info[user_key] = values[0] if values else None
    return user_info


def _validate_xsrf_token(supplied_token: str | None, xsrf_cookie: str | None) -> bool:
    """Validate the XSRF token from the WebSocket subprotocol against the cookie.

    This mirrors Tornado's XSRF validation logic to ensure the frontend can share
    XSRF logic between WebSocket handshake and HTTP uploads regardless of backend.
    """
    import hmac

    if not supplied_token or not xsrf_cookie:
        return False

    # Decode the supplied token from the subprotocol
    supplied_token_bytes, _ = starlette_app_utils.decode_xsrf_token_string(
        supplied_token
    )
    # Decode the expected token from the cookie
    expected_token_bytes, _ = starlette_app_utils.decode_xsrf_token_string(xsrf_cookie)

    if not supplied_token_bytes or not expected_token_bytes:
        return False

    return hmac.compare_digest(supplied_token_bytes, expected_token_bytes)


def _ensure_xsrf_cookie(request: Request, response: Response) -> None:
    """Ensure that the XSRF cookie is set.

    We manually manage XSRF generation and validation here to strictly match
    Tornado's implementation and cookie format. This allows the frontend to share
    XSRF logic between the WebSocket handshake and HTTP uploads regardless of the backend.
    """
    if not is_xsrf_enabled():
        return

    cookie_name = "_streamlit_xsrf"
    raw_cookie = request.cookies.get(cookie_name)
    token_bytes: bytes | None = None
    timestamp: int | None = None
    if raw_cookie:
        token_bytes, timestamp = starlette_app_utils.decode_xsrf_token_string(
            raw_cookie
        )

    # If we're missing a valid token or timestamp, generate a new one.
    # Note: we don't re-use the timestamp from the cookie if it's valid;
    # we let generate_xsrf_token_string handle creating a new one if needed,
    # OR we pass it through.
    # However, standard behavior is usually to refresh the mask even if the token
    # is the same.
    # If we have a valid token_bytes, we can re-use it to avoid invalidating
    # existing forms, but we should probably generate a new masked string.

    # Logic from original implementation:
    # If raw_cookie was valid, we got token_bytes and timestamp.
    # If not, we generate new ones.

    # We'll let the utility function handle the generation.
    # If token_bytes is None, it generates new random bytes.
    # If timestamp is None, it uses current time.

    cookie_value = starlette_app_utils.generate_xsrf_token_string(
        token_bytes, timestamp
    )

    _set_unquoted_cookie(
        response,
        cookie_name,
        cookie_value,
        secure=bool(config.get_option("server.sslCertFile")),
    )


def _set_unquoted_cookie(
    response: Response,
    cookie_name: str,
    cookie_value: str,
    *,
    secure: bool,
) -> None:
    header_value = "; ".join(
        [
            f"{cookie_name}={cookie_value}",
            "Path=/",
            "SameSite=Lax",
            *(["Secure"] if secure else []),
        ]
    )

    key_prefix = f"{cookie_name}=".encode("latin-1")
    filtered_headers: list[tuple[bytes, bytes]] = [
        (name, value)
        for name, value in response.raw_headers
        if not (
            name.lower() == b"set-cookie"
            and value.lower().startswith(key_prefix.lower())
        )
    ]
    filtered_headers.append((b"set-cookie", header_value.encode("latin-1")))
    response.raw_headers = filtered_headers


def _parse_user_cookie_signed(cookie_value: str | bytes, origin: str) -> dict[str, Any]:
    secret = get_cookie_secret()
    signed_value = cookie_value
    if isinstance(signed_value, str):
        signed_value = signed_value.encode("latin-1")

    decoded = starlette_app_utils.decode_signed_value(
        secret, "_streamlit_user", signed_value
    )
    if decoded is None:
        return {}

    try:
        payload = json.loads(decoded.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        _LOGGER.exception("Error decoding auth cookie payload")
        return {}

    parsed_origin = urlparse(origin)
    if not parsed_origin.scheme or not parsed_origin.netloc:
        return {}
    expected_origin = f"{parsed_origin.scheme}://{parsed_origin.netloc}"
    cookie_origin = payload.get("origin")
    if cookie_origin != expected_origin:
        _LOGGER.error(
            "Origin mismatch, the origin of websocket request is not the "
            "same origin of redirect_uri in secrets.toml",
        )
        return {}
    user_info = {"is_logged_in": payload.get("is_logged_in", False)}
    payload.pop("origin", None)
    payload.pop("is_logged_in", None)
    user_info.update(payload)
    return user_info


class _StarletteSessionClient(SessionClient):
    def __init__(self, websocket: WebSocket) -> None:
        self._websocket = websocket
        self._send_queue: asyncio.Queue[bytes] = asyncio.Queue()
        self._sender_task = asyncio.create_task(
            self._sender(), name="starlette-ws-send"
        )
        self._closed = asyncio.Event()

    async def _sender(self) -> None:
        """Background task to drain the send_queue and write to the WebSocket.

        This decouples the message generation (which puts into the queue) from the
        actual network I/O, allowing for non-blocking sends from the main thread.
        """
        from starlette.websockets import WebSocketDisconnect

        try:
            while True:
                payload = await self._send_queue.get()
                await self._websocket.send_bytes(payload)
        except WebSocketDisconnect:
            pass
        except Exception:
            _LOGGER.exception("Error sending websocket payload")
        finally:
            self._closed.set()

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        if self._closed.is_set():
            raise SessionClientDisconnectedError

        payload = serialize_forward_msg(msg)
        try:
            self._send_queue.put_nowait(payload)
        except asyncio.QueueFull as exc:  # pragma: no cover - defensive
            self._closed.set()
            raise SessionClientDisconnectedError from exc

    async def aclose(self) -> None:
        self._closed.set()
        self._sender_task.cancel()
        with suppress(asyncio.CancelledError):
            await self._sender_task


def create_starlette_app(runtime: Runtime) -> Starlette:
    try:
        import anyio
        from starlette.applications import Starlette
        from starlette.datastructures import UploadFile
        from starlette.exceptions import HTTPException
        from starlette.middleware.sessions import SessionMiddleware
        from starlette.responses import (
            FileResponse,
            JSONResponse,
            PlainTextResponse,
            Response,
            StreamingResponse,
        )
        from starlette.routing import Mount, Route, WebSocketRoute
        from starlette.staticfiles import StaticFiles
        from starlette.websockets import WebSocketDisconnect
    except ModuleNotFoundError as exc:  # pragma: no cover - import guard
        raise RuntimeError(
            "Starlette is not installed. Run `pip install streamlit[starlette]` or disable `server.useStarlette`."
        ) from exc

    # Mirror the Tornado StaticFileHandler behavior so the migration does not
    # change how unknown routes or cache headers behave.
    # This is critical for SPA fallback (serving index.html on 404s) and long-term caching of hashed assets.
    class _StreamlitStaticFiles(StaticFiles):
        def __init__(self, directory: str, base_url: str | None) -> None:
            super().__init__(directory=directory, html=True)
            self._base_url = (base_url or "").strip("/")
            self._index_path = os.path.join(directory, "index.html")

        async def get_response(
            self, path: str, scope: MutableMapping[str, Any]
        ) -> Response:
            served_path = path
            try:
                response = await super().get_response(path, scope)
            except HTTPException as exc:
                if exc.status_code != 404 or self._is_reserved(scope["path"]):
                    raise
                response = FileResponse(self._index_path)
                served_path = "index.html"

            self._apply_cache_headers(response, served_path)
            return response

        def _is_reserved(self, request_path: str) -> bool:
            normalized = request_path.split("?", 1)[0].strip("/")
            if self._base_url and normalized.startswith(self._base_url):
                normalized = normalized[len(self._base_url) :].strip("/")
            return any(
                normalized.endswith(suffix) for suffix in _RESERVED_STATIC_PATH_SUFFIXES
            )

        def _apply_cache_headers(self, response: Response, served_path: str) -> None:
            if response.status_code in {301, 302, 303, 304, 307, 308}:
                return

            normalized = served_path.replace("\\", "/").lstrip("./")
            # Tornado marks HTML/manifest assets as no-cache but lets hashed bundles
            # live in cache. Keep that contract to avoid churning snapshots or CDNs.
            cache_value = (
                "no-cache"
                if not normalized or NO_CACHE_PATTERN.search(normalized)
                else f"public, immutable, max-age={STATIC_ASSET_CACHE_MAX_AGE_SECONDS}"
            )
            response.headers["Cache-Control"] = cache_value

    routes: list[Any] = []
    media_manager: MediaFileManager = runtime.media_file_mgr
    upload_mgr: MemoryUploadedFileManager = runtime.uploaded_file_mgr  # type: ignore
    media_storage: MemoryMediaFileStorage = media_manager._storage  # type: ignore
    component_registry = runtime.component_registry
    bidi_component_manager = runtime.bidi_component_registry
    base_url = config.get_option("server.baseUrlPath")
    dev_mode = bool(config.get_option("global.developmentMode"))

    try:
        from streamlit.web.server.starlette.starlette_auth_routes import get_auth_routes

        routes.extend(get_auth_routes(base_url))
    except ModuleNotFoundError:  # pragma: no cover - auth optional
        pass

    async def _health_endpoint(request: Request) -> PlainTextResponse:
        ok, message = await runtime.is_ready_for_browser_connection
        status = 200 if ok else 503
        response = PlainTextResponse(message, status_code=status)
        response.headers["Cache-Control"] = "no-cache"
        await _set_cors_headers(request, response)
        _ensure_xsrf_cookie(request, response)
        if "_stcore/" not in request.url.path:
            response.headers["Deprecation"] = "true"
            response.headers["Link"] = (
                f'<{_with_base("_stcore/health", base_url)}>; rel="alternate"'
            )
        return response

    async def _script_health_endpoint(request: Request) -> PlainTextResponse:
        ok, message = await runtime.does_script_run_without_error()
        status = 200 if ok else 503
        response = PlainTextResponse(message, status_code=status)
        response.headers["Cache-Control"] = "no-cache"
        await _set_cors_headers(request, response)
        _ensure_xsrf_cookie(request, response)
        if "_stcore/" not in request.url.path:
            response.headers["Deprecation"] = "true"
            response.headers["Link"] = (
                f'<{_with_base("_stcore/script-health-check", base_url)}>; rel="alternate"'
            )
        return response

    async def _health_options(request: Request) -> Response:
        response = Response(status_code=204)
        response.headers["Cache-Control"] = "no-cache"
        await _set_cors_headers(request, response)
        return response

    async def _metrics_endpoint(request: Request) -> Response:
        stats = runtime.stats_mgr.get_stats()
        accept = request.headers.get("Accept", "")
        if "application/x-protobuf" in accept:
            payload = StatsRequestHandler._stats_to_proto(stats).SerializeToString()
            response = Response(payload, media_type="application/x-protobuf")
        else:
            text = StatsRequestHandler._stats_to_text(stats)
            response = PlainTextResponse(
                text, media_type="application/openmetrics-text"
            )
        await _set_cors_headers(request, response)
        if "_stcore/" not in request.url.path:
            response.headers["Deprecation"] = "true"
            response.headers["Link"] = (
                f'<{_with_base("_stcore/metrics", base_url)}>; rel="alternate"'
            )
        return response

    async def _host_config_endpoint(request: Request) -> JSONResponse:
        allowed = list(_DEFAULT_ALLOWED_MESSAGE_ORIGINS)
        if (
            config.get_option("global.developmentMode")
            and "http://localhost" not in allowed
        ):
            allowed.append("http://localhost")

        response = JSONResponse(
            {
                "allowedOrigins": allowed,
                "useExternalAuthToken": False,
                "enableCustomParentMessages": False,
                "enforceDownloadInNewTab": False,
                "metricsUrl": "",
                "blockErrorDialogs": False,
                "resourceCrossOriginMode": None,
            }
        )
        await _set_cors_headers(request, response)
        response.headers["Cache-Control"] = "no-cache"
        return response

    async def _websocket_endpoint(websocket: WebSocket) -> None:
        subprotocol, xsrf_token, existing_session_id = _parse_subprotocols(
            websocket.headers
        )
        await websocket.accept(subprotocol=subprotocol)

        client = _StarletteSessionClient(websocket)
        session_id: str | None = None
        user_info = _gather_user_info(websocket.headers)
        if is_xsrf_enabled():
            auth_cookie = websocket.cookies.get("_streamlit_user")
            xsrf_cookie = websocket.cookies.get("_streamlit_xsrf")
            origin_header = websocket.headers.get("Origin")

            # Validate XSRF token before parsing auth cookie (matches Tornado behavior)
            if (
                auth_cookie
                and origin_header
                and _validate_xsrf_token(xsrf_token, xsrf_cookie)
            ):
                try:
                    user_info.update(
                        _parse_user_cookie_signed(auth_cookie, origin_header)
                    )
                except Exception:  # pragma: no cover - defensive
                    _LOGGER.exception("Error parsing auth cookie for websocket")

        try:
            session_id = runtime.connect_session(
                client=client,
                user_info=user_info,
                existing_session_id=existing_session_id,
            )

            while True:
                try:
                    data = await websocket.receive_bytes()
                except WebSocketDisconnect:
                    break
                except RuntimeError:
                    # Starlette raises RuntimeError when a text frame is received by receive_bytes.
                    # Streamlit strictly uses binary protobufs for communication.
                    # We reject text frames to enforce the protocol and prevent ambiguity.
                    await websocket.close()
                    raise TypeError(
                        "WebSocket text frames are not supported; expected binary protobufs."
                    )

                back_msg = BackMsg()
                try:
                    back_msg.ParseFromString(data)
                except Exception as exc:
                    _LOGGER.exception("Error deserializing back message")
                    if session_id is not None:
                        runtime.handle_backmsg_deserialization_exception(
                            session_id, exc
                        )
                    continue

                msg_type = back_msg.WhichOneof("type")

                # "debug_disconnect_websocket" and "debug_shutdown_runtime" are special
                # developmentMode-only messages used in e2e tests to test reconnect
                # handling and disabling widgets.
                if msg_type == "debug_disconnect_websocket":
                    if config.get_option("global.developmentMode") or config.get_option(
                        "global.e2eTest"
                    ):
                        await websocket.close()
                        break
                    _LOGGER.warning(
                        "Client tried to disconnect websocket when not in "
                        "development mode or e2e testing."
                    )
                    continue
                if msg_type == "debug_shutdown_runtime":
                    if config.get_option("global.developmentMode") or config.get_option(
                        "global.e2eTest"
                    ):
                        runtime.stop()
                        break
                    _LOGGER.warning(
                        "Client tried to shut down runtime when not in "
                        "development mode or e2e testing."
                    )
                    continue

                runtime.handle_backmsg(session_id, back_msg)

        except WebSocketDisconnect:
            # The websocket was closed by the client,
            # we are handling it in the finally block.
            pass
        finally:
            if session_id is not None:
                runtime.disconnect_session(session_id)
            await client.aclose()

    async def _media_endpoint(request: Request) -> Response:
        file_id = request.path_params["file_id"]

        try:
            media_file = media_storage.get_file(file_id)
        except MediaFileStorageError as exc:
            raise HTTPException(status_code=404, detail="File not found") from exc

        headers: dict[str, str] = {"X-Content-Type-Options": "nosniff"}

        if media_file.kind == MediaFileKind.DOWNLOADABLE:
            filename = media_file.filename
            if not filename:
                filename = f"streamlit_download{get_extension_for_mimetype(media_file.mimetype)}"
            try:
                filename.encode("latin1")
                disposition = f'filename="{filename}"'
            except UnicodeEncodeError:
                disposition = f"filename*=utf-8''{quote(filename)}"
            headers["Content-Disposition"] = f"attachment; {disposition}"

        # Ensure support for range requests (e.g. for video files)
        headers["Accept-Ranges"] = "bytes"
        content = media_file.content
        content_length = len(content)
        status_code = 200
        range_header = request.headers.get("range")
        if range_header:
            try:
                range_start, range_end = starlette_app_utils.parse_range_header(
                    range_header, content_length
                )
            except ValueError:
                raise HTTPException(
                    status_code=416,
                    detail="Invalid range",
                    headers={"Content-Range": f"bytes */{content_length}"},
                )
            status_code = 206
            content = content[range_start : range_end + 1]
            headers["Content-Range"] = (
                f"bytes {range_start}-{range_end}/{content_length}"
            )
            headers["Content-Length"] = str(len(content))
        else:
            headers["Content-Length"] = str(content_length)

        response = Response(
            content,
            status_code=status_code,
            media_type=media_file.mimetype or "text/plain",
            headers=headers,
        )
        await _set_cors_headers(request, response)
        return response

    async def _media_options(request: Request) -> Response:
        response = Response(status_code=204)
        await _set_cors_headers(request, response)
        return response

    async def _set_upload_headers(request: Request, response: Response) -> None:
        response.headers["Access-Control-Allow-Methods"] = "PUT, OPTIONS, DELETE"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        if is_xsrf_enabled():
            response.headers["Access-Control-Allow-Origin"] = get_url(
                config.get_option("browser.serverAddress")
            )
            response.headers["Access-Control-Allow-Headers"] = (
                "X-Xsrftoken, Content-Type"
            )
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Credentials"] = "true"
        else:
            await _set_cors_headers(request, response)

    async def _upload_options(request: Request) -> Response:
        response = Response(status_code=204)
        await _set_upload_headers(request, response)
        return response

    async def _upload_put(request: Request) -> Response:
        session_id = request.path_params["session_id"]
        file_id = request.path_params["file_id"]

        if not runtime.is_active_session(session_id):
            raise HTTPException(status_code=400, detail="Invalid session_id")

        form = await request.form()
        uploads = [value for value in form.values() if isinstance(value, UploadFile)]

        if len(uploads) != 1:
            raise HTTPException(
                status_code=400, detail=f"Expected 1 file, but got {len(uploads)}"
            )

        max_size_mb = config.get_option("server.maxUploadSize")
        max_size_bytes = max_size_mb * 1024 * 1024

        # 1. Fast fail via header (if present)
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > max_size_bytes:
            raise HTTPException(status_code=413, detail="File too large")

        upload = uploads[0]

        # 2. Check actual file size (python-multipart spools to disk, so we can check size before reading into RAM)
        # If the underlying file is spooled/on-disk, we can check its size without loading it all.
        # This prevents MemoryErrors if a user uploads a huge file that bypasses the Nginx/ingress limit.
        upload.file.seek(0, 2)  # Seek to end
        size = upload.file.tell()
        upload.file.seek(0)  # Reset
        if size > max_size_bytes:
            raise HTTPException(status_code=413, detail="File too large")

        data = await upload.read()
        upload.file.close()

        upload_mgr.add_file(
            session_id=session_id,
            file=UploadedFileRec(
                file_id=file_id,
                name=upload.filename or "",
                type=upload.content_type or "application/octet-stream",
                data=data,
            ),
        )

        response = Response(status_code=204)
        await _set_upload_headers(request, response)
        return response

    async def _upload_delete(request: Request) -> Response:
        session_id = request.path_params["session_id"]
        file_id = request.path_params["file_id"]

        upload_mgr.remove_file(session_id=session_id, file_id=file_id)
        response = Response(status_code=204)
        await _set_upload_headers(request, response)
        return response

    async def _component_endpoint(request: Request) -> Response:
        path = request.path_params["path"]
        parts = path.split("/", maxsplit=1)

        if len(parts) == 0 or not parts[0]:
            raise HTTPException(status_code=404, detail="Component not found")

        component_name = parts[0]
        filename = parts[1] if len(parts) == 2 else ""

        component_root = component_registry.get_component_path(component_name)
        if component_root is None:
            raise HTTPException(status_code=404, detail="Component not found")

        component_root = os.path.realpath(component_root)
        abspath = os.path.normpath(os.path.join(component_root, filename))

        if os.path.commonpath([component_root, abspath]) != component_root:
            raise HTTPException(status_code=403, detail="Forbidden")

        try:
            async with await anyio.open_file(abspath, "rb") as file:
                data = await file.read()
        except OSError as exc:
            raise HTTPException(status_code=404, detail="read error") from exc

        response = StreamingResponse(
            iter([data]), media_type=guess_content_type(abspath)
        )
        await _set_cors_headers(request, response)

        if not filename or filename.endswith(".html"):
            response.headers["Cache-Control"] = "no-cache"
        else:
            response.headers["Cache-Control"] = "public"

        return response

    async def _bidi_component_endpoint(request: Request) -> Response:
        async def _text_response(body: str, status_code: int) -> PlainTextResponse:
            response = PlainTextResponse(body, status_code=status_code)
            await _set_cors_headers(request, response)
            return response

        path = request.path_params["path"]
        parts = path.split("/")
        component_name = parts[0] if parts else ""
        if not component_name:
            return await _text_response("not found", 404)

        if bidi_component_manager.get(component_name) is None:
            return await _text_response("not found", 404)

        component_root = bidi_component_manager.get_component_path(component_name)
        if component_root is None:
            return await _text_response("not found", 404)

        filename = "/".join(parts[1:])
        if not filename or filename.endswith("/"):
            return await _text_response("not found", 404)

        abspath = build_safe_abspath(component_root, filename)
        if abspath is None:
            return await _text_response("forbidden", 403)

        if os.path.isdir(abspath):
            return await _text_response("not found", 404)

        try:
            async with await anyio.open_file(abspath, "rb") as file:
                data = await file.read()
        except OSError:
            sanitized_abspath = abspath.replace("\n", "").replace("\r", "")
            _LOGGER.exception(
                "Error reading bidi component asset: %s", sanitized_abspath
            )
            return await _text_response("read error", 404)

        response = StreamingResponse(
            iter([data]), media_type=guess_content_type(abspath)
        )
        await _set_cors_headers(request, response)

        if filename.endswith(".html"):
            response.headers["Cache-Control"] = "no-cache"
        else:
            response.headers["Cache-Control"] = "public"

        return response

    async def _bidi_component_options(request: Request) -> Response:
        response = Response(status_code=204)
        await _set_cors_headers(request, response)
        return response

    async def _component_options(request: Request) -> Response:
        response = Response(status_code=204)
        await _set_cors_headers(request, response)
        return response

    if config.get_option("server.enableStaticServing"):
        script_path = getattr(runtime, "_main_script_path", None)
        app_static_root = (
            os.path.realpath(file_util.get_app_static_dir(script_path))
            if script_path
            else None
        )

        async def _app_static_endpoint(request: Request) -> Response:
            if not app_static_root:
                raise HTTPException(status_code=404, detail="File not found")

            relative_path = request.path_params.get("path", "")
            safe_path = build_safe_abspath(app_static_root, relative_path)
            if safe_path is None:
                raise HTTPException(status_code=404, detail="File not found")

            if not os.path.exists(safe_path) or os.path.isdir(safe_path):
                raise HTTPException(status_code=404, detail="File not found")

            if os.path.getsize(safe_path) > MAX_APP_STATIC_FILE_SIZE:
                raise HTTPException(
                    status_code=404,
                    detail="File is too large",
                )

            ext = Path(safe_path).suffix.lower()
            media_type = None
            if ext not in SAFE_APP_STATIC_FILE_EXTENSIONS:
                media_type = "text/plain"

            response = FileResponse(safe_path, media_type=media_type)
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["X-Content-Type-Options"] = "nosniff"
            return response

        async def _app_static_options(_request: Request) -> Response:
            response = Response(status_code=204)
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
            return response

        routes.extend(
            [
                Route(
                    _with_base("app/static/{path:path}", base_url),
                    _app_static_endpoint,
                    methods=["GET"],
                ),
                Route(
                    _with_base("app/static/{path:path}", base_url),
                    _app_static_options,
                    methods=["OPTIONS"],
                ),
            ]
        )

    routes.extend(
        [
            Route(
                _with_base("_stcore/health", base_url),
                _health_endpoint,
                methods=["GET", "HEAD"],
            ),
            Route(
                _with_base("_stcore/health", base_url),
                _health_options,
                methods=["OPTIONS"],
            ),
            Route(
                _with_base("healthz", base_url),
                _health_endpoint,
                methods=["GET", "HEAD"],
            ),
            Route(
                _with_base("healthz", base_url),
                _health_options,
                methods=["OPTIONS"],
            ),
            Route(
                _with_base("_stcore/metrics", base_url),
                _metrics_endpoint,
                methods=["GET"],
            ),
            Route(
                _with_base("st-metrics", base_url), _metrics_endpoint, methods=["GET"]
            ),
            Route(
                _with_base("_stcore/host-config", base_url),
                _host_config_endpoint,
                methods=["GET"],
            ),
            WebSocketRoute(_with_base("_stcore/stream", base_url), _websocket_endpoint),
            Route(
                _with_base("media/{file_id:path}", base_url),
                _media_endpoint,
                methods=["GET"],
            ),
            Route(
                _with_base("media/{file_id:path}", base_url),
                _media_options,
                methods=["OPTIONS"],
            ),
            Route(
                _with_base("_stcore/upload_file/{session_id}/{file_id}", base_url),
                _upload_put,
                methods=["PUT"],
            ),
            Route(
                _with_base("_stcore/upload_file/{session_id}/{file_id}", base_url),
                _upload_delete,
                methods=["DELETE"],
            ),
            Route(
                _with_base("_stcore/upload_file/{session_id}/{file_id}", base_url),
                _upload_options,
                methods=["OPTIONS"],
            ),
            Route(
                _with_base("component/{path:path}", base_url),
                _component_endpoint,
                methods=["GET"],
            ),
            Route(
                _with_base("component/{path:path}", base_url),
                _component_options,
                methods=["OPTIONS"],
            ),
            Route(
                _with_base("_stcore/bidi-components/{path:path}", base_url),
                _bidi_component_endpoint,
                methods=["GET"],
            ),
            Route(
                _with_base("_stcore/bidi-components/{path:path}", base_url),
                _bidi_component_options,
                methods=["OPTIONS"],
            ),
        ]
    )

    if config.get_option("server.scriptHealthCheckEnabled"):
        routes.extend(
            [
                Route(
                    _with_base("_stcore/script-health-check", base_url),
                    _script_health_endpoint,
                    methods=["GET", "HEAD"],
                ),
                Route(
                    _with_base("_stcore/script-health-check", base_url),
                    _health_options,
                    methods=["OPTIONS"],
                ),
                Route(
                    _with_base("script-health-check", base_url),
                    _script_health_endpoint,
                    methods=["GET", "HEAD"],
                ),
                Route(
                    _with_base("script-health-check", base_url),
                    _health_options,
                    methods=["OPTIONS"],
                ),
            ]
        )

    if not dev_mode:
        static_dir = file_util.get_static_dir()
        static_files = _StreamlitStaticFiles(directory=static_dir, base_url=base_url)
        routes.append(Mount(_with_base("", base_url), app=static_files, name="static"))

    app = Starlette(routes=routes)

    def _session_secret() -> str:
        secret = get_cookie_secret()
        if not secret:
            secret = binascii.b2a_hex(os.urandom(32)).decode("ascii")
        return secret

    app.add_middleware(
        SessionMiddleware,  # ty: ignore[invalid-argument-type]
        secret_key=_session_secret(),
        same_site="lax",
        https_only=bool(config.get_option("server.sslCertFile")),
        session_cookie="_streamlit_session",
    )

    # TODO(lukasmasuch): Validate the performance gain of GZip compression by comparing
    # response sizes and latency between Tornado (compress_response=True) and Starlette.
    # Consider making this configurable or adjusting minimum_size threshold if needed.
    from starlette.middleware.gzip import GZipMiddleware

    app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=6)

    @app.route(_with_base("_stcore/metrics", base_url), methods=["OPTIONS"])
    async def _metrics_options(request: Request) -> Response:
        response = Response(status_code=204)
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Accept"
        await _set_cors_headers(request, response)
        return response

    @app.on_event("startup")
    async def _on_startup() -> None:
        await runtime.start()

    @app.on_event("shutdown")
    async def _on_shutdown() -> None:
        runtime.stop()

    return app


__all__ = ["create_starlette_app"]
