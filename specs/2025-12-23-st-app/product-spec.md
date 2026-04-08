---
author: lukasmasuch
created: 2025-12-23
---

# ASGI application entry point (`st.App`)

## Summary

Add a new `st.App` class that provides an ASGI-compatible entry point for Streamlit
apps. This enables custom HTTP routes, middleware configuration, lifecycle hooks, integration with popular Python web frameworks, and aligns Streamlit with the broader async web ecosystem.

> [!NOTE]
> This proposal is a follow-up to the [Starlette support](https://github.com/streamlit/streamlit/pull/13375) that is currently being implemented.

## Problem

Streamlit's current architecture limits advanced deployment customizability and integration scenarios.
Users have requested numerous features that require lower-level control over the HTTP server:

**Custom HTTP Endpoints:**

- [#439](https://github.com/streamlit/streamlit/issues/439) — Support custom HTTP
  requests (REST endpoints alongside Streamlit)
- [#9673](https://github.com/streamlit/streamlit/issues/9673) — Serve robots.txt at root
  level (currently only `/app/static/` is supported)
- [#6195](https://github.com/streamlit/streamlit/issues/6195) — Widget to host folder as
  website for previewing generated sites
- [#9090](https://github.com/streamlit/streamlit/issues/9090) — Enhanced JavaScript file
  serving with correct MIME types
- [#11333](https://github.com/streamlit/streamlit/issues/11333) — MCP server for
  Streamlit (requires custom endpoint support)
- [#8713](https://github.com/streamlit/streamlit/issues/8713) — Custom 404/Error/Maintenance
  pages

**Security Headers & Middleware:**

- [#6417](https://github.com/streamlit/streamlit/issues/6417) — Handling security headers
  (CSP, HSTS, X-Frame-Options)
- [#9160](https://github.com/streamlit/streamlit/issues/9160) — Allow configuring HTTP
  security headers
- [#861](https://github.com/streamlit/streamlit/issues/861) — Ability to write cookies for
  auth persistence
- [#8823](https://github.com/streamlit/streamlit/issues/8823) — IP whitelist for access
  control

**Framework Integration & ASGI Support:**

- [#4311](https://github.com/streamlit/streamlit/issues/4311) — Run with WSGI/ASGI
  protocols (deploy alongside Django in same container)
- [#4567](https://github.com/streamlit/streamlit/issues/4567) — Integration with
  Flask/FastAPI
- [#927](https://github.com/streamlit/streamlit/issues/927) — Run on Django via Django
  Channels
- [#8661](https://github.com/streamlit/streamlit/issues/8661) — Expose Tornado instance
  for low-level access
- [#7546](https://github.com/streamlit/streamlit/issues/7546) — Multiple Runtime instances
  in single process

**Server Configuration & Lifecycle:**

- [#7688](https://github.com/streamlit/streamlit/issues/7688) — On session start/shutdown
  hooks for global resources
- [#9916](https://github.com/streamlit/streamlit/issues/9916) — Tornado HTTPServer extra
  arguments (max_header_size, max_body_size)
- [#8991](https://github.com/streamlit/streamlit/issues/8991) — Server startup hooks for
  cache pre-warming
- [#6108](https://github.com/streamlit/streamlit/issues/6108) — Pre-cache on start-up
  (populate cache before first user connects)
- [#8545](https://github.com/streamlit/streamlit/issues/8545) — Detect browser tab close
  for session cleanup
- [#7667](https://github.com/streamlit/streamlit/issues/7667) — Setup script entry point
  for initialization outside script runner

**SEO & Metadata:**

- [#5673](https://github.com/streamlit/streamlit/issues/5673) — Custom website metadata
  (manifest, icons, description)
- [#8999](https://github.com/streamlit/streamlit/issues/8999) — Embed metadata for SEO
  indexing (Google Analytics, Search Console)

## Proposal

### API

The `st.App` signature follows the [Starlette Application](https://www.starlette.io/applications/) signature, with
`script_path` replacing Starlette's `routes` as the primary parameter:

```python
st.App(
    script_path: str | Path,
    *,
    lifespan: Callable[[App], AsyncContextManager[dict[str, Any] | None]] | None = None,
    routes: Sequence[BaseRoute] | None = None,
    middleware: Sequence[Middleware] | None = None,
    exception_handlers: Mapping[Any, ExceptionHandler] | None = None,
    debug: bool = False,
) -> App
```

### Parameters

> [!NOTE]
> See the [Starlette Application](https://www.starlette.io/applications/) documentation for more details on the parameters.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `script_path` | `str \| Path` | required | Path to the main Streamlit script |
| `lifespan` | `AsyncContextManager` | `None` | Async context manager for startup/shutdown |
| `routes` | `Sequence[BaseRoute]` | `None` | Additional Starlette routes |
| `middleware` | `Sequence[Middleware]` | `None` | Middleware stack for all requests |
| `exception_handlers` | `Mapping` | `None` | Custom exception handlers |
| `debug` | `bool` | `False` | Enable debug mode |

### Return Value

An ASGI-compatible application object that can be:

- Auto-detected and run via `streamlit run app.py`
- Run directly with any ASGI server (e.g., `uvicorn app:app`)

### Behavior

**App discovery:**

When `streamlit run app.py` is invoked, Streamlit checks if the script contains an
`st.App` instance (similar to [FastAPI CLI discovery](https://github.com/fastapi/fastapi-cli/blob/main/src/fastapi_cli/discover.py)) by checking for a `st.App` instance named `app`. If no `st.App` instance is found, Streamlit will run the script in traditional mode.

**Lifespan execution order:**

1. Streamlit Runtime starts (enables full `@st.cache_resource` support)
2. User's lifespan runs (startup code)
3. Server starts accepting connections
4. ... application runs ...
5. Server stops accepting connections
6. User's lifespan runs (shutdown code)
7. Streamlit Runtime stops

If an error occurs during the lifespan, Streamlit will log the error and abort the startup.

**Route protection:**

Streamlit reserves certain route prefixes. User routes cannot override:

| Route Prefix | Purpose |
|--------------|---------|
| `/_stcore/*` | Core Streamlit API (WebSocket, health, upload) |
| `/media/*` | Media file serving |
| `/component/*` | Custom component serving (v1) |

Conflicting routes raise `ValueError` at startup.

**Middleware ordering:**

```
Request → [User Middleware] → [Streamlit Middleware] → [Route Handler]
Response ← [User Middleware] ← [Streamlit Middleware] ← [Route Handler]
```

User middleware wraps Streamlit's internal middleware, enabling:

- Auth middleware to reject requests before reaching Streamlit
- Logging middleware to see all requests/responses
- Security headers to be added to all responses

### How `st.App` Addresses Feature Requests

#### Custom HTTP Routes

> Enables: [#439](https://github.com/streamlit/streamlit/issues/439), [#9673](https://github.com/streamlit/streamlit/issues/9673), [#6195](https://github.com/streamlit/streamlit/issues/6195), [#9090](https://github.com/streamlit/streamlit/issues/9090)

```python
import streamlit as st
from starlette.routing import Route, Mount
from starlette.responses import JSONResponse, PlainTextResponse, FileResponse
from starlette.staticfiles import StaticFiles

# REST API endpoint (#439)
async def api_data(request):
    return JSONResponse({"data": [1, 2, 3]})

# robots.txt at root (#9673)
async def robots_txt(request):
    return PlainTextResponse("User-agent: *\nDisallow: /admin/")

# Serve generated site folder (#6195)
generated_site = StaticFiles(directory="./generated_docs", html=True)

app = st.App(
    "main.py",
    routes=[
        Route("/api/data", api_data),
        Route("/robots.txt", robots_txt),
        Mount("/preview", app=generated_site),  # Serve folder as sub-site
    ],
)
```

#### Security Headers & Middleware

##### Add security headers via middleware

> Enables: [#6417](https://github.com/streamlit/streamlit/issues/6417), [#9160](https://github.com/streamlit/streamlit/issues/9160)

```python
import streamlit as st
from starlette.middleware import Middleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                # Add security headers (#6417, #9160)
                headers[b"x-frame-options"] = b"SAMEORIGIN"
                headers[b"x-content-type-options"] = b"nosniff"
                headers[b"strict-transport-security"] = b"max-age=31536000"
                headers[b"content-security-policy"] = b"default-src 'self'"
                message["headers"] = list(headers.items())
            await send(message)
        await self.app(scope, receive, send_with_headers)

app = st.App(
    "main.py",
    middleware=[
        Middleware(HTTPSRedirectMiddleware),
        Middleware(SecurityHeadersMiddleware),
    ],
)
```

##### Set cookies via middleware

> Enables: [#861](https://github.com/streamlit/streamlit/issues/861)

```python
import streamlit as st
from starlette.middleware import Middleware

class SetCookieMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        async def send_with_cookie(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"set-cookie", b"my_cookie=value; Path=/; HttpOnly"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_cookie)

app = st.App(
    "main.py",
    middleware=[Middleware(SetCookieMiddleware)],
)
```

#### Framework Integration

##### Run Streamlit as ASGI app

> Enables: [#4311](https://github.com/streamlit/streamlit/issues/4311)

```python
import streamlit as st

app = st.App("dashboard.py")

# Can be run with:
# - uvicorn streamlit_app:app
# - gunicorn -k uvicorn.workers.UvicornWorker streamlit_app:app
# - hypercorn streamlit_app:app
```

##### Mount Streamlit in Django

> Enables: [#927](https://github.com/streamlit/streamlit/issues/927), [#4311](https://github.com/streamlit/streamlit/issues/4311)

```python
from django.core.asgi import get_asgi_application
from starlette.routing import Mount, Route
from starlette.applications import Starlette
import streamlit as st

django_app = get_asgi_application()
streamlit_app = st.App("analytics/dashboard.py")

# Combine Django and Streamlit in one ASGI app
app = Starlette(routes=[
    Mount("/analytics", app=streamlit_app),
    Mount("/", app=django_app),
])
```

##### Mount Streamlit in FastAPI

> Enables: [#4567](https://github.com/streamlit/streamlit/issues/4567)

```python
from fastapi import FastAPI
import streamlit as st

app = FastAPI()

@app.get("/api/health")
async def health():
    return {"status": "healthy"}

streamlit_app = st.App("dashboard.py")

# Mount Streamlit alongside FastAPI
app.mount("/dashboard", streamlit_app)
```

##### Mount FastAPI in Streamlit

> Enables: [#4567](https://github.com/streamlit/streamlit/issues/4567)

```python
from fastapi import FastAPI
from starlette.routing import Mount
import streamlit as st

# Create FastAPI sub-application
api = FastAPI()

@api.get("/health")
async def health():
    return {"status": "healthy"}

@api.post("/predict")
async def predict(data: dict):
    return {"prediction": data.get("value", 0) * 2}

# Mount FastAPI into Streamlit app
# - Streamlit UI at /
# - FastAPI endpoints at /api/*
# - FastAPI docs at /api/docs
app = st.App(
    "dashboard.py",
    routes=[
        Mount("/api", app=api),
    ],
)
```

#### Lifecycle Hooks

> Enables: [#7688](https://github.com/streamlit/streamlit/issues/7688), [#8991](https://github.com/streamlit/streamlit/issues/8991)

```python
import streamlit as st
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Startup: runs before accepting connections (#7688, #8991)
    print("Initializing global resources...")
    # load_ml_model uses cache_data and init_db_pool uses cache_resource, so they will be pre-warmed and initialized before the first user connects.
    from myapp.cache import load_ml_model, init_db_pool

    model = load_ml_model()   # Pre-warm cache
    db = init_db_pool()       # Initialize connection pool

    yield

    # Shutdown: cleanup global resources (#7688)
    print("Cleaning up...")
    await db.close()

app = st.App("main.py", lifespan=lifespan)
```

#### SEO & Metadata

> Enables: [#5673](https://github.com/streamlit/streamlit/issues/5673), [#8999](https://github.com/streamlit/streamlit/issues/8999)

```python
import streamlit as st
from starlette.routing import Route
from starlette.responses import JSONResponse

# Serve custom manifest.json (#5673)
async def manifest(request):
    return JSONResponse({
        "name": "My Analytics App",
        "short_name": "Analytics",
        "description": "Interactive data analytics dashboard",
        "icons": [{"src": "/app/static/icon-192.png", "sizes": "192x192"}],
        "theme_color": "#ff4b4b",
        "background_color": "#ffffff",
    })

app = st.App(
    "main.py",
    routes=[
        Route("/manifest.json", manifest),
    ],
)
```

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ⚠️ Likely, but will need testing. |
| No breaking API changes | ✅ |
| No new dependencies | ✅ will already added in Starlette migration |
| Metrics collected | We need to track the st.App usage via a flag in the metrics. |
| Any security/legal impact? | ✅ no new implications besides whats relevant for Starlette migration |
| Any docs changes needed? | New section: "Advanced Deployment with st.App" |
| Any other risks? | ✅ |
