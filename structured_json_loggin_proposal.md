# Streamlit Opensource Logging Middleware/Hook Pattern Proposal

Last Updated: Oct 1, 2025

## Problem Statement

For SiS on SPCS, in order to emit logs to the SPCS-managed logs aggregator, the logs need to follow a structured JSON format. Currently, the Streamlit open-source library and the Tornado server do not support structured JSON logging.

## Proposed Solution

Introduce a middleware-like pattern into the logging codepath in Streamlit. Enable consumers to define their own hooks so they can do whatever they want with logs.

## Design Options

### **Option A: Handler Registration API**

#### **Idea**

Provide an API for users to register custom `logging.Handler` instances that Streamlit will attach to its loggers.

#### **API Design**

```py
# In lib/streamlit/logger.py
from typing import List
import logging

_custom_handlers: List[logging.Handler] = []


def register_handler(
    handler: logging.Handler,
    apply_to_tornado: bool = True,
    remove_default_handler: bool = False
) -> None:
    """
    Register a custom logging handler to be attached to Streamlit loggers.
    
    This function must be called before any Streamlit loggers are created
    (i.e., before importing streamlit.web.cli or creating a Streamlit app).
    
    Args:
        handler: A logging.Handler instance that will receive log records
        apply_to_tornado: If True, also attach handler to Tornado loggers
            (tornado.access, tornado.application, tornado.general)
        remove_default_handler: If True, remove Streamlit's default console handler
            and only use the custom handler
    
    Example:
        >>> import logging
        >>> from streamlit.logger import register_handler
        >>>
        >>> # Create custom handler with JSON formatter
        >>> handler = logging.StreamHandler()
        >>> handler.setFormatter(MyJSONFormatter())
        >>>
        >>> # Register it
        >>> register_handler(handler, remove_default_handler=True)
        >>>
        >>> # Now import and run Streamlit
        >>> from streamlit.web import cli
        >>> cli.main()
    """
    _custom_handlers.append(handler)
    
    # Apply to already-created loggers
    for logger in _loggers.values():
        if remove_default_handler and hasattr(logger, 'streamlit_console_handler'):
            logger.removeHandler(logger.streamlit_console_handler)
        logger.addHandler(handler)
    
    # Apply to Tornado loggers if requested
    if apply_to_tornado:
        for logger_name in ["tornado.access", "tornado.application", "tornado.general"]:
            tornado_logger = logging.getLogger(logger_name)
            tornado_logger.addHandler(handler)


def get_logger(name: str) -> logging.Logger:
    """Get or create a Streamlit logger (existing function, modified)."""
    # ... existing logger creation logic ...
    
    # Attach any registered custom handlers
    for handler in _custom_handlers:
        logger.addHandler(handler)
    
    return logger
```

#### **User Implementation**

```py
# In streamlit-runner.py (SiS container runtime)
import logging
import sys
from pythonjsonlogger import jsonlogger

# MUST happen before importing streamlit
from streamlit.logger import register_handler

# Create handler with JSON formatter
handler = logging.StreamHandler(sys.stdout)
formatter = jsonlogger.JsonFormatter(
fmt='%(message)s %(levelname)s %(name)s %(asctime)s %(pathname)s',
# SiS controls all formatting details
rename_fields={...}, # if desired
static_fields={...}, # if desired
)
handler.setFormatter(formatter)

# Register with Streamlit
register_handler(
handler,
apply_to_tornado=True,
remove_default_handler=True # Don't want dual output
)

# Now start Streamlit
from streamlit.web import cli
cli.main()
```

#### **Pros**

1. **Maximum flexibility**: Users control handler type, formatter, destination, filters   
2. **Standard Python API**: Uses `logging.Handler`, familiar to Python developers  
3. **No Streamlit coupling**: Streamlit doesn't know or care about JSON/formatters  
4. **Composable**: Users can register multiple handlers (e.g., one for stdout, one for file)  
5. **Full control**: Can add filters, set levels per-handler, route to different outputs

#### **Cons**

1. **More complex**: Users must understand handlers vs formatters vs loggers  
2. **Easy to misconfigure**: Could create duplicate output if `remove_default_handler=False`  
3. **Handler lifecycle**: Users responsible for handler cleanup/shutdown  
4. **Timing-sensitive**: Must register before Streamlit creates loggers

#### **Risk Assessment**

**Medium Risk**:

1. If users register handler after loggers created, some logs won't use custom handler  
2. Could create multiple outputs if default handler not removed  
3. Handler errors could break logging entirely

### **Option B: Formatter Registration API**

#### **Idea**

Provide an API for users to register a custom `logging.Formatter` that Streamlit will use instead of its default formatter. Streamlit still manages handlers and loggers.

#### **API Design**

```py
# In lib/streamlit/logger.py
from typing import Optional
import logging

_custom_formatter: Optional[logging.Formatter] = None
_apply_formatter_to_tornado: bool = True


def register_formatter(
    formatter: logging.Formatter,
    apply_to_tornado: bool = True
) -> None:
    """
    Register a custom formatter for Streamlit logs.
    
    This formatter will be used for all Streamlit loggers instead of the default
    formatter. Must be called before any Streamlit loggers are created.
    
    Args:
        formatter: A logging.Formatter instance (or subclass)
        apply_to_tornado: If True, also apply formatter to Tornado loggers
    
    Example:
        >>> from pythonjsonlogger import jsonlogger
        >>> from streamlit.logger import register_formatter
        >>>
        >>> formatter = jsonlogger.JsonFormatter(
        ...     fmt='%(message)s %(levelname)s %(name)s'
        ... )
        >>>
        >>> register_formatter(formatter, apply_to_tornado=True)
        >>>
        >>> # Now import and run Streamlit
        >>> from streamlit.web import cli
        >>> cli.main()
    """
    global _custom_formatter, _apply_formatter_to_tornado
    _custom_formatter = formatter
    _apply_formatter_to_tornado = apply_to_tornado
    
    # Reapply to existing loggers
    update_formatter()


def setup_formatter(logger: logging.Logger) -> None:
    """Set up the formatter for a logger (existing function, modified)."""
    # Deregister any previous console loggers
    if hasattr(logger, "streamlit_console_handler"):
        logger.removeHandler(logger.streamlit_console_handler)
    
    # Create handler
    logger.streamlit_console_handler = logging.StreamHandler()
    
    # Use custom formatter if registered, otherwise default
    if _custom_formatter is not None:
        formatter = _custom_formatter
    else:
        # Import here to avoid circular imports
        from streamlit import config
        formatter = _create_standard_formatter(config)
    
    logger.streamlit_console_handler.setFormatter(formatter)
    logger.addHandler(logger.streamlit_console_handler)


def update_formatter() -> None:
    """Reapply formatters to all existing loggers."""
    # Reapply to Streamlit loggers
    for logger in _loggers.values():
        setup_formatter(logger)
    
    # Reapply to Tornado loggers if requested
    if _apply_formatter_to_tornado and _custom_formatter is not None:
        for logger_name in ["tornado.access", "tornado.application", "tornado.general"]:
            tornado_logger = logging.getLogger(logger_name)
            # Find existing StreamHandler and update its formatter
            for handler in tornado_logger.handlers:
                if isinstance(handler, logging.StreamHandler):
                    handler.setFormatter(_custom_formatter)
```

#### **User Implementation**

```py
# In streamlit-runner.py
from pythonjsonlogger import jsonlogger
from streamlit.logger import register_formatter

# Create formatter with desired configuration
formatter = jsonlogger.JsonFormatter(
fmt='%(message)s %(levelname)s %(name)s %(asctime)s',
rename_fields={'levelname': 'level', 'name': 'logger'},
)

# Register it
register_formatter(formatter, apply_to_tornado=True)

# Start Streamlit
from streamlit.web import cli
cli.main()
```

#### **Pros**

1. **Simpler than handlers**: Users only think about formatting, not handler management  
2. **No duplicate output**: Streamlit manages the handler lifecycle  
3. **Clearer scope**: Only affects log formatting, not routing/filtering  
4. **Standard API**: Uses `logging.Formatter`, familiar interface  
5. **Less error-prone**: Fewer moving parts, harder to misconfigure

#### **Cons**

1. **Less flexible**: Can't change handler type (always StreamHandler to stdout/stderr)  
2. **Can't control destination**: Logs always go to console, can't route to file/network  
3. **Single formatter only**: Can't have different formats for different loggers  
4. **Timing-sensitive**: Still must register before logger creation

#### **Risk Assessment**

**Low Risk**:

1. API is simple and hard to misuse  
2. Worst case: formatter not applied (logs still work, just wrong format)  
3. No risk of duplicate output or broken logging

### **Option C: Hook/Callback Pattern**

#### **Idea**

Instead of registering formatters/handlers, users register callback functions that transform `LogRecord` objects into formatted strings. Streamlit wraps these in a custom formatter.

#### **API Design**

```py
# In lib/streamlit/logger.py
from typing import Callable, List, Optional
import logging

LogTransformHook = Callable[[logging.LogRecord], str]
_log_transform_hooks: List[LogTransformHook] = []
_apply_hooks_to_tornado: bool = True


def register_log_transform(
    transform_func: LogTransformHook,
    apply_to_tornado: bool = True,
    priority: int = 0
) -> None:
    """
    Register a function that transforms log records into formatted strings.
    
    The transform function receives a logging.LogRecord and must return a
    formatted string. Multiple transforms can be registered; they will be
    called in priority order (higher priority first).
    
    Args:
        transform_func: Function that takes LogRecord and returns formatted string
        apply_to_tornado: If True, also apply to Tornado loggers
        priority: Higher priority transforms are called first (default: 0)
    
    Example:
        >>> import json
        >>> from streamlit.logger import register_log_transform
        >>>
        >>> def json_transform(record):
        ...     return json.dumps({
        ...         'message': record.getMessage(),
        ...         'level': record.levelname,
        ...         'logger': record.name,
        ...         'timestamp': record.created,
        ...     })
        >>>
        >>> register_log_transform(json_transform)
    """
    global _apply_hooks_to_tornado
    _log_transform_hooks.append((priority, transform_func))
    _log_transform_hooks.sort(key=lambda x: x[0], reverse=True)
    _apply_hooks_to_tornado = apply_to_tornado
    
    # Reapply formatters to existing loggers
    update_formatter()


class HookFormatter(logging.Formatter):
    """Formatter that applies registered transform hooks."""
    
    def __init__(self, hooks: List[LogTransformHook], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.hooks = hooks
    
    def format(self, record: logging.LogRecord) -> str:
        """Format record using hooks, or fall back to standard formatting."""
        if self.hooks:
            # Use first hook (highest priority)
            _, transform_func = self.hooks[0]
            try:
                return transform_func(record)
            except Exception as e:
                # If hook fails, fall back to standard formatting
                import sys
                sys.stderr.write(
                    f"Warning: Log transform hook failed: {e}. "
                    "Falling back to standard formatting.\n"
                )
                return super().format(record)
        else:
            # No hooks, use standard formatting
            return super().format(record)


def setup_formatter(logger: logging.Logger) -> None:
    """Set up the formatter for a logger (existing function, modified)."""
    # ... handler setup ...
    if _log_transform_hooks:
        # Extract just the functions (not priorities)
        hooks = [func for _, func in _log_transform_hooks]
        formatter = HookFormatter(
            hooks=hooks,
            fmt=config.get_option("logger.messageFormat")
        )
    else:
        formatter = _create_standard_formatter(config)
    
    logger.streamlit_console_handler.setFormatter(formatter)
    logger.addHandler(logger.streamlit_console_handler)
```

#### **User Implementation**

```py
# In streamlit-runner.py
import json
from streamlit.logger import register_log_transform

def json_transform(record):
"""Transform LogRecord to JSON string."""
# User has full control over format
return json.dumps({
'timestamp': record.created,
'level': record.levelname,
'logger': record.name,
'message': record.getMessage(),
'module': record.module,
'function': record.funcName,
'line': record.lineno,
})

# Register the transform
register_log_transform(json_transform, apply_to_tornado=True)

# Start Streamlit
from streamlit.web import cli
cli.main()
```

#### **Alternative: Using pythonjsonlogger**

```py
# User can still use pythonjsonlogger, just differently
from pythonjsonlogger import jsonlogger

# Create formatter instance
json_formatter = jsonlogger.JsonFormatter(
fmt='%(message)s %(levelname)s %(name)s'
)

# Wrap it in a transform function
def json_transform(record):
return json_formatter.format(record)

register_log_transform(json_transform)
```

#### **Pros**

1. **Very simple API**: Just a function that takes LogRecord, returns string  
2. **Language-agnostic**: Not tied to logging.Formatter interface  
3. **Easy error handling**: Streamlit can catch exceptions and fallback  
4. **Composable**: Multiple hooks could be chained (though we use highest priority)  
5. **Testable**: Easy to unit test transform functions

#### **Cons**

1. **Limited scope**: Only formatting, can't change destination/filtering  
2. **Less "Pythonic"**: Introduces new concept instead of using standard logging API  
3. **Performance overhead**: Extra function call per log record  
4. **Duplicate LogRecord access**: Hook receives LogRecord but can't modify it

#### **Risk Assessment**

**Low Risk**:

1. Hooks are isolated (can't affect other parts of logging)  
2. Built-in error handling with fallback  
3. Worst case: hook fails, logs use standard format

### **Option D: Plugin System with Entry Points**

#### **Idea**

Use Python's setuptools entry point mechanism to discover and load logging formatters as plugins. This is the most "pluggable" approach but requires packaging.

#### **API Design**

```py
# In lib/streamlit/logger.py
from typing import Optional
import logging


def discover_logging_plugin() -> Optional[logging.Formatter]:
    """
    Discover logging formatters via setuptools entry points.
    
    Looks for entry points in the 'streamlit.logging.formatter' group.
    If multiple plugins are installed, the first one found is used.
    
    Returns:
        A logging.Formatter instance, or None if no plugin found
    """
    try:
        import pkg_resources
    except ImportError:
        # pkg_resources not available
        return None
    
    for entry_point in pkg_resources.iter_entry_points('streamlit.logging.formatter'):
        try:
            # Entry point should be a callable that returns a Formatter
            plugin_factory = entry_point.load()
            
            # Import config here to avoid circular imports
            from streamlit import config
            
            # Call plugin factory, passing config so plugin can read settings
            formatter = plugin_factory(config)
            if isinstance(formatter, logging.Formatter):
                return formatter
            else:
                import sys
                sys.stderr.write(
                    f"Warning: Logging plugin {entry_point.name} did not return "
                    f"a logging.Formatter instance. Ignoring.\n"
                )
        except Exception as e:
            import sys
            sys.stderr.write(
                f"Warning: Failed to load logging plugin {entry_point.name}: {e}\n"
            )
    
    return None


def setup_formatter(logger: logging.Logger) -> None:
    """Set up the formatter for a logger (existing function, modified)."""
    # ... handler setup ...
    
    # Try to load plugin formatter
    plugin_formatter = discover_logging_plugin()
    if plugin_formatter is not None:
        formatter = plugin_formatter
    else:
        # Use default formatter
        from streamlit import config
        formatter = _create_standard_formatter(config)
    
    logger.streamlit_console_handler.setFormatter(formatter)
    logger.addHandler(logger.streamlit_console_handler)
```

#### **User Implementation**

Users create a separate package:

```py
# In streamlit-json-logger package
# setup.py
from setuptools import setup

setup(
    name='streamlit-json-logger',
    version='1.0.0',
    py_modules=['streamlit_json_logger'],
    install_requires=[
        'python-json-logger>=3.3.0',
    ],
    entry_points={
        'streamlit.logging.formatter': [
            'json = streamlit_json_logger:create_formatter',
        ],
    },
)


# streamlit_json_logger.py
from pythonjsonlogger import jsonlogger
import logging


def create_formatter(config) -> logging.Formatter:
    """
    Factory function called by Streamlit to create formatter.
    
    Args:
        config: Streamlit's config object (can read config options)
    
    Returns:
        A logging.Formatter instance
    """
    # Could read custom config options if defined
    # fields = config.get_option("logger.jsonFields")
    
    return jsonlogger.JsonFormatter(
        fmt='%(message)s %(levelname)s %(name)s %(asctime)s',
        # Plugin controls all formatting details
    )
```

Then install the plugin:

pip install streamlit-json-logger

Streamlit automatically discovers and uses it.

#### **Pros**

1. **True plugin architecture**: Clean separation between Streamlit and formatters  
2. **Discoverable**: Can list installed plugins, choose between them  
3. **Distributable**: Plugins can be published to PyPI, shared across teams  
4. **No code changes needed**: Just `pip install`, no modification to runner scripts  
5. **Versioned**: Plugin has its own version, release cycle independent of Streamlit

#### **Cons**

1. **More complex setup**: Requires creating a package with setup.py  
2. **Harder for simple cases**: Overkill if you just want custom formatting  
3. **Discovery overhead**: Entry point discovery has startup cost  
4. **Versioning complexity**: Plugin compatibility with Streamlit versions  
5. **No direct control**: User can't pass arguments to formatter (only via config)

#### **Risk Assessment**

**Medium Risk**:

1. Entry point loading could fail (import errors, version conflicts)
2. Plugin bugs could break logging for all users who installed it
3. Multiple plugins installed \= undefined which one is used

### **Option E: Config-Based Logging Middleware**

#### **Overview**

Let users specify a Python file containing a logging configuration function via CLI flag or `config.toml`. Streamlit loads this file and calls the function for each logger during initialization. This gives users complete control over logging configuration without requiring them to wrap Streamlit's startup.

This approach introduces a general middleware pattern that starts with logging but can extend to other areas later (request handling, script lifecycle hooks, etc.). For now, we're scoping this to just logging to avoid over-engineering.

#### **API Design**

We add two config options to the `[logger]` section:

**`logger.middlewarePath`** - Path to a Python file containing the middleware function. Can be absolute or relative (relative paths resolve from the app script directory). Defaults to `None`.

**`logger.applyMiddlewareToTornado`** - Whether to also apply the middleware to Tornado's loggers (`tornado.access`, `tornado.application`, `tornado.general`). Defaults to `true`.

The middleware file must export a function called `configure_logging` with this signature:

```py
def configure_logging(logger: logging.Logger, config) -> None:
    """Configure a Streamlit or Tornado logger.

    Args:
        logger: Standard Python logging.Logger instance
        config: Object with get_option(key) and is_manually_set(key) methods
    """
    # Modify logger however you want
    pass
```

The function receives a standard `logging.Logger` and can do whatever it wants with it - add/remove handlers, set formatters, add filters, change levels, etc. The `config` object lets you read Streamlit config options if you need conditional behavior (e.g., different formatting in dev vs prod).

**Contract guarantees:**
- `logger` is always a real `logging.Logger` instance
- `config.get_option(key)` and `config.is_manually_set(key)` are always available
- This signature won't change across Streamlit versions
- If your function raises an exception, we catch it and fall back to default logging
- Your function should be idempotent (we might call it multiple times)

**What we don't guarantee:**
- When exactly we call this function
- How many times we call it
- The order loggers are configured

Users can configure this three ways:

```toml
# config.toml
[logger]
middlewarePath = "./my_logging_middleware.py"
```

```bash
# CLI
streamlit run app.py --logger.middlewarePath ./my_logging_middleware.py
```

```bash
# Environment variable
export STREAMLIT_LOGGER_MIDDLEWARE_PATH=./my_logging_middleware.py
streamlit run app.py
```

#### **Usage Examples**

**Simple case: JSON logging for SPCS**

```py
# logging_middleware.py
import logging
from pythonjsonlogger import jsonlogger

def configure_logging(logger, config):
    logger.handlers.clear()
    handler = logging.StreamHandler()
    handler.setFormatter(jsonlogger.JsonFormatter(
        fmt='%(message)s %(levelname)s %(name)s %(asctime)s',
        rename_fields={'levelname': 'level', 'name': 'logger'},
    ))
    logger.addHandler(handler)
    logger.propagate = False
```

```toml
# .streamlit/config.toml
[logger]
middlewarePath = "./logging_middleware.py"
```

```bash
streamlit run app.py  # Middleware auto-loaded
```

**Advanced: Conditional formatting based on environment**

```py
# logging_middleware.py
import logging
import sys
from pythonjsonlogger import jsonlogger

def configure_logging(logger, config):
    logger.handlers.clear()

    # Use rich colors in dev, JSON in production
    if config.get_option("global.developmentMode"):
        try:
            from rich.logging import RichHandler
            logger.addHandler(RichHandler(rich_tracebacks=True))
        except ImportError:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter(
                '%(asctime)s %(levelname)-7s %(name)s: %(message)s'
            ))
            logger.addHandler(handler)
    else:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(jsonlogger.JsonFormatter(
            fmt='%(message)s %(levelname)s %(name)s %(asctime)s',
            rename_fields={'levelname': 'severity'},
        ))
        logger.addHandler(handler)

    logger.propagate = False
```

#### **Trade-offs**

The main benefit here is simplicity for users - they just write a normal Python function and point to it via config. No need to wrap Streamlit's startup or create a separate package. This works the same way whether you're running locally, on Community Cloud, or in SPCS.

The middleware pattern is also extensible. We're starting with logging, but the same approach could work for other customization points later (request middleware, script lifecycle hooks, etc.) without introducing a bunch of different APIs.

Downsides: We're dynamically importing user code, which means error handling needs to be solid. If the file doesn't exist or the function signature is wrong, we need clear error messages and fallback to default logging. Also, the middleware file needs to be on the filesystem when Streamlit starts - can't be loaded dynamically mid-session.

Security-wise, there's no new risk here - we're already executing arbitrary user code when we run their Streamlit app. Loading a logging config function from a file they specify is the same trust model.

The function signature (`configure_logging(logger, config)`) is simple enough that we can commit to keeping it stable. If we ever need to add parameters, we can make them optional or create a v2 function name.

#### **Future Extensibility**

This same pattern could work for other customization points:

```toml
[server]
requestMiddlewarePath = "./request_middleware.py"

[runtime]
scriptMiddlewarePath = "./script_middleware.py"
```

Each would get a well-defined function signature like `configure_logging`. For example, request middleware might be `def configure_request(request, response, config)`, and script middleware might be `def on_script_run(session, config)`.

We're not proposing to build all of this now - just pointing out that the pattern generalizes. Start with logging, see how it goes, expand later if there's demand.

## **Comparison Matrix**

| Options | Handler Registration | Formatter Registration | Hook/Callback | Entry Point Plugin | Config-Based Middleware |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Ease of Use** | Medium (complex API) | Simple | Very Simple | Complex (requires packaging) | Very Simple (just config) |
| **Flexibility** | Maximum | High | Medium (format only) | High | Maximum |
| **No Wrapper Needed** | No (must wrap startup) | No (must wrap startup) | No (must wrap startup) | Yes | Yes |
| **Works via CLI/Config** | No (code only) | No (code only) | No (code only) | Yes (config-like) | Yes |
| **SiS Use Case Fit** | Works | Good fit | Works | Requires packaging | Good fit |
| **Maintenance Burden** | Medium | Low | Low | Medium | Low |
| **Future Extensibility** | Logging only | Logging only | Logging only | Limited | General pattern |

## **Recommendation**

I'd go with **Option E** (config-based middleware).

The main reason is that it doesn't require users to wrap Streamlit's startup. With Options A-C, users have to call some registration function before importing Streamlit, which means they can't just run `streamlit run app.py` - they need a wrapper script that calls `cli.main()`. That's annoying for users and breaks the normal Streamlit workflow.

Option D (entry points) also avoids the wrapper problem, but it requires users to create a full Python package with setup.py just to configure logging. That's overkill.

Option E gives us the best of both worlds: users just point to a Python file via config/CLI, and Streamlit loads it automatically. Works the same way in development, CI, Community Cloud, and SPCS. The middleware pattern also sets us up to add other customization points later without inventing new mechanisms each time.

**Option B** (formatter registration) would be my fallback if Option E feels too heavyweight. It's simple and solves the immediate problem, but you still need the wrapper script.

## **Open Questions**

### **Q1: Should we support config-file based formatter selection?**

**Option**: Allow specifying formatter via config.toml

\[logger\]  
formatterClass \= "my\_module.MyFormatter"

**Pros**: No code changes needed, purely configuration 

**Cons**: Requires dynamic import (security concern), more complex

**Recommendation**: Start with code-based API, add config later if demand exists.

### **Q2: Should we allow registering multiple formatters for different loggers?**

**Option**: Allow per-logger formatter registration

register\_formatter(json\_formatter, logger\_pattern="streamlit.\*")  
register\_formatter(plain\_formatter, logger\_pattern="tornado.\*")

**Pros**: Maximum flexibility 

**Cons**: Complicates API, most users want consistent formatting

**Recommendation**: Start with single global formatter, add per-logger if needed.

### **Q3: Should we provide a built-in simple JSON formatter?**

**Option**: Include basic JSON formatter in Streamlit (no external dependency)

from streamlit.logger import SimpleJSONFormatter

register\_formatter(SimpleJSONFormatter())

**Pros**: Works without external dependencies 

**Cons**: Reinventing wheel, maintenance burden, users still need pythonjsonlogger for advanced features

**Recommendation**: Don't provide built-in formatter. Let users choose their library.

### **Q4: How do we handle formatter errors?**

**Current behavior**: If formatter.format() raises exception, logging module prints to stderr

**Options**:

1. Let logging module handle it (current behavior)  
2. Wrap formatter calls in try/except, fallback to default formatter  
3. Add `safe_mode=True` parameter that enables fallback

**Recommendation**: Start with option 1 (standard logging behavior), add option 3 if users request it.

### **Q5: Should registration be thread-safe?**

**Context**: What if multiple threads try to register formatters simultaneously?

**Analysis**:

1. Registration should happen once at startup, before threading  
2. If registration happens during runtime, race conditions could occur  
3. Python's GIL provides some protection, but not complete

**Recommendation**: Document that registration must happen before multi-threading starts. Add lock if real-world issues arise.