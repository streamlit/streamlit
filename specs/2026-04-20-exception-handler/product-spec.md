---
author: lukasmasuch
created: 2026-04-20
---

# Custom exception handlers for user script exceptions

## Summary

Add support for custom exception handlers that intercept uncaught exceptions from Streamlit
user scripts. This enables integration with error monitoring services like Sentry, Datadog,
and custom logging pipelines while preserving the default exception display behavior unless
a handler explicitly suppresses it to show custom UI.

## Problem

Users want to connect their Streamlit apps to error monitoring services (Sentry, Datadog,
Rollbar, etc.) to track uncaught exceptions in production. Currently, Streamlit catches
all exceptions from user code and displays them in the UI, but provides no hook for users
to intercept these exceptions for logging or monitoring purposes.

**GitHub Issues:**

- [#3426](https://github.com/streamlit/streamlit/issues/3426) — Custom exception handler
  support (register callback for all unhandled exceptions)

**Current workaround:** Users can wrap their entire script in try/except, but this is
error-prone and doesn't catch exceptions from callbacks, fragments, or framework-level code.

**Two distinct exception layers:**

1. **HTTP layer** (`st.App.exception_handlers`): Starlette exception handlers for HTTP
   request/response errors (404, 500, etc.). These operate at the ASGI/web server level.

2. **Script execution layer**: Exceptions from user code running in the Streamlit script.
   These are caught in `exec_func_with_error_handling` and passed to
   `handle_uncaught_app_exception`, which logs to console and shows in the UI.

This spec addresses the **script execution layer** — enabling users to hook into exceptions
from their Streamlit app code.

## Proposal

### Naming Options

The existing `exception_handlers` parameter handles HTTP-layer exceptions. We need a name
that clearly distinguishes script/code exceptions:

| Name | Pros | Cons |
|------|------|------|
| `on_script_error` | Explicit "script" scope, `on_*` pattern | Slightly verbose |
| `script_error_handler` | Very explicit | Doesn't match `on_*` callback pattern |
| `on_uncaught_exception` | Describes behavior accurately | Long, doesn't clarify "script" scope |
| `error_callback` | Short, clear it's a callback | Too generic, could be HTTP errors |

**Recommended: `on_script_error`** — clearly indicates script-level errors, follows `on_*`
callback convention, and is distinct from HTTP-layer `exception_handlers`.

### API Options

#### Option A: Separate parameter ✅ PREFERRED

Add a dedicated `on_script_error` parameter alongside the existing `exception_handlers`:

```python
st.App(
    script_path: str | Path,
    *,
    on_script_error: Callable[[Exception], bool | None] | None = None,  # NEW
    exception_handlers: Mapping[Any, ExceptionHandler] | None = None,  # HTTP layer
    # ... other parameters
)
```

**Usage:**

```python
import streamlit as st
import sentry_sdk

sentry_sdk.init(dsn="...")

def handle_script_error(exc: Exception) -> None:
    """Called for every uncaught exception in user script code.

    Returns None to preserve the default exception display behavior.
    Return True instead to suppress the default display and show custom UI.
    """
    sentry_sdk.capture_exception(exc)

app = st.App(
    "main.py",
    on_script_error=handle_script_error,
)
```

**Pros:**

- Clear separation of concerns
- Self-documenting: parameter name explains what it handles
- No type detection magic
- Easy to use one, the other, or both

**Cons:**

- Two parameters for "exception handling" (potential confusion)

#### Option B: Unified `exception_handlers` with type detection

Extend `exception_handlers` to accept either a mapping (HTTP layer) or a callable
(script layer), detecting the type at runtime:

```python
st.App(
    script_path: str | Path,
    *,
    exception_handlers: (
        Mapping[Any, ExceptionHandler] |           # HTTP layer (existing)
        Callable[[Exception], bool | None] |   # Script layer (new)
        None
    ) = None,
    # ... other parameters
)
```

**Usage:**

```python
# Script errors only
app = st.App("main.py", exception_handlers=sentry_sdk.capture_exception)

# HTTP errors only (existing behavior)
app = st.App("main.py", exception_handlers={404: not_found_handler})
```

**Pros:**

- Single parameter for all exception handling
- Intuitive: "pass a function to handle exceptions"

**Cons:**

- Cannot configure both HTTP and script handlers simultaneously
- Type detection can be surprising
- Overloads parameter meaning

#### Option C: Unified with explicit structure

Use a structured object or tuple to support both layers in one parameter:

```python
from streamlit import ScriptErrorHandler

st.App(
    script_path: str | Path,
    *,
    exception_handlers: (
        Mapping[Any, ExceptionHandler] |
        Callable[[Exception], bool | None] |
        tuple[Mapping[Any, ExceptionHandler], Callable[[Exception], bool | None]] |
        None
    ) = None,
)
```

**Usage:**

```python
# Both layers
app = st.App(
    "main.py",
    exception_handlers=(
        {404: not_found_handler},      # HTTP layer
        sentry_sdk.capture_exception,  # Script layer
    ),
)

# Script only (simple callable)
app = st.App("main.py", exception_handlers=sentry_sdk.capture_exception)

# HTTP only (mapping, existing behavior)
app = st.App("main.py", exception_handlers={404: not_found_handler})
```

**Pros:**

- Single parameter handles all cases
- Backwards compatible (mapping still works)
- Supports both layers simultaneously

**Cons:**

- Tuple syntax is less readable
- Complex type signature
- Parameter name doesn't clearly indicate dual purpose

### Recommended Approach: Option A (Separate Parameter)

**Use `on_script_error` as a separate parameter.** Rationale:

1. **Clarity over cleverness**: Two explicit parameters are easier to understand than
   one overloaded parameter with type detection
2. **Independent configuration**: Users can configure HTTP and script handlers
   independently without learning special syntax
3. **Better documentation**: Each parameter's docstring explains exactly what it does
4. **Type safety**: No runtime type detection, clear static types

```python
st.App(
    script_path: str | Path,
    *,
    lifespan: ... = None,
    routes: ... = None,
    middleware: ... = None,
    on_script_error: Callable[[Exception], bool | None] | None = None,  # Script exceptions
    exception_handlers: Mapping[Any, ExceptionHandler] | None = None,  # HTTP exceptions
    debug: bool = False,
)
```

**Example with both layers:**

```python
import streamlit as st
import sentry_sdk
from starlette.responses import HTMLResponse

sentry_sdk.init(dsn="...")

async def custom_404(request, exc):
    return HTMLResponse("<h1>Page not found</h1>", status_code=404)

app = st.App(
    "main.py",
    on_script_error=sentry_sdk.capture_exception,  # Script exceptions → Sentry
    exception_handlers={404: custom_404},          # HTTP 404 → custom page
)
```

### Behavior

**Callback signature:**

```python
def handler(exc: Exception) -> bool | None:
    """
    Called when an uncaught exception occurs while executing the
    Streamlit script for a user session, including widget callbacks
    and fragments.

    This does not handle HTTP route errors, ASGI middleware errors,
    websocket failures, or broader session lifecycle errors.

    Parameters
    ----------
    exc : Exception
        The exception that was raised. Includes full traceback via
        exc.__traceback__.

        Note: The existing ``exec_func_with_error_handling`` catches
        ``Exception``, not ``BaseException``. This means ``KeyboardInterrupt``,
        ``SystemExit``, and ``GeneratorExit`` are NOT passed to this handler.

    Returns
    -------
    bool | None
        Return ``True`` to suppress the default exception display.
        Return ``False`` or ``None`` (default) to show the exception normally.

    Notes
    -----
    - The handler is called AFTER the exception is logged to console
    - The handler is called BEFORE the exception is displayed in the UI
    - The handler CAN call ``st.*`` commands to display custom error UI
    - The handler runs in the script thread (blocking)
    - If the handler itself raises an exception, that exception is logged to
      the console but not displayed in the UI. The original exception's
      default display behavior proceeds as if the handler returned False/None.
      This ensures the handler cannot break the app's error display, but be
      aware that errors in your custom ``st.*`` error UI will be silently
      swallowed from the user's perspective.
    """
    pass
```

**Execution order:**

```
1. Exception raised in user code
2. Exception caught by exec_func_with_error_handling
3. Exception logged to console (unchanged)
4. on_script_error handler called (NEW)
5. If handler returns True: skip default display
   If handler returns False/None: display exception in UI (unchanged)
```

**What exceptions trigger the handler:**

| Exception Type | Triggers Handler | Notes |
|----------------|------------------|-------|
| User code exceptions | Yes | Main use case |
| `st.stop()` | No | Control flow, not an error |
| `st.rerun()` | No | Control flow, not an error |
| Compile/syntax errors | No | Caught during compile phase before `exec_func_with_error_handling`; shows modal dialog in frontend |
| Fragment exceptions | Yes | Errors in `@st.fragment` code |
| Callback exceptions | Yes | Errors in widget callbacks |
| `KeyboardInterrupt`, `SystemExit` | No | Not caught by `except Exception`; propagate normally |

**Thread safety:**

The handler runs in the script thread, same as the user's code. This means:

- Handler can access `st.session_state` safely
- Handler can call `st.*` commands to display custom error UI
- Handler should be quick (blocking delays UI update)

**Implementation notes:**

The handler must be propagated from `st.App` construction to `exec_func_with_error_handling`.
The current call chain is:

```
st.App.__call__ → Starlette → Runtime → ScriptRunner → exec_func_with_error_handling
                                                      → handle_uncaught_app_exception
```

The recommended approach is to add the handler as a field on `ScriptRunContext`, which is
already threaded through to `exec_func_with_error_handling`. The `handle_uncaught_app_exception`
function (or its caller) can then check `ctx.on_script_error` and invoke it at the appropriate
point in the exception handling flow.

### Examples

#### Sentry Integration

```python
import streamlit as st
import sentry_sdk

sentry_sdk.init(dsn="https://...")

app = st.App("main.py", on_script_error=sentry_sdk.capture_exception)
```

#### Custom Error UI (Suppress Default Display)

```python
import streamlit as st
import sentry_sdk

sentry_sdk.init(dsn="...")

def custom_error_handler(exc: Exception) -> bool:
    """Show friendly error message and report to Sentry."""
    sentry_sdk.capture_exception(exc)

    st.error("Something went wrong. Our team has been notified.")
    st.caption(f"Error reference: {sentry_sdk.last_event_id()}")

    with st.expander("Technical details"):
        st.code(f"{type(exc).__name__}: {exc}")

    return True  # Suppress default exception display

app = st.App("main.py", on_script_error=custom_error_handler)
```

#### Custom Logging with Context

```python
import streamlit as st
import logging

logger = logging.getLogger("myapp")

def log_exception(exc: Exception) -> None:
    logger.error(
        "Uncaught exception in Streamlit app",
        exc_info=(type(exc), exc, exc.__traceback__),
        extra={
            "session_id": st.session_state.get("_session_id"),
            "user": st.user.email if st.user.is_logged_in else None,
        }
    )

app = st.App("main.py", on_script_error=log_exception)
```

#### Both Exception Layers

```python
import streamlit as st
import sentry_sdk
from starlette.responses import HTMLResponse

sentry_sdk.init(dsn="...")

async def maintenance_page(request, exc):
    return HTMLResponse("<h1>Under maintenance</h1>", status_code=503)

app = st.App(
    "main.py",
    on_script_error=sentry_sdk.capture_exception,  # Script errors → Sentry
    exception_handlers={503: maintenance_page},    # HTTP 503 → maintenance page
)
```

#### Multiple Error Services

```python
import streamlit as st
import sentry_sdk
import datadog

sentry_sdk.init(dsn="...")
datadog.initialize(api_key="...")

def multi_service_handler(exc: Exception) -> None:
    sentry_sdk.capture_exception(exc)
    datadog.statsd.increment("streamlit.errors", tags=[f"type:{type(exc).__name__}"])

app = st.App("main.py", on_script_error=multi_service_handler)
```

## Out of Scope (Future Work)

- **`st.set_exception_handler()`**: A command for traditional `streamlit run` mode (not using `st.App`)
- **Exception filtering**: Allow handlers to filter which exceptions to report
- **Multiple handlers**: Support a list of handlers (middleware-style)
- **Async handlers**: Support `async def handler(exc)` for non-blocking reporting
- **Per-session handlers**: Different handlers for different sessions

## Checklist

| Item | Status |
|------|--------|
| Works on SiS, Cloud, etc? | ✅ Yes - handler runs in script thread |
| No breaking API changes | ✅ Yes |
| No new dependencies | ✅ Yes |
| Metrics collected | ⚠️ st.App parameters aren't tracked yet |
| Any security/legal impact? | ✅ Handler could send data externally (user's choice) |
| Any docs changes needed? | ✅ New section in "Error Handling" docs |
