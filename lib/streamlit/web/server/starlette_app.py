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

"""Prototype Starlette application used while migrating away from Tornado."""

from __future__ import annotations

import asyncio
import binascii
import json
import mimetypes
import os
import time
from contextlib import suppress
from pathlib import Path
from shlex import quote
from typing import TYPE_CHECKING, Any, Final
from urllib.parse import urlparse

from tornado.util import _websocket_mask
from tornado.web import decode_signed_value

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


def _parse_subprotocols(headers: Headers) -> tuple[str | None, str | None]:
    raw = headers.get("sec-websocket-protocol")
    if not raw:
        return None, None

    entries = [value.strip() for value in raw.split(",") if value.strip()]
    selected = entries[0] if entries else None
    existing_session = entries[2] if len(entries) >= 3 else None
    return selected, existing_session


def _gather_user_info(headers: Headers) -> dict[str, str | bool | None]:
    user_info: dict[str, str | bool | None] = {}
    mapping = config.get_option("server.trustedUserHeaders")
    if not isinstance(mapping, dict):
        return user_info

    for header_name, user_key in mapping.items():
        values = headers.getlist(header_name)
        user_info[user_key] = values[0] if values else None
    return user_info


def _ensure_xsrf_cookie(request: Request, response: Response) -> None:
    if not is_xsrf_enabled():
        return

    cookie_name = "_streamlit_xsrf"
    raw_cookie = request.cookies.get(cookie_name)
    token_bytes: bytes | None = None
    timestamp: int | None = None
    if raw_cookie:
        token_bytes, timestamp = _decode_xsrf_cookie(raw_cookie)

    if token_bytes is None or timestamp is None:
        token_bytes = os.urandom(16)
        timestamp = int(time.time())

    mask = os.urandom(4)
    masked_token = _websocket_mask(mask, token_bytes)
    cookie_value = "2|{}|{}|{}".format(
        binascii.b2a_hex(mask).decode("ascii"),
        binascii.b2a_hex(masked_token).decode("ascii"),
        timestamp,
    )

    _set_unquoted_cookie(
        response,
        cookie_name,
        cookie_value,
        secure=bool(config.get_option("server.sslCertFile")),
    )


def _decode_xsrf_cookie(
    cookie_value: str,
) -> tuple[bytes | None, int | None]:
    value = cookie_value.strip("\"'")
    try:
        if value.startswith("2|"):
            _, mask_hex, masked_hex, timestamp_str = value.split("|")
            mask = binascii.a2b_hex(mask_hex.encode("ascii"))
            masked = binascii.a2b_hex(masked_hex.encode("ascii"))
            token = _websocket_mask(mask, masked)
            return token, int(timestamp_str)

        token = binascii.a2b_hex(value.encode("ascii"))
        return token, int(time.time())
    except (binascii.Error, ValueError):
        return None, None


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

    decoded = decode_signed_value(secret, "_streamlit_user", signed_value)
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
        from streamlit.web.server.starlette_auth_routes import get_auth_routes

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
        subprotocol, existing_session_id = _parse_subprotocols(websocket.headers)
        await websocket.accept(subprotocol=subprotocol)

        client = _StarletteSessionClient(websocket)
        session_id: str | None = None
        user_info = _gather_user_info(websocket.headers)
        if is_xsrf_enabled():
            cookie = websocket.cookies.get("_streamlit_user")
            origin_header = websocket.headers.get("Origin")
            if cookie and origin_header:
                try:
                    user_info.update(_parse_user_cookie_signed(cookie, origin_header))
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
                    # Starlette raises RuntimeError when a text frame is received.
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
                if msg_type == "debug_disconnect_websocket":
                    await websocket.close()
                    break
                if msg_type == "debug_shutdown_runtime":
                    runtime.stop()
                    break

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

        response = StreamingResponse(
            iter([media_file.content]),
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

        upload = uploads[0]
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

        response = StreamingResponse(iter([data]))
        await _set_cors_headers(request, response)

        if not filename or filename.endswith(".html"):
            response.headers["Cache-Control"] = "no-cache"
        else:
            response.headers["Cache-Control"] = "public"

        mime_type, encoding = mimetypes.guess_type(abspath)
        if encoding == "gzip":
            response.media_type = "application/gzip"
        elif mime_type is not None:
            response.media_type = mime_type
        else:
            response.media_type = "application/octet-stream"

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
