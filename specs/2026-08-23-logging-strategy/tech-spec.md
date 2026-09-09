---
author: lukasmasuch
created: 2026-08-23
---

# Standard, launch-aware logging

## Summary

Replace Streamlit's per-module handlers and logger registry behavior with one standard
`streamlit` namespace handler. Introduce explicit managed, cooperative, and host-owned
logging policies so `streamlit run`, `App.run()`, externally served `st.App`, and embedded
ASGI apps keep useful logs without duplicate output or mutations to server loggers owned by
another application.

See the [product spec](./product-spec.md) for user-facing behavior and the proposed
`logger.handlerMode` option. This is the implementation proposal for
[#4742](https://github.com/streamlit/streamlit/issues/4742).

## Problem

### Current logger topology

`streamlit.logger.get_logger(name)` currently performs four operations:

1. retrieves a logger through `logging.getLogger`;
2. sets an explicit Streamlit-global level on that logger;
3. sets `propagate=False`; and
4. creates a new `StreamHandler` and formatter on the logger.

It also stores every logger in a private `_loggers` dictionary. `set_log_level` and
`update_formatter` iterate this registry and mutate every logger independently. There are
roughly 80 `get_logger` call sites across roughly 70 Streamlit consumer files. Importing
`streamlit` creates dozens of child handlers before an app starts, and parsing config adds
more.

This bypasses the standard hierarchy:

```text
Record from streamlit.runtime.app_session
    -> child handler
    -> propagation stops
    X  logging.getLogger("streamlit") handlers and level are ignored
```

The behavior blocks ordinary `dictConfig`, JSON handlers, pytest capture, and namespace
filtering. It also creates unnecessary handler/formatter objects and makes config reloads
touch every imported module logger.

### Startup modes and ordering

Streamlit tracks five server modes in `streamlit.config._server_mode`:

- `starlette-managed` — traditional `streamlit run`;
- `starlette-app` — `st.App` discovered by `streamlit run`;
- `starlette-app-direct` — `App.run()`;
- `asgi-server` — standalone external ASGI server; and
- `asgi-mounted` — mounted in another ASGI application.

The value is currently assigned too late to drive logging policy:

- `_main_run` parses config before it discovers the application and sets a server mode.
- `App.run()` parses config before `_prepare_asgi_app_run_context` assigns
  `starlette-app-direct`.
- `App.lifespan()` creates the runtime before marking the lifespan external.
- External `App.__call__` can create the runtime before `_combined_lifespan` assigns
  `asgi-server` or `asgi-mounted`.

Config parsing triggers the global `_update_logger` callback, so logging is configured
before ownership is known.

### Third-party server loggers

`init_uvicorn_logs()` sends `uvicorn`, `uvicorn.access`, `uvicorn.asgi`, `uvicorn.error`,
and `websockets` through `get_logger`. This installs Streamlit handlers and disables
propagation on namespaces Streamlit does not always own. Uvicorn then applies its own
`dictConfig`, potentially replacing handlers and levels while retaining earlier propagation
state. A later Streamlit config reload can add another handler alongside Uvicorn's handler.

## Goals

- Preserve default Streamlit console logs for existing apps and all supported launch modes.
- Make `logging.getLogger("streamlit")` the effective parent for all `streamlit.*` records.
- Emit each record once per configured destination.
- Support host-controlled logging for external and embedded ASGI modes.
- Keep a fallback in cooperative mode when the host has no usable handler.
- Configure Uvicorn only when Streamlit owns the server runner, and leave WebSockets
  logging to the library or host in every mode.
- Make config reload idempotent and preserve user-owned logging state.

## Non-goals

- Changing log messages, severity, or record fields.
- Adding public Python logging helpers.
- File logging, log rotation, remote shipping, or UI rendering.
- Per-session logging configuration. Logging remains process-wide, like Streamlit config
  and runtime ownership.
- Supporting different logger policies for multiple `st.App` instances in one process;
  multiple independently configured Streamlit runtimes are already unsupported.

## Proposal

### Namespace architecture

Create one module-owned handler on the namespace logger:

```python
_NAMESPACE_LOGGER_NAME: Final = "streamlit"
_NAMESPACE_LOGGER = logging.getLogger(_NAMESPACE_LOGGER_NAME)
_console_handler: logging.StreamHandler | None = None
```

Do not add a permanent `NullHandler`. The bootstrap console handler covers the period before
policy activation. In explicit `HOST` mode with no handler anywhere in the restored path,
standard Python `lastResort` behavior remains available for `WARNING` and higher records;
lower-level records may be discarded. A host-supplied `NullHandler` keeps its normal Python
semantics. Cooperative mode still retains Streamlit's handler as its fallback.

`get_logger` becomes a compatibility shim:

```python
def get_logger(name: str) -> logging.Logger:
    resolved_name = _NAMESPACE_LOGGER_NAME if name == "root" else name
    return logging.getLogger(resolved_name)
```

It does not set a level, attach a handler, or change propagation. Existing call sites can
remain unchanged in the first implementation. The `"root"` alias continues to resolve to
`"streamlit"`, preserving direct-execution warnings.

The compatibility promise applies to Streamlit's internal `streamlit.*` names and the
special `"root"` alias. A third-party caller passing its own module name receives an
ordinary, unconfigured standard logger and must migrate to `logging.getLogger(__name__)`
plus its application logging configuration. Streamlit must not configure unrelated
namespaces merely because they called this private helper.

Fresh child loggers retain the standard `level=NOTSET` and `propagate=True`, so their
effective level comes from the namespace logger. Explicit user configuration on a child is
respected. Remove the private `_loggers` registry in the first implementation: after
centralizing level and formatter updates it has no behavior or remaining consumer, and
retaining it would accumulate logger references for the life of the process.

Record flow with Streamlit's handler:

```text
streamlit.runtime.app_session
    -> propagate
streamlit
    -> one Streamlit console handler
    -> propagation stops before Python root
```

Record flow with host ownership:

```text
streamlit.runtime.app_session
    -> propagate
streamlit
    -> user namespace handlers, if any
    -> propagate
Python root / host handlers
```

### Launch context and output policy

Track the way Streamlit was started separately from the configured output policy:

```python
class LoggingContext(Enum):
    UNCONFIGURED = "unconfigured"
    STREAMLIT_MANAGED = "streamlit-managed"
    EXTERNAL = "external"


class OutputPolicy(Enum):
    STREAMLIT = "streamlit"
    COOPERATIVE = "cooperative"  # handlerMode="auto" in an external launch
    HOST = "host"
```

`COOPERATIVE` is a detection step rather than a persistent topology: it immediately
selects either the host-owned topology or the Streamlit fallback from the handler path
visible in an external launch.

`activate_logging(context)` records the launch context before config is parsed. After
config is available, `apply_logging_config()` resolves the effective policy:

| `logger.handlerMode` | Launch context | Effective policy |
|---|---|---|
| `streamlit` | Any | `STREAMLIT` |
| `auto` | `UNCONFIGURED` | `STREAMLIT` fallback |
| `auto` | Streamlit-managed launch | `STREAMLIT` |
| `auto` | External/embedded launch | `COOPERATIVE` |
| `host` | Any | `HOST` |

The initial config default is `streamlit`, preserving current output. A not-yet-known
context is conservative so code that reads Streamlit config before choosing a launcher
does not lose diagnostics. The launch context is still implemented now so `auto` works
correctly and a future default change does not require another architecture migration.
The `logger.handlerMode` config option normalizes strings to lowercase, explicitly validates
membership in `"streamlit"`, `"auto"`, and `"host"`, and reports those canonical choices in
an actionable Streamlit config error before resolving policy. Define it as a public,
non-scriptable option, matching `logger.level` and `logger.messageFormat` rather than the
hidden, scriptable `logger.enableRich` option.

Unlike other non-sensitive options, `logger.handlerMode` must also be read directly from
`STREAMLIT_LOGGER_HANDLER_MODE` by `config.get_config_options`, because external ASGI and
plain-Python launchers do not pass through Click. Preserve the documented precedence:
project config overrides global config, this environment variable overrides config files,
and explicit CLI or `App.run(config=...)` values override the environment.

An invalid value is rejected during config set/parse. Initial startup emits the actionable
error through the isolated bootstrap handler and then aborts without guessing a policy. An
invalid live reload leaves the last successfully applied policy in place and rejects the
new config rather than falling back.

`STREAMLIT_MANAGED` is authoritative for the process once selected by the CLI or
`App.run()`. An `st.App` mounted inside an ASGI app discovered by `streamlit run` must not
downgrade the context to `EXTERNAL`; Streamlit still owns that server runner. External
detection only replaces `UNCONFIGURED`, while `App.run()` may promote an unstarted app to
`STREAMLIT_MANAGED`.

### Bootstrapping before config parsing

Before changing logger state, bootstrap saves the namespace's existing level and propagation
values. Under the module's `threading.RLock`, before config watchers can run, initialization
atomically (1) sets namespace propagation to false and its level to `INFO`, then (2)
installs one Streamlit-owned namespace handler at `NOTSET` using `DEFAULT_LOG_MESSAGE` and
stderr. Setting isolation first prevents a root handler configured before `import streamlit`
from receiving a second copy during initialization. This replaces the dozens of handlers
created during a normal import while preserving import-time and config-parser diagnostics
before `logger.level`, `logger.messageFormat`, and `logger.handlerMode` are known.

After config parsing, `apply_logging_config` updates or removes only the owned handler:

- `STREAMLIT`: retain the handler at `NOTSET`, set the namespace level and handler formatter
  from config, and set namespace propagation to false.
- `COOPERATIVE`: if a usable host path exists, remove the owned handler and apply the same
  last-written-value restoration described under ownership as `HOST`, so host levels and
  formatting are authoritative.
  Otherwise behave exactly like `STREAMLIT`: retain the `NOTSET` fallback handler, apply
  `logger.level` and `logger.messageFormat`, and keep namespace propagation false.
- `HOST`: remove the owned handler and conditionally restore the namespace state saved
  before Streamlit took ownership.

The bootstrap handler is deliberately used for config-parser diagnostics even when the
final configured policy is `HOST`. This prevents an invalid logging config from suppressing
the diagnostic that explains the invalid config. Once valid config is parsed, host mode
removes it.

### Cooperative handler detection

A usable host path exists when either:

1. the `streamlit` namespace has a non-owned, non-`NullHandler` handler; or
2. an ancestor has a non-`NullHandler` handler that would be reachable after transferring
   namespace ownership to the host.

Detection walks the hierarchy explicitly rather than calling `Logger.hasHandlers` so it can
ignore the Streamlit-owned handler, disregard any host `NullHandler` as a usable output,
and evaluate the namespace propagation value that would be restored after ownership
transfer. If the saved pre-ownership value is false, an ancestor is not reachable. The walk
also stops at `propagate=False` on any user-owned intermediate logger. Only after finding a
usable path does Streamlit remove its handler and restore namespace state, so detection
never creates a duplicate-output window.

`Logger.disabled` is neither a usable host path nor an input to cooperative detection: it
does not describe handler reachability for descendants, and `dictConfig` can set it based
on logger creation order. Streamlit never changes the flag. Therefore a host that disables
an individual logger may suppress records emitted directly by that logger, but does not
establish a namespace-wide output policy. Streamlit leaves that standard, creation-order-
dependent behavior unchanged. Host `dictConfig` examples use
`disable_existing_loggers=False`.

If no usable path exists, cooperative mode retains the Streamlit handler. This is important
for external Uvicorn: Uvicorn's default logging configuration typically configures
`uvicorn.*`, not Python's global root logger.

External activation is two-phase because hosts can construct an `st.App` before configuring
logging:

1. Before config parsing or runtime creation, record `EXTERNAL` context and retain the
   compatibility fallback.
2. At ASGI lifespan entry, or on the first HTTP/WebSocket call for lazy mounts, reconcile
   cooperative mode after the server has had an opportunity to configure logging.

Reconcile again when Streamlit config is reloaded. Streamlit does not monitor arbitrary
handler changes made after ASGI startup; applications that reconfigure logging later should
select `handlerMode="host"` explicitly.

### Ownership of logger state

Streamlit tracks the exact handler object it creates and never identifies ownership by
handler class alone. Formatter updates affect only this handler. User handlers and filters
are never cleared or rewritten.

Before Streamlit takes ownership, it snapshots the current namespace level and propagation
values. This preserves configuration applied before `import streamlit` and is refreshed
each time ownership is reacquired after a host-owned period.

When Streamlit owns the output path:

- the namespace logger level is set from `logger.level`;
- the owned handler remains at `NOTSET`, allowing the namespace level and explicit child
  levels to follow standard Python semantics;
- the namespace logger uses `propagate=False`; and
- the owned handler uses `logger.messageFormat` and the existing millisecond formatting.

The namespace level and propagation values are Streamlit-owned in `STREAMLIT` and
cooperative-fallback modes. Config application and reload reassert them; applications that
need host ownership of those values must select `HOST` or host-selected cooperative mode.

When ownership is transferred to the host, Streamlit restores the saved pre-ownership level
and propagation values only if those attributes still contain the last values written by
Streamlit. A distinguishable user modification made after activation wins and is not
reverted. Reapplying the same value cannot be detected through the standard `Logger` API and
is deterministically treated as still Streamlit-owned; a host needing that value should set
it after handoff or before import. For a fresh standard logger the saved values are `NOTSET`
and `propagate=True`; a namespace handler and `propagate=False` configured before import
remain isolated as the host intended. Streamlit never changes `Logger.disabled`; that state
always belongs to the host.

`set_log_level` and `update_formatter` remain temporary internal compatibility shims, but
operate only on the namespace logger and owned handler. They no longer iterate `_loggers`.
In `HOST` and host-selected cooperative mode, all three compatibility shims are no-ops for
namespace level and propagation; they cannot reclaim or mutate host state.
`setup_formatter(logger)` also remains during the migration as a redirecting shim: it
updates the owned namespace handler if one is active and never adds a handler to the passed
child logger. The namespace logger's private `streamlit_console_handler` attribute points
to the owned handler while it is attached and becomes `None` when ownership is transferred,
making the handler discoverable to existing integrations. Child loggers no longer expose
their own `streamlit_console_handler`; that private per-child topology is the behavior this
proposal replaces.

### Launch-mode wiring

Logging context must be selected before any launcher call that can parse config or create a
runtime. Config reads that occur earlier retain the conservative fallback and are reconciled
when the context becomes known.

#### `streamlit run` and CLI commands

`web.cli._main_run` activates `STREAMLIT_MANAGED` before
`bootstrap.load_config_options`. This is known before ASGI discovery: invoking the
Streamlit CLI means Streamlit owns the server runner whether the target is a traditional
script, `st.App`, FastAPI, or another discovered ASGI app.

Other CLI commands that parse config use `STREAMLIT_MANAGED` bootstrapping so configuration
errors remain visible.

#### `App.run()`

`App.run()` activates `STREAMLIT_MANAGED` before `bootstrap.load_config_options` and before
`_prepare_asgi_app_run_context` assigns `starlette-app-direct`. Its logging behavior remains
equivalent to `streamlit run`.

#### External standalone ASGI

When `App.__call__` first builds an app and no Streamlit-managed context has been selected,
it activates `EXTERNAL` before `_build_starlette_app` creates the runtime. It reconciles
cooperative output before serving the first HTTP/WebSocket request.

#### Mounted ASGI with explicit lifespan

Unless the CLI already selected a managed context, `App.lifespan()` activates the
`EXTERNAL` logging context before calling `_create_runtime`. The existing
`_external_lifespan=True` assignment stays after runtime creation; only logging-context
activation moves earlier, so mounted-app lifecycle behavior does not change.
`_combined_lifespan` reconciles cooperative output when the returned lifespan context is
entered.

#### Mounted ASGI with lazy auto-start

Unless a managed context is already active, the first HTTP/WebSocket call activates
`EXTERNAL` before `_build_starlette_app`, reconciles cooperative output, and retains that
context when `_auto_start_runtime` later assigns `asgi-mounted`.

Lazy reconciliation uses a double-checked, process-wide reconciled flag. The request path
first performs a cheap flag read and acquires the policy lock only when reconciliation is
pending; it checks the flag again inside the lock before applying policy. Steady-state
requests therefore do not acquire the logging lock. Activation and config reload update or
invalidate this flag as part of the same locked transition. Reconciliation snapshots and
applies logging state synchronously and releases the lock before returning to async request
work.

#### Bare `st.*` execution

The first direct-execution warning uses the bootstrap handler. This preserves the existing
formatted warning and missing-`ScriptRunContext` diagnostics while an ordinary
`import streamlit` installs one output handler instead of dozens.

### Managed server dependencies

Remove `init_uvicorn_logs` from the global config callback.

In the shared `_get_uvicorn_config_kwargs()` used by the traditional `UvicornServer` and
the `st.App` `UvicornRunner`, pass the validated integer level directly to Uvicorn:

```python
{
    "log_level": normalized_log_level,
    # Existing kwargs, including access_log=False, remain unchanged.
    "access_log": False,
}
```

This lets Uvicorn apply its own handler configuration and level through its supported API.
Use the same normalization and validation as the namespace logger. This accepts supported
case-insensitive config values such as `INFO`, avoids Uvicorn's lowercase-only string map,
and reports unknown values as an actionable Streamlit config error before constructing
`uvicorn.Config`.

Replace the existing source comment that says logging config is not overridden; it is no
longer accurate once `log_level` is supplied. Uvicorn applies the level to its error,
access, and ASGI namespaces, while the separate existing `access_log=False` continues to
disable access records even at a lower configured level.

Both managed server implementations register the same context-gated Uvicorn level updater
after constructing their respective `uvicorn.Config`: traditional `UvicornServer` and the
`st.App` `UvicornRunner`. Each unregisters it during server shutdown/finally cleanup. On a
managed config reload, the updater changes levels on the existing Uvicorn logger family
without adding handlers, changing propagation, or re-enabling access logs. It is never
registered by external ASGI paths.

The managed runner leaves the `websockets` logger entirely alone. Modern Uvicorn protocol
logs use the `uvicorn.*` hierarchy; independently emitted `websockets` records follow
normal Python logging rules.

For external ASGI servers, Streamlit does not configure `uvicorn.*`, `websockets`, Gunicorn,
or Hypercorn loggers. Their levels, handlers, access logs, and formatting belong to the host.

`logger.messageFormat` continues to apply only to Streamlit records; Uvicorn keeps its
native formatter. This matches the effective behavior after Uvicorn currently applies its
own logging configuration.

### Config reloads and idempotency

The existing config watcher in Streamlit-managed launches can continue invoking a logging
callback, which calls `apply_logging_config` against the stored launch context. External
`App.lifespan()` and `App.__call__()` paths do not install Streamlit file watchers, so this
proposal does not add live `config.toml` reload to those modes. Explicit config parsing
remains idempotent in every mode. The callback must:

- reuse or replace exactly one owned handler;
- never add a second owned handler;
- do not remove host handlers;
- transition safely between `streamlit`, `auto`, and `host`; and
- update managed dependency levels without installing dependency handlers.

Because logging and Streamlit config are process-wide, no per-session synchronization or
state is introduced. Python logging's handler mutation APIs provide their own locks; the
module should additionally guard policy transitions with one `threading.RLock` so a config
watcher cannot interleave with ASGI startup. Applying policy is synchronous and must not
`await` while holding this lock.

Lock order is always Streamlit's `_config_lock` before the logging policy lock, and code
holding the policy lock must never read Streamlit config. `apply_logging_config` receives
an immutable snapshot containing the validated handler mode, integer log level, and message
format. The config callback builds that snapshot while `_config_lock` is already held, then
takes the policy lock. Lifespan and request reconciliation also acquire `_config_lock`,
snapshot config, acquire the policy lock in that order, and apply synchronously before
releasing either lock. They do not `await` in the critical section. Holding the config lock
through apply prevents a newer reload from being overwritten by a stale lifespan snapshot.

### Implementation sequence

1. Confirm SiS/SPCS and Community Cloud do not inspect per-child `.handlers` or
   `streamlit_console_handler` in their logging wrappers.
2. Centralize Streamlit's handler and level on the namespace logger while keeping
   `handlerMode="streamlit"` in all launch modes.
3. Replace per-child logger tests with hierarchy and exactly-once tests.
4. Move managed Uvicorn configuration into the runner and stop configuring WebSockets.
5. Add launch-context activation before config/runtime initialization.
6. Add `logger.handlerMode` and cooperative/host transitions.
7. Document standard namespace customization and external hosting examples.

Steps 2–4 can merge independently while preserving all default Streamlit output. Steps 5–6
are additive because the initial config default still resolves to Streamlit-owned logging.

## Backward Compatibility and Rollout

The first release keeps `handlerMode="streamlit"` as its default in every launch context.
Before the first implementation PR merges, capture subprocess fixtures for the current
default output of `streamlit run`, `App.run()`, external Uvicorn, a mounted app, and bare
`st.*` execution. The new hierarchy must match their representative Streamlit record
levels, formatting, destination, and multiplicity.

Intentional observable changes are limited to:

- a handler attached to `logging.getLogger("streamlit")` now receives child records;
- an explicit child level can override the inherited namespace level using standard Python
  semantics;
- private inspection of child `.handlers` sees no Streamlit handler;
- external server libraries are no longer mutated by Streamlit;
- Streamlit no longer configures the third-party `websockets` logger, even in managed
  launches. Without a host/root handler, its independent `DEBUG`/`INFO` records are
  discarded and `WARNING` or higher may use Python's `lastResort` format; a host root
  handler set to `DEBUG` may instead expose protocol chatter that Streamlit previously
  isolated;
- a third party that passes a non-`streamlit` name to the private `get_logger` helper now
  receives an unconfigured standard logger and must configure its own namespace; and
- invalid levels reported through the retained `set_log_level` shim use the actionable
  Streamlit config error path instead of terminating the process with `sys.exit(1)`.

The first two changes are the requested interoperability behavior. The latter changes
affect private topology or third-party diagnostics rather than Streamlit application
records. Keep `get_logger`, `set_log_level`, `setup_formatter`, `update_formatter`,
`DEFAULT_LOG_MESSAGE`, the namespace `streamlit_console_handler` attribute, and the
`"root"` alias during the migration to reduce risk for internal and third-party code that
imports these private symbols.

Do not change the default to `auto` in the same release. A later proposal can evaluate that
change using external-mode integration coverage and user feedback. Rolling back the new
ownership policy requires only restoring `handlerMode="streamlit"`; it does not require
reintroducing per-child handlers.

Primary implementation risks are process-global test leakage, duplicate output during
policy transitions, and observing host logging before it is fully configured. Subprocess
tests, exact handler identity tracking, idempotent transitions, and the second-phase ASGI
reconciliation address those risks.

## Testing

Logging uses process-global state, so tests that validate import and startup behavior should
run in isolated subprocesses rather than rely only on in-process fixture cleanup.

### Unit tests

- `get_logger(__name__)` returns the standard logger without adding a child handler.
- Fresh `streamlit.*` children use `NOTSET` and propagate.
- The `"root"` alias returns `logging.getLogger("streamlit")`.
- Managed mode installs exactly one owned handler using the configured format, with the
  configured level set on the namespace logger.
- Bootstrap and managed output keep the owned handler at `NOTSET`, so an explicit child
  `DEBUG` level can pass the namespace handler.
- Repeated activation and config reload do not increase handler counts.
- A custom namespace handler is never removed or reformatted.
- Host mode removes only the owned handler and restores the saved namespace level and
  propagation state.
- Cooperative mode chooses an existing namespace handler, a global root handler, or the
  Streamlit fallback as appropriate.
- Cooperative detection ignores `NullHandler` as usable output, evaluates the saved
  namespace propagation state, and respects user-owned `propagate=False` boundaries.
- `Logger.disabled` does not count as a host handler and is never changed by Streamlit.
- Invalid `logger.handlerMode` values fail with an actionable config error.
- Handler mode values are case-insensitive and validation errors list the three canonical
  lowercase choices.
- The handler-mode environment variable is applied without Click, while explicit CLI and
  `App.run(config=...)` values retain higher precedence.
- Invalid startup config aborts after the bootstrap diagnostic; an invalid reload preserves
  the last applied policy.
- Streamlit and cooperative-fallback modes reassert the configured namespace level and
  isolation on reload; transferring ownership preserves pre-existing state and user changes
  that do not match Streamlit's last written values.
- `setup_formatter` and the namespace `streamlit_console_handler` compatibility shims do
  not restore Streamlit-owned output in host mode.
- `set_log_level`, `update_formatter`, and `setup_formatter` do not mutate namespace state
  after host ownership is selected.
- `get_logger` called with a non-`streamlit` name returns an unconfigured logger and does not
  attach Streamlit output to a third-party namespace.

### Subprocess integration tests

- `streamlit run` emits representative startup, warning, and shutdown records once with
  the existing format.
- `App.run()` has the same Streamlit logging behavior as `streamlit run`.
- Streamlit-managed Uvicorn respects `logger.level` after `uvicorn.Config` initialization.
- Managed Uvicorn accepts every case-insensitive `logger.level` supported by Streamlit and
  rejects unknown values with Streamlit's config error rather than a Uvicorn `KeyError`.
- External Uvicorn plus `handlerMode="auto"` uses a host JSON handler exactly once.
- External Uvicorn with no host handler retains the Streamlit fallback.
- Cooperative mode reconciles again at lifespan entry when host logging was configured
  after constructing the `st.App` object.
- Mounted FastAPI plus `handlerMode="host"` captures Streamlit records in the FastAPI/root
  handler without a second Streamlit-formatted copy.
- A root handler configured before `import streamlit` receives no duplicate bootstrap
  record in default/`streamlit` mode.
- Namespace level and propagation configured before import are restored when host ownership
  activates.
- Reapplying a value equal to Streamlit's last write follows the deterministic
  Streamlit-owned restoration rule.
- Host mode with no handler anywhere in the restored path leaves Python `lastResort`
  behavior intact for `WARNING` and higher records.
- `dictConfig(disable_existing_loggers=True)` after import remains authoritative: Streamlit
  does not re-enable any disabled logger or treat the flag as a cooperative host path.
- Bare `st.write` retains the direct-execution and missing-context warnings.
- A managed-launch live config reload changes level/format or ownership without duplicating
  handlers; external launches do not gain a config-file watcher.
- A config reload racing ASGI lifespan reconciliation completes without deadlock and leaves
  one policy-consistent output path.
- Both managed Uvicorn implementations register, apply, and unregister the shared level
  updater; external ASGI launches never register it.
- With Rich enabled, uncaught exceptions retain their direct Rich console presentation;
  with Rich disabled, exactly one standard record follows the selected handler policy.

No browser-facing `@pytest.mark.external_test` coverage is expected for the logging-only
implementation steps because they do not change routes, WebSocket/session transport,
embedding boundaries, cross-origin behavior, assets, browser storage, or security headers.
The externally hosted scenarios need Python subprocess integration coverage instead. This
assessment must be repeated for each implementation PR, especially any change that touches
`App.lifespan()`, `App.__call__`, or lazy-mount request ordering.

## Alternatives Considered

### Implement the issue literally: standard children plus only `NullHandler`

Configure no output handler except when invoked through the Click CLI.

**Rejected because:** Streamlit is primarily an app runtime, `App.run()` is not the Click
CLI, and external Uvicorn may not configure Python's root logger. Useful runtime errors
could disappear.

### Keep per-child handlers and add an opt-out

Add a config flag that disables the current setup.

**Rejected because:** The standard `streamlit` parent still cannot control child levels or
receive records, handler/formatter duplication remains, and Uvicorn ownership remains
unsafe.

### Always use one Streamlit namespace handler

Centralize the hierarchy but install the handler unconditionally.

**Rejected as the complete solution because:** It fixes most of #4742 and is the safe first
migration step, but it still forces embedded applications to remove a handler after every
config reload.

### Propagate everything to Python's global root

Install no Streamlit handler and rely on `logging.basicConfig` or the host.

**Rejected because:** It changes the default app experience, makes formatting dependent on
unrelated libraries, can duplicate records, and regresses the isolation fixed by #3978.

### Add public Python APIs for Streamlit handlers and filters

Expose helpers such as `st.configure_logging`, `streamlit.logger.add_filter`, or a custom
Streamlit log handler.

**Rejected because:** Python's logging APIs already provide these capabilities once the
namespace hierarchy works. A Streamlit-specific API would increase maintenance burden and
fragment standard logging configuration.
