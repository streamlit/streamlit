# Async/Asyncio Support Plan for Streamlit

## Executive Summary

This document outlines a comprehensive plan to add first-class `asyncio` support to Streamlit. Currently, Streamlit's synchronous execution model creates friction for developers who want to use modern async Python patterns, especially for database access, API calls, and LLM integrations.

**Reference Issue:** [#8488 - Native asyncio support](https://github.com/streamlit/streamlit/issues/8488) (126 👍)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [User Pain Points & Use Cases](#user-pain-points--use-cases)
3. [Related GitHub Issues](#related-github-issues)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Phases](#implementation-phases)
6. [API Proposals](#api-proposals)
7. [Breaking Changes & Migration](#breaking-changes--migration)
8. [Risks & Considerations](#risks--considerations)

---

## Current State Analysis

### How Streamlit's Event Loop Works Today

Streamlit uses a dual-thread architecture:

1. **Main Thread (Server Thread):** Runs Tornado's asyncio event loop (`bootstrap.py`)
   - Manages WebSocket connections
   - Handles HTTP requests
   - Coordinates session management

2. **Script Thread:** Runs user scripts synchronously (`ScriptRunner`)
   - Created fresh for each script run
   - Has NO running asyncio event loop by default
   - All `st.*` commands are synchronous

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Thread (asyncio)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tornado Server (HTTP/WebSocket)                     │   │
│  │  Runtime._loop_coroutine()                           │   │
│  │  asyncio.get_running_loop() ← exists here            │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼ (Spawns per session)
┌─────────────────────────────────────────────────────────────┐
│                   Script Thread (sync)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ScriptRunner._run_script()                          │   │
│  │  exec(user_script)                                   │   │
│  │  asyncio.get_running_loop() → RuntimeError!          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Current Workarounds (from codebase)

1. **`type_util.async_generator_to_sync()`**: Creates a new event loop per async generator
   ```python
   loop = asyncio.new_event_loop()
   try:
       while True:
           yield loop.run_until_complete(async_gen.__anext__())
   except StopAsyncIteration:
       pass
   finally:
       loop.close()  # ← This causes "Event loop is closed" errors
   ```

2. **User workaround from issue #8488:**
   ```python
   @st.cache_resource(show_spinner=False)
   def get_event_loop():
       loop = asyncio.new_event_loop()
       asyncio.set_event_loop(loop)
       return loop

   if not st.session_state.get("event_loop"):
       st.session_state["event_loop"] = get_event_loop()
   ```

### Current Async "Support" in the Codebase

| Feature | Async Support | Notes |
|---------|---------------|-------|
| `st.write_stream` | Partial | Converts async generators to sync via new event loop |
| `st.cache_data` | ❌ No | Caches coroutine objects instead of awaited values |
| `st.cache_resource` | ❌ No | Same issue - warns about async objects |
| Widget callbacks | ❌ No | `WidgetCallback = Callable[..., None]` - sync only |
| `@st.fragment` | ❌ No | Wrapped function must be sync |
| `st.connection` | ❌ No | All connection classes are synchronous |
| `AppTest` | ❌ No | Test runner is synchronous |

---

## User Pain Points & Use Cases

### Primary Use Cases for Async Support

1. **Async Database Access** (High Priority)
   - AsyncPG, Motor (MongoDB), aioredis, aiomysql
   - Modern ORMs: SQLAlchemy 2.0 async, Prisma Python, EdgeDB

2. **LLM/AI Streaming** (High Priority)
   - OpenAI async API with streaming
   - LangChain async chains
   - Anthropic async client

3. **Multiple Concurrent API Calls** (Medium Priority)
   - `asyncio.gather()` for parallel data fetching
   - Faster data loading for dashboards

4. **WebSocket Clients** (Medium Priority)
   - Real-time data feeds
   - Bi-directional communication with external services

5. **Background Tasks** (Medium Priority)
   - Long-running operations that update progress
   - Non-blocking data processing

### Example User Stories

**Story 1: Async Database Connection**
```python
# User wants this to work:
import streamlit as st
import asyncpg

@st.cache_resource
async def get_db_pool():
    return await asyncpg.create_pool("postgresql://...")

async def main():
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        data = await conn.fetch("SELECT * FROM users")
    st.dataframe(data)

# Currently requires ugly workarounds or doesn't work at all
```

**Story 2: Concurrent API Calls**
```python
# User wants this to work:
import streamlit as st
import aiohttp

async def fetch_all_data():
    async with aiohttp.ClientSession() as session:
        results = await asyncio.gather(
            fetch_users(session),
            fetch_products(session),
            fetch_orders(session),
        )
    return results

# Currently impossible without creating custom event loops
```

**Story 3: LLM Streaming with Caching**
```python
# User wants this to work:
@st.cache_data
async def get_embedding(text):
    return await openai.embeddings.create(input=text, model="...")

async def stream_response(prompt):
    async for chunk in openai.chat.completions.create(..., stream=True):
        yield chunk.choices[0].delta.content

# Currently broken: cache stores coroutine, not result
```

---

## Related GitHub Issues

| Issue | Title | 👍 | Priority |
|-------|-------|---:|----------|
| [#8488](https://github.com/streamlit/streamlit/issues/8488) | Native asyncio support | 126 | P1 |
| [#8308](https://github.com/streamlit/streamlit/issues/8308) | `st.cache_resource` and `st.cache_data` should support async functions | 82 | P1 |
| [#12076](https://github.com/streamlit/streamlit/issues/12076) | RuntimeError: Event loop is closed with st.write_stream | 7 | P2 |
| [#744](https://github.com/streamlit/streamlit/issues/744) | RuntimeError: There is no current event loop in thread | 31 | P2 |
| [#6836](https://github.com/streamlit/streamlit/issues/6836) | Async programming guide with streamlit (progress bar) | 10 | P3 |
| [#6508](https://github.com/streamlit/streamlit/issues/6508) | Stopping asyncio producer-consumer causes session_state KeyError | 4 | P3 |
| [#9310](https://github.com/streamlit/streamlit/issues/9310) | Non-Blocking Async Progress Bar | 9 | P3 |
| [#10578](https://github.com/streamlit/streamlit/issues/10578) | Input events terminate generators/async mid-execution | 7 | P3 |

---

## Technical Architecture

### Proposed Architecture: Per-Script-Thread Event Loop

The recommended approach is to provide each script thread with its own managed asyncio event loop:

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Thread (asyncio)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tornado Server - unchanged                          │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                Script Thread (with asyncio)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ScriptRunner._run_script()                          │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Managed Event Loop (new!)                     │  │   │
│  │  │  - Created at script thread start              │  │   │
│  │  │  - Available via st.get_event_loop()           │  │   │
│  │  │  - Runs async code via st.run_async()          │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │  exec(user_script) - can call async code!            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

#### Option A: Implicit Async (Like FastAPI)
- Script runs in async context automatically
- All `st.*` commands become `async def`
- **Pros:** Clean API, fully async
- **Cons:** Breaking change, complex migration, all commands need rewrite

#### Option B: Explicit Async Helpers (Recommended)
- Provide `st.run_async()` and related helpers
- Keep existing sync API working
- **Pros:** Non-breaking, gradual adoption, simpler implementation
- **Cons:** Users must explicitly opt-in, some boilerplate

#### Option C: Hybrid with Auto-Detection
- Detect if user's function is async and handle appropriately
- `st.cache_data` works with both sync and async functions
- **Pros:** Best of both worlds, smart defaults
- **Cons:** More complex implementation, potential edge cases

**Recommendation:** Start with Option B, evolve toward Option C.

---

## Implementation Phases

### Phase 1: Foundation (Est. 4-6 weeks)

#### 1.1 Per-Script-Thread Event Loop

Add a managed event loop to `ScriptRunContext`:

```python
# In lib/streamlit/runtime/scriptrunner_utils/script_run_context.py
@dataclass
class ScriptRunContext:
    # ... existing fields ...

    # New: Managed event loop for async operations
    _event_loop: asyncio.AbstractEventLoop | None = None

    def get_event_loop(self) -> asyncio.AbstractEventLoop:
        """Get or create the script thread's event loop."""
        if self._event_loop is None:
            self._event_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._event_loop)
        return self._event_loop

    def close_event_loop(self) -> None:
        """Close the event loop when script run completes."""
        if self._event_loop is not None:
            self._event_loop.close()
            self._event_loop = None
```

Modify `ScriptRunner` to manage the event loop lifecycle:

```python
# In lib/streamlit/runtime/scriptrunner/script_runner.py
def _run_script_thread(self) -> None:
    # ... existing setup ...

    ctx = ScriptRunContext(...)
    add_script_run_ctx(threading.current_thread(), ctx)

    try:
        # ... existing script running logic ...
    finally:
        ctx.close_event_loop()  # Clean up event loop
```

#### 1.2 New API: `st.run_async()`

```python
# In lib/streamlit/commands/async_commands.py
from __future__ import annotations

import asyncio
from typing import Any, Coroutine, TypeVar

from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

T = TypeVar("T")


def run_async(coro: Coroutine[Any, Any, T]) -> T:
    """Run an async coroutine and return its result.

    This function allows you to run async code from within a Streamlit script.
    It uses the script thread's event loop, which is managed by Streamlit.

    Parameters
    ----------
    coro : Coroutine
        The coroutine to run.

    Returns
    -------
    T
        The result of the coroutine.

    Examples
    --------
    >>> import streamlit as st
    >>> import aiohttp
    >>>
    >>> async def fetch_data(url):
    ...     async with aiohttp.ClientSession() as session:
    ...         async with session.get(url) as response:
    ...             return await response.json()
    >>>
    >>> data = st.run_async(fetch_data("https://api.example.com/data"))
    >>> st.write(data)
    """
    ctx = get_script_run_ctx()
    if ctx is None:
        raise RuntimeError("st.run_async() must be called from a Streamlit script.")

    loop = ctx.get_event_loop()
    return loop.run_until_complete(coro)
```

#### 1.3 New API: `st.get_event_loop()`

```python
def get_event_loop() -> asyncio.AbstractEventLoop:
    """Get the current script thread's event loop.

    This event loop is managed by Streamlit and should be used for any async
    operations that need to persist across multiple `st.run_async()` calls.

    Returns
    -------
    asyncio.AbstractEventLoop
        The script thread's event loop.

    Examples
    --------
    >>> import streamlit as st
    >>> import asyncio
    >>>
    >>> loop = st.get_event_loop()
    >>> # Use with libraries that need an event loop reference
    >>> motor_client = AsyncIOMotorClient(io_loop=loop)
    """
    ctx = get_script_run_ctx()
    if ctx is None:
        raise RuntimeError("st.get_event_loop() must be called from a Streamlit script.")

    return ctx.get_event_loop()
```

### Phase 2: Async Caching (Est. 4-6 weeks)

#### 2.1 Async-Aware `@st.cache_data`

Modify `CachedFunc` to detect and handle async functions:

```python
# In lib/streamlit/runtime/caching/cache_utils.py
import inspect

class CachedFunc(Generic[P, R]):
    def __init__(self, info: CachedFuncInfo[P, R]) -> None:
        self._info = info
        self._function_key = _make_function_key(info.cache_type, info.func)
        self._is_async = inspect.iscoroutinefunction(info.func)

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> R:
        if self._is_async:
            return self._call_async(*args, **kwargs)
        return self._call_sync(*args, **kwargs)

    def _call_sync(self, *args: P.args, **kwargs: P.kwargs) -> R:
        # Existing synchronous implementation
        ...

    def _call_async(self, *args: P.args, **kwargs: P.kwargs) -> R:
        """Handle async cached functions."""
        from streamlit.runtime.scriptrunner_utils.script_run_context import (
            get_script_run_ctx,
        )

        ctx = get_script_run_ctx()
        if ctx is None:
            raise RuntimeError("Async cached functions require a Streamlit context.")

        loop = ctx.get_event_loop()

        # Check cache first
        cache = self._info.get_function_cache(self._function_key)
        value_key = _make_value_key(...)

        try:
            cached_result = cache.read_result(value_key)
            return self._handle_cache_hit(cached_result)
        except CacheKeyNotFoundError:
            pass

        # Cache miss - run the async function
        with cache.compute_value_lock(value_key):
            # Double-check after acquiring lock
            try:
                cached_result = cache.read_result(value_key)
                return self._handle_cache_hit(cached_result)
            except CacheKeyNotFoundError:
                pass

            # Actually run the async function
            coro = self._info.func(*args, **kwargs)
            computed_value = loop.run_until_complete(coro)

            # Cache the result (not the coroutine!)
            messages = self._info.cached_message_replay_ctx._most_recent_messages
            cache.write_result(value_key, computed_value, messages)
            return computed_value
```

#### 2.2 Clear Documentation Warning Removal

Remove the warning from `cache_resource_api.py`:

```python
# Before:
"""
.. warning::
    Async objects are not officially supported in Streamlit...
"""

# After:
"""
Async functions are fully supported. When decorating an async function,
the coroutine is automatically awaited and the result is cached.

>>> @st.cache_data
... async def fetch_data(url):
...     async with aiohttp.ClientSession() as session:
...         async with session.get(url) as response:
...             return await response.json()
>>>
>>> # Works! Result is cached, not the coroutine.
>>> data = fetch_data("https://api.example.com/data")
"""
```

### Phase 3: Async Callbacks (Est. 3-4 weeks)

#### 3.1 Async Widget Callbacks

Update the `WidgetCallback` type alias and callback execution:

```python
# In lib/streamlit/runtime/state/common.py
from collections.abc import Awaitable, Callable
from typing import Union

# Support both sync and async callbacks
WidgetCallback: TypeAlias = Callable[..., None] | Callable[..., Awaitable[None]]
```

Update callback execution in `session_state.py`:

```python
# In lib/streamlit/runtime/state/session_state.py
import inspect

def call_callback(self, widget_id: str) -> None:
    metadata = self.widget_metadata.get(widget_id)
    if metadata is None or metadata.callback is None:
        return

    callback = metadata.callback
    args = metadata.callback_args or ()
    kwargs = metadata.callback_kwargs or {}

    if inspect.iscoroutinefunction(callback):
        # Async callback - run on script thread's event loop
        ctx = get_script_run_ctx()
        if ctx is not None:
            loop = ctx.get_event_loop()
            loop.run_until_complete(callback(*args, **kwargs))
    else:
        # Sync callback - run directly
        callback(*args, **kwargs)
```

#### 3.2 Async `@st.fragment`

```python
# In lib/streamlit/runtime/fragment.py
def _fragment(
    func: F | None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
    additional_hash_info: str = "",
) -> Callable[[F], F] | F:
    # ...

    @wraps(non_optional_func)
    def wrap(*args: Any, **kwargs: Any) -> Any:
        # ...

        def wrapped_fragment() -> Any:
            # ...

            # Handle async fragment functions
            result = None
            with active_hash_context:
                with st.container():
                    if inspect.iscoroutinefunction(non_optional_func):
                        ctx = get_script_run_ctx()
                        loop = ctx.get_event_loop()
                        result = loop.run_until_complete(
                            non_optional_func(*args, **kwargs)
                        )
                    else:
                        result = non_optional_func(*args, **kwargs)
            return result

        # ...
```

### Phase 4: Async Connections (Est. 3-4 weeks)

#### 4.1 New `AsyncBaseConnection` Class

```python
# In lib/streamlit/connections/async_base_connection.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Generic, TypeVar

RawConnectionT = TypeVar("RawConnectionT")


class AsyncBaseConnection(ABC, Generic[RawConnectionT]):
    """Base class for async database connections.

    Subclass this to create async connection classes that work with
    Streamlit's connection management and caching.
    """

    def __init__(self, connection_name: str = "default", **kwargs) -> None:
        self._connection_name = connection_name
        self._raw_connection: RawConnectionT | None = None
        self._kwargs = kwargs

    @abstractmethod
    async def _connect(self, **kwargs) -> RawConnectionT:
        """Create the raw connection. Must be implemented by subclasses."""
        raise NotImplementedError

    async def connect(self) -> RawConnectionT:
        """Get or create the raw connection."""
        if self._raw_connection is None:
            self._raw_connection = await self._connect(**self._kwargs)
        return self._raw_connection

    @abstractmethod
    async def close(self) -> None:
        """Close the connection."""
        raise NotImplementedError
```

#### 4.2 Example: Async SQL Connection

```python
# In lib/streamlit/connections/async_sql_connection.py
from __future__ import annotations

from typing import Any

import pandas as pd

from streamlit.connections.async_base_connection import AsyncBaseConnection


class AsyncSQLConnection(AsyncBaseConnection["AsyncEngine"]):
    """Async SQL connection using SQLAlchemy 2.0 async."""

    async def _connect(self, **kwargs) -> "AsyncEngine":
        from sqlalchemy.ext.asyncio import create_async_engine

        url = kwargs.pop("url", None)
        if url is None:
            raise ValueError("url is required for AsyncSQLConnection")

        return create_async_engine(url, **kwargs)

    async def query(
        self,
        sql: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> pd.DataFrame:
        """Execute a query and return results as a DataFrame."""
        from sqlalchemy import text

        engine = await self.connect()
        async with engine.connect() as conn:
            result = await conn.execute(text(sql), params or {})
            rows = result.fetchall()
            columns = result.keys()

        return pd.DataFrame(rows, columns=columns)

    async def close(self) -> None:
        if self._raw_connection is not None:
            await self._raw_connection.dispose()
            self._raw_connection = None
```

### Phase 5: Async Testing (Est. 2-3 weeks)

#### 5.1 Async `AppTest`

```python
# In lib/streamlit/testing/v1/app_test.py
class AppTest:
    # ...

    async def run_async(self, *, timeout: float | None = None) -> AppTest:
        """Run the app asynchronously.

        Use this when testing apps that use async code.
        """
        # Similar to _run but with async support
        ...

    # Keep sync run() for backwards compatibility
    def run(self, *, timeout: float | None = None) -> AppTest:
        """Run the app synchronously (existing behavior)."""
        return self._run(timeout=timeout)
```

### Phase 6: Documentation & Migration (Est. 2 weeks)

- Add "Async Programming Guide" to docs
- Update API reference for all async-enabled commands
- Create migration guide for existing workarounds
- Add examples to the `hello` app

---

## API Proposals

### New APIs

| API | Description |
|-----|-------------|
| `st.run_async(coro)` | Run a coroutine and return its result |
| `st.get_event_loop()` | Get the script thread's event loop |
| `st.gather(*coros)` | Convenience wrapper for `asyncio.gather` |
| `AsyncBaseConnection` | Base class for async connections |

### Modified APIs (Backward Compatible)

| API | Change |
|-----|--------|
| `@st.cache_data` | Auto-detect and handle async functions |
| `@st.cache_resource` | Auto-detect and handle async functions |
| `@st.fragment` | Support async fragment functions |
| Widget `on_change` | Accept async callbacks |
| `AppTest` | Add `run_async()` method |

### Example Usage After Implementation

```python
import streamlit as st
import asyncio
import aiohttp

# Async cached function - just works!
@st.cache_data
async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

# Parallel data fetching
async def load_dashboard():
    users, products, orders = await asyncio.gather(
        fetch_data("/api/users"),
        fetch_data("/api/products"),
        fetch_data("/api/orders"),
    )
    return users, products, orders

# Async fragment
@st.fragment
async def live_data_fragment():
    data = await fetch_data("/api/live")
    st.metric("Live Value", data["value"])

# Async callback
async def on_submit():
    await save_to_database(st.session_state.form_data)
    st.toast("Saved!")

# Main app
st.title("Async Dashboard")

users, products, orders = st.run_async(load_dashboard())
st.dataframe(users)
st.dataframe(products)
st.dataframe(orders)

live_data_fragment()

st.text_input("Name", key="name")
st.button("Submit", on_click=on_submit)
```

---

## Breaking Changes & Migration

### No Breaking Changes in Phase 1-3

All proposed changes are additive and backward compatible:
- Existing sync code continues to work unchanged
- New async features are opt-in
- Type signatures are expanded, not changed

### Potential Future Breaking Change (Phase 7+)

If Streamlit ever moves to a fully async execution model:
- All `st.*` commands would become `async def`
- Would require major version bump (e.g., Streamlit 2.0)
- Migration path: `await st.write(...)` instead of `st.write(...)`

**Recommendation:** Defer this decision until async adoption is widespread.

---

## Risks & Considerations

### 1. Event Loop Lifecycle Management

**Risk:** Event loops not being properly closed can cause resource leaks.

**Mitigation:**
- Ensure `ScriptRunContext.close_event_loop()` is always called in `finally` blocks
- Add logging/warnings for unclosed loops
- Consider using `asyncio.Runner` (Python 3.11+) for better lifecycle management

### 2. Thread Safety

**Risk:** Async objects (connections, clients) may not be thread-safe.

**Mitigation:**
- Document that cached async resources should use proper synchronization
- Consider session-scoped event loops vs. global event loops
- Provide `st.session_state` integration for per-session async resources

### 3. Callback Execution Order

**Risk:** Async callbacks may execute in unexpected order.

**Mitigation:**
- Document that async callbacks are awaited sequentially
- Consider adding `st.gather_callbacks()` for parallel callback execution

### 4. Testing Complexity

**Risk:** Testing async code is more complex.

**Mitigation:**
- Provide `AppTest.run_async()` from the start
- Add pytest-asyncio integration examples
- Document testing patterns for async apps

### 5. Performance

**Risk:** Creating/closing event loops per script run may have overhead.

**Mitigation:**
- Benchmark the overhead (likely negligible)
- Consider event loop pooling if overhead is significant
- Profile real-world apps before and after

---

## Timeline Estimate

| Phase | Description | Duration | Dependencies |
|-------|-------------|----------|--------------|
| 1 | Foundation (event loop, `run_async`) | 4-6 weeks | None |
| 2 | Async Caching | 4-6 weeks | Phase 1 |
| 3 | Async Callbacks | 3-4 weeks | Phase 1 |
| 4 | Async Connections | 3-4 weeks | Phase 1, 2 |
| 5 | Async Testing | 2-3 weeks | Phase 1-4 |
| 6 | Documentation | 2 weeks | Phase 1-5 |

**Total Estimated Duration:** 4-6 months

---

## Appendix: Code Locations for Changes

### Phase 1 Files to Modify

- `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py` - Add event loop management
- `lib/streamlit/runtime/scriptrunner/script_runner.py` - Event loop lifecycle
- `lib/streamlit/commands/async_commands.py` - New file for `st.run_async()`
- `lib/streamlit/__init__.py` - Export new commands

### Phase 2 Files to Modify

- `lib/streamlit/runtime/caching/cache_utils.py` - Async detection in `CachedFunc`
- `lib/streamlit/runtime/caching/cache_data_api.py` - Update docstrings
- `lib/streamlit/runtime/caching/cache_resource_api.py` - Update docstrings

### Phase 3 Files to Modify

- `lib/streamlit/runtime/state/common.py` - `WidgetCallback` type
- `lib/streamlit/runtime/state/session_state.py` - Async callback execution
- `lib/streamlit/runtime/fragment.py` - Async fragment support

### Phase 4 Files to Modify

- `lib/streamlit/connections/async_base_connection.py` - New file
- `lib/streamlit/connections/async_sql_connection.py` - New file
- `lib/streamlit/runtime/connection_factory.py` - Async connection support

### Phase 5 Files to Modify

- `lib/streamlit/testing/v1/app_test.py` - Add `run_async()`
- `lib/streamlit/testing/v1/local_script_runner.py` - Async script running

---

## References

- [Python asyncio documentation](https://docs.python.org/3/library/asyncio.html)
- [Tornado asyncio integration](https://www.tornadoweb.org/en/stable/asyncio.html)
- [GitHub Issue #8488](https://github.com/streamlit/streamlit/issues/8488)
- [GitHub Issue #8308](https://github.com/streamlit/streamlit/issues/8308)
