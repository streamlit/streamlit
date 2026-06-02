# SharedRunState Container Implementation Plan

## Background

This document describes the implementation plan for introducing a `SharedRunState` container class to `ScriptRunContext`. This is a post-release hardening item for the parallel fragments feature.

### Why This Restructuring Is Needed

`ScriptRunContext` currently mixes per-thread, shared-mutable, shared-immutable, and externally-managed fields on one flat dataclass. The distinction between what's isolated per-thread and what's shared across threads is implicit — you have to know. This is fragile: adding a new field requires understanding the concurrency model to choose the right category, and nothing prevents accidental unsynchronized access to shared state.

Per the [parallel fragments tech spec](specs/2026-03-05-parallel-fragments/tech-spec.md) (section "Other shared mutable state"), the proposed design restructures `ScriptRunContext` into four explicit categories:

1. **Immutable config** — set at construction, never mutated
2. **Externally thread-safe objects** — manage their own locking
3. **Shared mutable run state** → `SharedRunState` container
4. **Per-thread fragment state** → `FragmentThreadState` via ContextVar (already implemented in PR #15072)

This plan covers only category 3: extracting the `ThreadSafeSet` fields and telemetry fields into a dedicated `SharedRunState` container. Callers will migrate from `ctx.field_name` to `ctx.shared.field_name`.

## Current State

### Fields on `ScriptRunContext` Today

The `ScriptRunContext` dataclass (`lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`) currently has the following fields:

```python
@dataclass
class ScriptRunContext:
    session_id: str
    _enqueue: Callable[[ForwardMsg], None]
    query_string: str
    session_state: SafeSessionState
    uploaded_file_mgr: UploadedFileManager
    main_script_path: str
    user_info: UserInfoType
    fragment_storage: FragmentStorage
    pages_manager: PagesManager
    on_script_error: OnScriptErrorHandler | None = None
    cached_message_hashes: set[str] = field(default_factory=set)
    context_info: ContextInfo | None = None
    gather_usage_stats: bool = False
    command_tracking_deactivated: bool = False
    tracked_commands: list[Command] = field(default_factory=list)
    tracked_commands_counter: collections.Counter[str] = field(default_factory=collections.Counter)
    _has_script_started: bool = False
    widget_ids_this_run: ThreadSafeSet[str] = field(default_factory=ThreadSafeSet)
    widget_user_keys_this_run: ThreadSafeSet[str] = field(default_factory=ThreadSafeSet)
    form_ids_this_run: ThreadSafeSet[str] = field(default_factory=ThreadSafeSet)
    cursors: dict[int, RunningCursor] = field(default_factory=dict)
    script_requests: ScriptRequests | None = None
    fragment_ids_this_run: list[str] | None = None
    new_fragment_ids: ThreadSafeSet[str] = field(default_factory=ThreadSafeSet)
    has_dialog_opened: bool = False
    parallel_coordinator: ParallelFragmentCoordinator | None = None
```

### How Shared Fields Are Currently Accessed

The fields that will move to `SharedRunState` are currently accessed directly on `ctx`:

| Field | Current Access Pattern | Example |
|-------|----------------------|---------|
| `widget_ids_this_run` | `ctx.widget_ids_this_run.check_and_add(id)` | `lib/streamlit/elements/lib/utils.py:145` |
| `widget_user_keys_this_run` | `ctx.widget_user_keys_this_run.check_and_add(key)` | `lib/streamlit/elements/lib/utils.py:142` |
| `form_ids_this_run` | `ctx.form_ids_this_run.check_and_add(form_id)` | `lib/streamlit/elements/form.py:223` |
| `new_fragment_ids` | `ctx.new_fragment_ids.check_and_add(fragment_id)` | `lib/streamlit/runtime/fragment.py:400` |
| `tracked_commands` | `ctx.tracked_commands.append(command)` | `lib/streamlit/runtime/metrics_util.py:685` |
| `tracked_commands_counter` | `ctx.tracked_commands_counter.update([name])` | `lib/streamlit/runtime/metrics_util.py:686` |

## Field Categorization

Every field on `ScriptRunContext` categorized:

| Field | Category | Rationale |
|-------|----------|-----------|
| `session_id` | Immutable config | Set at construction, never changes |
| `_enqueue` | Immutable config | Callable set at construction |
| `main_script_path` | Immutable config | Set at construction, never changes |
| `user_info` | Immutable config | Set at construction, never changes |
| `gather_usage_stats` | Immutable config | Set at construction, never changes |
| `on_script_error` | Immutable config | Set at construction, never changes |
| `session_state` | Externally thread-safe | `SafeSessionState` wraps access with `RLock` |
| `uploaded_file_mgr` | Externally thread-safe | External manager with its own lifecycle |
| `fragment_storage` | Externally thread-safe | Has internal lock (added in parallel fragments work) |
| `pages_manager` | Externally thread-safe | Has internal lock (added in parallel fragments work) |
| `script_requests` | Externally thread-safe | External object, not mutated by ctx |
| `query_string` | Per-run config | Reset in `reset()`, read-only during execution |
| `context_info` | Per-run config | Reset in `reset()`, read-only during execution |
| `cached_message_hashes` | Per-run config | Reset in `reset()`, read-only during execution |
| `fragment_ids_this_run` | Per-run config | Reset in `reset()`, read-only during execution |
| `cursors` | Per-run state | Reset in `reset()`, single-threaded access (cursor ownership) |
| `parallel_coordinator` | Per-run state | Created fresh in `reset()`, coordinates thread lifecycle |
| `_has_script_started` | Per-run state | Flag toggled by main thread only |
| `has_dialog_opened` | Per-run state | Flag checked during sequential execution only |
| `command_tracking_deactivated` | Per-run state | Flag for telemetry, main thread context only |
| **`widget_ids_this_run`** | **Shared mutable → SharedRunState** | Written by any thread (widget registration) |
| **`widget_user_keys_this_run`** | **Shared mutable → SharedRunState** | Written by any thread (key registration) |
| **`form_ids_this_run`** | **Shared mutable → SharedRunState** | Written by any thread (form registration) |
| **`new_fragment_ids`** | **Shared mutable → SharedRunState** | Written by any thread (fragment registration) |
| **`tracked_commands`** | **Shared mutable → SharedRunState** | Written by any thread (telemetry) |
| **`tracked_commands_counter`** | **Shared mutable → SharedRunState** | Written by any thread (telemetry) |

### Notes on Categorization

- **`command_tracking_deactivated`**: Although accessed during telemetry tracking, this flag is used to prevent nested command tracking within the *same* call stack. With `@gather_metrics` wrapping `st.*` calls, the flag is set/unset within a single thread's execution. It should remain on `ctx` rather than `SharedRunState` because the deactivation is per-call-stack, not global.

- **`has_dialog_opened`**: This flag enforces the one-dialog-per-rerun invariant. Per the tech spec, dialogs are prohibited during parallel worker execution (`_check_not_parallel_worker`), so the flag is only checked during sequential execution. It remains on `ctx`.

- **`cursors`**: The cursor dict is deepcopied for fragment reruns and uses cursor ownership to enforce single-thread access. It remains on `ctx`.

## Files Changed

| File | Summary |
|------|---------|
| `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py` | Add `SharedRunState` class; add `shared` field to `ScriptRunContext`; update `reset()` |
| `lib/streamlit/runtime/scriptrunner_utils/shared_run_state.py` | **New file**: `SharedRunState` container class |
| `lib/streamlit/elements/lib/utils.py` | Migrate `widget_ids_this_run`, `widget_user_keys_this_run` access |
| `lib/streamlit/elements/form.py` | Migrate `form_ids_this_run` access |
| `lib/streamlit/components/v2/presentation.py` | Migrate `widget_ids_this_run`, `form_ids_this_run` access |
| `lib/streamlit/runtime/fragment.py` | Migrate `new_fragment_ids` access |
| `lib/streamlit/runtime/metrics_util.py` | Migrate `tracked_commands`, `tracked_commands_counter` access |
| `lib/streamlit/runtime/scriptrunner/script_runner.py` | Migrate `widget_ids_this_run.snapshot()`, `new_fragment_ids.snapshot()` access |
| `lib/streamlit/runtime/state/session_state.py` | Migrate `widget_ids_this_run`, `form_ids_this_run` access |
| `lib/streamlit/testing/v1/local_script_runner.py` | Migrate `widget_ids_this_run.snapshot()` access |
| `lib/tests/streamlit/runtime/scriptrunner_utils/thread_safe_set_test.py` | Update tests for new `ctx.shared.*` access pattern |
| `lib/tests/streamlit/runtime/scriptrunner_utils/shared_run_state_test.py` | **New file**: Unit tests for `SharedRunState` |
| `lib/tests/streamlit/elements/lib/utils_test.py` | Update mock setup for `ctx.shared.*` |
| `lib/tests/streamlit/components/v2/test_bidi_presentation.py` | Update mock setup for `ctx.shared.*` |
| `lib/tests/streamlit/components/v2/test_bidi_component.py` | Update test setup for `ctx.shared.*` |
| `lib/tests/streamlit/components_test.py` | Update test setup for `ctx.shared.*` |
| `lib/tests/streamlit/delta_generator_test.py` | Update test setup for `ctx.shared.*` |
| `lib/tests/streamlit/runtime/caching/common_cache_test.py` | Update test setup for `ctx.shared.*` |
| `lib/tests/streamlit/runtime/fragment_test.py` | Update test setup for `ctx.shared.*` |
| `lib/tests/streamlit/runtime/metrics_util_test.py` | Update test setup for `ctx.shared.*` |
| `lib/tests/streamlit/runtime/state/session_state_test.py` | Update mock setup for `ctx.shared.*` |

## Detailed Changes

### 1. New `SharedRunState` class

**File:** `lib/streamlit/runtime/scriptrunner_utils/shared_run_state.py` (new)

```python
from __future__ import annotations

import threading
from collections import Counter
from typing import TYPE_CHECKING

from streamlit.runtime.scriptrunner_utils.thread_safe_set import ThreadSafeSet

if TYPE_CHECKING:
    from streamlit.proto.PageProfile_pb2 import Command


class SharedRunState:
    """Thread-safe shared state for a script run.
    
    Single instance shared across main thread and all worker threads.
    Encapsulates locking so callers cannot make unsynchronized access.
    """
    
    def __init__(self) -> None:
        self._widget_ids = ThreadSafeSet[str]()
        self._widget_user_keys = ThreadSafeSet[str]()
        self._form_ids = ThreadSafeSet[str]()
        self._new_fragment_ids = ThreadSafeSet[str]()
        
        # Telemetry fields need a shared lock since they're accessed together
        self._telemetry_lock = threading.Lock()
        self._tracked_commands: list[Command] = []
        self._tracked_commands_counter: Counter[str] = Counter()
    
    # --- Widget/Form ID registration ---
    
    @property
    def widget_ids(self) -> ThreadSafeSet[str]:
        """Widget IDs registered this run."""
        return self._widget_ids
    
    @property
    def widget_user_keys(self) -> ThreadSafeSet[str]:
        """Widget user keys registered this run."""
        return self._widget_user_keys
    
    @property
    def form_ids(self) -> ThreadSafeSet[str]:
        """Form IDs registered this run."""
        return self._form_ids
    
    @property
    def new_fragment_ids(self) -> ThreadSafeSet[str]:
        """Fragment IDs registered this run."""
        return self._new_fragment_ids
    
    # --- Telemetry ---
    
    def track_command(
        self, command: Command, max_commands: int, max_per_command: int
    ) -> None:
        """Thread-safe command tracking for telemetry.
        
        Parameters
        ----------
        command : Command
            The command telemetry to track.
        max_commands : int
            Maximum total commands to track.
        max_per_command : int
            Maximum instances of any single command name to track.
        """
        with self._telemetry_lock:
            if len(self._tracked_commands) >= max_commands:
                return
            if (
                command.name not in self._tracked_commands_counter
                or self._tracked_commands_counter[command.name] < max_per_command
            ):
                self._tracked_commands.append(command)
            self._tracked_commands_counter.update([command.name])
    
    def get_tracked_commands(self) -> list[Command]:
        """Return a snapshot of tracked commands."""
        with self._telemetry_lock:
            return list(self._tracked_commands)
    
    def tracked_commands_count(self) -> int:
        """Return the count of tracked commands."""
        with self._telemetry_lock:
            return len(self._tracked_commands)
    
    # --- Lifecycle ---
    
    def reset(self) -> None:
        """Reset all shared state for a new script run."""
        self._widget_ids.clear()
        self._widget_user_keys.clear()
        self._form_ids.clear()
        self._new_fragment_ids.clear()
        with self._telemetry_lock:
            self._tracked_commands = []
            self._tracked_commands_counter = Counter()
```

### 2. Update `ScriptRunContext`

**File:** `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`

**Before:**

```python
@dataclass
class ScriptRunContext:
    # ... other fields ...
    tracked_commands: list[Command] = field(default_factory=list)
    tracked_commands_counter: collections.Counter[str] = field(
        default_factory=collections.Counter
    )
    widget_ids_this_run: ThreadSafeSet[str] = field(default_factory=ThreadSafeSet)
    widget_user_keys_this_run: ThreadSafeSet[str] = field(default_factory=ThreadSafeSet)
    form_ids_this_run: ThreadSafeSet[str] = field(default_factory=ThreadSafeSet)
    new_fragment_ids: ThreadSafeSet[str] = field(default_factory=ThreadSafeSet)
```

**After:**

```python
from streamlit.runtime.scriptrunner_utils.shared_run_state import SharedRunState

@dataclass
class ScriptRunContext:
    # ... other fields ...
    
    # Shared mutable run state — accessed via ctx.shared.*
    shared: SharedRunState = field(default_factory=SharedRunState)
    
    # DEPRECATED: Direct access maintained for backward compatibility during migration
    # These properties delegate to self.shared for gradual migration.
    @property
    def widget_ids_this_run(self) -> ThreadSafeSet[str]:
        return self.shared.widget_ids
    
    @property
    def widget_user_keys_this_run(self) -> ThreadSafeSet[str]:
        return self.shared.widget_user_keys
    
    @property
    def form_ids_this_run(self) -> ThreadSafeSet[str]:
        return self.shared.form_ids
    
    @property
    def new_fragment_ids(self) -> ThreadSafeSet[str]:
        return self.shared.new_fragment_ids
```

**Update `reset()` method:**

```python
def reset(self, ...) -> None:
    # ... existing checks and setup ...
    
    # Reset shared mutable state
    self.shared.reset()
    
    # Remove direct field clears (now handled by shared.reset()):
    # - self.widget_ids_this_run.clear()
    # - self.widget_user_keys_this_run.clear()
    # - self.form_ids_this_run.clear()
    # - self.new_fragment_ids.clear()
    # - self.tracked_commands = []
    # - self.tracked_commands_counter = collections.Counter()
```

### 3. Migrate `lib/streamlit/elements/lib/utils.py`

**Before:**

```python
def _check_and_register_element(ctx: ScriptRunContext, ...):
    user_key = user_key_from_element_id(element_id)
    if user_key and not ctx.widget_user_keys_this_run.check_and_add(user_key):
        raise StreamlitDuplicateElementKey(user_key)

    if not ctx.widget_ids_this_run.check_and_add(element_id):
        raise StreamlitDuplicateElementId(element_type)
```

**After:**

```python
def _check_and_register_element(ctx: ScriptRunContext, ...):
    user_key = user_key_from_element_id(element_id)
    if user_key and not ctx.shared.widget_user_keys.check_and_add(user_key):
        raise StreamlitDuplicateElementKey(user_key)

    if not ctx.shared.widget_ids.check_and_add(element_id):
        raise StreamlitDuplicateElementId(element_type)
```

### 4. Migrate `lib/streamlit/elements/form.py`

**Before:**

```python
if ctx is not None and not ctx.form_ids_this_run.check_and_add(form_id):
    raise StreamlitAPIException(...)
```

**After:**

```python
if ctx is not None and not ctx.shared.form_ids.check_and_add(form_id):
    raise StreamlitAPIException(...)
```

### 5. Migrate `lib/streamlit/components/v2/presentation.py`

**Before:**

```python
component_id in ctx.widget_ids_this_run
    or user_key in ctx.form_ids_this_run
```

**After:**

```python
component_id in ctx.shared.widget_ids
    or user_key in ctx.shared.form_ids
```

### 6. Migrate `lib/streamlit/runtime/fragment.py`

**Before:**

```python
ctx.new_fragment_ids.check_and_add(fragment_id)
```

**After:**

```python
ctx.shared.new_fragment_ids.check_and_add(fragment_id)
```

### 7. Migrate `lib/streamlit/runtime/metrics_util.py`

**Before:**

```python
tracking_activated = (
    ctx is not None
    and ctx.gather_usage_stats
    and not ctx.command_tracking_deactivated
    and len(ctx.tracked_commands) < _MAX_TRACKED_COMMANDS
)

if ctx and tracking_activated:
    if (
        command_telemetry.name not in ctx.tracked_commands_counter
        or ctx.tracked_commands_counter[command_telemetry.name] < _MAX_TRACKED_PER_COMMAND
    ):
        ctx.tracked_commands.append(command_telemetry)
    ctx.tracked_commands_counter.update([command_telemetry.name])
```

**After:**

```python
tracking_activated = (
    ctx is not None
    and ctx.gather_usage_stats
    and not ctx.command_tracking_deactivated
    and ctx.shared.tracked_commands_count() < _MAX_TRACKED_COMMANDS
)

if ctx and tracking_activated:
    ctx.shared.track_command(
        command_telemetry,
        max_commands=_MAX_TRACKED_COMMANDS,
        max_per_command=_MAX_TRACKED_PER_COMMAND,
    )
```

### 8. Migrate `lib/streamlit/runtime/scriptrunner/script_runner.py`

**Before:**

```python
self._session_state.on_script_finished(ctx.widget_ids_this_run.snapshot())
# ...
self._fragment_storage.clear(new_fragment_ids=ctx.new_fragment_ids.snapshot())
# ...
commands=ctx.tracked_commands,
```

**After:**

```python
self._session_state.on_script_finished(ctx.shared.widget_ids.snapshot())
# ...
self._fragment_storage.clear(new_fragment_ids=ctx.shared.new_fragment_ids.snapshot())
# ...
commands=ctx.shared.get_tracked_commands(),
```

### 9. Migrate `lib/streamlit/runtime/state/session_state.py`

**Before:**

```python
widget_ids = ctx.widget_ids_this_run
form_ids = ctx.form_ids_this_run
```

**After:**

```python
widget_ids = ctx.shared.widget_ids
form_ids = ctx.shared.form_ids
```

### 10. Migrate `lib/streamlit/testing/v1/local_script_runner.py`

**Before:**

```python
self._session_state.on_script_finished(ctx.widget_ids_this_run.snapshot())
```

**After:**

```python
self._session_state.on_script_finished(ctx.shared.widget_ids.snapshot())
```

### 11. Update Test Files

For test files that mock `ScriptRunContext`, update the mock setup:

**Before (example from `test_bidi_presentation.py`):**

```python
mock_ctx.widget_ids_this_run = ThreadSafeSet()
mock_ctx.widget_ids_this_run.check_and_add("test_component_id")
mock_ctx.form_ids_this_run = ThreadSafeSet()
```

**After:**

```python
mock_ctx.shared = MagicMock()
mock_ctx.shared.widget_ids = ThreadSafeSet()
mock_ctx.shared.widget_ids.check_and_add("test_component_id")
mock_ctx.shared.form_ids = ThreadSafeSet()
```

**Or using a real `SharedRunState` instance:**

```python
mock_ctx.shared = SharedRunState()
mock_ctx.shared.widget_ids.check_and_add("test_component_id")
```

## Design Decisions

### 1. `SharedRunState` Composition vs. Subclassing

**Decision:** `SharedRunState` is a standalone class composed into `ScriptRunContext`, not a parent class.

**Rationale:**
- Composition over inheritance is a project guideline
- Clear separation of concerns — `SharedRunState` owns thread-safe shared data
- `ScriptRunContext` remains the single point of access for callers
- Enables potential future refactoring (e.g., different `SharedRunState` implementations)

### 2. Property Accessors for ThreadSafeSet Fields

**Decision:** Expose `ThreadSafeSet` fields as read-only properties (e.g., `ctx.shared.widget_ids`) rather than wrapping each method.

**Rationale:**
- `ThreadSafeSet` already encapsulates thread-safety
- Exposing the object allows callers to use the full API (`check_and_add`, `__contains__`, `snapshot`, `clear`)
- Consistent with current usage patterns — minimal caller changes
- The properties return the same `ThreadSafeSet` instance, so callers cannot replace the underlying set

### 3. Telemetry API: `track_command()` vs. Direct Access

**Decision:** Provide a `track_command(command, max_commands, max_per_command)` method rather than exposing `tracked_commands` and `tracked_commands_counter` directly.

**Rationale:**
- The telemetry logic involves a compound check-then-add operation on two data structures
- Encapsulating this in a single atomic method prevents race conditions
- The `max_*` parameters come from module-level constants in `metrics_util.py`, passed explicitly to avoid coupling
- `get_tracked_commands()` returns a snapshot list, not the underlying list

### 4. `SharedRunState.reset()` Method

**Decision:** Provide a `reset()` method that clears all fields atomically.

**Rationale:**
- Called from `ScriptRunContext.reset()` at the start of each script run
- Centralizes the reset logic — if new fields are added to `SharedRunState`, only one place to update
- The individual `ThreadSafeSet.clear()` calls are already atomic; grouping them makes the intent clear

### 5. Backward Compatibility Properties

**Decision:** Keep deprecated properties on `ScriptRunContext` that delegate to `self.shared.*` during migration.

**Rationale:**
- Allows gradual migration of callers
- External code (custom components, test utilities) may access these fields directly
- Properties can be removed in a future release after a deprecation period

### 6. No Changes to `command_tracking_deactivated`

**Decision:** `command_tracking_deactivated` remains on `ScriptRunContext`, not `SharedRunState`.

**Rationale:**
- Per the tech spec, this flag prevents tracking of nested commands within the same call stack
- It's toggled within `@gather_metrics` to prevent double-counting when `st.markdown()` calls `st.write()` internally
- The flag is set/unset within a single function execution, not shared across threads
- If a parallel worker tracks a command, it sets its own flag; another worker's flag is independent

## Test Plan

### Unit Tests for `SharedRunState`

**File:** `lib/tests/streamlit/runtime/scriptrunner_utils/shared_run_state_test.py`

| Test Name | Description |
|-----------|-------------|
| `test_shared_run_state_init_creates_empty_sets` | Verify all `ThreadSafeSet` fields start empty |
| `test_shared_run_state_widget_ids_check_and_add` | Verify `widget_ids.check_and_add()` returns `True` for new, `False` for duplicate |
| `test_shared_run_state_widget_user_keys_check_and_add` | Same for `widget_user_keys` |
| `test_shared_run_state_form_ids_check_and_add` | Same for `form_ids` |
| `test_shared_run_state_new_fragment_ids_check_and_add` | Same for `new_fragment_ids` |
| `test_shared_run_state_track_command_adds_command` | Verify `track_command()` appends to list |
| `test_shared_run_state_track_command_respects_max_commands` | Stop tracking after `max_commands` reached |
| `test_shared_run_state_track_command_respects_max_per_command` | Stop tracking specific command after limit |
| `test_shared_run_state_track_command_still_counts_after_per_command_limit` | Counter still increments even when list doesn't grow |
| `test_shared_run_state_get_tracked_commands_returns_copy` | Returned list is a copy, not the internal list |
| `test_shared_run_state_reset_clears_all_fields` | Verify `reset()` empties all sets and lists |
| `test_shared_run_state_concurrent_widget_id_registration` | Multiple threads registering IDs concurrently |
| `test_shared_run_state_concurrent_command_tracking` | Multiple threads tracking commands concurrently |

### Integration Tests

**File:** `lib/tests/streamlit/runtime/scriptrunner_utils/script_run_context_test.py` (updates)

| Test Name | Description |
|-----------|-------------|
| `test_reset_clears_shared_run_state` | Verify `ctx.reset()` calls `ctx.shared.reset()` |
| `test_backward_compat_widget_ids_this_run_property` | Verify `ctx.widget_ids_this_run` delegates to `ctx.shared.widget_ids` |
| `test_backward_compat_widget_user_keys_this_run_property` | Same for `widget_user_keys_this_run` |
| `test_backward_compat_form_ids_this_run_property` | Same for `form_ids_this_run` |
| `test_backward_compat_new_fragment_ids_property` | Same for `new_fragment_ids` |

### Existing Test Updates

Update existing tests to use `ctx.shared.*` access pattern:

- `lib/tests/streamlit/runtime/scriptrunner_utils/thread_safe_set_test.py` — Update `test_script_run_context_uses_thread_safe_set` to check `ctx.shared.widget_ids` etc.
- `lib/tests/streamlit/elements/lib/utils_test.py` — Update mock setup
- `lib/tests/streamlit/components/v2/test_bidi_*.py` — Update mock setup
- `lib/tests/streamlit/delta_generator_test.py` — Update test setup
- `lib/tests/streamlit/runtime/caching/common_cache_test.py` — Update test setup
- `lib/tests/streamlit/runtime/fragment_test.py` — Update test setup
- `lib/tests/streamlit/runtime/metrics_util_test.py` — Update test setup for new telemetry API
- `lib/tests/streamlit/runtime/state/session_state_test.py` — Update mock setup

## Scope Boundaries

### What This PR Does

- Introduces `SharedRunState` class as a container for thread-safe shared mutable fields
- Adds `shared: SharedRunState` field to `ScriptRunContext`
- Migrates all production code to use `ctx.shared.*` access pattern
- Provides backward-compatible properties on `ScriptRunContext` for gradual migration
- Updates all unit tests to use new access pattern
- Adds unit tests for `SharedRunState` class

### What This PR Does NOT Change

- **`FragmentThreadState`** — Already implemented in PR #15072; this plan does not modify per-thread state
- **Immutable config fields** — No changes to `session_id`, `main_script_path`, `user_info`, etc.
- **Externally thread-safe fields** — No changes to `session_state`, `pages_manager`, `fragment_storage`
- **Per-run config fields** — No changes to `query_string`, `context_info`, `cached_message_hashes`
- **Per-run state fields** — No changes to `cursors`, `parallel_coordinator`, `has_dialog_opened`
- **`command_tracking_deactivated`** — Remains on `ScriptRunContext` (per-call-stack, not cross-thread)
- **Telemetry module constants** — `_MAX_TRACKED_COMMANDS` and `_MAX_TRACKED_PER_COMMAND` stay in `metrics_util.py`
- **Public API** — No user-facing API changes
- **E2E tests** — No changes to end-to-end test behavior

## Open Questions

1. **Deprecation timeline for backward-compat properties?**
   - The tech spec does not specify when `ctx.widget_ids_this_run` etc. should be removed
   - Suggest: Add `# DEPRECATED` comments and remove after one minor release cycle

2. **Should `tracked_commands` and `tracked_commands_counter` be exposed via properties?**
   - Current design encapsulates them entirely behind `track_command()` and `get_tracked_commands()`
   - If test code needs direct access, we could add read-only properties
   - Suggest: Keep encapsulated; update tests to use the API

3. **Location of `SharedRunState` class?**
   - Option A: Same file as `ScriptRunContext` (`script_run_context.py`)
   - Option B: New file (`shared_run_state.py`)
   - Suggest: New file for cleaner separation and testability
