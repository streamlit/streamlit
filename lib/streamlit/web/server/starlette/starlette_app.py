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

import binascii
import os
from typing import TYPE_CHECKING, Any

from streamlit import config, file_util
from streamlit.web.server.server_util import get_cookie_secret
from streamlit.web.server.starlette.starlette_routes import (
    create_app_static_routes,
    create_bidi_component_routes,
    create_component_routes,
    create_health_routes,
    create_host_config_routes,
    create_media_routes,
    create_metrics_options_handler,
    create_metrics_routes,
    create_script_health_routes,
    create_upload_routes,
)
from streamlit.web.server.starlette.starlette_static import (
    create_streamlit_static_files,
)
from streamlit.web.server.starlette.starlette_websocket import create_websocket_handler

if TYPE_CHECKING:
    from starlette.applications import Starlette

    from streamlit.runtime import Runtime
    from streamlit.runtime.media_file_manager import MediaFileManager
    from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
    from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager


def create_starlette_app(runtime: Runtime) -> Starlette:
    """Create a Starlette application for serving Streamlit.

    This factory function creates a fully configured Starlette app that provides
    the same functionality as the Tornado-based server, including:
    - WebSocket endpoint for client-server communication
    - Health check endpoints
    - Media file serving with range request support
    - File upload handling
    - Custom component serving
    - Static file serving with SPA fallback
    - XSRF protection
    - Session middleware
    - GZip compression
    """
    try:
        from starlette.applications import Starlette
        from starlette.middleware.sessions import SessionMiddleware
        from starlette.routing import Mount, WebSocketRoute
    except ModuleNotFoundError as exc:  # pragma: no cover - import guard
        raise RuntimeError(
            "Starlette is not installed. Run `pip install streamlit[starlette]` "
            "or disable `server.useStarlette`."
        ) from exc

    # Extract runtime components
    media_manager: MediaFileManager = runtime.media_file_mgr
    upload_mgr: MemoryUploadedFileManager = runtime.uploaded_file_mgr  # type: ignore
    media_storage: MemoryMediaFileStorage = media_manager._storage  # type: ignore
    component_registry = runtime.component_registry
    bidi_component_manager = runtime.bidi_component_registry
    base_url = config.get_option("server.baseUrlPath")
    dev_mode = bool(config.get_option("global.developmentMode"))

    # Build routes list
    routes: list[Any] = []

    # Add auth routes if available
    try:
        from streamlit.web.server.starlette.starlette_auth_routes import get_auth_routes

        routes.extend(get_auth_routes(base_url))
    except ModuleNotFoundError:  # pragma: no cover - auth optional
        pass

    # Add app static routes if enabled
    if config.get_option("server.enableStaticServing"):
        main_script_path = getattr(runtime, "_main_script_path", None)
        routes.extend(create_app_static_routes(main_script_path, base_url))

    # Add core routes
    routes.extend(create_health_routes(runtime, base_url))
    routes.extend(create_metrics_routes(runtime, base_url))
    routes.extend(create_host_config_routes(base_url))
    routes.extend(create_media_routes(media_storage, base_url))
    routes.extend(create_upload_routes(runtime, upload_mgr, base_url))
    routes.extend(create_component_routes(component_registry, base_url))
    routes.extend(create_bidi_component_routes(bidi_component_manager, base_url))

    # Add WebSocket route
    websocket_handler = create_websocket_handler(runtime)
    routes.append(
        WebSocketRoute(_with_base("_stcore/stream", base_url), websocket_handler)
    )

    # Add script health check routes if enabled
    if config.get_option("server.scriptHealthCheckEnabled"):
        routes.extend(create_script_health_routes(runtime, base_url))

    # Add static files mount (only in production mode)
    if not dev_mode:
        static_dir = file_util.get_static_dir()
        static_files = create_streamlit_static_files(
            directory=static_dir, base_url=base_url
        )
        routes.append(Mount(_with_base("", base_url), app=static_files, name="static"))

    # Create the Starlette application
    app = Starlette(routes=routes)

    # Add session middleware
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

    # Add GZip compression middleware
    # TODO(lukasmasuch): Validate the performance gain of GZip compression by comparing
    # response sizes and latency between Tornado (compress_response=True) and Starlette.
    # Consider making this configurable or adjusting minimum_size threshold if needed.
    from starlette.middleware.gzip import GZipMiddleware

    app.add_middleware(
        GZipMiddleware,  # ty: ignore[invalid-argument-type]
        minimum_size=500,
        compresslevel=6,
    )

    # Add metrics OPTIONS handler (for CORS preflight)
    metrics_options_handler, metrics_path = create_metrics_options_handler(base_url)

    @app.route(metrics_path, methods=["OPTIONS"])
    async def _metrics_options(request: Any) -> Any:
        return await metrics_options_handler(request)

    # Add lifecycle event handlers
    @app.on_event("startup")
    async def _on_startup() -> None:
        await runtime.start()

    @app.on_event("shutdown")
    async def _on_shutdown() -> None:
        runtime.stop()

    return app


def _with_base(path: str, base_url: str | None = None) -> str:
    """Prepend the base URL path to a route path."""
    base = (
        base_url if base_url is not None else config.get_option("server.baseUrlPath")
    ) or ""
    base = base.strip("/")
    if base:
        return f"/{base}/{path.lstrip('/')}"
    return f"/{path.lstrip('/')}"


__all__ = ["create_starlette_app"]
