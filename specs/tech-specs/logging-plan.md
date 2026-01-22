# Logging Strategy Improvement Plan

**Status: ✅ IMPLEMENTED**

This document outlines the improvements made to Streamlit's logging strategy to follow Python standard library conventions while maintaining backward compatibility.

**Related Issue:** [GitHub Issue #4742](https://github.com/streamlit/streamlit/issues/4742)

## Implementation Summary

The following changes were made to `lib/streamlit/logger.py`:

1. **Centralized handler on root logger**: The `StreamHandler` is now configured only on the root `streamlit` logger, not on each child logger.

2. **Enabled log propagation**: Child `streamlit.*` loggers no longer set `propagate=False`, allowing messages to bubble up to the root logger's handler.

3. **Added `_ensure_root_logger_configured()`**: This function ensures the root logger is configured before any child logger is used.

4. **Preserved external logger behavior**: Non-streamlit loggers (like `tornado.*`) continue to have their own handlers for backward compatibility.

### Files Modified
- `lib/streamlit/logger.py` - Core logging implementation
- `lib/tests/streamlit/logger_test.py` - Updated and new tests

### Verification
Users can now configure Streamlit's logging using standard Python methods:

```python
import logging
streamlit_logger = logging.getLogger("streamlit")
streamlit_logger.setLevel(logging.DEBUG)
streamlit_logger.addHandler(my_custom_handler)  # Messages propagate here!
```

---

## Problem Summary

Streamlit's current logging implementation deviates from Python's standard logging practices:

1. **Non-standard logger configuration:** Each logger obtained via `get_logger(__name__)` is configured with:
   - Its own `StreamHandler` (redundant handlers across 60+ modules)
   - `propagate = False` (prevents log propagation to parent loggers)
   - Custom level management via `_global_log_level`

2. **Custom logger storage:** The `_loggers` dict re-implements what Python's `logging` module already provides.

3. **User customization is blocked:** Users cannot configure Streamlit's logging using standard methods:

   ```python
   # This doesn't work as expected due to propagate=False on child loggers
   import logging
   streamlit_logger = logging.getLogger("streamlit")
   streamlit_logger.setLevel(logging.DEBUG)
   streamlit_logger.addHandler(my_custom_handler)
   ```

4. **Violates Python logging best practices:** The [Python logging documentation](https://docs.python.org/3/howto/logging.html#configuring-logging-for-a-library) recommends:
   > "It is strongly advised that you do not add any handlers other than NullHandler to your library's loggers."

## Current Implementation Analysis

### `lib/streamlit/logger.py` (Lines 103-129)

```python
def get_logger(name: str) -> logging.Logger:
    if name in _loggers:
        return _loggers[name]

    logger = (
        logging.getLogger("streamlit") if name == "root" else logging.getLogger(name)
    )

    logger.setLevel(_global_log_level)
    logger.propagate = False  # ❌ Blocks propagation
    setup_formatter(logger)   # ❌ Adds handler to each logger

    _loggers[name] = logger
    return logger
```

### Current Usage Pattern

```python
# In 60+ files across the codebase:
from streamlit.logger import get_logger
_LOGGER: Final = get_logger(__name__)
```

### Initialization Flow

1. `streamlit/__init__.py` imports `logger` and `config` modules
2. `_config.on_config_parsed(_update_logger, True)` registers callback
3. When config is parsed, `_update_logger()` is called:
   - Sets log level via `logger.set_log_level()`
   - Updates formatters via `logger.update_formatter()`
   - Initializes Tornado logs via `logger.init_tornado_logs()`

## Proposed Solution

### Phase 1: Centralize Handler on Root Logger (Backward Compatible)

**Goal:** Move the handler/formatter to the root `streamlit` logger while keeping `get_logger()` API unchanged.

#### Changes to `lib/streamlit/logger.py`

```python
"""Logging module."""

from __future__ import annotations

import logging
import sys
from typing import Final, cast

DEFAULT_LOG_MESSAGE: Final = "%(asctime)s %(levelname) -7s %(name)s: %(message)s"

# Track whether logging has been configured for app mode
_logging_configured: bool = False

# The global log level (for backward compatibility)
_global_log_level: int = logging.INFO


def _get_root_logger() -> logging.Logger:
    """Return the Streamlit root logger."""
    return logging.getLogger("streamlit")


def _configure_root_handler() -> None:
    """Configure the root streamlit logger with a handler.

    This should only be called when Streamlit is running as an app.
    """
    global _logging_configured
    if _logging_configured:
        return

    root_logger = _get_root_logger()

    # Remove any existing Streamlit handlers
    if hasattr(root_logger, "streamlit_console_handler"):
        root_logger.removeHandler(
            cast("logging.Handler", root_logger.streamlit_console_handler)
        )

    # Add handler only to root logger
    handler = logging.StreamHandler()
    root_logger.streamlit_console_handler = handler  # type: ignore[attr-defined]

    # Import here to avoid circular imports
    from streamlit import config

    if config._config_options:
        message_format = config.get_option("logger.messageFormat")
    else:
        message_format = DEFAULT_LOG_MESSAGE

    formatter = logging.Formatter(fmt=message_format)
    formatter.default_msec_format = "%s.%03d"
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    _logging_configured = True


def set_log_level(level: str | int) -> None:
    """Set log level for Streamlit loggers."""
    if isinstance(level, str):
        level = level.upper()

    level_map = {
        "CRITICAL": logging.CRITICAL,
        "ERROR": logging.ERROR,
        "WARNING": logging.WARNING,
        "INFO": logging.INFO,
        "DEBUG": logging.DEBUG,
    }

    if isinstance(level, str):
        log_level = level_map.get(level)
        if log_level is None:
            root = _get_root_logger()
            root.critical(f'undefined log level "{level}"')
            sys.exit(1)
    elif level in level_map.values():
        log_level = level
    else:
        root = _get_root_logger()
        root.critical(f'undefined log level "{level}"')
        sys.exit(1)

    global _global_log_level
    _global_log_level = log_level

    # Set level on root logger - child loggers inherit via propagation
    _get_root_logger().setLevel(log_level)


def update_formatter() -> None:
    """Update the formatter on the root logger."""
    root_logger = _get_root_logger()
    if hasattr(root_logger, "streamlit_console_handler"):
        from streamlit import config

        if config._config_options:
            message_format = config.get_option("logger.messageFormat")
        else:
            message_format = DEFAULT_LOG_MESSAGE

        formatter = logging.Formatter(fmt=message_format)
        formatter.default_msec_format = "%s.%03d"
        root_logger.streamlit_console_handler.setFormatter(formatter)  # type: ignore[attr-defined]


def init_tornado_logs() -> None:
    """Set Tornado log levels."""
    for log_name in ("access", "application", "general"):
        tornado_logger = logging.getLogger(f"tornado.{log_name}")
        tornado_logger.setLevel(_global_log_level)


def get_logger(name: str) -> logging.Logger:
    """Return a logger.

    Parameters
    ----------
    name : str
        The name of the logger to use. You should just pass in __name__.

    Returns
    -------
    Logger
    """
    if name == "root":
        return _get_root_logger()

    return logging.getLogger(name)
```

#### Changes to `lib/streamlit/__init__.py`

```python
def _update_logger() -> None:
    # Configure the root handler when running as an app
    _logger._configure_root_handler()
    _logger.set_log_level(_config.get_option("logger.level").upper())
    _logger.update_formatter()
    _logger.init_tornado_logs()
```

### Phase 2: Library Mode Support (Optional, Future Enhancement)

For users who import Streamlit as a library and want full control over logging:

#### Add `configure_logging()` function

```python
def configure_logging(
    level: str | int = logging.WARNING,
    handler: logging.Handler | None = None,
    formatter: logging.Formatter | None = None,
) -> None:
    """Configure Streamlit's logging behavior.

    Call this function before running any Streamlit code if you want to
    customize logging behavior when using Streamlit as a library.

    Parameters
    ----------
    level : str | int
        The log level to use. Default is WARNING.
    handler : logging.Handler, optional
        Custom handler to use. If None, uses StreamHandler.
    formatter : logging.Formatter, optional
        Custom formatter to use.

    Example
    -------
    >>> import logging
    >>> import streamlit as st
    >>> st.logger.configure_logging(
    ...     level=logging.DEBUG,
    ...     handler=logging.FileHandler("streamlit.log")
    ... )
    """
    global _logging_configured

    root_logger = _get_root_logger()

    # Remove existing handlers
    for h in root_logger.handlers[:]:
        root_logger.removeHandler(h)
    if hasattr(root_logger, "streamlit_console_handler"):
        delattr(root_logger, "streamlit_console_handler")

    # Set level
    if isinstance(level, str):
        level = getattr(logging, level.upper())
    root_logger.setLevel(level)

    # Add handler if provided, otherwise use StreamHandler
    if handler is None:
        handler = logging.StreamHandler()

    if formatter is not None:
        handler.setFormatter(formatter)

    root_logger.addHandler(handler)
    _logging_configured = True
```

## Migration Strategy

### Backward Compatibility

The proposed changes maintain backward compatibility:

1. **Same CLI behavior:** Users running `streamlit run app.py` see identical log output
2. **Same config options:** `logger.level` and `logger.messageFormat` continue to work
3. **Same API:** `get_logger(__name__)` remains the internal interface
4. **Tornado logs:** Continue to be configured as before

### What Changes for Users

**Before (current behavior):**

```python
import logging
# This doesn't work - handlers are on child loggers
logging.getLogger("streamlit").setLevel(logging.DEBUG)
```

**After (proposed behavior):**

```python
import logging
# This works - handler is on root logger, children propagate
logging.getLogger("streamlit").setLevel(logging.DEBUG)
```

### Test Updates Required

Update `lib/tests/streamlit/logger_test.py`:

1. Remove tests that verify handlers on child loggers
2. Add tests verifying:
   - Handler only on root `streamlit` logger
   - Child loggers propagate to root
   - Level changes on root affect all child loggers
   - `configure_logging()` works for library mode

## Implementation Checklist

### Phase 1 (Core Changes) ✅ COMPLETED

- [x] Modify `lib/streamlit/logger.py`:
  - [x] Add `_setup_root_handler()` function (renamed from `_configure_root_handler()`)
  - [x] Add `_ensure_root_logger_configured()` function
  - [x] Update `set_log_level()` to set level on root logger
  - [x] Update `update_formatter()` to update root logger only
  - [x] Simplify `get_logger()` to return standard logger with propagation
  - [x] Keep `_loggers` dict for tracking and Tornado logs
  - [x] Remove per-logger handler setup for streamlit.* loggers

- [x] Verify `lib/streamlit/__init__.py` works correctly:
  - [x] Existing `_update_logger()` works with new implementation

- [x] Update tests in `lib/tests/streamlit/logger_test.py`:
  - [x] Test handler is only on root logger
  - [x] Test log propagation works
  - [x] Test standard logging configuration works (GitHub #4742 fix)
  - [x] Add setUp/tearDown for test isolation

### Phase 2 (Library Mode - Optional, Future)

- [ ] Add `configure_logging()` function
- [ ] Add documentation for library users
- [ ] Add detection for "library mode" vs "app mode"

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Duplicate log messages | Ensure only one handler on root logger |
| Breaking third-party integrations | Phase rollout, announce in release notes |
| Config option timing issues | Maintain `on_config_parsed` callback pattern |
| Tornado log handling | Keep separate handling for tornado.* loggers |

## Testing Plan

1. **Unit tests:** Update `logger_test.py` with new expectations
2. **Integration tests:** Verify logs appear correctly in CLI output
3. **Manual testing:**
   - `streamlit run app.py` with various `--logger.level` values
   - Import Streamlit in a script and verify standard logging works
4. **E2E tests:** Ensure no regressions in log output

## References

- [Python Logging HOWTO - Configuring Logging for a Library](https://docs.python.org/3/howto/logging.html#configuring-logging-for-a-library)
- [Python Logging Cookbook](https://docs.python.org/3/howto/logging-cookbook.html)
- [GitHub Issue #4742](https://github.com/streamlit/streamlit/issues/4742)
- [GitHub Issue #3978](https://github.com/streamlit/streamlit/issues/3978) (related: root logger issue)

## Timeline Estimate

- **Phase 1:** 2-3 days of development + 1 day of testing
- **Phase 2:** 1-2 days of development + 1 day of testing
- **Documentation:** 0.5 day

## Summary

This plan addresses the core issues raised in GitHub Issue #4742 by:

1. Moving handler/formatter to the root `streamlit` logger only
2. Allowing log propagation from child loggers (default behavior)
3. Maintaining full backward compatibility for CLI users
4. Enabling standard Python logging configuration for library users

The key insight is that **the handler should only be configured when Streamlit runs as an application**, not when imported as a library. This follows Python's best practices while preserving existing functionality.
