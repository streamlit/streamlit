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

"""Starlette application for serving a Streamlit app."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any

from streamlit import config
from streamlit.web.server.server_util import get_cookie_secret
from streamlit.web.server.starlette.starlette_app_utils import (
    generate_random_hex_string,
)
from streamlit.web.server.starlette.starlette_auth_routes import create_auth_routes
from streamlit.web.server.starlette.starlette_routes import (
    create_app_static_serving_routes,
    create_bidi_component_routes,
    create_component_routes,
    create_health_routes,
    create_host_config_routes,
    create_media_routes,
    create_metrics_routes,
    create_script_health_routes,
    create_upload_routes,
)
from streamlit.web.server.starlette.starlette_server_config import (
    GZIP_COMPRESSLEVEL,
    GZIP_MINIMUM_SIZE,
    SESSION_COOKIE_NAME,
)
from streamlit.web.server.starlette.starlette_static_routes import (
    create_streamlit_static_assets_routes,
)
from streamlit.web.server.starlette.starlette_websocket import create_websocket_routes

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from starlette.applications import Starlette
    from starlette.middleware import Middleware
    from starlette.routing import BaseRoute

    from streamlit.runtime import Runtime
    from streamlit.runtime.media_file_manager import MediaFileManager
    from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
    from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager


def create_streamlit_routes(runtime: Runtime) -> list[BaseRoute]:
    """Create the Streamlit-internal routes for the application.

    This function creates all the routes required for Streamlit's core functionality
    including WebSocket communication, health checks, media serving, file uploads,
    and static file serving.

    Parameters
    ----------
    runtime
        The Streamlit Runtime instance that manages the application state.

    Returns
    -------
    list[BaseRoute]
        A list of Starlette route objects for Streamlit's core functionality.
    """
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

    # Add core routes
    routes.extend(create_health_routes(runtime, base_url))
    routes.extend(create_metrics_routes(runtime, base_url))
    routes.extend(create_host_config_routes(base_url))
    routes.extend(create_media_routes(media_storage, base_url))
    routes.extend(create_upload_routes(runtime, upload_mgr, base_url))
    routes.extend(create_component_routes(component_registry, base_url))
    routes.extend(create_bidi_component_routes(bidi_component_manager, base_url))

    # Add WebSocket route:
    routes.extend(create_websocket_routes(runtime, base_url))

    # Add auth routes:
    routes.extend(create_auth_routes(base_url))

    # Add app static routes if enabled:
    if config.get_option("server.enableStaticServing"):
        # TODO(lukasmasuch): Expose main_script_path as property on runtime class
        # or make the runtime config available so that we don't need to access the private
        # attribute.
        main_script_path = getattr(runtime, "_main_script_path", None)
        routes.extend(create_app_static_serving_routes(main_script_path, base_url))

    # Add script health check routes if enabled
    if config.get_option("server.scriptHealthCheckEnabled"):
        routes.extend(create_script_health_routes(runtime, base_url))

    # Add static files mount (only in production mode):
    if not dev_mode:
        routes.extend(create_streamlit_static_assets_routes(base_url=base_url))

    return routes


def create_streamlit_middleware() -> list[Middleware]:
    """Create the Streamlit-internal middleware stack.

    This function creates the middleware required for Streamlit's core functionality
    including session management and GZip compression.

    Returns
    -------
    list[Middleware]
        A list of Starlette Middleware objects for Streamlit's core functionality.
    """
    from starlette.middleware import Middleware
    from starlette.middleware.sessions import SessionMiddleware

    from streamlit.web.server.starlette.starlette_gzip_middleware import (
        MediaAwareGZipMiddleware,
    )

    middleware: list[Middleware] = []

    # Add session middleware
    middleware.append(
        Middleware(
            SessionMiddleware,  # ty: ignore[invalid-argument-type]
            secret_key=get_cookie_secret() or generate_random_hex_string(),
            same_site="lax",
            https_only=bool(config.get_option("server.sslCertFile")),
            session_cookie=SESSION_COOKIE_NAME,
        )
    )

    # Add GZip compression middleware.
    # We use a custom MediaAwareGZipMiddleware that excludes audio/video content
    # from compression. Compressing binary media content breaks playback in browsers,
    # especially with range requests. Using a custom middleware instead of setting
    # Content-Encoding: identity provides better browser compatibility, as some
    # browsers (especially WebKit) have issues with explicit identity encoding.
    middleware.append(
        Middleware(
            MediaAwareGZipMiddleware,  # ty: ignore[invalid-argument-type]
            minimum_size=GZIP_MINIMUM_SIZE,
            compresslevel=GZIP_COMPRESSLEVEL,
        )
    )

    return middleware


def create_starlette_app(runtime: Runtime) -> Starlette:
    """Create a Starlette application for serving Streamlit.

    This factory function creates a fully configured Starlette app that provides
    the full web-server functionality required for Streamlit:
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

    # Get routes and middleware from helper functions
    routes = create_streamlit_routes(runtime)
    middleware = create_streamlit_middleware()

    # Create the Starlette application with lifespan handler
    return Starlette(routes=routes, middleware=middleware, lifespan=_lifespan)


__all__ = ["create_starlette_app"]
