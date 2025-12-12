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
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any

from streamlit import config, file_util
from streamlit.web.server.server_util import get_cookie_secret
from streamlit.web.server.starlette.starlette_routes import (
    ROUTE_WEBSOCKET_STREAM,
    _with_base,
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
    from collections.abc import AsyncIterator

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
        from starlette.routing import Mount, Route, WebSocketRoute
    except ModuleNotFoundError as exc:  # pragma: no cover - import guard
        raise RuntimeError(
            "Starlette is not installed. Run `pip install streamlit[starlette]` "
            "or disable `server.useStarlette`."
        ) from exc

    # Define lifespan context manager for startup/shutdown events
    @asynccontextmanager
    async def _lifespan(_app: Starlette) -> AsyncIterator[None]:
        # Startup
        await runtime.start()
        yield
        # Shutdown
        runtime.stop()

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
        WebSocketRoute(_with_base(ROUTE_WEBSOCKET_STREAM, base_url), websocket_handler)
    )

    # Add script health check routes if enabled
    if config.get_option("server.scriptHealthCheckEnabled"):
        routes.extend(create_script_health_routes(runtime, base_url))

    # Add metrics OPTIONS route (for CORS preflight)
    metrics_options_handler, metrics_path = create_metrics_options_handler(base_url)
    routes.append(Route(metrics_path, metrics_options_handler, methods=["OPTIONS"]))

    # Add static files mount (only in production mode)
    if not dev_mode:
        static_dir = file_util.get_static_dir()
        static_files = create_streamlit_static_files(
            directory=static_dir, base_url=base_url
        )
        routes.append(Mount(_with_base("", base_url), app=static_files, name="static"))

    # Create the Starlette application with lifespan handler
    app = Starlette(routes=routes, lifespan=_lifespan)

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

    # Add GZip compression middleware.
    # We use a custom MediaAwareGZipMiddleware that excludes audio/video content
    # from compression. Compressing binary media content breaks playback in browsers,
    # especially with range requests. Using a custom middleware instead of setting
    # Content-Encoding: identity provides better browser compatibility, as some
    # browsers (especially WebKit) have issues with explicit identity encoding.
    from streamlit.web.server.starlette.starlette_app_utils import (
        MediaAwareGZipMiddleware,
    )

    app.add_middleware(
        MediaAwareGZipMiddleware,  # ty: ignore[invalid-argument-type]
        minimum_size=500,
        compresslevel=6,
    )

    return app


__all__ = ["create_starlette_app"]
