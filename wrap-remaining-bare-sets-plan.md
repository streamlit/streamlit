# Implementation Plan: Wrap Remaining Bare Sets on ScriptRunContext

## Background

PR #14969 wrapped three `set[str]` element-registration fields on `ScriptRunContext` with a
`ThreadSafeSet` wrapper to support parallel fragments:

- `widget_ids_this_run`
- `widget_user_keys_this_run`
- `form_ids_this_run`
- `new_fragment_ids`

However, several other mutable collections on `ScriptRunContext` remain unwrapped:

| Field | Type | Current Status |
|-------|------|----------------|
| `cached_message_hashes` | `set[str]` | Bare set, written once at `reset()` |
| `tracked_commands` | `list[Command]` | Bare list, written during execution |
| `tracked_commands_counter` | `Counter[str]` | Bare Counter, written during execution |

The tech spec ([specs/2026-03-05-parallel-fragments/tech-spec.md](specs/2026-03-05-parallel-fragments/tech-spec.md))
describes these fields in the "Other shared mutable state" section and proposes a `SharedRunState`
abstraction to make the concurrency model explicit.

**Why consistency matters:** The goal is to make the access policy for every mutable collection on
`ScriptRunContext` explicit and enforced. Currently, the distinction between "safe to access
concurrently" and "needs synchronization" is implicit — you have to know. This is fragile: adding a
new field requires understanding the concurrency model, and nothing prevents accidental unsynchronized
access to shared state.

---

## Current State

### 1. `cached_message_hashes` (`set[str]`)

**Definition:**

```python
# lib/streamlit/runtime/scriptrunner_utils/script_run_context.py:207
cached_message_hashes: set[str] = field(default_factory=set)
```

**Access Pattern:**

| Location | Operation | Thread(s) |
|----------|-----------|-----------|
| `script_run_context.py:293` (`reset()`) | Write (replace entire set) | Main thread only |
| `script_run_context.py:324` (`enqueue()`) | Read (`in` membership check) | Main + workers |
| `execution_control.py:178,186,342` | Read (pass to RerunData) | Main thread |
| `script_requests.py:61,239` | Storage (RerunData dataclass) | N/A |
| `app_session.py:460` | Create (from client state) | Event loop thread |
| `script_runner.py:624` | Pass to `reset()` | Main thread |

**Concurrency Analysis:**

Per the tech spec: "This set is written once at `ctx.reset()` and only read during execution, so it
is safe for concurrent access without synchronization."

The field has a **write-once, read-many** pattern:
1. Created fresh at `reset()` (main thread only — enforced by thread guard)
2. Read via `in` operator during `enqueue()` (any thread)
3. Never mutated after initialization

This is thread-safe under Python's memory model: reads of a fully-constructed immutable object do
not race with each other. However, the bare `set[str]` type doesn't enforce the immutability
contract — nothing prevents accidental mutation.

**Thread-Safety Status:** ✅ Safe (but not enforced)

---

### 2. `tracked_commands` (`list[Command]`)

**Definition:**

```python
# lib/streamlit/runtime/scriptrunner_utils/script_run_context.py:211
tracked_commands: list[Command] = field(default_factory=list)
```

**Access Pattern:**

| Location | Operation | Thread(s) |
|----------|-----------|-----------|
| `script_run_context.py:288` (`reset()`) | Write (replace with `[]`) | Main thread only |
| `metrics_util.py:663` | Read (`len()`) | Any thread via `gather_metrics` |
| `metrics_util.py:685` | Write (`append()`) | Any thread via `gather_metrics` |
| `script_runner.py:833` | Read (pass to `create_page_profile_message`) | Main thread (after join) |

**Concurrency Analysis:**

With parallel fragments, multiple threads call `st.*` commands simultaneously. Each command goes
through the `@gather_metrics` decorator, which:

1. Checks `len(ctx.tracked_commands) < _MAX_TRACKED_COMMANDS`
2. Checks `command_telemetry.name not in ctx.tracked_commands_counter`
3. Appends to `ctx.tracked_commands`
4. Updates `ctx.tracked_commands_counter`

This is a **check-then-act** pattern across two data structures. Without synchronization:
- Two threads could both pass the length check, then both append (exceeding the limit)
- `len()` and `append()` on the same list can race under free-threaded Python (PEP 703)
- The counter check and list append are not atomic

**Thread-Safety Status:** ❌ Unsafe under parallel execution

---

### 3. `tracked_commands_counter` (`Counter[str]`)

**Definition:**

```python
# lib/streamlit/runtime/scriptrunner_utils/script_run_context.py:212-214
tracked_commands_counter: collections.Counter[str] = field(
    default_factory=collections.Counter
)
```

**Access Pattern:**

| Location | Operation | Thread(s) |
|----------|-----------|-----------|
| `script_run_context.py:289` (`reset()`) | Write (replace with `Counter()`) | Main thread only |
| `metrics_util.py:681` | Read (`name not in counter`) | Any thread via `gather_metrics` |
| `metrics_util.py:682` | Read (`counter[name]` value lookup) | Any thread via `gather_metrics` |
| `metrics_util.py:686` | Write (`update()`) | Any thread via `gather_metrics` |

**Concurrency Analysis:**

Same issue as `tracked_commands` — accessed from multiple threads without synchronization. The
`Counter` is a `dict` subclass; concurrent `in`, `[]`, and `update()` operations are not thread-safe.

**Thread-Safety Status:** ❌ Unsafe under parallel execution

---

## Files Changed

| File | Change |
|------|--------|
| `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py` | Replace field types, update `reset()` and accessors |
| `lib/streamlit/runtime/scriptrunner_utils/thread_safe_telemetry.py` | **New file:** `ThreadSafeTelemetry` wrapper class |
| `lib/streamlit/runtime/metrics_util.py` | Update access patterns to use wrapper methods |
| `lib/streamlit/runtime/scriptrunner/script_runner.py` | Update `create_page_profile_message` call |
| `lib/streamlit/commands/execution_control.py` | No change (pass-through only) |
| `lib/tests/streamlit/runtime/scriptrunner_utils/script_run_context_test.py` | Update tests |
| `lib/tests/streamlit/runtime/scriptrunner_utils/thread_safe_telemetry_test.py` | **New file:** Unit tests |
| `lib/tests/streamlit/runtime/metrics_util_test.py` | Update mock setup |

---

## Detailed Changes

### 1. `cached_message_hashes` — Convert to `frozenset`

**Rationale:**

The field is written once and read many times. Converting to `frozenset` enforces the
immutability-after-init contract at the type level. This is the simplest, most Pythonic approach:
no wrapper class needed, no runtime overhead, and the type system prevents accidental mutation.

**Option Analysis:**

| Option | Pros | Cons |
|--------|------|------|
| `frozenset` ✅ PREFERRED | Enforces immutability, zero overhead, clear intent | Requires type changes at pass-through sites |
| `ThreadSafeSet` | Consistent with other wrapped fields | Overhead for a read-only field; misleading (implies mutability) |
| Leave as-is | No code changes | Doesn't enforce the contract |

**Before:**

```python
# lib/streamlit/runtime/scriptrunner_utils/script_run_context.py
cached_message_hashes: set[str] = field(default_factory=set)

# In reset():
self.cached_message_hashes = cached_message_hashes or set()

# In enqueue():
if msg.hash in self.cached_message_hashes:
```

**After:**

```python
# lib/streamlit/runtime/scriptrunner_utils/script_run_context.py
cached_message_hashes: frozenset[str] = field(default_factory=frozenset)

# In reset():
self.cached_message_hashes = frozenset(cached_message_hashes) if cached_message_hashes else frozenset()

# In enqueue(): (unchanged — `in` works on frozenset)
if msg.hash in self.cached_message_hashes:
```

**Pass-through updates:**

```python
# lib/streamlit/runtime/scriptrunner_utils/script_requests.py:61
# Change type annotation
cached_message_hashes: frozenset[str] = field(default_factory=frozenset)

# lib/streamlit/commands/execution_control.py:178
# No code change needed — frozenset is passed through

# lib/streamlit/runtime/app_session.py:460
# Convert from client state (repeated string) to frozenset
cached_message_hashes=frozenset(client_state.cached_message_hashes)

# lib/streamlit/runtime/scriptrunner/script_runner.py:624
# No change — passed to reset() which accepts frozenset
```

---

### 2. `tracked_commands` and `tracked_commands_counter` — New `ThreadSafeTelemetry` Wrapper

**Rationale:**

These two fields are always accessed together in `gather_metrics`:
1. Check length of `tracked_commands`
2. Check if name exists in `tracked_commands_counter`
3. Check count in `tracked_commands_counter`
4. Append to `tracked_commands`
5. Update `tracked_commands_counter`

Wrapping them separately would require two locks and wouldn't provide atomicity across the
check-then-act sequence. A single wrapper that encapsulates both provides:
- Atomicity for the compound operation
- A clean API that matches the actual usage pattern
- A single lock for both data structures

**Option Analysis:**

| Option | Pros | Cons |
|--------|------|------|
| `ThreadSafeTelemetry` (single wrapper) ✅ PREFERRED | Atomic compound operations, matches usage pattern | New abstraction |
| Separate wrappers + external lock | Could reuse `ThreadSafeSet` pattern | Awkward API, lock management burden on callers |
| Per-field locks in `ScriptRunContext` | No new classes | Doesn't provide compound atomicity |

**New class: `ThreadSafeTelemetry`**

```python
# lib/streamlit/runtime/scriptrunner_utils/thread_safe_telemetry.py

from __future__ import annotations

import threading
from collections import Counter
from typing import TYPE_CHECKING, NoReturn

if TYPE_CHECKING:
    from streamlit.proto.PageProfile_pb2 import Command


class ThreadSafeTelemetry:
    """Thread-safe wrapper for command telemetry tracking.

    Encapsulates both the command list and the per-command counter, providing
    atomic check-and-append operations. The two data structures are always
    accessed together in the gather_metrics decorator, so a single wrapper
    with a single lock ensures correctness.
    """

    def __init__(self, max_commands: int, max_per_command: int) -> None:
        self._lock = threading.Lock()
        self._commands: list[Command] = []
        self._counter: Counter[str] = Counter()
        self._max_commands = max_commands
        self._max_per_command = max_per_command

    def try_record(self, command: Command) -> bool:
        """Atomically check limits and record a command if within bounds.

        Returns True if the command was recorded, False if limits were exceeded.
        The counter is always updated (for rate limiting), but the command is
        only appended if both the total limit and per-command limit allow.
        """
        with self._lock:
            # Always update counter for rate limiting
            name = command.name
            self._counter[name] += 1

            # Check if we should record
            if len(self._commands) >= self._max_commands:
                return False
            if self._counter[name] > self._max_per_command:
                return False

            self._commands.append(command)
            return True

    def snapshot(self) -> list[Command]:
        """Return a copy of the commands list for read-only consumers."""
        with self._lock:
            return list(self._commands)

    def clear(self) -> None:
        """Reset to empty state."""
        with self._lock:
            self._commands.clear()
            self._counter.clear()

    def __len__(self) -> int:
        """Return the number of tracked commands."""
        with self._lock:
            return len(self._commands)

    def __deepcopy__(self, memo: dict[int, object]) -> NoReturn:
        raise TypeError(
            "ThreadSafeTelemetry does not support deepcopy; "
            "use .snapshot() for a copy of commands"
        )

    def __copy__(self) -> NoReturn:
        raise TypeError(
            "ThreadSafeTelemetry does not support copy; "
            "use .snapshot() for a copy of commands"
        )
```

**Update `ScriptRunContext`:**

```python
# lib/streamlit/runtime/scriptrunner_utils/script_run_context.py

# Before:
tracked_commands: list[Command] = field(default_factory=list)
tracked_commands_counter: collections.Counter[str] = field(
    default_factory=collections.Counter
)

# After:
command_telemetry: ThreadSafeTelemetry = field(
    default_factory=lambda: ThreadSafeTelemetry(
        max_commands=_MAX_TRACKED_COMMANDS,
        max_per_command=_MAX_TRACKED_PER_COMMAND,
    )
)
```

Note: The constants `_MAX_TRACKED_COMMANDS` and `_MAX_TRACKED_PER_COMMAND` are currently defined in
`metrics_util.py`. They should either be:
1. Passed to `ThreadSafeTelemetry` at construction (current proposal), or
2. Moved to a shared constants module

Option 1 is preferred to avoid circular imports and keep the wrapper self-contained.

**Update `reset()`:**

```python
# Before:
self.tracked_commands = []
self.tracked_commands_counter = collections.Counter()

# After:
self.command_telemetry.clear()
```

**Update `metrics_util.py`:**

```python
# Before (lib/streamlit/runtime/metrics_util.py:659-686):
tracking_activated = (
    ctx is not None
    and ctx.gather_usage_stats
    and not ctx.command_tracking_deactivated
    and len(ctx.tracked_commands)
    < _MAX_TRACKED_COMMANDS  # Prevent too much memory usage
)

# ...

if (
    command_telemetry.name not in ctx.tracked_commands_counter
    or ctx.tracked_commands_counter[command_telemetry.name]
    < _MAX_TRACKED_PER_COMMAND
):
    ctx.tracked_commands.append(command_telemetry)
ctx.tracked_commands_counter.update([command_telemetry.name])


# After:
tracking_activated = (
    ctx is not None
    and ctx.gather_usage_stats
    and not ctx.command_tracking_deactivated
)

# ...

# The try_record method handles all limit checks atomically
ctx.command_telemetry.try_record(command_telemetry)
```

The `tracking_activated` check no longer includes the length check — that's now internal to
`try_record()`. This simplifies the caller and ensures the check-then-act is atomic.

**Update `script_runner.py`:**

```python
# Before (lib/streamlit/runtime/scriptrunner/script_runner.py:831-833):
ctx.enqueue(
    create_page_profile_message(
        commands=ctx.tracked_commands,
        ...
    )
)

# After:
ctx.enqueue(
    create_page_profile_message(
        commands=ctx.command_telemetry.snapshot(),
        ...
    )
)
```

---

## Design Decisions

### 1. `frozenset` for `cached_message_hashes`

**Decision:** Convert to `frozenset` rather than wrapping with `ThreadSafeSet`.

**Rationale:**
- The field is genuinely immutable after initialization — `frozenset` makes this explicit
- Zero runtime overhead (no lock acquisition on reads)
- Type system prevents accidental mutation
- Simpler than adding a wrapper for a read-only field

**Trade-off:** Requires updating type annotations at pass-through sites, but this is a one-time
change that improves correctness.

### 2. Single `ThreadSafeTelemetry` wrapper for telemetry fields

**Decision:** Create a single wrapper that encapsulates both `tracked_commands` and
`tracked_commands_counter`, rather than wrapping them separately.

**Rationale:**
- The two fields are always accessed together in `gather_metrics`
- A compound check-then-act across both structures requires a single lock
- The wrapper's API (`try_record`) matches the actual usage pattern
- Prevents callers from accidentally accessing fields independently

**Trade-off:** Introduces a new abstraction, but it's well-scoped and matches the established
`ThreadSafeSet` pattern.

### 3. Limits as constructor parameters

**Decision:** Pass `max_commands` and `max_per_command` to `ThreadSafeTelemetry` at construction.

**Rationale:**
- Avoids importing from `metrics_util` (prevents potential circular imports)
- Makes the wrapper self-contained and testable in isolation
- Follows dependency injection principle

### 4. Naming: `command_telemetry` vs `tracked_commands`

**Decision:** Rename to `command_telemetry` (singular field replacing two).

**Rationale:**
- The old names (`tracked_commands`, `tracked_commands_counter`) are implementation details
- The new name describes the purpose (telemetry tracking)
- Follows the pattern of `ThreadSafeSet` where the wrapper name describes its role

---

## Test Plan

### New Tests: `thread_safe_telemetry_test.py`

| Test Name | Description |
|-----------|-------------|
| `test_try_record_within_limits` | Verify commands are recorded when within limits |
| `test_try_record_exceeds_total_limit` | Verify commands are rejected when total limit exceeded |
| `test_try_record_exceeds_per_command_limit` | Verify commands are rejected when per-command limit exceeded |
| `test_snapshot_returns_copy` | Verify `snapshot()` returns a copy, not the internal list |
| `test_clear_resets_state` | Verify `clear()` empties both commands and counter |
| `test_len_returns_command_count` | Verify `__len__` returns correct count |
| `test_concurrent_try_record` | Verify thread safety with concurrent `try_record` calls |
| `test_deepcopy_raises` | Verify `__deepcopy__` raises `TypeError` |
| `test_copy_raises` | Verify `__copy__` raises `TypeError` |

### Updated Tests: `script_run_context_test.py`

| Test Name | Change |
|-----------|--------|
| `test_enqueue_uses_cached_message_ref` | Update to use `frozenset` in factory |
| `test_reset_clears_command_telemetry` | New test for `command_telemetry.clear()` |

### Updated Tests: `metrics_util_test.py`

| Test Name | Change |
|-----------|--------|
| `_create_mock_ctx` fixture | Replace `tracked_commands`/`tracked_commands_counter` mocks with `command_telemetry` mock |
| `test_gather_metrics_*` tests | Update assertions to use `command_telemetry.snapshot()` |

---

## Scope Boundaries

### This PR does NOT change:

1. **`SharedRunState` abstraction** — The tech spec proposes a larger restructuring of
   `ScriptRunContext` into explicit categories (`SharedRunState`, `FragmentThreadState`, etc.).
   This PR focuses only on wrapping the remaining bare collections; the broader restructuring is
   a separate effort.

2. **Other `ScriptRunContext` fields** — Fields like `cursors`, `fragment_ids_this_run`, etc. are
   not addressed here. Each has its own access pattern that may or may not need protection.

3. **`command_tracking_deactivated` flag** — This boolean is written and read from multiple threads
   but is used as a reentrant guard within a single `gather_metrics` call. The flag's races are
   benign (worst case: an extra command is tracked) and fixing would require a more invasive change
   to the decorator pattern. Out of scope for this PR.

4. **`PagesManager` and `FragmentStorage` locking** — The tech spec proposes adding locks to these
   classes. That work is tracked separately.

5. **`SafeSessionState` compound atomicity** — The tech spec documents that `SafeSessionState` has
   per-operation atomicity but not multi-operation atomicity. This limitation is documented, not
   fixed, in the parallel fragments MVP.

---

## Open Questions

1. **Should `_MAX_TRACKED_COMMANDS` and `_MAX_TRACKED_PER_COMMAND` move to a constants module?**
   
   Currently in `metrics_util.py`. The proposed design passes them to `ThreadSafeTelemetry` at
   construction, which works but requires the caller to know the values. An alternative is a shared
   constants module that both `metrics_util.py` and `script_run_context.py` can import.

2. **Should `ThreadSafeTelemetry` live in `thread_safe_set.py` or a new file?**
   
   The proposed design creates a new file (`thread_safe_telemetry.py`) since it's a different
   abstraction (list + counter vs. set). However, co-locating all thread-safe wrappers in one
   module could aid discoverability.

---

## Migration Notes

The changes are internal to the runtime and don't affect the public API. No user-facing migration
is required.

Test updates are straightforward: replace direct field access with wrapper method calls in mocks
and assertions.
