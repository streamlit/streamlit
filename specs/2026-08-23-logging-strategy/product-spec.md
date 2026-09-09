---
author: lukasmasuch
created: 2026-08-23
---

# Standard, launch-aware logging

## Summary

Make all `streamlit.*` logs controllable through the standard
`logging.getLogger("streamlit")` hierarchy while preserving Streamlit's automatic console
logging when it runs an app. Add an opt-in handler policy for applications that run
`st.App` through an external ASGI server or embed it in another framework, without allowing
Streamlit logs to disappear when the host has not configured logging.

## Problem

[#4742](https://github.com/streamlit/streamlit/issues/4742) describes a long-standing
limitation in Streamlit's logging strategy. Each internal module logger gets its own level,
formatter, `StreamHandler`, and `propagate=False`. Consequently, the standard customization
point does not work:

```python
import logging

streamlit_logger = logging.getLogger("streamlit")
streamlit_logger.setLevel(logging.DEBUG)
streamlit_logger.addHandler(my_handler)
```

The parent logger neither controls the effective level of `streamlit.*` children nor
receives their records. Users that need structured logging, test capture, filtering, or
centralized observability must find and rewrite every existing child logger or monkeypatch
private `streamlit.logger` functions. The issue includes such a workaround.

[#3978](https://github.com/streamlit/streamlit/issues/3978) stopped Streamlit's special
`"root"` logger from configuring Python's global root logger, but did not change the
per-child handler topology.

Streamlit is also no longer started through one path. It can run as:

- a traditional app through `streamlit run`;
- an `st.App` discovered by `streamlit run` and served by Streamlit's Uvicorn runner;
- an `st.App` launched through `App.run()`;
- a standalone ASGI app launched by external Uvicorn, Gunicorn, or Hypercorn; or
- an app mounted in FastAPI, Starlette, or another ASGI framework.

The first three modes are applications whose server lifecycle is owned by Streamlit. They
must keep useful, formatted logs without requiring Python logging setup. The latter two
modes run inside a host application that may need to own formatting and delivery. Treating
all imports as a passive library would break Streamlit's app-first experience, while always
installing isolated child handlers interferes with embedded hosts.

The current strategy also configures `uvicorn.*` and `websockets` through Streamlit's
generic logger helper. Uvicorn subsequently applies its own logging configuration, which
can overwrite levels, remove handlers while leaving propagation disabled, or create
duplicates after Streamlit reloads its config.

Related requests such as per-message filtering
([#11645](https://github.com/streamlit/streamlit/issues/11645)), logging to a file
([#4539](https://github.com/streamlit/streamlit/issues/4539)), and rendering logs inside a
Streamlit app ([#13610](https://github.com/streamlit/streamlit/issues/13610)) demonstrate
broader logging interest but are not required to fix the hierarchy and ownership problem.

## Proposal

### Default behavior

All Streamlit-owned log records use the standard `streamlit` namespace hierarchy:

```text
streamlit
├── streamlit.config
├── streamlit.runtime
│   ├── streamlit.runtime.app_session
│   └── streamlit.runtime.scriptrunner
└── streamlit.web
```

Streamlit installs at most one default console handler on the `streamlit` namespace. Child
loggers do not install handlers and propagate records to the namespace logger. Existing
configuration continues to control the built-in handler:

```toml
[logger]
level = "info"
messageFormat = "%(asctime)s %(message)s"
```

For existing apps, the following remain unchanged:

- which Streamlit records are visible at the default level;
- the default format, timestamp behavior, and stderr destination;
- development-mode `DEBUG` logging;
- runtime config reloads;
- uncaught app exception presentation (including the existing Rich traceback behavior);
- direct-execution warnings from using `st.*` outside a Streamlit runtime; and
- isolation from unrelated Python root logs.

The intentionally changed behavior is the private topology of child logger handlers. Code
that inspects `logging.getLogger("streamlit.runtime...").handlers` is not a supported API.
The customization shown in the problem statement now works: adding a handler to the
namespace adds a destination alongside Streamlit's default console handler. Use
`handlerMode="host"` when the namespace or root handler should be the only destination.

### Handler policy configuration

Add a config option with a compatibility-first default:

```toml
[logger]
handlerMode = "streamlit"
```

| Value | Behavior |
|---|---|
| `"streamlit"` | Install Streamlit's default namespace handler. This is the initial default and preserves existing output in every launch mode. |
| `"auto"` | Use Streamlit's handler in Streamlit-managed launches. In externally hosted launches, use host logging when configured and otherwise install Streamlit's handler as a fallback. |
| `"host"` | Do not install a Streamlit output handler. Propagate `streamlit.*` records to host logging. |

`"host"` is an explicit ownership transfer. If the host has no usable handler, records may
be discarded. `logger.level` and `logger.messageFormat` configure only Streamlit's default
output path; the host owns levels, filters, formatting, and destinations in host mode.

An enum is preferred over `enableDefaultHandler = true/false` because it distinguishes an
explicit host-owned policy from the cooperative fallback needed by external ASGI servers
that have not configured Python's root logger.

### Launch-mode behavior

| Launch mode | `handlerMode="streamlit"` | `handlerMode="auto"` | `handlerMode="host"` |
|---|---|---|---|
| `streamlit run app.py` | Streamlit handler | Streamlit handler | Host handler |
| `streamlit run` with `st.App`/ASGI discovery | Streamlit handler | Streamlit handler | Host handler |
| `App.run()` | Streamlit handler | Streamlit handler | Host handler |
| External `uvicorn module:app` | Streamlit handler | Host handler if present; otherwise Streamlit fallback | Host handler |
| `st.App` mounted in FastAPI/Starlette | Streamlit handler | Host handler if present; otherwise Streamlit fallback | Host handler |

The initial default remains `"streamlit"` so upgrades do not change console output for
existing self-hosted or embedded deployments. Making `"auto"` the default can be evaluated
in a future major release after users have had a deprecation period and the external modes
have sufficient integration coverage.

External Uvicorn's default configuration normally installs handlers only on `uvicorn.*`,
not on Python's root logger. In that common case, `"auto"` deliberately keeps Streamlit's
fallback and behaves like `"streamlit"`. The value is useful when one deployment artifact
can either call `App.run()` or be embedded in a host that configures a root or `streamlit`
handler. Applications that always want external ownership should use `"host"`.

### Examples

Add a custom destination through the standard namespace:

```python
import logging

import streamlit as st

file_handler = logging.FileHandler("streamlit.log")
streamlit_logger = logging.getLogger("streamlit")
streamlit_logger.setLevel(logging.DEBUG)
streamlit_logger.addHandler(file_handler)
```

With the default `handlerMode="streamlit"`, this intentionally produces two destinations:
Streamlit's existing console output and `streamlit.log`. Select `"host"` when the custom
handler should be the only output path. The config option can be supplied through
`config.toml`, the equivalent `STREAMLIT_LOGGER_HANDLER_MODE` environment variable, or the
applicable Streamlit CLI option; no new Python configuration API is introduced. As with
other Streamlit config, removing the owned handler directly in Python is not durable across
a config reload.

Use the host application's JSON logging exclusively for an embedded app:

```toml
[logger]
handlerMode = "host"
```

```python
import logging.config

logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": False,
        "handlers": {
            "json": {
                "class": "logging.StreamHandler",
                "formatter": "json",
            }
        },
        "formatters": {
            "json": {
                "format": '{"level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}'
            }
        },
        "root": {"level": "INFO", "handlers": ["json"]},
    }
)

import streamlit as st
from fastapi import FastAPI

streamlit_app = st.App("dashboard.py")
app = FastAPI(lifespan=streamlit_app.lifespan())
app.mount("/dashboard", streamlit_app)
```

Configure host logging before importing Streamlit when possible. Import installs an
isolated bootstrap handler so early diagnostics remain visible until Streamlit parses
`handlerMode`; those early records use Streamlit's format and do not also propagate to the
host. Keep `disable_existing_loggers=False` when reconfiguring after import. Python's
`dictConfig` default can disable loggers that already exist, and Streamlit does not
re-enable them. Because `Logger.disabled` applies to an individual logger rather than its
descendants, it should not be used as a namespace ownership mechanism.

Use cooperative detection for an app that may run standalone or embedded:

```toml
[logger]
handlerMode = "auto"
```

The same launcher keeps Streamlit's normal console logs with `App.run()` and integrates
with host logging under FastAPI when the host configures a root or `streamlit` handler.
Under external Uvicorn's default logging configuration, no such host path normally exists,
so Streamlit retains its fallback.

### Rich exception output

`handlerMode` governs records emitted through Python's `logging` package. The existing
Rich traceback path for uncaught app exceptions writes directly to its own console and
remains independently controlled by the hidden `logger.enableRich` option. It stays
Streamlit-owned in every handler mode to preserve existing exception presentation. A host
that requires uncaught exceptions to use only its structured logging path must set
`logger.enableRich=false`; the fallback `streamlit.error_util` log record then follows the
selected handler policy.

### Behavior guarantees

- Streamlit warnings and errors reach at least one handler in `"streamlit"` and `"auto"`
  modes.
- Streamlit never removes, reformats, or replaces handlers it does not own.
- Repeated config parsing does not increase handler counts.
- Streamlit-owned configuration does not create duplicate delivery paths. Adding a custom
  handler with the default `"streamlit"` policy intentionally adds another destination; a
  host can also create duplicates by attaching handlers at multiple hierarchy levels.
- Python's global root logger is never configured by Streamlit.
- Loggers created by the user's app and unrelated libraries are not configured by
  Streamlit.
- Externally owned Uvicorn, Gunicorn, Hypercorn, and WebSockets loggers are not configured
  by Streamlit.
- Streamlit-managed Uvicorn continues to emit server logs and respects `logger.level`.

### Why this shape

- A namespace handler fixes the underlying interoperability issue rather than adding more
  Streamlit-specific logging APIs. Standard `logging`, `dictConfig`, and observability
  tooling can target `streamlit`; host mode also supports root-based test capture.
- Keeping `"streamlit"` as the default reflects the way Streamlit is normally used: users
  start an app and expect diagnostics without first configuring a host process.
- Separating launch context from handler policy avoids guessing from import context. An
  `st.App` object can be run directly, served by Uvicorn, or mounted after it is created.
- `"auto"` needs a fallback because an ASGI server can configure only its own logger
  namespaces and leave the Python root logger without an output handler.
- `"host"` gives embedded applications deterministic control when fallback output would be
  undesirable, such as JSON logging or centralized filtering.
- Leaving externally owned server loggers alone avoids ordering conflicts with Uvicorn,
  Gunicorn, Hypercorn, and their reload behavior.

### Options considered

**Option A: Configure only a `NullHandler` when Streamlit is imported**

- Pros: Strictest interpretation of Python library guidance.
- Cons: Breaks the default app experience, misses `App.run()`, and can make logs disappear
  under external Uvicorn when the host has not configured the global root logger.

**Option B: One Streamlit namespace handler in every mode**

- Pros: Small, preserves output, and fixes parent logger control.
- Cons: Does not provide a clean ownership model for embedded applications.

**Option C: Namespace handler plus an enum policy** ✅ PREFERRED

- Pros: Preserves app defaults, supports external and embedded hosts, provides a fallback,
  and can evolve without another boolean option.
- Cons: Adds one config option and requires launch-mode-aware initialization.

## Out of Scope (Future Work)

- Logging Streamlit records to a file; applications can use standard `FileHandler` once
  the hierarchy works.
- A Streamlit-specific public API for filters, handlers, or structured logging.
- Rendering Python logs as elements in the Streamlit UI.
- Changing individual log messages or their severity.
- Adding request/access logging, correlation IDs, session IDs, or user identity to records.
- Making `handlerMode="auto"` the default.
- Reconfiguring logging libraries owned by external ASGI servers.
- Configuring logs emitted by the user's app or unrelated libraries.

## Checklist

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | ✅ Default remains Streamlit-owned logging. Hosted runtimes can explicitly select `"host"` or `"auto"`. |
| No breaking API changes | ✅ Additive config option; existing level, format, and default output remain. Private child-handler topology changes. |
| No new dependencies | ✅ Uses Python's standard `logging` package and existing Uvicorn integration. |
| Metrics collected | No new telemetry in the first implementation. The resolved handler policy may be useful diagnostic context but must not include log content. |
| Any security/legal impact? | ✅ No log content, retention, or transport changes. Host mode may route existing records to host-configured destinations. |
| Any docs changes needed? | ✅ Document `logger.handlerMode`, standard `logging.getLogger("streamlit")` customization, and examples for `App.run()`, external Uvicorn, and mounted FastAPI. |
