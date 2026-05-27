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

import copy
from collections.abc import Mapping as MappingABC
from contextlib import asynccontextmanager
from pathlib import Path
from typing import TYPE_CHECKING, Any, Final

from streamlit import config
from streamlit.web.server.server_util import get_cookie_secret
from streamlit.web.server.starlette.starlette_app_utils import (
    generate_random_hex_string,
)
from streamlit.web.server.starlette.starlette_auth_routes import create_auth_routes
from streamlit.web.server.starlette.starlette_gzip_middleware import (
    SelectiveGZipMiddleware,
)
from streamlit.web.server.starlette.starlette_path_security_middleware import (
    PathSecurityMiddleware,
)
from streamlit.web.server.starlette.starlette_routes import (
    BASE_ROUTE_COMPONENT,
    BASE_ROUTE_CORE,
    BASE_ROUTE_MEDIA,
    BASE_ROUTE_STATIC,
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
    ANYIO_STATIC_FILE_THREAD_TOKENS,
    GZIP_COMPRESSLEVEL,
    GZIP_MINIMUM_SIZE,
    SESSION_COOKIE_NAME,
)
from streamlit.web.server.starlette.starlette_static_routes import (
    create_streamlit_static_assets_routes,
)
from streamlit.web.server.starlette.starlette_websocket import create_websocket_routes

if TYPE_CHECKING:
    import asyncio
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
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        OnScriptErrorHandler,
    )
    from streamlit.runtime.secrets import SecretsValue

# Reserved route prefixes that users cannot override.
_RESERVED_ROUTE_PREFIXES: Final[tuple[str, ...]] = (
    f"/{BASE_ROUTE_CORE}/",  # Core API endpoints (health, upload, stream, etc.)
    f"/{BASE_ROUTE_MEDIA}/",  # Media file serving
    f"/{BASE_ROUTE_COMPONENT}/",  # Custom component serving
    f"/{BASE_ROUTE_STATIC}/",  # Frontend assets (JS/CSS bundles)
)


def _set_anyio_thread_limiter() -> None:
    """Apply the measured AnyIO thread limit for Starlette file serving."""
    from anyio import to_thread

    to_thread.current_default_thread_limiter().total_tokens = (
        ANYIO_STATIC_FILE_THREAD_TOKENS
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

    middleware: list[Middleware] = []

    # FIRST: Path security middleware to block dangerous paths before any other processing.
    middleware.append(Middleware(PathSecurityMiddleware))

    # Add session middleware
    middleware.append(
        Middleware(
            SessionMiddleware,
            secret_key=get_cookie_secret() or generate_random_hex_string(),
            same_site="lax",
            https_only=bool(config.get_option("server.sslCertFile")),
            session_cookie=SESSION_COOKIE_NAME,
        )
    )

    # Keep static asset responses out of the gzip middleware. Local load testing
    # showed that bypassing gzip on these paths materially improves initial load
    # times and peak RSS, while a session-only bypass regressed.
    middleware.append(
        Middleware(
            SelectiveGZipMiddleware,
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
            "Starlette is not installed. Please reinstall Streamlit."
        ) from exc

    # Define lifespan context manager for startup/shutdown events
    @asynccontextmanager
    async def _lifespan(_app: Starlette) -> AsyncIterator[None]:
        _set_anyio_thread_limiter()
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

    .. warning::
        Hosting multiple ``App`` instances with different ``script_path`` values
        in the same process is not supported. The first ``App`` constructed in a
        process pins the script-level config directory (via the process-global
        ``config._main_script_path``), and subsequent ``App`` instances will
        resolve relative ``script_path`` values against that first directory
        rather than the current working directory.

    This class provides a way to configure and run Streamlit applications
    with custom routes, middleware, lifespan hooks, and exception handlers.

    Parameters
    ----------
    script_path : str | Path
        Path to the main Streamlit script. Can be absolute or relative. Relative
        paths are resolved based on context: when started via ``streamlit run``,
        they resolve relative to the main script; when started directly via uvicorn
        or another ASGI server, they resolve relative to the current working directory.
    secrets : Mapping[str, SecretsValue] | None
        A dictionary of secrets to make available via ``st.secrets``. Supported
        value types are: ``str``, ``int``, ``float``, ``bool``, and nested ``dict``.
        When provided, these secrets are shallow-merged with file-based secrets
        (programmatic secrets override file-based secrets at the top level).
        Unsupported types raise ``TypeError`` at construction.
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
    on_script_error : Callable[[Exception], bool | None] | None
        Callback invoked when an uncaught exception occurs during script execution.
        The callback receives the exception and can optionally return ``True`` to
        suppress the default exception display in the UI, allowing custom error UI
        to be shown instead. Returns ``False`` or ``None`` to show the exception
        normally. Useful for integrating with error monitoring services like Sentry.

        The handler is invoked for:

        - Uncaught exceptions in the full app script
        - Exceptions in widget callbacks (``on_change``, ``on_click``, etc.)

        The handler is NOT invoked for:

        - ``st.stop()`` / ``st.rerun()`` (control flow, not errors)
        - Syntax/compile errors in the script
        - ``KeyboardInterrupt`` / ``SystemExit``
    exception_handlers : Mapping[Any, ExceptionHandler] | None
        A mapping of either integer status codes, or exception class types onto
        callables which handle the exceptions. Exception handler callables should
        be of the form ``handler(request, exc) -> response`` and may be either
        standard functions, or async functions. This is only for exception handling
        on the network layer. Use ``on_script_error`` for customized handling of
        uncaught exceptions from the app script.
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

    With programmatic secrets:

    >>> import os
    >>> from streamlit.web.server.starlette import App
    >>>
    >>> app = App(
    ...     "main.py",
    ...     secrets={
    ...         "database": {
    ...             "host": os.environ["DB_HOST"],
    ...             "password": os.environ["DB_PASSWORD"],
    ...         }
    ...     },
    ... )

    With error monitoring (Sentry):

    >>> import sentry_sdk
    >>> from streamlit.web.server.starlette import App
    >>>
    >>> sentry_sdk.init(dsn="...")
    >>>
    >>> def log_to_sentry(exc):
    ...     sentry_sdk.capture_exception(exc)
    ...     return None  # Show default exception display
    >>>
    >>> app = App("main.py", on_script_error=log_to_sentry)

    With custom error UI:

    >>> import streamlit as st
    >>> from streamlit.web.server.starlette import App
    >>>
    >>> def custom_error_handler(exc):
    ...     st.error("Something went wrong!")
    ...     return True  # Suppress default exception display
    >>>
    >>> app = App("main.py", on_script_error=custom_error_handler)
    """

    def __init__(
        self,
        script_path: str | Path,
        *,
        secrets: Mapping[str, SecretsValue] | None = None,
        lifespan: (
            Callable[[App], AbstractAsyncContextManager[dict[str, Any] | None]] | None
        ) = None,
        routes: Sequence[BaseRoute] | None = None,
        middleware: Sequence[Middleware] | None = None,
        on_script_error: OnScriptErrorHandler | None = None,
        exception_handlers: Mapping[Any, ExceptionHandler] | None = None,
        debug: bool = False,
    ) -> None:
        from streamlit.runtime.secrets import _validate_secrets_value

        self._script_path = Path(script_path)
        self._user_lifespan = lifespan
        self._user_routes = list(routes) if routes else []
        self._user_middleware = list(middleware) if middleware else []
        self._on_script_error = on_script_error
        self._exception_handlers = (
            dict(exception_handlers) if exception_handlers else {}
        )
        self._debug = debug

        # Validate and store programmatic secrets (deep copy to prevent external mutation)
        if secrets is not None:
            if not isinstance(secrets, MappingABC):
                raise TypeError(
                    f"secrets must be a mapping (dict), got {type(secrets).__name__!r}."
                )
            # Validate all keys are strings and values have allowed types
            _validate_secrets_value(dict(secrets))
        self._programmatic_secrets = (
            copy.deepcopy(secrets) if secrets is not None else None
        )
        self._secrets_applied: bool = False

        self._runtime: Runtime | None = None
        self._starlette_app: Starlette | None = None
        self._state: dict[str, Any] = {}
        self._external_lifespan: bool = False
        # Track if runtime was auto-started (for mounted apps without explicit lifespan)
        self._auto_started: bool = False
        self._startup_lock: asyncio.Lock | None = None

        # Cache the resolved script path so _resolve_script_path() is idempotent
        # even after we set config._main_script_path below. We initialize to
        # None first so the inner _resolve_script_path() call falls through to
        # the existing branches; the result is then cached for subsequent
        # invocations.
        self._resolved_script_path: Path | None = None
        self._resolved_script_path = self._resolve_script_path()

        # Mirror what `streamlit run` does in cli.py so the script-level
        # `.streamlit/config.toml` is discoverable when st.App is launched
        # directly via an external ASGI server (e.g. uvicorn) from a working
        # directory that is not the script's directory. We assign here in
        # __init__ (not in _combined_lifespan) because config.get_option() is
        # read by _build_starlette_app -> create_streamlit_routes BEFORE the
        # lifespan startup runs, which would otherwise cache a config_options
        # dict that omits the script-level config. The guard preserves any
        # value already set by `streamlit run`.
        #
        # Note: `config._main_script_path` is process-global (like
        # `config._config_options`), so the first `App` constructed in a
        # process pins the script-level config directory. Hosting multiple
        # `App` instances with different configs in one process is not
        # supported and was not supported prior to this change.
        if config._main_script_path is None:
            config._main_script_path = str(self._resolved_script_path)

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
        1. If `__init__` has already cached a resolved path, return it (so the
           result remains stable even after config._main_script_path is set
           by this App instance).
        2. If already absolute, return as-is.
        3. If CLI set main_script_path (via `streamlit run`), resolve relative to it.
        4. Otherwise, resolve relative to current working directory (e.g. when
           started via uvicorn).
        """
        # Use getattr with a default so this method is safe to call from inside
        # __init__ before self._resolved_script_path has been assigned.
        cached: Path | None = getattr(self, "_resolved_script_path", None)
        if cached is not None:
            return cached

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
                media_file_storage=media_file_storage,
                uploaded_file_manager=uploaded_file_mgr,
                cache_storage_manager=create_default_cache_storage_manager(),
                is_hello=False,
                session_storage=MemorySessionStorage(
                    ttl_seconds=config.get_option("server.disconnectedSessionTTL")
                ),
                on_script_error=self._on_script_error,
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

        # Merge programmatic secrets (after file-based secrets are loaded)
        # Only apply once to prevent re-entry issues with test harnesses or restarts
        if self._programmatic_secrets and not self._secrets_applied:
            from streamlit.runtime.secrets import secrets_singleton

            secrets_singleton.merge_programmatic_secrets(self._programmatic_secrets)
            self._secrets_applied = True

        _set_anyio_thread_limiter()

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
        """ASGI interface.

        When mounted on another ASGI framework without using the lifespan() method,
        the runtime will be auto-started on the first HTTP/WebSocket request.
        """
        import asyncio as _asyncio

        from streamlit.runtime import RuntimeState

        if self._starlette_app is None:
            self._starlette_app = self._build_starlette_app()

        # Auto-start runtime for mounted apps that didn't use lifespan().
        # This handles the common pattern: Mount("/st", App("main.py"))
        # The lifespan scope is only sent to the root app, not mounted apps,
        # so we need to start the runtime lazily on the first real request.
        if (
            scope["type"] in {"http", "websocket"}
            and self._runtime is not None
            and self._runtime.state == RuntimeState.INITIAL
        ):
            # Use a lock to prevent concurrent startup attempts
            if self._startup_lock is None:
                self._startup_lock = _asyncio.Lock()

            async with self._startup_lock:
                # Double-check after acquiring lock in case another request
                # already started the runtime while we were waiting.
                if (
                    self._runtime.state == RuntimeState.INITIAL
                    and not self._auto_started
                ):
                    await self._auto_start_runtime()

        await self._starlette_app(scope, receive, send)

    async def _auto_start_runtime(self) -> None:
        """Auto-start the runtime for mounted apps without explicit lifespan.

        This is called when the app is mounted on another ASGI framework without
        using the lifespan() method. The runtime will be started on the first
        HTTP/WebSocket request.

        Note: This assumes the ASGI server implements the lifespan protocol. All
        major ASGI servers (uvicorn, hypercorn, daphne) support it, so standalone
        apps using lifespan() will work correctly. If an ASGI server does not
        implement lifespan, a standalone app would also trigger this auto-start
        path and be labelled as "asgi-mounted" in metrics.
        """
        import atexit

        from streamlit.logger import get_logger
        from streamlit.web.bootstrap import prepare_streamlit_environment

        logger = get_logger(__name__)

        if self._runtime is None:
            return

        # Warn if user provided a lifespan but it's being skipped due to auto-start.
        # This helps users catch the misconfiguration where they pass lifespan to
        # App.__init__ but then mount without calling app.lifespan().
        if self._user_lifespan is not None:
            logger.warning(
                "Auto-starting runtime, but a user-provided lifespan was configured. "
                "The lifespan hooks will be skipped. To use your lifespan, mount the "
                "app using: FastAPI(lifespan=streamlit_app.lifespan())"
            )

        # Set server mode for metrics tracking. Only set to "asgi-mounted" when
        # the app is actually mounted (external lifespan not used means direct mount).
        # Do not override an explicit mode set by the embedding environment.
        if config._server_mode is None:
            config._server_mode = "asgi-mounted"

        # Prepare the Streamlit environment
        prepare_streamlit_environment(str(self._resolve_script_path()))

        # Merge programmatic secrets (after file-based secrets are loaded)
        if self._programmatic_secrets and not self._secrets_applied:
            from streamlit.runtime.secrets import secrets_singleton

            secrets_singleton.merge_programmatic_secrets(self._programmatic_secrets)
            self._secrets_applied = True

        _set_anyio_thread_limiter()

        # Start runtime
        await self._runtime.start()
        self._auto_started = True

        # Register cleanup on process exit
        def _cleanup() -> None:
            if self._runtime is not None and self._auto_started:
                try:
                    self._runtime.stop()
                except RuntimeError:
                    # During process shutdown, the event loop may already be closed.
                    # Runtime.stop() uses call_soon_threadsafe which raises RuntimeError
                    # if the loop is closed. Silently ignore this since we're exiting.
                    pass

        atexit.register(_cleanup)


__all__ = ["App", "create_starlette_app"]
