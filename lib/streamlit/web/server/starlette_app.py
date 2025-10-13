"""Prototype Starlette application used while migrating away from Tornado."""

from __future__ import annotations

import asyncio
import json
import mimetypes
import os
from contextlib import suppress
from shlex import quote
from typing import TYPE_CHECKING, Any
from urllib.parse import urlparse

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
from streamlit.web.server.routes import (
    _DEFAULT_ALLOWED_MESSAGE_ORIGINS,
    allow_all_cross_origin_requests,
    is_allowed_origin,
)
from streamlit.web.server.server_util import get_cookie_secret, get_url, is_xsrf_enabled
from streamlit.web.server.stats_request_handler import StatsRequestHandler

if TYPE_CHECKING:
    from starlette.applications import Starlette
    from starlette.datastructures import Headers
    from starlette.requests import Request
    from starlette.websockets import WebSocket

    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
    from streamlit.runtime import Runtime
    from streamlit.runtime.media_file_manager import MediaFileManager
    from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager

_LOGGER = get_logger(__name__)


def _with_base(path: str) -> str:
    base = (config.get_option("server.baseUrlPath") or "").strip("/")
    if base:
        return f"/{base}/{path.lstrip('/')}"
    return f"/{path.lstrip('/')}"


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
            "Starlette is not installed. Install optional dependencies or disable "
            "`server.useStarlette`."
        ) from exc

    routes: list[Any] = []
    media_manager: MediaFileManager = runtime.media_file_mgr
    upload_mgr: MemoryUploadedFileManager = runtime.uploaded_file_mgr  # type: ignore
    media_storage: MemoryMediaFileStorage = media_manager._storage  # type: ignore
    component_registry = runtime.component_registry
    base_url = config.get_option("server.baseUrlPath")
    dev_mode = bool(config.get_option("global.developmentMode"))

    try:
        from streamlit.web.server.starlette_auth_routes import get_auth_routes

        routes.extend(get_auth_routes(base_url))
    except ModuleNotFoundError:  # pragma: no cover - auth optional
        pass

    async def _set_cors_headers(request: Request, response: Response) -> None:
        if allow_all_cross_origin_requests():
            response.headers["Access-Control-Allow-Origin"] = "*"
        elif (origin := request.headers.get("Origin")) and is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin

    async def _health_endpoint(request: Request) -> PlainTextResponse:
        ok, message = await runtime.is_ready_for_browser_connection
        status = 200 if ok else 503
        response = PlainTextResponse(message, status_code=status)
        await _set_cors_headers(request, response)
        if "_stcore/" not in request.url.path:
            response.headers["Deprecation"] = "true"
            response.headers["Link"] = (
                f'<{_with_base("_stcore/health")}>; rel="alternate"'
            )
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
                f'<{_with_base("_stcore/metrics")}>; rel="alternate"'
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

    async def _component_options(request: Request) -> Response:
        response = Response(status_code=204)
        await _set_cors_headers(request, response)
        return response

    routes.extend(
        [
            Route(_with_base("_stcore/health"), _health_endpoint, methods=["GET"]),
            Route(_with_base("healthz"), _health_endpoint, methods=["GET"]),
            Route(_with_base("_stcore/metrics"), _metrics_endpoint, methods=["GET"]),
            Route(_with_base("st-metrics"), _metrics_endpoint, methods=["GET"]),
            Route(
                _with_base("_stcore/host-config"),
                _host_config_endpoint,
                methods=["GET"],
            ),
            WebSocketRoute(_with_base("_stcore/stream"), _websocket_endpoint),
            Route(_with_base("media/{file_id:path}"), _media_endpoint, methods=["GET"]),
            Route(
                _with_base("media/{file_id:path}"),
                _media_options,
                methods=["OPTIONS"],
            ),
            Route(
                _with_base("_stcore/upload_file/{session_id}/{file_id}"),
                _upload_put,
                methods=["PUT"],
            ),
            Route(
                _with_base("_stcore/upload_file/{session_id}/{file_id}"),
                _upload_delete,
                methods=["DELETE"],
            ),
            Route(
                _with_base("_stcore/upload_file/{session_id}/{file_id}"),
                _upload_options,
                methods=["OPTIONS"],
            ),
            Route(
                _with_base("component/{path:path}"),
                _component_endpoint,
                methods=["GET"],
            ),
            Route(
                _with_base("component/{path:path}"),
                _component_options,
                methods=["OPTIONS"],
            ),
        ]
    )

    if not dev_mode:
        static_dir = file_util.get_static_dir()
        static_files = StaticFiles(directory=static_dir, html=True)
        routes.append(Mount(_with_base(""), app=static_files, name="static"))

    app = Starlette(routes=routes)

    @app.route(_with_base("_stcore/metrics"), methods=["OPTIONS"])
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
