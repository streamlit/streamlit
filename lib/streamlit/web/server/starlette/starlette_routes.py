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

"""Route handlers for the Starlette server."""

from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING, Final
from urllib.parse import quote

from streamlit import config, file_util
from streamlit.logger import get_logger
from streamlit.runtime.media_file_storage import MediaFileKind, MediaFileStorageError
from streamlit.runtime.memory_media_file_storage import get_extension_for_mimetype
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
    allow_all_cross_origin_requests,
    is_allowed_origin,
)
from streamlit.web.server.server_util import get_url, is_xsrf_enabled
from streamlit.web.server.starlette import starlette_app_utils
from streamlit.web.server.starlette.starlette_app_utils import validate_xsrf_token
from streamlit.web.server.starlette.starlette_server_config import XSRF_COOKIE_NAME
from streamlit.web.server.stats_request_handler import StatsRequestHandler

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response
    from starlette.routing import BaseRoute

    from streamlit.components.types.base_component_registry import BaseComponentRegistry
    from streamlit.components.v2.component_manager import BidiComponentManager
    from streamlit.runtime import Runtime
    from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
    from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager

_LOGGER: Final = get_logger(__name__)

# Route path constants (without base URL prefix)
# These define the canonical paths for all Starlette server endpoints.

# IMPORTANT: Keep these in sync with:
# - frontend/app/vite.config.ts (dev server proxy configuration)
# - frontend/connection/src/DefaultStreamlitEndpoints.ts

BASE_ROUTE_CORE: Final = "_stcore"
BASE_ROUTE_MEDIA: Final = "media"
BASE_ROUTE_UPLOAD_FILE: Final = f"{BASE_ROUTE_CORE}/upload_file"
BASE_ROUTE_COMPONENT: Final = "component"

# Health check routes
_ROUTE_HEALTH: Final = f"{BASE_ROUTE_CORE}/health"
_ROUTE_SCRIPT_HEALTH: Final = f"{BASE_ROUTE_CORE}/script-health-check"

# Metrics routes
_ROUTE_METRICS: Final = f"{BASE_ROUTE_CORE}/metrics"

# Host configuration
_ROUTE_HOST_CONFIG: Final = f"{BASE_ROUTE_CORE}/host-config"

# Media and file routes
_ROUTE_MEDIA: Final = f"{BASE_ROUTE_MEDIA}/{{file_id:path}}"
_ROUTE_UPLOAD_FILE: Final = f"{BASE_ROUTE_UPLOAD_FILE}/{{session_id}}/{{file_id}}"

# Component routes
_ROUTE_COMPONENTS_V1: Final = f"{BASE_ROUTE_COMPONENT}/{{path:path}}"
_ROUTE_COMPONENTS_V2: Final = f"{BASE_ROUTE_CORE}/bidi-components/{{path:path}}"

# App static files
_ROUTE_APP_STATIC: Final = "app/static/{path:path}"


def _with_base(path: str, base_url: str | None = None) -> str:
    """Prepend the base URL path to a route path.

    Parameters
    ----------
    path
        The route path to prepend the base URL to (e.g., "_stcore/health").
    base_url
        Optional explicit base URL. If None, uses the configured server.baseUrlPath.
        If an empty string, no base URL is prepended.

    Returns
    -------
    str
        The full route path with base URL prepended (e.g., "/myapp/_stcore/health").
    """
    from streamlit.url_util import make_url_path

    base = (
        base_url if base_url is not None else config.get_option("server.baseUrlPath")
    ) or ""
    return make_url_path(base, path)


async def _set_cors_headers(request: Request, response: Response) -> None:
    """Set CORS headers on a response based on configuration.

    Configures the Access-Control-Allow-Origin header according to the following rules:
    - If CORS is disabled or in development mode: allows all origins ("*")
    - Otherwise: only allows origins that match the configured allowlist

    Parameters
    ----------
    request
        The incoming Starlette request (used to read the Origin header).
    response
        The outgoing Starlette response to set headers on.
    """
    if allow_all_cross_origin_requests():
        response.headers["Access-Control-Allow-Origin"] = "*"
        return

    origin = request.headers.get("Origin")
    if origin and is_allowed_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin


def _ensure_xsrf_cookie(request: Request, response: Response) -> None:
    """Ensure that the XSRF cookie is set on the response.

    This function manages XSRF (Cross-Site Request Forgery) token generation
    and cookie setting to maintain compatibility with Tornado's implementation.
    If an existing valid XSRF cookie is present, its token bytes and timestamp
    are preserved. Otherwise, a new token is generated.

    The cookie is only set if XSRF protection is enabled in the configuration.
    The Secure flag is added when SSL is configured.

    Note: The XSRF cookie intentionally does NOT have the HttpOnly flag. This
    is required for the double-submit cookie pattern: JavaScript reads the
    cookie value and includes it in the X-Xsrftoken request header, which the
    server then compares against the cookie value to validate requests.

    Parameters
    ----------
    request
        The incoming Starlette request (used to read existing XSRF cookie).
    response
        The outgoing Starlette response to set the cookie on.
    """
    if not is_xsrf_enabled():
        return

    # Try to decode existing XSRF cookie to preserve token across requests
    raw_cookie = request.cookies.get(XSRF_COOKIE_NAME)
    token_bytes: bytes | None = None
    timestamp: int | None = None
    if raw_cookie:
        token_bytes, timestamp = starlette_app_utils.decode_xsrf_token_string(
            raw_cookie
        )

    # Generate token string (reuses existing token bytes/timestamp if available)
    cookie_value = starlette_app_utils.generate_xsrf_token_string(
        token_bytes, timestamp
    )

    _set_unquoted_cookie(
        response,
        XSRF_COOKIE_NAME,
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
    """Set a cookie without URL-encoding or quoting the value.

    Starlette's standard set_cookie() method URL-encodes special characters
    (like `|`) in cookie values. This function bypasses that encoding to
    maintain compatibility with Tornado's cookie format, which is required
    for XSRF tokens that use the format "2|mask|token|timestamp".

    If a cookie with the same name already exists, it is replaced.

    Cookie flags set:
    - Path=/: Available to all paths
    - SameSite=Lax: Protects against CSRF while allowing top-level navigations
    - Secure (conditional): Added when SSL is configured

    HttpOnly is intentionally NOT set for XSRF cookies because JavaScript must
    read the cookie value to include it in request headers (double-submit pattern).
    This matches Tornado's behavior.

    Parameters
    ----------
    response
        The Starlette response to set the cookie on.
    cookie_name
        The name of the cookie.
    cookie_value
        The raw cookie value (will not be URL-encoded or quoted).
    secure
        Whether to add the Secure flag (should be True when using HTTPS).
    """
    # Build the Set-Cookie header value manually to avoid encoding
    header_value = "; ".join(
        [
            f"{cookie_name}={cookie_value}",
            "Path=/",
            "SameSite=Lax",
            *(["Secure"] if secure else []),
        ]
    )

    # Remove any existing cookie with the same name before adding the new one
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


def create_health_routes(runtime: Runtime, base_url: str | None) -> list[BaseRoute]:
    """Create health check route handlers for /_stcore/health.

    The health endpoint returns 200 OK when the runtime is ready to accept
    browser connections, or 503 Service Unavailable otherwise. This is used
    by load balancers and orchestration systems to determine service readiness.

    Parameters
    ----------
    runtime
        The Streamlit runtime instance to check health status.
    base_url
        Optional base URL path prefix for the routes.

    Returns
    -------
    list[BaseRoute]
        List of Starlette Route objects for GET, HEAD, and OPTIONS methods.
    """
    from starlette.responses import PlainTextResponse, Response
    from starlette.routing import Route

    async def _health_endpoint(request: Request) -> PlainTextResponse:
        ok, message = await runtime.is_ready_for_browser_connection
        status = 200 if ok else 503
        response = PlainTextResponse(message, status_code=status)
        response.headers["Cache-Control"] = "no-cache"
        await _set_cors_headers(request, response)
        _ensure_xsrf_cookie(request, response)
        return response

    async def _health_options(request: Request) -> Response:
        response = Response(status_code=204)
        response.headers["Cache-Control"] = "no-cache"
        await _set_cors_headers(request, response)
        return response

    return [
        Route(
            _with_base(_ROUTE_HEALTH, base_url),
            _health_endpoint,
            methods=["GET", "HEAD"],
        ),
        Route(
            _with_base(_ROUTE_HEALTH, base_url),
            _health_options,
            methods=["OPTIONS"],
        ),
    ]


def create_script_health_routes(
    runtime: Runtime, base_url: str | None
) -> list[BaseRoute]:
    """Create script health check route handlers."""
    from starlette.responses import PlainTextResponse, Response
    from starlette.routing import Route

    async def _script_health_endpoint(request: Request) -> PlainTextResponse:
        ok, message = await runtime.does_script_run_without_error()
        status = 200 if ok else 503
        response = PlainTextResponse(message, status_code=status)
        response.headers["Cache-Control"] = "no-cache"
        await _set_cors_headers(request, response)
        _ensure_xsrf_cookie(request, response)
        return response

    async def _script_health_options(request: Request) -> Response:
        response = Response(status_code=204)
        response.headers["Cache-Control"] = "no-cache"
        await _set_cors_headers(request, response)
        return response

    return [
        Route(
            _with_base(_ROUTE_SCRIPT_HEALTH, base_url),
            _script_health_endpoint,
            methods=["GET", "HEAD"],
        ),
        Route(
            _with_base(_ROUTE_SCRIPT_HEALTH, base_url),
            _script_health_options,
            methods=["OPTIONS"],
        ),
    ]


def create_metrics_routes(runtime: Runtime, base_url: str | None) -> list[BaseRoute]:
    """Create metrics route handlers."""
    from starlette.responses import PlainTextResponse, Response
    from starlette.routing import Route

    async def _metrics_endpoint(request: Request) -> Response:
        requested_families = request.query_params.getlist("families")
        stats = runtime.stats_mgr.get_stats(
            family_names=requested_families if requested_families else None
        )
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
        return response

    async def _metrics_options(request: Request) -> Response:
        response = Response(status_code=204)
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Accept"
        await _set_cors_headers(request, response)
        return response

    return [
        Route(
            _with_base(_ROUTE_METRICS, base_url),
            _metrics_endpoint,
            methods=["GET"],
        ),
        Route(
            _with_base(_ROUTE_METRICS, base_url),
            _metrics_options,
            methods=["OPTIONS"],
        ),
    ]


def create_host_config_routes(base_url: str | None) -> list[BaseRoute]:
    """Create host config route handlers."""
    from starlette.responses import JSONResponse
    from starlette.routing import Route

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

    return [
        Route(
            _with_base(_ROUTE_HOST_CONFIG, base_url),
            _host_config_endpoint,
            methods=["GET"],
        ),
    ]


def create_media_routes(
    media_storage: MemoryMediaFileStorage, base_url: str | None
) -> list[BaseRoute]:
    """Create media file route handlers for /media/{file_id}.

    Serves media files (images, audio, video) stored by st.image, st.audio,
    st.video, and st.download_button. Supports HTTP range requests for
    streaming media playback.

    Parameters
    ----------
    media_storage
        The media file storage backend.
    base_url
        Optional base URL path prefix for the routes.

    Returns
    -------
    list[BaseRoute]
        List of Starlette Route objects for GET, HEAD, and OPTIONS methods.
    """
    from starlette.exceptions import HTTPException
    from starlette.responses import Response
    from starlette.routing import Route

    async def _media_endpoint(request: Request) -> Response:
        file_id = request.path_params["file_id"]

        try:
            media_file = media_storage.get_file(file_id)
        except MediaFileStorageError as exc:
            raise HTTPException(status_code=404, detail="File not found") from exc

        headers: dict[str, str] = {}

        if media_file.kind == MediaFileKind.DOWNLOADABLE:
            filename = media_file.filename
            if not filename:
                filename = (
                    f"streamlit_download"
                    f"{get_extension_for_mimetype(media_file.mimetype)}"
                )
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

    return [
        Route(
            _with_base(_ROUTE_MEDIA, base_url),
            _media_endpoint,
            # HEAD is needed for browsers (especially WebKit) to probe media files
            methods=["GET", "HEAD"],
        ),
        Route(
            _with_base(_ROUTE_MEDIA, base_url),
            _media_options,
            methods=["OPTIONS"],
        ),
    ]


def create_upload_routes(
    runtime: Runtime,
    upload_mgr: MemoryUploadedFileManager,
    base_url: str | None,
) -> list[BaseRoute]:
    """Create file upload route handlers for /_stcore/upload_file/{session_id}/{file_id}.

    Handles file uploads from st.file_uploader widgets. Supports PUT for uploading
    files and DELETE for removing them. XSRF protection is enforced when enabled.

    Parameters
    ----------
    runtime
        The Streamlit runtime instance (used to validate session IDs).
    upload_mgr
        The uploaded file manager to store/retrieve files.
    base_url
        Optional base URL path prefix for the routes.

    Returns
    -------
    list[BaseRoute]
        List of Starlette Route objects for PUT, DELETE, and OPTIONS methods.
    """
    from starlette.datastructures import UploadFile
    from starlette.exceptions import HTTPException
    from starlette.responses import Response
    from starlette.routing import Route

    def _check_xsrf(request: Request) -> None:
        """Validate XSRF token for non-safe HTTP methods.

        Raises HTTPException with 403 if XSRF is enabled and validation fails.
        This mirrors Tornado's automatic XSRF protection for non-GET requests.
        """
        if not is_xsrf_enabled():
            return

        xsrf_header = request.headers.get("X-Xsrftoken")
        xsrf_cookie = request.cookies.get(XSRF_COOKIE_NAME)

        if not validate_xsrf_token(xsrf_header, xsrf_cookie):
            raise HTTPException(status_code=403, detail="XSRF token missing or invalid")

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
        """Upload a file to the server."""

        _check_xsrf(request)

        session_id = request.path_params["session_id"]
        file_id = request.path_params["file_id"]

        if not runtime.is_active_session(session_id):
            raise HTTPException(status_code=400, detail="Invalid session_id")

        max_size_bytes = (  # maxUploadSize is in megabytes
            config.get_option("server.maxUploadSize") * 1024 * 1024
        )

        # 1. Fast fail via header (if present) - check before reading the body
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > max_size_bytes:
                    raise HTTPException(status_code=413, detail="File too large")
            except ValueError:
                raise HTTPException(
                    status_code=400, detail="Invalid Content-Length header"
                )

        form = await request.form()
        uploads = [value for value in form.values() if isinstance(value, UploadFile)]

        if len(uploads) != 1:
            raise HTTPException(
                status_code=400, detail=f"Expected 1 file, but got {len(uploads)}"
            )

        upload = uploads[0]

        # 2. Check actual file size (Content-Length may be absent or inaccurate)
        # TODO(lukasmasuch): Improve by using a streaming approach that rejects uploads as soon as
        # they exceed max_size_bytes, rather than waiting for the full upload to complete.
        try:
            data = await upload.read()
        finally:
            upload.file.close()
        if len(data) > max_size_bytes:
            raise HTTPException(status_code=413, detail="File too large")

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
        """Delete a file from the server."""

        _check_xsrf(request)

        session_id = request.path_params["session_id"]
        file_id = request.path_params["file_id"]

        upload_mgr.remove_file(session_id=session_id, file_id=file_id)
        response = Response(status_code=204)
        await _set_upload_headers(request, response)
        return response

    return [
        Route(
            _with_base(_ROUTE_UPLOAD_FILE, base_url),
            _upload_put,
            methods=["PUT"],
        ),
        Route(
            _with_base(_ROUTE_UPLOAD_FILE, base_url),
            _upload_delete,
            methods=["DELETE"],
        ),
        Route(
            _with_base(_ROUTE_UPLOAD_FILE, base_url),
            _upload_options,
            methods=["OPTIONS"],
        ),
    ]


def create_component_routes(
    component_registry: BaseComponentRegistry, base_url: str | None
) -> list[BaseRoute]:
    """Create custom component route handlers."""
    import anyio
    from starlette.exceptions import HTTPException
    from starlette.responses import Response
    from starlette.routing import Route

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

        # Use build_safe_abspath to properly resolve symlinks and prevent traversal
        abspath = build_safe_abspath(component_root, filename)
        if abspath is None:
            raise HTTPException(status_code=403, detail="Forbidden")

        try:
            async with await anyio.open_file(abspath, "rb") as file:
                data = await file.read()
        except OSError as exc:
            raise HTTPException(status_code=404, detail="read error") from exc

        response = Response(content=data, media_type=guess_content_type(abspath))
        await _set_cors_headers(request, response)

        if not filename or filename.endswith(".html"):
            response.headers["Cache-Control"] = "no-cache"
        else:
            response.headers["Cache-Control"] = "public"

        return response

    async def _component_options(request: Request) -> Response:
        response = Response(status_code=204)
        await _set_cors_headers(request, response)
        return response

    return [
        Route(
            _with_base(_ROUTE_COMPONENTS_V1, base_url),
            _component_endpoint,
            methods=["GET"],
        ),
        Route(
            _with_base(_ROUTE_COMPONENTS_V1, base_url),
            _component_options,
            methods=["OPTIONS"],
        ),
    ]


def create_bidi_component_routes(
    bidi_component_manager: BidiComponentManager, base_url: str | None
) -> list[BaseRoute]:
    """Create bidirectional component route handlers."""
    import anyio
    from starlette.responses import PlainTextResponse, Response
    from starlette.routing import Route

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

        response = Response(content=data, media_type=guess_content_type(abspath))
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

    return [
        Route(
            _with_base(_ROUTE_COMPONENTS_V2, base_url),
            _bidi_component_endpoint,
            methods=["GET"],
        ),
        Route(
            _with_base(_ROUTE_COMPONENTS_V2, base_url),
            _bidi_component_options,
            methods=["OPTIONS"],
        ),
    ]


def create_app_static_serving_routes(
    main_script_path: str | None, base_url: str | None
) -> list[BaseRoute]:
    """Create app static serving file route handlers."""
    from starlette.exceptions import HTTPException
    from starlette.responses import FileResponse, Response
    from starlette.routing import Route

    app_static_root = (
        os.path.realpath(file_util.get_app_static_dir(main_script_path))
        if main_script_path
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

    return [
        Route(
            _with_base(_ROUTE_APP_STATIC, base_url),
            _app_static_endpoint,
            methods=["GET"],
        ),
        Route(
            _with_base(_ROUTE_APP_STATIC, base_url),
            _app_static_options,
            methods=["OPTIONS"],
        ),
    ]
