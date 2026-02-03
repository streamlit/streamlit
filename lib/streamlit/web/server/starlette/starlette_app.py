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
from pathlib import Path
from typing import TYPE_CHECKING, Any, Final

from streamlit import config
from streamlit.web.server.server_util import get_cookie_secret
from streamlit.web.server.starlette.starlette_app_utils import (
    generate_random_hex_string,
)
from streamlit.web.server.starlette.starlette_auth_routes import create_auth_routes
from streamlit.web.server.starlette.starlette_routes import (
    BASE_ROUTE_COMPONENT,
    BASE_ROUTE_CORE,
    BASE_ROUTE_MEDIA,
    BASE_ROUTE_UPLOAD_FILE,
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
    from collections.abc import AsyncIterator, Callable, Mapping, Sequence
    from contextlib import AbstractAsyncContextManager

    from starlette.applications import Starlette
    from starlette.middleware import Middleware
    from starlette.routing import BaseRoute
    from starlette.types import ExceptionHandler, Receive, Scope, Send

    from streamlit.runtime import Runtime
    from streamlit.runtime.media_file_manager import MediaFileManager
    from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
    from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager

# Reserved route prefixes that users cannot override
_RESERVED_ROUTE_PREFIXES: Final[tuple[str, ...]] = (
    f"/{BASE_ROUTE_CORE}/",
    f"/{BASE_ROUTE_MEDIA}/",
    f"/{BASE_ROUTE_COMPONENT}/",
)


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
    including path security, session management, and GZip compression.

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
    from streamlit.web.server.starlette.starlette_path_security_middleware import (
        PathSecurityMiddleware,
    )

    middleware: list[Middleware] = []

    # FIRST: Path security middleware to block dangerous paths before any other processing.
    middleware.append(Middleware(PathSecurityMiddleware))

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


class App:
    """ASGI-compatible Streamlit application.

    .. warning::
        This feature is experimental and may change or be removed in future
        versions without warning. Use at your own risk.

    This class provides a way to configure and run Streamlit applications
    with custom routes, middleware, lifespan hooks, and exception handlers.

    Parameters
    ----------
    script_path : str | Path
        Path to the main Streamlit script. Can be absolute or relative. Relative
        paths are resolved based on context: when started via ``streamlit run``,
        they resolve relative to the main script; when started directly via uvicorn
        or another ASGI server, they resolve relative to the current working directory.
    lifespan : Callable[[App], AbstractAsyncContextManager[dict[str, Any] | None]] | None
        Async context manager for startup/shutdown logic. The context manager
        receives the App instance and can yield a dictionary of state that will
        be accessible via ``app.state``.
    routes : Sequence[BaseRoute] | None
        Additional routes to mount alongside Streamlit. User routes are checked
        against reserved Streamlit routes and will raise ValueError if they conflict.
    middleware : Sequence[Middleware] | None
        Middleware stack to apply to all requests. User middleware runs before
        Streamlit's internal middleware.
    exception_handlers : Mapping[Any, ExceptionHandler] | None
        Custom exception handlers for user routes.
    debug : bool
        Enable debug mode for the underlying Starlette application.

    Examples
    --------
    Basic usage:

    >>> from streamlit.web.server.starlette import App
    >>> app = App("main.py")

    With lifespan hooks:

    >>> from contextlib import asynccontextmanager
    >>> from streamlit.web.server.starlette import App
    >>>
    >>> @asynccontextmanager
    ... async def lifespan(app):
    ...     print("Starting up...")
    ...     yield {"model": "loaded"}
    ...     print("Shutting down...")
    >>>
    >>> app = App("main.py", lifespan=lifespan)

    With custom routes:

    >>> from starlette.routing import Route
    >>> from starlette.responses import JSONResponse
    >>> from streamlit.web.server.starlette import App
    >>>
    >>> async def health(request):
    ...     return JSONResponse({"status": "ok"})
    >>>
    >>> app = App("main.py", routes=[Route("/health", health)])
    """

    def __init__(
        self,
        script_path: str | Path,
        *,
        lifespan: (
            Callable[[App], AbstractAsyncContextManager[dict[str, Any] | None]] | None
        ) = None,
        routes: Sequence[BaseRoute] | None = None,
        middleware: Sequence[Middleware] | None = None,
        exception_handlers: Mapping[Any, ExceptionHandler] | None = None,
        debug: bool = False,
    ) -> None:
        self._script_path = Path(script_path)
        self._user_lifespan = lifespan
        self._user_routes = list(routes) if routes else []
        self._user_middleware = list(middleware) if middleware else []
        self._exception_handlers = (
            dict(exception_handlers) if exception_handlers else {}
        )
        self._debug = debug

        self._runtime: Runtime | None = None
        self._starlette_app: Starlette | None = None
        self._state: dict[str, Any] = {}
        self._external_lifespan: bool = False

        # Validate user routes don't conflict with reserved routes
        self._validate_routes()

    def _validate_routes(self) -> None:
        """Validate that user routes don't conflict with reserved Streamlit routes."""
        for route in self._user_routes:
            path = getattr(route, "path", None)
            if path:
                for reserved in _RESERVED_ROUTE_PREFIXES:
                    if path.startswith(reserved) or path == reserved.rstrip("/"):
                        raise ValueError(
                            f"Route '{path}' conflicts with reserved Streamlit route "
                            f"prefix '{reserved}'. Use a different path like '/api/...'."
                        )

    @property
    def script_path(self) -> Path:
        """The entry point script path."""
        return self._script_path

    @property
    def state(self) -> dict[str, Any]:
        """Application state, populated by lifespan context manager."""
        return self._state

    def lifespan(self) -> Callable[[Any], AbstractAsyncContextManager[None]]:
        """Get a lifespan context manager for mounting on external ASGI frameworks.

        Use this when mounting st.App as a sub-application on another framework
        like FastAPI. The Streamlit runtime lifecycle will be managed by the
        parent framework's lifespan instead of st.App's internal lifespan.

        Returns
        -------
        Callable[[Any], AbstractAsyncContextManager[None]]
            A lifespan context manager compatible with Starlette/FastAPI.

        Examples
        --------
        Mount st.App on FastAPI:

        >>> from fastapi import FastAPI
        >>> from streamlit.starlette import App
        >>>
        >>> streamlit_app = App("dashboard.py")
        >>> fastapi_app = FastAPI(lifespan=streamlit_app.lifespan())
        >>> fastapi_app.mount("/dashboard", streamlit_app)
        """
        # Create runtime now (but don't start it - lifespan will do that)
        if self._runtime is None:
            self._runtime = self._create_runtime()

        # Mark that lifespan is externally managed
        self._external_lifespan = True

        return self._combined_lifespan

    def _resolve_script_path(self) -> Path:
        """Resolve the script path to an absolute path.

        Resolution order:
        1. If already absolute, return as-is
        2. If CLI set main_script_path (via `streamlit run`), resolve relative to it
        3. Otherwise, resolve relative to current working directory (e.g. when started via uvicorn)
        """
        if self._script_path.is_absolute():
            return self._script_path

        # Check if CLI set the main script path (streamlit run)
        # This is set in cli.py before config is loaded
        if config._main_script_path:
            return (Path(config._main_script_path).parent / self._script_path).resolve()

        # Fallback: resolve relative to cwd (direct uvicorn usage)
        return self._script_path.resolve()

    def _create_runtime(self) -> Runtime:
        """Create the Streamlit runtime (but don't start it yet)."""
        from streamlit.runtime import Runtime, RuntimeConfig
        from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
        from streamlit.runtime.memory_session_storage import MemorySessionStorage
        from streamlit.runtime.memory_uploaded_file_manager import (
            MemoryUploadedFileManager,
        )
        from streamlit.web.cache_storage_manager_config import (
            create_default_cache_storage_manager,
        )

        script_path = self._resolve_script_path()

        # Validate that the script file exists
        if not script_path.is_file():
            raise FileNotFoundError(
                f"Streamlit script not found: '{script_path}'. "
                f"Please verify that the path '{self._script_path}' is correct."
            )

        media_file_storage = MemoryMediaFileStorage(f"/{BASE_ROUTE_MEDIA}")
        uploaded_file_mgr = MemoryUploadedFileManager(f"/{BASE_ROUTE_UPLOAD_FILE}")

        return Runtime(
            RuntimeConfig(
                script_path=str(script_path),
                command_line=None,
                media_file_storage=media_file_storage,
                uploaded_file_manager=uploaded_file_mgr,
                cache_storage_manager=create_default_cache_storage_manager(),
                is_hello=False,
                session_storage=MemorySessionStorage(
                    ttl_seconds=config.get_option("server.disconnectedSessionTTL")
                ),
            ),
        )

    @asynccontextmanager
    async def _combined_lifespan(self, _app: Starlette) -> AsyncIterator[None]:
        """Combine Streamlit runtime lifecycle with user's lifespan.

        The runtime must already be created (via _create_runtime) before this
        lifespan runs. This lifespan handles starting and stopping the runtime.
        """
        from streamlit.web.bootstrap import prepare_streamlit_environment

        if self._runtime is None:
            raise RuntimeError(
                "Runtime not initialized. Call _create_runtime before lifespan."
            )

        # Set server mode for metrics tracking.
        # We need to detect if the app is mounted on another framework (FastAPI, etc.)
        # based on the _external_lifespan flag, which is set when lifespan() is called.
        if self._external_lifespan:
            # App is mounted on another framework - this takes precedence over CLI mode
            # because it reflects the actual architectural pattern being used.
            config._server_mode = "asgi-mounted"
        elif config._server_mode is None:
            # Standalone st.App started directly via external ASGI server (not CLI)
            config._server_mode = "asgi-server"
        # If config._server_mode is already "starlette-app" (set by CLI) and
        # _external_lifespan is False, keep it as "starlette-app"

        # Prepare the Streamlit environment (secrets, pydeck, static folder check)
        # Use resolved path to ensure correct directory for static folder check
        prepare_streamlit_environment(str(self._resolve_script_path()))

        # Start runtime (enables full cache support)
        await self._runtime.start()

        try:
            # Run user's lifespan
            if self._user_lifespan:
                async with self._user_lifespan(self) as state:
                    if state:
                        self._state.update(state)
                    yield
            else:
                yield
        finally:
            # Stop runtime
            self._runtime.stop()

    def _build_starlette_app(self) -> Starlette:
        """Build the Starlette application with all routes and middleware."""
        from starlette.applications import Starlette

        from streamlit.runtime import RuntimeState

        # If lifespan() was called, the parent framework manages the lifecycle.
        # Check if the runtime was actually started by the parent framework.
        # If not, the user likely called lifespan() but then used the app standalone,
        # which would result in the runtime never starting.
        if self._external_lifespan:
            runtime_not_started = (
                self._runtime is None or self._runtime.state == RuntimeState.INITIAL
            )
            if runtime_not_started:
                raise RuntimeError(
                    "Cannot use App as standalone ASGI application after calling "
                    "lifespan(). The lifespan() method should only be used when "
                    "mounting this App on another ASGI framework like FastAPI."
                )

        # Create the runtime if not already created
        if self._runtime is None:
            self._runtime = self._create_runtime()

        # Get Streamlit's internal routes
        streamlit_routes = create_streamlit_routes(self._runtime)

        # User routes come first (higher priority), then Streamlit routes
        # This allows users to override non-reserved routes like static files
        all_routes = self._user_routes + streamlit_routes

        # Get Streamlit's internal middleware
        streamlit_middleware = create_streamlit_middleware()

        # User middleware wraps Streamlit middleware (runs first on request,
        # last on response)
        all_middleware = self._user_middleware + streamlit_middleware

        # If external lifespan, the parent manages lifecycle; otherwise use internal
        app_lifespan = None if self._external_lifespan else self._combined_lifespan

        return Starlette(
            debug=self._debug,
            routes=all_routes,
            middleware=all_middleware,
            exception_handlers=self._exception_handlers,
            lifespan=app_lifespan,
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """ASGI interface."""
        if self._starlette_app is None:
            self._starlette_app = self._build_starlette_app()

        await self._starlette_app(scope, receive, send)


__all__ = ["App", "create_starlette_app"]
