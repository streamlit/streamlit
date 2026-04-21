---
author: lukasmasuch
created: 2026-04-21
---

# Multi-Runtime Support

## Summary

This tech spec investigates the architectural changes required to support multiple Streamlit
`Runtime` instances within a single Python process. This enables use cases such as mounting
multiple `st.App` instances on the same FastAPI application, running parallel Streamlit apps
in stlite (Pyodide), and embedding multiple independent Streamlit dashboards in a single
web application.

## Problem

Currently, Streamlit enforces a strict singleton pattern for the `Runtime` class, explicitly
preventing multiple runtime instances:

```python
# lib/streamlit/runtime/runtime.py:192-193
if Runtime._instance is not None:
    raise RuntimeError("Runtime instance already exists!")
```

This design decision creates fundamental limitations for several use cases:

**Use Cases Blocked:**

1. **FastAPI Sub-Applications**: Mounting multiple `st.App` instances on different routes
   of a FastAPI application (e.g., `/dashboard1`, `/dashboard2`)
2. **stlite Multi-App**: Running several independent Streamlit apps in the browser via
   Pyodide on a single HTTP server
3. **Multi-Tenant Deployments**: Hosting isolated Streamlit apps per tenant within a
   single process for resource efficiency
4. **Testing Isolation**: Running multiple `AppTest` instances concurrently without
   interference

**Related Issues:**
- GitHub Issue [#7546](https://github.com/streamlit/streamlit/issues/7546) - Support for
  multiple Runtime instances

## Current Architecture Analysis

### Identified Singletons and Global State

Through deep codebase analysis, the following singletons and global state patterns were
identified as blockers for multi-runtime support:

#### Critical Singletons (Hard Blockers)

| Singleton | Location | Impact | Difficulty |
|-----------|----------|--------|------------|
| `Runtime._instance` | `runtime/runtime.py:159` | Main blocker - explicit enforcement | High |
| `DeltaGeneratorSingleton._instance` | `delta_generator_singletons.py:44` | Root DeltaGenerators (main, sidebar, event, bottom) | High |
| `_MultiPathWatcher._singleton` | `watcher/event_based_path_watcher.py:170` | Single file Observer thread | Medium |

#### Module-Level Singletons (Shared State Issues)

| Singleton | Location | Impact | Difficulty |
|-----------|----------|--------|------------|
| `_data_caches` | `runtime/caching/cache_data_api.py:377` | Cross-runtime cache pollution | Medium |
| `_resource_caches` | `runtime/caching/cache_resource_api.py:218` | Shared resource instances | Medium |
| `secrets_singleton` | `runtime/secrets.py:527` | Shared secrets across runtimes | Medium |
| `Installation._instance` | `runtime/metrics_util.py:303` | Telemetry singleton (low impact) | Low |
| `secret_error_messages_singleton` | `runtime/secrets.py:128` | Error message customization | Low |

#### Config Module Global State

| Global | Location | Impact | Difficulty |
|--------|----------|--------|------------|
| `_config_options` | `config.py:59` | Shared configuration state | High |
| `_main_script_path` | `config.py:63` | Single script path assumption | High |
| `_server_mode` | `config.py:71` | Server mode tracking | Medium |
| `_config_lock` | `config.py:49` | Threading lock (can be shared) | Low |

#### Threading/Context (Generally OK)

| Mechanism | Location | Status |
|-----------|----------|--------|
| `SCRIPT_RUN_CONTEXT_ATTR_NAME` | `scriptrunner_utils/script_run_context.py:204` | Thread-local, safe for multi-runtime |
| `context_dg_stack` | `delta_generator_singletons.py:211` | ContextVar, but initialized with singleton reference |
| `in_cached_function` | `scriptrunner_utils/script_run_context.py:57` | ContextVar, safe |

### Dependency Graph

```
Runtime (singleton)
├── SessionManager (per-runtime, OK)
│   └── AppSession (per-session, OK)
│       ├── ScriptRunner (per-session, OK)
│       │   └── ScriptRunContext (thread-local, OK)
│       ├── SessionState (per-session, OK)
│       └── FragmentStorage (per-session, OK)
├── MediaFileManager (per-runtime via RuntimeConfig, OK)
├── UploadedFileManager (per-runtime via RuntimeConfig, OK)
├── ComponentRegistry (per-runtime via RuntimeConfig, OK)
├── BidiComponentManager (per-runtime via RuntimeConfig, OK)
├── ScriptCache (per-runtime, OK)
└── CacheStorageManager (per-runtime via RuntimeConfig, OK)

DeltaGeneratorSingleton (process-wide singleton) ⚠️
├── main_dg (single instance)
├── sidebar_dg (single instance)
├── event_dg (single instance)
└── bottom_dg (single instance)

Global Caches (process-wide) ⚠️
├── _data_caches (shared)
└── _resource_caches (shared)

Config (process-wide) ⚠️
├── _config_options (shared)
└── _main_script_path (single script assumption)

Secrets (process-wide) ⚠️
└── secrets_singleton (shared)

File Watcher (process-wide) ⚠️
└── _MultiPathWatcher._singleton (single Observer)
```

### Current `st.App` Implementation

The `st.App` class (`web/server/starlette/starlette_app.py:242`) already creates a
`Runtime` instance per app:

```python
def _create_runtime(self) -> Runtime:
    # ...
    return Runtime(RuntimeConfig(...))
```

However, instantiating a second `st.App` fails because `Runtime.__init__` raises when
`_instance` is already set.

## Proposal

### Phase 1: Remove Runtime Singleton Enforcement

**Scope:** Allow multiple `Runtime` instances to coexist.

**Changes:**

1. **Remove singleton enforcement in `Runtime.__init__`:**
   ```python
   # Remove these lines:
   # if Runtime._instance is not None:
   #     raise RuntimeError("Runtime instance already exists!")
   # Runtime._instance = self
   ```

2. **Make `Runtime.instance()` and `Runtime.exists()` return the "current" runtime
   based on context:**
   - Option A: Thread-local storage for current runtime
   - Option B: ContextVar for current runtime
   - Option C: Explicit runtime parameter passing (requires API changes)

3. **Update `runtime.get_instance()` and `runtime.exists()` helpers:**
   These are the primary entry points used throughout the codebase.

**Compatibility:**
- `streamlit run` continues to work as before (single runtime)
- `st.App` can create multiple instances
- `AppTest` isolation improves

### Phase 2: Runtime-Scoped DeltaGenerators

**Scope:** Each runtime has its own root DeltaGenerators.

**Changes:**

1. **Move DeltaGenerator creation into Runtime:**
   Instead of process-level singleton, create DeltaGenerators per runtime.

2. **Update `context_dg_stack` initialization:**
   The ContextVar should lazily resolve to the current runtime's main DG.

3. **Update `st` module exports:**
   The `st.sidebar`, `st.main`, etc. should resolve to the current runtime's containers.

**Challenge:**
The `streamlit/__init__.py` module creates `DeltaGeneratorSingleton` at import time:
```python
_dg_singleton = _DeltaGeneratorSingleton(...)
```

This needs to be deferred or made runtime-aware.

### Phase 3: Runtime-Scoped Configuration

**Scope:** Each runtime has isolated configuration.

**Options:**

**Option A: Config Overlay Pattern (Preferred)**
- Keep process-level defaults in `_config_options`
- Allow runtime-specific overrides via `RuntimeConfig`
- Changes only affect the specific runtime

**Option B: Full Config Isolation**
- Each runtime has its own complete config copy
- Higher memory usage but complete isolation

**Option C: Immutable Base + Runtime Overrides**
- Process-level config is immutable after first runtime starts
- Runtimes can only add overrides, not modify base

**Recommendation:** Option A provides good isolation while maintaining the familiar
config system for single-runtime deployments.

### Phase 4: Runtime-Scoped Caching

**Scope:** Cache isolation between runtimes.

**Changes:**

1. **Add runtime ID to cache keys:**
   ```python
   cache_key = f"{runtime_id}:{function_key}:{args_hash}"
   ```

2. **Option: Shared vs Isolated caches:**
   - `@st.cache_data(scope="runtime")` - isolated per runtime (new default?)
   - `@st.cache_data(scope="process")` - shared across runtimes (current behavior)

3. **Update cache clear operations:**
   `st.cache_data.clear()` should only clear the current runtime's caches.

### Phase 5: Runtime-Scoped Secrets

**Scope:** Allow different secrets per runtime.

**Options:**

**Option A: Per-App Secrets Parameter (Preferred)**
Building on the existing `secrets` parameter in `st.App`:
```python
app = st.App("script.py", secrets={"api_key": "..."})
```

The runtime-scoped secrets would override the process-level `secrets_singleton`.

**Option B: Path-Based Secrets**
Each runtime reads secrets from a different path based on script location.

**Option C: Full Secrets Isolation**
Completely separate `Secrets` instances per runtime.

### Phase 6: Shared File Watcher (Low Priority)

**Scope:** Allow multiple runtimes to share file watching infrastructure.

The current `_MultiPathWatcher` singleton can actually be shared across runtimes since
it's stateless from the runtime's perspective. The key change needed:

1. **Reference counting for paths:**
   Track which runtimes are watching which paths
2. **Cleanup on runtime shutdown:**
   Remove watches when a runtime stops

## Implementation Strategy

### Recommended Approach: Context-Based Runtime Resolution

Use Python's `contextvars` to track the current runtime:

```python
# runtime/runtime.py
import contextvars

_current_runtime: contextvars.ContextVar[Runtime | None] = contextvars.ContextVar(
    "streamlit_current_runtime", default=None
)

class Runtime:
    _instances: list[Runtime] = []  # Track all instances for cleanup

    @classmethod
    def instance(cls) -> Runtime:
        """Return the current runtime from context, or the singleton for compatibility."""
        ctx_runtime = _current_runtime.get()
        if ctx_runtime is not None:
            return ctx_runtime
        # Fallback for backward compatibility
        if len(cls._instances) == 1:
            return cls._instances[0]
        raise RuntimeError("No current runtime - use 'with runtime:' context")

    def __enter__(self) -> Runtime:
        self._token = _current_runtime.set(self)
        return self

    def __exit__(self, *args) -> None:
        _current_runtime.reset(self._token)
```

This allows:
- Backward compatibility: single runtime works as before
- Multi-runtime: explicit context or async task isolation
- Clean API: `with runtime:` or automatic for script threads

### API Changes for Multi-Runtime

```python
# Current (single runtime)
app = st.App("script.py")

# Multi-runtime (new)
app1 = st.App("dashboard1.py", runtime_id="dashboard1")
app2 = st.App("dashboard2.py", runtime_id="dashboard2")

# Mounting on FastAPI
from fastapi import FastAPI
fastapi_app = FastAPI(lifespan=app1.lifespan())
fastapi_app.mount("/dashboard1", app1)
fastapi_app.mount("/dashboard2", app2)
```

### Migration Path

1. **Phase 1**: Remove singleton enforcement, add deprecation warnings for
   `Runtime.instance()` direct access
2. **Phase 2**: Introduce `RuntimeConfig.isolated_dg=True` flag for opt-in
3. **Phase 3**: Make isolated mode the default in Streamlit 2.0
4. **Phase 4**: Remove legacy singleton access

## Alternatives Considered

### Alternative 1: Process-Level Isolation

Run each Streamlit app in a separate Python process.

**Pros:**
- No code changes required
- Complete isolation guaranteed

**Cons:**
- Higher resource usage (memory, startup time)
- Complex IPC for shared state
- Doesn't solve the stlite use case (single WASM context)

### Alternative 2: Runtime as Parameter

Pass `runtime` explicitly to all functions.

**Pros:**
- Explicit, no magic

**Cons:**
- Massive API breaking change
- Poor developer experience

### Alternative 3: Namespace Isolation via Import Tricks

Create isolated `streamlit` module instances per runtime.

**Pros:**
- Complete isolation including module-level state

**Cons:**
- Complex, fragile implementation
- Confusing debugging experience
- Breaks assumptions about module identity

## Open Questions

1. **Cache Sharing Semantics**: Should `@st.cache_resource` connections be shared
   across runtimes by default? (Likely yes for efficiency)

2. **Config Inheritance**: Should child runtimes inherit parent config or start fresh?

3. **Error Isolation**: If one runtime crashes, should it affect others?

4. **Resource Limits**: Should there be a limit on concurrent runtimes per process?

5. **Metrics/Telemetry**: How should usage stats be attributed across runtimes?

## Testing Strategy

1. **Unit Tests**: Test each singleton's isolation in multi-runtime scenarios
2. **Integration Tests**: Mount multiple `st.App` on FastAPI, verify isolation
3. **Stress Tests**: Concurrent runtimes with heavy cache/state usage
4. **AppTest Isolation**: Verify parallel `AppTest` runs don't interfere

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing apps | High | Maintain backward compatibility for single-runtime |
| Memory increase | Medium | Lazy initialization, shared read-only state |
| Race conditions | Medium | Thorough testing, ContextVar isolation |
| Incomplete isolation | High | Phased rollout with opt-in flags |
