# Server Startup and Shutdown Hooks in Streamlit

This document outlines options for supporting server-level startup and shutdown hooks in Streamlit.

## Problem Statement

Users want to run initialization code **once when the server starts** (before any user connects) for use cases like:
- Pre-warming caches (ML models, database connections)
- Configuration validation
- Logging/telemetry setup
- License validation
- Resource pool initialization

Currently, Streamlit has no native mechanism for this. The first user to connect pays the initialization cost.

---

## Current Architecture

### Server Startup Sequence

The current startup order in `Server.start()` (`lib/streamlit/web/server/server.py:336-350`):

```python
async def start(self) -> None:
    app = self._create_app()
    start_listening(app)          # 1. HTTP server starts accepting connections
    await self._runtime.start()   # 2. Runtime starts AFTER
```

**Problem:** The HTTP server accepts connections *before* the Runtime is fully started. There's no gap to insert a startup hook that runs after Runtime is ready but before connections are accepted.

### Can We Reorder Startup?

**Yes, reordering is safe** (and already done in Starlette). Analysis shows:

1. **`Runtime.start()` has no HTTP dependencies** - it only creates async primitives and starts an internal loop. It doesn't make any HTTP requests or need routes to exist.

2. **`start_listening()` has no Runtime dependencies** - it just binds to a port. The handlers reference `self._runtime` but don't call it until requests arrive.

3. **Current Tornado order has a race condition** - if a WebSocket connects between `start_listening()` and `Runtime.start()`, the handler calls `_get_async_objs()` which raises `RuntimeError("Runtime hasn't started yet!")`.

4. **Health endpoint is already safe** - `is_ready_for_browser_connection` returns `(False, "unavailable")` when state is `INITIAL`, so load balancers won't route traffic prematurely.

5. **Starlette implementation already does this correctly** - uses ASGI lifespan to start Runtime before accepting connections (see `starlette_app.py`):
   ```python
   @asynccontextmanager
   async def _lifespan(_app: Starlette) -> AsyncIterator[None]:
       await runtime.start()  # Startup: before accepting connections
       yield
       runtime.stop()         # Shutdown: after connections close
   ```

**Proposed Tornado order (to match Starlette):**
```python
async def start(self) -> None:
    app = self._create_app()
    await self._runtime.start()   # 1. Runtime starts FIRST
    # << STARTUP HOOK INSERTION POINT >>
    start_listening(app)          # 2. HTTP server starts AFTER
```

This eliminates the race condition and creates a natural insertion point for startup hooks.

### Why This Matters for Cache Pre-Warming

The caching system has different behaviors depending on whether Runtime exists:

| Cache Type | Without Runtime | With Runtime |
|------------|-----------------|--------------|
| `@st.cache_resource` | Works fully (global singleton) | Works fully |
| `@st.cache_data` | In-memory only (fallback) | Full support + disk persistence |
| `@st.cache_data(persist="disk")` | **No disk persistence** | Works fully |

For full cache functionality, startup hooks should run **after** Runtime exists.

---

## Part 1: Current Workarounds

### 1. `@st.cache_resource` for Global Singletons

The most common pattern - lazy initialization on first call:

```python
@st.cache_resource
def init_database():
    return create_db_connection()

@st.cache_resource
def load_ml_model():
    return load_model("path/to/model")

# First user to call these pays the initialization cost
db = init_database()
model = load_ml_model()
```

**Pros:**
- Simple and idiomatic
- Cached globally across all sessions
- Works without code changes

**Cons:**
- Lazy initialization - first user pays latency cost
- No control over initialization order

### 2. Module-Level Initialization

Code at module level executes when the module is imported:

```python
# app.py
import streamlit as st

# Runs when module is first imported
_config = load_config()
_db_pool = create_connection_pool()

st.title("My App")
```

**Pros:**
- Runs early in the lifecycle

**Cons:**
- Hot-reload behavior unpredictable
- Module may be re-imported on code changes
- Runs before Runtime exists (limited cache support)

### 3. External Wrapper Script

Run initialization before starting Streamlit:

```python
# run_app.py
from myapp.startup import initialize_resources

# Pre-initialize (runs before Streamlit process)
initialize_resources()

# Start Streamlit
import subprocess
subprocess.run(["streamlit", "run", "app.py"])
```

**Pros:**
- True pre-startup initialization
- Full control over timing

**Cons:**
- Runs in separate process - resources must be shareable (files, external services)
- In-memory caches won't be shared with Streamlit process

### 4. Container/Process Entrypoint

For Docker deployments:

```dockerfile
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

```bash
#!/bin/bash
python /app/init.py      # Pre-initialization
exec streamlit run /app/main.py
```

Same limitations as wrapper script - separate process.

---

## Part 2: Native Support Options

### The Bootstrap Problem

Server startup hooks defined in the user's `app.py` face a chicken-and-egg problem:
1. Hooks are defined in `app.py`
2. `app.py` only executes when a session connects
3. By then, "server startup" has already happened

**Solutions:**
- **Option A:** Define hooks in a separate module referenced by config (avoids the problem)
- **Option B:** "Dry run" the user script at startup to collect hooks (complex)

---

### Option A: Configuration-Based Hooks (Recommended)

Define hooks in `.streamlit/config.toml`:

```toml
[hooks]
on_server_start = "myapp.hooks:on_startup"
on_server_stop = "myapp.hooks:on_shutdown"
```

```python
# myapp/hooks.py
import streamlit as st
from myapp.cache import load_ml_model, init_db_pool

def on_startup():
    """Called after Runtime starts, before accepting connections."""
    print("Pre-warming caches...")
    load_ml_model()   # @st.cache_resource - will be cached
    init_db_pool()    # @st.cache_resource - will be cached
    print("Server ready!")

def on_shutdown():
    """Called when server is shutting down."""
    print("Cleaning up resources...")
    cleanup_connections()
```

```python
# myapp/cache.py
import streamlit as st

@st.cache_resource
def load_ml_model():
    return load_model("path/to/model")

@st.cache_resource
def init_db_pool():
    return create_connection_pool()
```

**Implementation approach:**

Modify `Server.start()` in `lib/streamlit/web/server/server.py`:

```python
async def start(self) -> None:
    app = self._create_app()

    # Start Runtime FIRST (so caches work fully)
    await self._runtime.start()

    # Run startup hook AFTER Runtime, BEFORE accepting connections
    await self._run_startup_hook()

    # NOW start accepting connections
    start_listening(app)
```

**Pros:**
- Full cache support (Runtime exists when hook runs)
- No "dry run" complexity
- First user sees pre-warmed caches
- Clean separation of concerns
- Can be overridden per environment

**Cons:**
- Requires separate file from main app
- Less discoverable than in-script decorators

---

### Option B: CLI Flag for Startup Script

Add a CLI option to specify a startup script:

```bash
streamlit run app.py --on-startup myapp/hooks.py:on_startup --on-shutdown myapp/hooks.py:on_shutdown
```

**Pros:**
- Explicit and visible
- No config file needed
- Easy to override per deployment

**Cons:**
- Verbose command line
- Not persisted in project config

---

### Option C: Convention-Based Hook File

Look for a well-known file like `.streamlit/hooks.py` or `streamlit_hooks.py`:

```python
# .streamlit/hooks.py

def on_server_start():
    """Auto-discovered startup hook."""
    from myapp.cache import warm_caches
    warm_caches()

def on_server_stop():
    """Auto-discovered shutdown hook."""
    cleanup()
```

**Pros:**
- Zero configuration needed
- Convention over configuration
- Easy to understand

**Cons:**
- Magic file name - less explicit
- May conflict with existing files

---

### Option D: Decorator-Based with "Dry Run" (Complex)

Allow decorators in `app.py`, but require Streamlit to execute the script once at startup:

```python
# app.py
import streamlit as st

@st.on_server_start
def startup():
    load_ml_model()

@st.on_server_stop
def shutdown():
    cleanup()

st.title("My App")
```

**Implementation would require:**
1. Execute `app.py` at server start with a "null" session context
2. All `st.` UI commands become no-ops during this phase
3. Collect registered `@st.on_server_start` functions
4. Execute them (now Runtime exists, caches work)
5. Start accepting connections

**Pros:**
- Most intuitive API for users
- Hooks live with app code

**Cons:**
- Complex execution model
- Script side effects may fail without real session
- Error handling complexity (script errors vs hook errors)
- Hot-reload needs to re-run the dry run
- `st.` commands silently failing could confuse users

---

### Option E: ASGI Lifespan Integration (Long-term, Recommended)

With the ongoing migration from Tornado to Starlette ([#12772](https://github.com/streamlit/streamlit/pull/12772)), Streamlit can leverage the standard ASGI lifespan protocol used by Starlette and FastAPI.

**Good news: The foundation already exists!** The Starlette PR already includes a lifespan context manager in `starlette_app.py`:

```python
@asynccontextmanager
async def _lifespan(_app: Starlette) -> AsyncIterator[None]:
    await runtime.start()  # Startup
    yield
    runtime.stop()         # Shutdown
```

This just needs to be extended to call user-provided hooks.

**ASGI Lifespan Pattern:**

```python
# Standard ASGI lifespan context manager
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Startup: runs before accepting connections
    print("Starting up...")
    model = load_ml_model()
    db_pool = create_connection_pool()

    yield {"model": model, "db_pool": db_pool}  # State available to app

    # Shutdown: runs on graceful shutdown
    print("Shutting down...")
    await db_pool.close()
```

**Streamlit Integration - Option E1: New `st.App()` Entry Point**

Introduce an alternative execution mode for users who want ASGI-style lifecycle control:

```python
# app.py
import streamlit as st
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Startup
    print("Pre-warming caches...")
    load_ml_model()  # @st.cache_resource - will be cached
    yield
    # Shutdown
    print("Cleaning up...")

# New entry point that accepts lifespan
app = st.App("pages/main.py", lifespan=lifespan)
```

Run with:
```bash
# New ASGI-style runner
streamlit run app.py --asgi

# Or with uvicorn directly (for advanced users)
uvicorn app:app --host 0.0.0.0 --port 8501
```

**Streamlit Integration - Option E2: Configuration-Based Lifespan**

Reference a lifespan function in config, similar to Option A but using ASGI semantics:

```toml
[server]
lifespan = "myapp.lifecycle:lifespan"
```

```python
# myapp/lifecycle.py
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Startup
    from myapp.cache import warm_caches
    await warm_caches()

    yield

    # Shutdown
    from myapp.cleanup import cleanup
    await cleanup()
```

**Why ASGI Lifespan is Compelling:**

1. **Standard pattern** - familiar to FastAPI/Starlette users (large ecosystem)
2. **Context manager semantics** - natural try/finally for cleanup, even on crashes
3. **Async-native** - supports `await` in startup/shutdown code
4. **State passing** - can yield state dict accessible to the app
5. **Battle-tested** - well-documented, edge cases handled by the framework
6. **Composability** - enables running Streamlit as sub-app in larger ASGI applications
7. **No "dry run" needed** - lifespan is separate from the app script

**Implementation Considerations:**

The Starlette migration provides the foundation. Key steps:
1. Starlette's `Lifespan` middleware handles the ASGI lifespan protocol
2. Startup hook runs after Runtime is created (full cache support)
3. Shutdown hook runs before Runtime stops
4. The `st.App()` constructor (or config) accepts the lifespan callable

```python
# Starlette-based implementation sketch
from starlette.applications import Starlette
from starlette.routing import Route, WebSocketRoute

class StreamlitServer:
    def __init__(self, script_path: str, lifespan=None):
        self._runtime = Runtime(...)
        self._app = Starlette(
            routes=[...],
            lifespan=lifespan or self._default_lifespan,
        )

    @asynccontextmanager
    async def _default_lifespan(self, app):
        await self._runtime.start()
        yield
        await self._runtime.stop()
```

**Pros:**
- Aligns with Python web ecosystem standards
- Familiar to FastAPI/Starlette users
- Clean async context manager semantics
- Enables advanced deployment patterns (uvicorn, gunicorn, etc.)
- Future-proof as ASGI becomes more prevalent

**Cons:**
- Requires Starlette migration to complete first
- More advanced API - may intimidate beginners
- Need to maintain backward compatibility with `streamlit run`

---

## Recommendation

### Short-term (Now)

**Improve documentation** for existing workarounds:
- `@st.cache_resource` for lazy global initialization
- External wrapper scripts for true pre-startup needs

### Medium-term (Before Starlette Migration Completes)

**Option A: Configuration-Based Hooks** - simple, low-risk:
1. Reorder Tornado's `Server.start()` (Runtime before HTTP listener) to match Starlette
2. Add `[hooks] on_server_start` and `on_server_stop` config options
3. Import and call hook functions at the right lifecycle points

This provides immediate value and aligns Tornado behavior with Starlette.

### Long-term (After Starlette Migration)

**Option E: ASGI Lifespan Integration** - the recommended end-state:
1. Extend the existing `_lifespan` in `starlette_app.py` to call user hooks
2. Expose via `st.App(..., lifespan=...)` for advanced users
3. Keep `streamlit run` working with optional config-based lifespan
4. Enable `uvicorn app:app` deployment pattern for power users

This aligns Streamlit with the broader Python async web ecosystem and provides a well-understood, standard API for lifecycle management.

---

## Implementation Notes

### Summary: Startup Order by Server Type

| Server | Current Order | Correct Order | Status |
|--------|--------------|---------------|--------|
| **Tornado** | HTTP listen → Runtime start | Runtime start → HTTP listen | **Needs fix** |
| **Starlette** | Runtime start → HTTP listen | Runtime start → HTTP listen | **Already correct** |

The Starlette implementation uses ASGI lifespan which naturally ensures Runtime starts before accepting connections. Tornado needs to be reordered to match.

### Tornado: Config-Based Hooks

#### Key Files

| File | Change |
|------|--------|
| `lib/streamlit/web/server/server.py` | Reorder `start()`, add hook invocation |
| `lib/streamlit/config.py` | Add `[hooks]` config options |
| `lib/streamlit/web/bootstrap.py` | Handle shutdown hook on SIGTERM/SIGINT |
| `lib/streamlit/runtime/runtime.py` | Possibly add shutdown callback |

#### Startup Hook Invocation Point

```python
# lib/streamlit/web/server/server.py

async def start(self) -> None:
    app = self._create_app()

    # 1. Start Runtime first
    await self._runtime.start()

    # 2. Run startup hook (Runtime exists, caches work fully)
    hook_path = config.get_option("hooks.on_server_start")
    if hook_path:
        await self._invoke_hook(hook_path)

    # 3. Start accepting connections
    start_listening(app)
```

#### Shutdown Hook Invocation

The shutdown hook should be called:
- On SIGTERM/SIGINT (graceful shutdown)
- Before `Runtime.stop()` is called
- With a timeout to prevent hanging

```python
# In bootstrap.py or server.py shutdown handling

async def shutdown():
    hook_path = config.get_option("hooks.on_server_stop")
    if hook_path:
        try:
            await asyncio.wait_for(invoke_hook(hook_path), timeout=30.0)
        except asyncio.TimeoutError:
            _LOGGER.warning("Shutdown hook timed out")

    await runtime.stop()
```

### Long-term: ASGI Lifespan (Starlette)

#### Extending the Existing Lifespan

The Starlette implementation already has a lifespan in `starlette_app.py`. To add user hooks, extend it:

```python
# lib/streamlit/web/server/starlette/starlette_app.py

@asynccontextmanager
async def _lifespan(_app: Starlette) -> AsyncIterator[None]:
    # 1. Start Runtime first
    await runtime.start()

    # 2. Run user startup hook (Runtime exists, caches work fully)
    startup_hook = config.get_option("hooks.on_server_start")
    if startup_hook:
        await _invoke_hook(startup_hook)

    yield  # Server accepts connections here

    # 3. Run user shutdown hook
    shutdown_hook = config.get_option("hooks.on_server_stop")
    if shutdown_hook:
        try:
            await asyncio.wait_for(_invoke_hook(shutdown_hook), timeout=30.0)
        except asyncio.TimeoutError:
            _LOGGER.warning("Shutdown hook timed out")

    # 4. Stop Runtime
    runtime.stop()
```

This is a minimal change to add config-based hooks to Starlette.

#### Detection of `st.App()` Usage

When `streamlit run app.py` is invoked, Streamlit can detect if the script uses the new `st.App()` pattern:

```python
# In bootstrap.py or cli.py

def detect_app_mode(script_path: str) -> bool:
    """Check if script uses st.App() pattern."""
    with open(script_path) as f:
        source = f.read()

    # Simple detection: look for st.App pattern
    # Could use AST parsing for more robust detection
    return "st.App(" in source or "streamlit.App(" in source

def run(script_path: str):
    if detect_app_mode(script_path):
        # New ASGI mode: import the app object and run with uvicorn/starlette
        run_asgi_app(script_path)
    else:
        # Traditional mode: run script directly
        run_traditional(script_path)
```

#### `st.App()` Implementation

```python
# lib/streamlit/__init__.py or lib/streamlit/app.py

from contextlib import asynccontextmanager
from typing import Callable, AsyncContextManager

class App:
    """ASGI-compatible Streamlit application with lifecycle hooks."""

    def __init__(
        self,
        script_path: str,
        *,
        lifespan: Callable[["App"], AsyncContextManager] | None = None,
    ):
        self.script_path = script_path
        self._user_lifespan = lifespan
        self._runtime: Runtime | None = None

    @asynccontextmanager
    async def _default_lifespan(self):
        """Default lifespan that just starts/stops the Runtime."""
        self._runtime = Runtime(RuntimeConfig(script_path=self.script_path, ...))
        await self._runtime.start()
        yield
        await self._runtime.stop()

    @asynccontextmanager
    async def _combined_lifespan(self):
        """Combine default Runtime lifecycle with user's lifespan."""
        self._runtime = Runtime(RuntimeConfig(script_path=self.script_path, ...))
        await self._runtime.start()

        if self._user_lifespan:
            async with self._user_lifespan(self):
                yield
        else:
            yield

        await self._runtime.stop()

    async def __call__(self, scope, receive, send):
        """ASGI interface."""
        # Delegate to Starlette app
        ...
```

#### User-Facing API

```python
# myapp/app.py
import streamlit as st
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Startup: runs after Runtime is ready, before accepting connections
    print("Loading ML model...")
    from myapp.cache import load_model
    load_model()  # @st.cache_resource - fully functional

    yield

    # Shutdown: runs on graceful shutdown
    print("Cleaning up...")

# This creates an ASGI app that can be:
# 1. Detected and run by `streamlit run myapp/app.py`
# 2. Run directly with `uvicorn myapp.app:app`
app = st.App("pages/main.py", lifespan=lifespan)
```

---

## Related Use Cases

Users requesting startup hooks typically want to:
- Pre-warm ML model caches (avoid cold start latency)
- Initialize database connection pools
- Validate configuration before accepting traffic
- Set up logging/monitoring/telemetry
- Perform license checks
- Load large datasets into memory
