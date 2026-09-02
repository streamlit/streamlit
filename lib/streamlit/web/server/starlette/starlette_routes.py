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

# ruff: noqa: RUF029  # Async route handlers are idiomatic even without await

"""Route handlers for the Starlette server."""

from __future__ import annotations

import asyncio
import os
import time
from contextlib import aclosing
from typing import TYPE_CHECKING, Final
from urllib.parse import quote

from streamlit import config, file_util
from streamlit.logger import get_logger
from streamlit.runtime.media_file_storage import MediaFileKind, MediaFileStorageError
from streamlit.runtime.memory_media_file_storage import get_extension_for_mimetype
from streamlit.runtime.stats import CACHE_MEMORY_FAMILY
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from streamlit.web.server.component_file_utils import (
    build_safe_abspath,
    guess_content_type,
)
from streamlit.web.server.server_util import (
    allow_all_cross_origin_requests,
    get_url,
    is_allowed_origin,
    is_xsrf_enabled,
)
from streamlit.web.server.starlette import starlette_app_utils
from streamlit.web.server.starlette.starlette_app_utils import validate_xsrf_token
from streamlit.web.server.starlette.starlette_server_config import (
    MAX_APP_STATIC_FILE_SIZE,
    XSRF_COOKIE_NAME,
)

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence

    from starlette.requests import Request
    from starlette.responses import Response
    from starlette.routing import BaseRoute
    from starlette.types import Message

    from streamlit.components.types.base_component_registry import BaseComponentRegistry
    from streamlit.components.v2.component_manager import BidiComponentManager
    from streamlit.proto.openmetrics_data_model_pb2 import MetricSet as MetricSetProto
    from streamlit.runtime import Runtime
    from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
    from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
    from streamlit.runtime.stats import Stat, StatsManager

_LOGGER: Final = get_logger(__name__)

# TTL for the cached cache_memory_bytes result. Short enough that scrapers
# (Prometheus default interval is 15 s) still see fresh data; long enough to
# collapse request floods to one computation per window.
_METRICS_EXPENSIVE_STATS_TTL_SECONDS: Final = 5.0


class _ExpensiveStatsCache:
    """Single-flight, short-TTL cache for the ``cache_memory_bytes`` metric family.

    That family is the only CPU-heavy metrics family (it walks session state,
    caches, media files, and uploads). Caching collapses request floods to one
    computation per TTL window; single-flight coalesces concurrent callers onto
    the same in-flight task.

    Concurrency notes:
    - The event-loop thread exclusively owns this state, so no locks are needed.
    - ``get`` must not ``await`` between reading ``_inflight`` and assigning it,
      or more than one task could start per expired window.
    - Waiters ``await asyncio.shield(_inflight)`` so cancelling one request
      (client disconnect, scraper timeout) does not cancel the shared task or
      other waiters. A done callback owns caching and clearing ``_inflight``.
    """

    def __init__(self, stats_mgr: StatsManager) -> None:
        self._stats_mgr = stats_mgr
        self._result: Mapping[str, Sequence[Stat]] | None = None
        self._expiry: float = 0.0
        self._inflight: asyncio.Task[Mapping[str, Sequence[Stat]]] | None = None

    async def get(self) -> Mapping[str, Sequence[Stat]]:
        """Return cached ``cache_memory_bytes`` stats, or compute them once for all waiters."""
        from starlette.concurrency import run_in_threadpool

        if self._result is not None and time.monotonic() < self._expiry:
            return self._result
        # Join an in-flight computation instead of starting another. Do not await
        # between this check and the assignment below.
        if self._inflight is None:
            task: asyncio.Task[Mapping[str, Sequence[Stat]]] = asyncio.create_task(
                run_in_threadpool(
                    self._stats_mgr.get_stats,
                    family_names=[CACHE_MEMORY_FAMILY],
                )
            )

            def _on_done(
                done: asyncio.Task[Mapping[str, Sequence[Stat]]],
            ) -> None:
                # Clear and cache only when *this* shared task settles, so a
                # cancelled waiter cannot drop the single-flight marker while
                # the worker is still running.
                if self._inflight is done:
                    self._inflight = None
                if done.cancelled():
                    return
                exc = done.exception()
                if exc is not None:
                    # Waiters that are still awaiting see the failure via
                    # shield; log here so a wave where every waiter cancelled
                    # still leaves an ops signal.
                    _LOGGER.error(
                        "Failed to compute %s metrics",
                        CACHE_MEMORY_FAMILY,
                        exc_info=(type(exc), exc, exc.__traceback__),
                    )
                    return
                self._result = done.result()
                self._expiry = time.monotonic() + _METRICS_EXPENSIVE_STATS_TTL_SECONDS

            self._inflight = task
            task.add_done_callback(_on_done)

        # Shield so cancelling this waiter does not cancel the shared task
        # (or other waiters coalesced onto it).
        return await asyncio.shield(self._inflight)


# Route path constants (without base URL prefix)
# These define the canonical paths for all Starlette server endpoints.

# IMPORTANT: Keep these in sync with:
# - frontend/app/vite.config.ts (dev server proxy configuration)
# - frontend/connection/src/DefaultStreamlitEndpoints.ts

BASE_ROUTE_CORE: Final = "_stcore"
BASE_ROUTE_MEDIA: Final = "media"
BASE_ROUTE_UPLOAD_FILE: Final = f"{BASE_ROUTE_CORE}/upload_file"
BASE_ROUTE_COMPONENT: Final = "component"
# Route prefix for serving static Streamlit frontend assets (JS, CSS, etc.)
BASE_ROUTE_STATIC: Final = "static"

# Health check routes
ROUTE_HEALTH: Final = f"{BASE_ROUTE_CORE}/health"
ROUTE_SCRIPT_HEALTH: Final = f"{BASE_ROUTE_CORE}/script-health-check"

# Metrics routes
ROUTE_METRICS: Final = f"{BASE_ROUTE_CORE}/metrics"

# Host configuration
ROUTE_HOST_CONFIG: Final = f"{BASE_ROUTE_CORE}/host-config"

# Media and file routes
_ROUTE_MEDIA: Final = f"{BASE_ROUTE_MEDIA}/{{file_id:path}}"
_ROUTE_UPLOAD_FILE: Final = f"{BASE_ROUTE_UPLOAD_FILE}/{{session_id}}/{{file_id}}"

# Component routes
_ROUTE_COMPONENTS_V1: Final = f"{BASE_ROUTE_COMPONENT}/{{path:path}}"
_ROUTE_COMPONENTS_V2: Final = f"{BASE_ROUTE_CORE}/bidi-components/{{path:path}}"

# Mapping of the (lowercase) server.xsrfCookieSameSite config values to their
# canonical Set-Cookie "SameSite" attribute values.
_SAME_SITE_HEADER_VALUES: Final = {
    "lax": "Lax",
    "strict": "Strict",
    "none": "None",
}

# App static files
_ROUTE_APP_STATIC: Final = "app/static/{path:path}"

# Framing margin for the streaming upload-size cap in `_upload_put`: the raw
# request body is rejected once it exceeds `server.maxUploadSize` plus this
# margin, and the exact per-file limit is still re-checked after parsing. The
# margin exists because a multipart body is slightly larger than the file it
# carries (boundary lines, part headers, filename), so without it a legitimate
# file of exactly `maxUploadSize` could be rejected while streaming. 1 MB
# comfortably covers that framing overhead.
_MAX_UPLOAD_MULTIPART_OVERHEAD_BYTES: Final = 1024 * 1024  # 1 MB


def _stats_to_text(stats_by_family: Mapping[str, Sequence[Stat]]) -> str:
    """Convert stats to OpenMetrics text format."""
    result: list[str] = []

    for stats in stats_by_family.values():
        if not stats:
            continue

        # All of the stats in a family will have the same family_name, type,
        # unit, and help text, so we can just use the first one to construct
        # our OpenMetrics comments.
        first_stat = stats[0]
        result.append(f"# TYPE {first_stat.family_name} {first_stat.type}")
        if first_stat.unit:
            result.append(f"# UNIT {first_stat.family_name} {first_stat.unit}")
        result.append(f"# HELP {first_stat.family_name} {first_stat.help}")
        result.extend(stat.to_metric_str() for stat in stats)

    result.append("# EOF\n")
    return "\n".join(result)


def _stats_to_proto(
    stats_by_family: Mapping[str, Sequence[Stat]],
) -> MetricSetProto:
    """Convert stats to protobuf MetricSet format."""
    # Lazy load the import of this proto message for better performance:
    from streamlit.proto.openmetrics_data_model_pb2 import (
        MetricSet as MetricSetProto,
    )
    from streamlit.runtime.stats import metric_type_string_to_proto

    metric_set = MetricSetProto()

    for stats in stats_by_family.values():
        if not stats:
            continue

        # All of the stats in a family will have the same family_name, type,
        # unit, and help text, so we can just use the first one to fill in
        # these metric_family fields.
        first_stat = stats[0]
        metric_family = metric_set.metric_families.add()
        metric_family.name = first_stat.family_name
        metric_family.type = metric_type_string_to_proto(first_stat.type)
        metric_family.unit = first_stat.unit
        metric_family.help = first_stat.help

        for stat in stats:
            metric_proto = metric_family.metrics.add()
            stat.marshall_metric_proto(metric_proto)

    return metric_set


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
    and cookie setting. If an existing valid XSRF cookie is present, its token
    bytes and timestamp are preserved. Otherwise, a new token is generated.

    The cookie is only set if XSRF protection is enabled in the configuration.
    The SameSite attribute is controlled by server.xsrfCookieSameSite. The
    Secure flag is added when SSL is configured, and is always added when
    SameSite is "none" (browsers require Secure for SameSite=None).

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

    # Only normalize actual strings; any unexpected value (e.g. None) falls
    # back to the safe "Lax" default rather than being coerced into "none".
    xsrf_cookie_same_site = config.get_option("server.xsrfCookieSameSite")
    same_site = _SAME_SITE_HEADER_VALUES.get(
        xsrf_cookie_same_site.lower()
        if isinstance(xsrf_cookie_same_site, str)
        else "lax",
        "Lax",
    )
    # Browsers reject SameSite=None cookies without the Secure flag, so force
    # Secure in that case.
    secure = bool(config.get_option("server.sslCertFile")) or same_site == "None"

    _set_unquoted_cookie(
        response,
        XSRF_COOKIE_NAME,
        cookie_value,
        same_site=same_site,
        secure=secure,
    )


def _set_unquoted_cookie(
    response: Response,
    cookie_name: str,
    cookie_value: str,
    *,
    same_site: str = "Lax",
    secure: bool,
) -> None:
    """Set a cookie without URL-encoding or quoting the value.

    Starlette's standard set_cookie() method URL-encodes special characters
    (like `|`) in cookie values. This function bypasses that encoding to preserve
    the raw cookie format required for XSRF tokens (format: "2|mask|token|timestamp").

    If a cookie with the same name already exists, it is replaced.

    Cookie flags set:
    - Path=/: Available to all paths
    - SameSite: Controlled by the `same_site` argument. "Lax" (the default)
      protects against CSRF while allowing top-level navigations; "None" enables
      cross-origin (iframe) usage and requires Secure.
    - Secure (conditional): Added when SSL is configured or `secure` is True.

    HttpOnly is intentionally NOT set for XSRF cookies because JavaScript must
    read the cookie value to include it in request headers (double-submit pattern).

    Parameters
    ----------
    response
        The Starlette response to set the cookie on.
    cookie_name
        The name of the cookie.
    cookie_value
        The raw cookie value (will not be URL-encoded or quoted).
    same_site
        The SameSite attribute value to use (e.g. "Lax", "Strict", or "None").
        Defaults to "Lax".
    secure
        Whether to add the Secure flag (should be True when using HTTPS).
    """
    # Build the Set-Cookie header value manually to avoid encoding
    header_value = "; ".join(
        [
            f"{cookie_name}={cookie_value}",
            "Path=/",
            f"SameSite={same_site}",
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

        # Provide a more helpful message when the runtime is not ready
        if not ok:
            from streamlit.runtime import RuntimeState

            if runtime.state == RuntimeState.INITIAL:
                # Runtime was never started - common issue when mounting without lifespan
                message = (
                    "Runtime not started. If mounting st.App on another ASGI framework, "
                    "ensure the runtime starts before serving requests."
                )
            elif runtime.state == RuntimeState.STOPPING:
                message = "Runtime is shutting down"
            elif runtime.state == RuntimeState.STOPPED:
                message = "Runtime has stopped"

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
            _with_base(ROUTE_HEALTH, base_url),
            _health_endpoint,
            methods=["GET", "HEAD"],
        ),
        Route(
            _with_base(ROUTE_HEALTH, base_url),
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
            _with_base(ROUTE_SCRIPT_HEALTH, base_url),
            _script_health_endpoint,
            methods=["GET", "HEAD"],
        ),
        Route(
            _with_base(ROUTE_SCRIPT_HEALTH, base_url),
            _script_health_options,
            methods=["OPTIONS"],
        ),
    ]


def create_metrics_routes(runtime: Runtime, base_url: str | None) -> list[BaseRoute]:
    """Create metrics route handlers."""
    from starlette.concurrency import run_in_threadpool
    from starlette.responses import PlainTextResponse, Response
    from starlette.routing import Route

    expensive_cache = _ExpensiveStatsCache(runtime.stats_mgr)

    async def _metrics_endpoint(request: Request) -> Response:
        requested: list[str] | None = request.query_params.getlist("families") or None
        wants_expensive = requested is None or CACHE_MEMORY_FAMILY in requested

        # Cheap families stay live; only cache_memory_bytes uses the TTL cache.
        all_registered = runtime.stats_mgr.registered_families()
        if requested is None:
            cheap_families = [f for f in all_registered if f != CACHE_MEMORY_FAMILY]
        else:
            cheap_families = [f for f in requested if f != CACHE_MEMORY_FAMILY]

        cheap_result: Mapping[str, Sequence[Stat]] = {}
        expensive_result: Mapping[str, Sequence[Stat]] = {}

        # Overlap cheap (thread-pool) and expensive (cache / thread-pool) work
        # when both are needed so scrape latency is the max of the two, not the sum.
        async def _fetch_cheap() -> Mapping[str, Sequence[Stat]]:
            if not cheap_families:
                return {}
            return await run_in_threadpool(
                runtime.stats_mgr.get_stats,
                family_names=cheap_families,
            )

        async def _fetch_expensive() -> Mapping[str, Sequence[Stat]]:
            if not wants_expensive:
                return {}
            return await expensive_cache.get()

        cheap_result, expensive_result = await asyncio.gather(
            _fetch_cheap(),
            _fetch_expensive(),
        )

        # Merge in registration order so the serialized output is deterministic.
        # Unknown requested families are omitted (same as get_stats).
        stats: dict[str, Sequence[Stat]] = {}
        for family in all_registered:
            if family == CACHE_MEMORY_FAMILY:
                if CACHE_MEMORY_FAMILY in expensive_result:
                    stats[CACHE_MEMORY_FAMILY] = expensive_result[CACHE_MEMORY_FAMILY]
            elif family in cheap_result:
                stats[family] = cheap_result[family]

        accept = request.headers.get("Accept", "")
        if "application/x-protobuf" in accept:
            payload = _stats_to_proto(stats).SerializeToString()
            response = Response(payload, media_type="application/x-protobuf")
        else:
            text = _stats_to_text(stats)
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
            _with_base(ROUTE_METRICS, base_url),
            _metrics_endpoint,
            methods=["GET"],
        ),
        Route(
            _with_base(ROUTE_METRICS, base_url),
            _metrics_options,
            methods=["OPTIONS"],
        ),
    ]


def create_host_config_routes(base_url: str | None) -> list[BaseRoute]:
    """Create host config route handlers."""
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    async def _host_config_endpoint(request: Request) -> JSONResponse:
        allowed: list[str] = list(config.get_option("client.allowedOrigins"))
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
            _with_base(ROUTE_HOST_CONFIG, base_url),
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
    from starlette.requests import Request as StarletteRequest
    from starlette.responses import Response
    from starlette.routing import Route

    def _check_xsrf(request: Request) -> None:
        """Validate XSRF token for non-safe HTTP methods.

        Raises HTTPException with 403 if XSRF is enabled and validation fails.
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
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid session_id. This is likely caused by a multi-replica "
                    "deployment without sticky sessions / session affinity. See "
                    "https://docs.streamlit.io/develop/concepts/architecture/"
                    "architecture#websockets-and-session-management"
                ),
            )

        max_size_bytes = (  # maxUploadSize is in megabytes
            config.get_option("server.maxUploadSize") * 1024 * 1024
        )

        # 1. Fast fail via the Content-Length header (if present), before reading
        # any of the body. This rejects well-behaved oversized uploads early.
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > max_size_bytes:
                    raise HTTPException(status_code=413, detail="File too large")
            except ValueError:
                raise HTTPException(
                    status_code=400, detail="Invalid Content-Length header"
                )

        # 2. Enforce the limit while streaming the body. Content-Length can be
        # absent or falsified (e.g. Transfer-Encoding: chunked), so we cap the
        # raw request body as it arrives and abort as soon as it exceeds the
        # limit. Without this, an oversized upload would be fully buffered in
        # memory (upload.read()) or spooled to disk (request.form()) before the
        # size check below could reject it, allowing a single request to exhaust
        # the server's memory/disk.
        max_body_bytes = max_size_bytes + _MAX_UPLOAD_MULTIPART_OVERHEAD_BYTES
        bytes_received = 0

        # Use the original request's stream so a middleware-cached body is
        # replayed instead of blocking on the drained ASGI channel (a keep-alive
        # connection sends no disconnect). Create the iterator once so each
        # `limited_receive` call advances the same stream, and aclose it so
        # cleanup does not wait for GC. Sentry's StarletteIntegration is the
        # reported trigger: it reads bodies to attach them to error events.
        # See #16697.
        async with aclosing(request.stream()) as body_chunks:

            async def limited_receive() -> Message:
                nonlocal bytes_received
                try:
                    chunk = await anext(body_chunks)
                except StopAsyncIteration:
                    # The stream is exhausted, so the body is complete.
                    return {"type": "http.request", "body": b"", "more_body": False}
                except RuntimeError as ex:
                    # Starlette raises RuntimeError("Stream consumed") when a
                    # middleware streamed the body away without caching it,
                    # leaving nothing to parse. Any other RuntimeError comes from
                    # the ASGI channel; let it keep its 500 rather than blaming a
                    # body that was never consumed.
                    if "Stream consumed" not in str(ex):
                        raise
                    # The client only ever sees the HTTP status, so log the cause
                    # for whoever has to fix the middleware. Without this a 400
                    # leaves no server-side signal at all, unlike the 413 below.
                    _LOGGER.warning(
                        "Upload rejected: the request body was already consumed "
                        "before reaching the upload handler. This usually means "
                        "in-process ASGI middleware read the body without "
                        "replaying it downstream."
                    )
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Request body was already consumed before it reached "
                            "the upload handler, most likely by ASGI middleware "
                            "that read the body without replaying it."
                        ),
                    ) from ex

                bytes_received += len(chunk)
                if bytes_received > max_body_bytes:
                    # Log the streaming-cap rejection so operators can tell a
                    # misconfigured server.maxUploadSize (legitimate uploads being
                    # rejected) apart from an actual abuse attempt.
                    _LOGGER.warning(
                        "Upload rejected: request body exceeded the size limit "
                        "while streaming (%d bytes received, cap %d bytes). If "
                        "legitimate uploads are affected, increase "
                        "server.maxUploadSize.",
                        bytes_received,
                        max_body_bytes,
                    )
                    # Raising here aborts the multipart parse mid-stream. Starlette
                    # only closes its spooled temp files on MultiPartException /
                    # OSError, so this HTTPException leaves cleanup to GC once the
                    # frames unwind - the same as an upstream ClientDisconnect.
                    # Resource use stays bounded to one in-flight request.
                    raise HTTPException(status_code=413, detail="File too large")

                # Report more body unconditionally and let exhaustion above mark
                # the end, so framing never depends on how `stream()` chunks an
                # empty tail. A trailing empty chunk is harmless to the parser.
                return {"type": "http.request", "body": chunk, "more_body": True}

            limited_request = StarletteRequest(request.scope, limited_receive)
            form = await limited_request.form()

        uploads = [value for value in form.values() if isinstance(value, UploadFile)]

        if len(uploads) != 1:
            raise HTTPException(
                status_code=400, detail=f"Expected 1 file, but got {len(uploads)}"
            )

        upload = uploads[0]

        # 3. Enforce the exact per-file size limit. The streaming cap above
        # allows a small framing margin, so re-check the parsed file size here.
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
            # Return 400 for malicious paths (consistent with middleware behavior)
            raise HTTPException(status_code=400, detail="Bad Request")

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
    from anyio import Path as AsyncPath
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
            # Return 400 for unsafe paths
            return await _text_response("Bad Request", 400)

        if await AsyncPath(abspath).is_dir():
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
    from anyio import Path as AsyncPath
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
            # Return 400 for malicious paths (consistent with middleware behavior)
            raise HTTPException(status_code=400, detail="Bad Request")

        async_path = AsyncPath(safe_path)
        if not await async_path.exists() or await async_path.is_dir():
            raise HTTPException(status_code=404, detail="File not found")

        file_stat = await async_path.stat()
        if file_stat.st_size > MAX_APP_STATIC_FILE_SIZE:
            raise HTTPException(
                status_code=404,
                detail="File is too large",
            )

        response = FileResponse(safe_path, media_type=guess_content_type(safe_path))
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
