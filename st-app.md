# `st.App` - ASGI Application Entry Point

This document proposes a new `st.App` class that provides an ASGI-compatible entry point for Streamlit applications, enabling advanced configuration of routes, middleware, lifespan, and more.

## Overview

`st.App` extends the Starlette migration ([#12772](https://github.com/streamlit/streamlit/pull/12772)) to expose Streamlit as a configurable ASGI application. This enables:

1. **Startup/shutdown hooks** via ASGI lifespan
2. **Custom routes** alongside the Streamlit app
3. **Custom middleware** (auth, logging, rate limiting, etc.)
4. **Running with any ASGI server** (uvicorn, hypercorn, daphne, etc.)
5. **Embedding Streamlit** in larger applications

## Basic Usage

```python
# streamlit_app.py
import streamlit as st

app = st.App(Path("pages/main.py"))
```

Run with either:
```bash
# Streamlit CLI (auto-detects st.App usage)
streamlit run streamlit_app.py

# Or any ASGI server
uvicorn streamlit_app:app --host 0.0.0.0 --port 8501
```

## API Reference

### `st.App`

```python
class App:
    def __init__(
        self,
        script_path: str | Path,
        *,
        # Lifespan
        lifespan: Callable[[App], AsyncContextManager[dict[str, Any] | None]] | None = None,

        # Routes
        routes: Sequence[BaseRoute] | None = None,

        # Middleware
        middleware: Sequence[Middleware] | None = None,

        # Exception handlers
        exception_handlers: Mapping[Any, ExceptionHandler] | None = None,

        # Configuration overrides
        debug: bool = False,
    ) -> None:
        ...
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `script_path` | `str \| Path` | Path to the main Streamlit script (relative to the app file or absolute) |
| `lifespan` | `AsyncContextManager` | Async context manager for startup/shutdown logic |
| `routes` | `Sequence[BaseRoute]` | Additional routes to mount alongside Streamlit (see [Route Protection](#route-protection)) |
| `middleware` | `Sequence[Middleware]` | Middleware stack to apply to all requests (see [Middleware Ordering](#middleware-ordering)) |
| `exception_handlers` | `Mapping` | Custom exception handlers |
| `debug` | `bool` | Enable debug mode |

---

## Feature Examples

### 1. Lifespan Hooks (Startup/Shutdown)

Pre-warm caches, initialize connections, and clean up on shutdown:

```python
# streamlit_app.py
import streamlit as st
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Startup: runs AFTER Runtime starts, BEFORE accepting connections
    print("Pre-warming caches...")
    from myapp.cache import load_ml_model, init_db_pool

    model = load_ml_model()   # @st.cache_resource - fully functional
    db = init_db_pool()       # @st.cache_resource - fully functional

    print("Server ready!")

    # Yield state that can be accessed via app.state
    yield {"model": model, "db": db}

    # Shutdown: runs on graceful shutdown
    print("Cleaning up...")
    await db.close()

app = st.App(Path("pages/main.py"), lifespan=lifespan)
```

**Key benefit:** Caches are pre-warmed before the first user connects, eliminating cold-start latency.

### 2. Custom Routes

Add REST API endpoints alongside your Streamlit app:

```python
# streamlit_app.py
import streamlit as st
from starlette.routing import Route
from starlette.responses import JSONResponse

async def api_health(request):
    return JSONResponse({"status": "healthy", "version": "1.0.0"})

async def api_predict(request):
    data = await request.json()
    # Use the same cached model as Streamlit
    from myapp.cache import load_ml_model
    model = load_ml_model()
    result = model.predict(data["input"])
    return JSONResponse({"prediction": result})

app = st.App(
    Path("pages/main.py"),
    routes=[
        Route("/api/health", api_health),
        Route("/api/predict", api_predict, methods=["POST"]),
    ],
)
```

**Use cases:**
- REST API for programmatic access
- Webhook endpoints
- Health checks for orchestrators
- Admin endpoints

### 3. Custom Middleware

Add authentication, logging, rate limiting, or other cross-cutting concerns:

```python
# streamlit_app.py
import streamlit as st
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

# Custom middleware example
class RequestLoggingMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            print(f"Request: {scope['method']} {scope['path']}")
        await self.app(scope, receive, send)

app = st.App(
    Path("pages/main.py"),
    middleware=[
        Middleware(TrustedHostMiddleware, allowed_hosts=["example.com", "*.example.com"]),
        Middleware(CORSMiddleware, allow_origins=["https://example.com"]),
        Middleware(RequestLoggingMiddleware),
    ],
)
```

**Common middleware use cases:**
- **CORS** - Cross-origin requests for embedded apps
- **Authentication** - JWT validation, OAuth, API keys
- **Rate limiting** - Protect against abuse
- **Request logging** - Audit trails
- **Compression** - GZip responses
- **Trusted hosts** - Security hardening

> **Note:** See [Middleware Ordering](#middleware-ordering) for details on how user middleware interacts with Streamlit's internal middleware.

### 4. Exception Handlers

Custom error handling for specific exceptions:

```python
# streamlit_app.py
import streamlit as st
from starlette.responses import JSONResponse, HTMLResponse

async def handle_value_error(request, exc):
    return JSONResponse(
        {"error": str(exc), "type": "validation_error"},
        status_code=400,
    )

async def handle_500(request, exc):
    # Log to external service
    log_error_to_sentry(exc)
    return HTMLResponse("<h1>Something went wrong</h1>", status_code=500)

app = st.App(
    Path("pages/main.py"),
    exception_handlers={
        ValueError: handle_value_error,
        500: handle_500,
    },
)
```

### 5. Mounting Sub-Applications

Mount Streamlit alongside other ASGI apps:

```python
# main_app.py
from starlette.applications import Starlette
from starlette.routing import Mount, Route
from starlette.responses import JSONResponse
import streamlit as st

async def homepage(request):
    return JSONResponse({"message": "Welcome to the API"})

# Create Streamlit app
streamlit_app = st.App(Path("dashboard/main.py"))

# Create main application with Streamlit mounted
app = Starlette(
    routes=[
        Route("/", homepage),
        Route("/api/v1/data", data_endpoint),
        Mount("/dashboard", app=streamlit_app),  # Streamlit at /dashboard
    ],
)
```

### 6. Full Example: Production-Ready Setup

```python
# streamlit_app.py
import streamlit as st
from contextlib import asynccontextmanager
from starlette.routing import Route
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============== Lifespan ==============
@asynccontextmanager
async def lifespan(app):
    logger.info("Starting up...")

    # Pre-warm caches
    from myapp.cache import load_ml_model, init_db_pool
    model = load_ml_model()
    db = await init_db_pool()

    # Validate configuration
    from myapp.config import validate_config
    validate_config()

    logger.info("Server ready to accept connections")

    yield {"model": model, "db": db}

    logger.info("Shutting down...")
    await db.close()
    logger.info("Shutdown complete")

# ============== Custom Routes ==============
async def health_check(request):
    return JSONResponse({"status": "healthy"})

async def readiness_check(request):
    # Check if caches are warm
    from myapp.cache import load_ml_model
    try:
        model = load_ml_model()
        return JSONResponse({"status": "ready", "model_loaded": True})
    except Exception as e:
        return JSONResponse({"status": "not_ready", "error": str(e)}, status_code=503)

async def api_inference(request):
    data = await request.json()
    from myapp.cache import load_ml_model
    model = load_ml_model()
    result = model.predict(data["features"])
    return JSONResponse({"prediction": result.tolist()})

# ============== Middleware ==============
class RequestIDMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        import uuid
        if scope["type"] == "http":
            scope["state"]["request_id"] = str(uuid.uuid4())
        await self.app(scope, receive, send)

# ============== Application ==============
app = st.App(
    "pages/main.py",
    lifespan=lifespan,
    routes=[
        Route("/health", health_check),
        Route("/ready", readiness_check),
        Route("/api/v1/inference", api_inference, methods=["POST"]),
    ],
    middleware=[
        Middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"]),
        Middleware(RequestIDMiddleware),
    ],
    exception_handlers={
        ValueError: lambda req, exc: JSONResponse({"error": str(exc)}, status_code=400),
    },
)
```

---

## Route and Middleware Protection

### Reserved Routes {#route-protection}

Streamlit reserves certain route prefixes for internal functionality. User routes **cannot override** these:

| Route Prefix | Purpose |
|--------------|---------|
| `/_stcore/*` | Core Streamlit API (WebSocket, health, upload, etc.) |
| `/media/*` | Media file serving |
| `/component/*` | Custom component serving |
| `/_stcore/bidi-components/*` | Bidirectional components |

If a user route conflicts with a reserved route, `st.App` will raise a `ValueError` at startup:

```python
# This will raise ValueError: Route '/\_stcore/custom' conflicts with reserved Streamlit route
app = st.App(
    Path("main.py"),
    routes=[Route("/_stcore/custom", my_handler)],  # Error!
)
```

**Safe patterns for custom routes:**
```python
# Good: Use /api/ prefix for custom endpoints
routes=[
    Route("/api/health", health_check),
    Route("/api/v1/predict", predict),
    Route("/webhook", webhook_handler),
]
```

### Middleware Ordering {#middleware-ordering}

Middleware is applied in a specific order to ensure Streamlit functions correctly:

```
Request → [User Middleware] → [Streamlit Middleware] → [Route Handler]
Response ← [User Middleware] ← [Streamlit Middleware] ← [Route Handler]
```

**Streamlit's internal middleware (always applied):**

| Middleware | Purpose | Can be overridden? |
|------------|---------|-------------------|
| `GZipMiddleware` | Response compression | No (but can be configured) |
| `SessionMiddleware` | Session cookie handling | No |
| `XSRFMiddleware` | CSRF protection | No (security critical) |
| `ErrorHandlingMiddleware` | Streamlit error display | No |

**User middleware runs first**, wrapping Streamlit's middleware. This means:
- User auth middleware can reject requests before they reach Streamlit
- User logging middleware sees all requests/responses
- User middleware cannot bypass Streamlit's security middleware

**Example: Auth middleware that protects everything:**

```python
class AuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Check auth header
            headers = dict(scope.get("headers", []))
            auth = headers.get(b"authorization", b"").decode()

            if not self._is_valid_token(auth):
                response = JSONResponse({"error": "Unauthorized"}, status_code=401)
                await response(scope, receive, send)
                return

        await self.app(scope, receive, send)

app = st.App(
    Path("main.py"),
    middleware=[Middleware(AuthMiddleware)],  # Runs before Streamlit middleware
)
```

### Protecting Specific Routes Only

To apply middleware to only certain routes, use Starlette's route-level middleware or sub-applications:

```python
from starlette.routing import Route, Mount
from starlette.middleware import Middleware

# Middleware only for /api/* routes
api_routes = [
    Route("/api/data", data_handler),
    Route("/api/predict", predict_handler),
]

app = st.App(
    Path("main.py"),
    routes=[
        Mount("/api", routes=api_routes, middleware=[
            Middleware(APIKeyAuthMiddleware),
            Middleware(RateLimitMiddleware),
        ]),
        Route("/webhook", webhook_handler),  # No extra middleware
    ],
)
```

### Exception Handler Scope

Exception handlers apply to **user routes only**, not to Streamlit's internal routes. Streamlit handles its own errors to ensure proper error display in the UI.

```python
# This handler will NOT catch errors from Streamlit's WebSocket handler
app = st.App(
    Path("main.py"),
    exception_handlers={
        ValueError: custom_value_error_handler,  # Only for user routes
    },
)
```

To customize error handling for the Streamlit app itself, use `st.exception` or custom error boundaries in your Streamlit code.

---

## Implementation

### App Discovery

When `streamlit run streamlit_app.py` is invoked, Streamlit detects if the script uses `st.App`:

```python
# lib/streamlit/web/server/app_discovery.py

import importlib
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Union

@dataclass
class AppDiscoveryResult:
    """Result of app discovery."""
    is_st_app: bool
    app_name: str | None
    import_string: str | None

def get_module_data_from_path(path: Path) -> tuple[str, Path]:
    """Convert a file path to a module import string."""
    use_path = path.resolve()
    module_path = use_path
    if use_path.is_file() and use_path.stem == "__init__":
        module_path = use_path.parent

    module_paths = [module_path]
    extra_sys_path = module_path.parent

    for parent in module_path.parents:
        init_path = parent / "__init__.py"
        if init_path.is_file():
            module_paths.insert(0, parent)
            extra_sys_path = parent.parent
        else:
            break

    module_str = ".".join(p.stem for p in module_paths)
    return module_str, extra_sys_path

def discover_streamlit_app(
    path: Path,
    app_name: str | None = None,
) -> AppDiscoveryResult:
    """Discover if a Python file contains an st.App instance.

    Similar to FastAPI CLI's discovery mechanism.
    """
    from streamlit import App  # Import the App class

    module_str, extra_sys_path = get_module_data_from_path(path)
    sys.path.insert(0, str(extra_sys_path))

    try:
        mod = importlib.import_module(module_str)
    except (ImportError, ValueError):
        return AppDiscoveryResult(is_st_app=False, app_name=None, import_string=None)

    object_names = dir(mod)

    # If app_name is provided, check that specific name
    if app_name:
        if app_name in object_names:
            obj = getattr(mod, app_name)
            if isinstance(obj, App):
                return AppDiscoveryResult(
                    is_st_app=True,
                    app_name=app_name,
                    import_string=f"{module_str}:{app_name}",
                )
        return AppDiscoveryResult(is_st_app=False, app_name=None, import_string=None)

    # Check preferred names first
    for preferred_name in ["app", "application", "streamlit_app"]:
        if preferred_name in object_names:
            obj = getattr(mod, preferred_name)
            if isinstance(obj, App):
                return AppDiscoveryResult(
                    is_st_app=True,
                    app_name=preferred_name,
                    import_string=f"{module_str}:{preferred_name}",
                )

    # Fall back to any App instance
    for name in object_names:
        obj = getattr(mod, name)
        if isinstance(obj, App):
            return AppDiscoveryResult(
                is_st_app=True,
                app_name=name,
                import_string=f"{module_str}:{name}",
            )

    return AppDiscoveryResult(is_st_app=False, app_name=None, import_string=None)
```

### Bootstrap Integration

The key insight is that bootstrap logic (sys.path fixes, secrets loading, config watchers, etc.)
should run **before** detecting whether to use traditional or ASGI mode. This ensures consistent
behavior regardless of execution mode.

```python
# lib/streamlit/web/bootstrap.py (modified)

def run(
    main_script_path: str,
    is_hello: bool,
    args: list[str],
    flag_options: dict[str, Any],
) -> None:
    """Run a script in a separate thread and start a server for the app."""

    # === Bootstrap logic runs first (same for both modes) ===
    _fix_sys_path(main_script_path)
    _fix_sys_argv(main_script_path, args)
    _fix_pydeck_mapbox_api_warning()
    _install_config_watchers(flag_options)

    # Load secrets early
    try:
        secrets.load_if_toml_exists()
    except Exception:
        _LOGGER.exception("Failed to load secrets.toml file")

    # Check static folder configuration
    _maybe_print_static_folder_warning(main_script_path)

    # === Now detect execution mode ===
    discovery = discover_streamlit_app(Path(main_script_path))

    if discovery.is_st_app:
        # Run in ASGI mode with uvicorn
        _run_asgi_app(discovery.import_string, flag_options)
    else:
        # Traditional mode: create Server and run
        _run_traditional(main_script_path, is_hello, flag_options)


def _run_asgi_app(import_string: str, flag_options: dict[str, Any]) -> None:
    """Run the discovered st.App with uvicorn."""
    import uvicorn

    host = config.get_option("server.address") or "localhost"
    port = int(config.get_option("server.port"))

    # Print URL (similar to traditional mode)
    _print_url(is_running_hello=False)

    uvicorn.run(
        import_string,
        host=host,
        port=port,
        reload=config.get_option("server.runOnSave"),
        log_level="warning",  # Streamlit handles its own logging
    )


def _run_traditional(main_script_path: str, is_hello: bool, flag_options: dict[str, Any]) -> None:
    """Run in traditional Streamlit mode with the built-in server."""
    # ... existing Server-based implementation ...
```

This approach ensures:
- **Consistent bootstrap**: sys.path, secrets, config watchers all run regardless of mode
- **Single entry point**: `streamlit run` works seamlessly for both traditional and App-based scripts
- **No duplication**: Bootstrap logic stays in one place

### `App` Class Implementation

The `App` class is implemented in `lib/streamlit/web/server/starlette/starlette_app.py` alongside
the internal `create_starlette_app` function. This consolidates all Starlette app creation logic
in one place.

```python
# lib/streamlit/web/server/starlette/starlette_app.py

# ... imports and helper functions ...

# Reserved route prefixes that users cannot override
_RESERVED_ROUTE_PREFIXES: Final[tuple[str, ...]] = (
    "/_stcore/",
    "/media/",
    "/component/",
)


def create_streamlit_routes(runtime: Runtime) -> list[BaseRoute]:
    """Create Streamlit's internal routes (health, media, websocket, etc.)."""
    # ... implementation ...


def create_streamlit_middleware() -> list[Middleware]:
    """Create Streamlit's internal middleware (session, gzip)."""
    # ... implementation ...


def create_starlette_app(runtime: Runtime) -> Starlette:
    """Internal factory used by StarletteServer for CLI mode."""
    # ... implementation ...


class App:
    """ASGI-compatible Streamlit application.

    This class provides a way to configure and run Streamlit applications
    with custom routes, middleware, lifespan hooks, and exception handlers.
    """

    def __init__(
        self,
        script_path: str | Path,
        *,
        lifespan: Callable[[App], AbstractAsyncContextManager[dict[str, Any] | None]] | None = None,
        routes: Sequence[BaseRoute] | None = None,
        middleware: Sequence[Middleware] | None = None,
        exception_handlers: Mapping[Any, ExceptionHandler] | None = None,
        debug: bool = False,
    ) -> None:
        # ... validation and initialization ...

    def _build_starlette_app(self) -> Starlette:
        """Build the Starlette application with all routes and middleware."""
        # Reuses create_streamlit_routes() and create_streamlit_middleware()
        streamlit_routes = create_streamlit_routes(self._runtime)
        streamlit_middleware = create_streamlit_middleware()

        # User routes/middleware come first (higher priority)
        all_routes = self._user_routes + streamlit_routes
        all_middleware = self._user_middleware + streamlit_middleware

        return Starlette(
            debug=self._debug,
            routes=all_routes,
            middleware=all_middleware,
            exception_handlers=self._exception_handlers,
            lifespan=self._combined_lifespan,
        )

    async def __call__(self, scope, receive, send) -> None:
        """ASGI interface."""
        if self._starlette_app is None:
            self._starlette_app = self._build_starlette_app()
        await self._starlette_app(scope, receive, send)


__all__ = ["App", "create_starlette_app"]
```

### Current Export Location

Currently, `App` is exported from the starlette subpackage:

```python
# lib/streamlit/web/server/starlette/__init__.py

from streamlit.web.server.starlette.starlette_app import App, create_starlette_app
from streamlit.web.server.starlette.starlette_server import StarletteServer

__all__ = ["App", "StarletteServer", "create_starlette_app"]
```

### Future: Exposing in `st` Namespace

Once the feature is stable, `App` can be exposed in the main `st` namespace:

```python
# lib/streamlit/__init__.py

from streamlit.web.server.starlette.starlette_app import App

__all__ = [
    # ... existing exports
    "App",
]
```

---

## Features Enabled by `st.App`

### 1. Cache Pre-Warming
Eliminate cold-start latency by loading ML models and data before the first user connects.

### 2. REST API Alongside Streamlit
Expose programmatic endpoints for:
- Machine learning inference APIs
- Data export endpoints
- Webhook receivers
- Health/readiness probes for Kubernetes

### 3. Custom Authentication
Implement custom auth flows:
- JWT validation middleware
- OAuth2 integration
- API key authentication
- Role-based access control

### 4. Advanced Deployment Patterns
- **Blue-green deployments** with readiness checks
- **Canary releases** with traffic splitting middleware
- **Multi-tenant apps** with tenant isolation middleware
- **Rate limiting** to prevent abuse

### 5. Observability
- Request tracing middleware (OpenTelemetry)
- Custom metrics endpoints
- Structured logging middleware
- Error reporting (Sentry integration)

### 6. Embedding in Larger Applications
Mount Streamlit as a sub-application:
- Admin dashboards in existing web apps
- Analytics panels in SaaS products
- Internal tools alongside production APIs

### 7. Graceful Shutdown
Proper cleanup of resources:
- Close database connections
- Flush logs and metrics
- Complete in-flight requests
- Save state to persistent storage

### 8. Configuration Validation
Validate configuration before accepting traffic:
- Check required environment variables
- Verify database connectivity
- Validate API keys
- Ensure required files exist

### 9. Background Tasks
Start background tasks during lifespan:
- Periodic data refresh
- Cache invalidation
- Health monitoring
- Metrics collection

### 10. WebSocket Extensions
Add custom WebSocket endpoints for:
- Real-time notifications
- Live data feeds
- Collaborative features

---

## Migration Guide

### From Traditional `streamlit run`

**Before:**
```python
# main.py
import streamlit as st

st.title("My App")
# ... rest of app
```

```bash
streamlit run main.py
```

**After (minimal change):**
```python
# streamlit_app.py
import streamlit as st
from pathlib import Path

app = st.App(Path("main.py"))
```

```bash
streamlit run streamlit_app.py
# or
uvicorn streamlit_app:app
```

The original `main.py` remains unchanged.

### Adding Lifespan Hooks

```python
# streamlit_app.py
import streamlit as st
from pathlib import Path
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Move initialization from main.py here
    from myapp.setup import initialize
    initialize()
    yield
    # Cleanup
    from myapp.setup import cleanup
    cleanup()

app = st.App(Path("main.py"), lifespan=lifespan)
```

---

## Compatibility

### ASGI Servers

`st.App` works with any ASGI server:

| Server | Command |
|--------|---------|
| Uvicorn | `uvicorn streamlit_app:app` |
| Hypercorn | `hypercorn streamlit_app:app` |
| Daphne | `daphne streamlit_app:app` |
| Gunicorn + Uvicorn | `gunicorn -k uvicorn.workers.UvicornWorker streamlit_app:app` |

### Starlette Version

Requires Starlette 0.27.0+ for full lifespan support.

### Python Version

Python 3.10+ (matches Streamlit's requirements).

---

## Open Questions

1. **Should `st.App` be the only way to use advanced features?**
   - Alternative: config-based hooks that work without `st.App`

2. **How to handle hot-reload?**
   - Uvicorn's `--reload` works, but lifespan runs on each reload
   - May need special handling for development mode

3. **Should we support mounting Streamlit at a sub-path?**
   - e.g., `st.App(Path("main.py"), base_path="/dashboard")`

4. **How to expose runtime state to custom routes?**
   - Access session state from REST endpoints?
   - Share cache between Streamlit and custom routes? (already works via `@st.cache_resource`)

5. **Naming: `st.App` vs `st.Application` vs `st.Server`?**
   - `st.App` is concise and familiar (FastAPI uses `FastAPI()`)

6. **Should `script_path` accept a module path?**
   - e.g., `st.App("myapp.pages.main")` in addition to file paths
   - Would align with how uvicorn accepts module paths

7. **How should multipage apps work with `st.App`?**
   - Current: `script_path` points to main script, pages discovered automatically
   - Should we expose page configuration in `st.App`?
