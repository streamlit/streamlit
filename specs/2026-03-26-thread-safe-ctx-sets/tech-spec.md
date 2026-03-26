---
author: sfc-gh-lwilby
created: 2026-03-26
---

# Thread-safe ScriptRunContext shared sets

## Summary

Make six shared mutable fields on `ScriptRunContext` thread-safe using per-structure locking.
This is a prerequisite for [parallel fragments](https://github.com/streamlit/streamlit/blob/develop/specs/2026-03-05-parallel-fragments/tech-spec.md) (`@st.fragment(parallel=True)`), where multiple threads attach to the same context via `add_script_run_ctx` and call `st.*` concurrently. It also makes Streamlit correct under [PEP 703](https://peps.python.org/pep-0703/) free-threaded CPython (`python3.13t+`), where `set` operations are no longer implicitly serialized by the GIL.

## Problem

### Single-threaded assumption today

`ScriptRunContext` (`lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`) holds several collections mutated on every widget, form, fragment, and (when usage stats are on) command invocation. With one script thread, only one mutator runs at a time.

### Concurrent access with parallel fragments

Worker threads share the **same** `ScriptRunContext` instance. Any field that is both **read** and **written** during the run is subject to data races.

**Concrete race (duplicate user-key detection):**

`lib/streamlit/elements/lib/utils.py` (~L142–L148) does check-then-act on `widget_user_keys_this_run` and adds to `widget_ids_this_run`:

```python
if user_key not in ctx.widget_user_keys_this_run:
    ctx.widget_user_keys_this_run.add(user_key)
# ...
ctx.widget_ids_this_run.add(element_id)
```

- **Thread A:** `user_key not in set` → True (key absent).
- **Thread B:** adds a different key (or the same key) concurrently.
- **Thread A:** `add(user_key)` — without synchronization, the set can be in an inconsistent state during concurrent `__contains__` / `add` / hash-table resize (undefined behavior under the memory model; `RuntimeError` from set mutation during iteration is also possible in edge cases).

The same pattern applies to `form_ids_this_run` (`lib/streamlit/elements/form.py` ~L224–L226), `new_fragment_ids` (`lib/streamlit/runtime/fragment.py` ~L200), and usage tracking (`lib/streamlit/runtime/metrics_util.py` ~L528–L551), where reads (`len`, `in`, counter lookup) are interleaved with writes (`append`, `Counter.update`).

### Why not rely on the GIL

- The language specification does not guarantee atomicity of `set.add` / `__contains__` pairs across threads.
- Free-threaded CPython removes the GIL; “works on my machine” under classic CPython is insufficient.
- Streamlit should be **correct by construction** for shared mutable state.

### Fields that need synchronization

| Field | Type | Mutation | Read during execution |
|-------|------|----------|------------------------|
| `widget_ids_this_run` | `set[str]` | Add per widget | Duplicate ID / registration paths |
| `widget_user_keys_this_run` | `set[str]` | Add when `key=` present | Duplicate user-key check (`elements/lib/utils.py`) |
| `form_ids_this_run` | `set[str]` | Add per `st.form()` | `form_id not in ctx.form_ids_this_run` |
| `new_fragment_ids` | `set[str]` | Add per `@st.fragment` definition | `FragmentStorage.clear` needs full set after run (`script_runner.py` ~L691) |
| `tracked_commands` | `list[Command]` | Append when usage stats on | `len(ctx.tracked_commands)` before append (`metrics_util.py` ~L528) |
| `tracked_commands_counter` | `Counter[str]` | `update` per command | `in` / `[]` before append (`metrics_util.py` ~L546–L551) |

### Fields that do **not** need synchronization (this change)

| Field | Why safe |
|-------|----------|
| `session_state` | `SafeSessionState` uses `RLock` |
| `cached_message_hashes` | Set at `reset()`; read-only during execution |
| `in_cached_function` | `ContextVar` — per logical thread |
| `_enqueue` | `ForwardMsgQueue` synchronization is separate work |
| `current_fragment_id`, `current_fragment_delta_path`, `in_fragment_callback` | Per-thread via `contextvars.copy_context()` in parallel fragment design |
| `_active_script_hash` | Per-thread via `run_with_active_hash` |
| Immutable scalars (`session_id`, `main_script_path`, `user_info`, …) | Not mutated during execution |
| `has_dialog_opened` | `@st.dialog` disallowed during parallel execution (guarded elsewhere) |

## Proposal

### Approach: lock-wrapped structures (recommended)

Use `threading.Lock` (or one lock per logical group) around a private backing `set`, `list`, or `Counter`. Operations stay **O(1)** for set membership and add; expected parallel fragment count is small (<10), so contention should be negligible.

**Do not** use “per-thread sets merged after join” for the four widget/form/fragment sets: duplicate detection must observe keys registered by **all** threads during the run.

### Module placement

Add a small internal module next to the context, e.g. `lib/streamlit/runtime/scriptrunner_utils/thread_safe_collections.py`, containing:

- `ThreadSafeStrSet` — backing `set[str]`, one lock.
- `ThreadSafeTelemetry` — **single lock** over both `tracked_commands` and `tracked_commands_counter`, because `metrics_util.py` reads and updates them in one logical step; two independent locks would allow torn reads unless call sites always acquire both in a fixed order.

Keep `ScriptRunContext` as a `@dataclass`; field types become these wrapper classes. Call sites that need a plain `set` for APIs like `on_script_finished(widget_ids_this_run: set[str])` use an explicit **snapshot** method under the lock (see below).

### `ThreadSafeStrSet` (illustrative)

```python
from __future__ import annotations

import threading
from typing import Final


class ThreadSafeStrSet:
    """A set[str] guarded by a lock; safe for concurrent add / __contains__."""

    __slots__ = ("_lock", "_set")

    def __init__(self) -> None:
        self._lock: Final[threading.Lock] = threading.Lock()
        self._set: set[str] = set()

    def __contains__(self, item: str) -> bool:
        with self._lock:
            return item in self._set

    def add(self, item: str) -> None:
        with self._lock:
            self._set.add(item)

    def snapshot(self) -> frozenset[str]:
        """Copy for use after all fragment threads have joined (e.g. stale widget cleanup)."""
        with self._lock:
            return frozenset(self._set)

    def clear_and_reset(self) -> None:
        with self._lock:
            self._set = set()
```

**Check-then-add for duplicate user keys:** the existing two-step `if key not in set: set.add(key)` must become **one locked critical section** (e.g. `add_if_absent(key) -> bool` returning whether the key was newly added), so two threads cannot both observe “absent” and add. Same idea for widget IDs and form IDs if they use check-then-act.

Example helper on the wrapper:

```python
    def add_if_absent(self, item: str) -> bool:
        """Return True if item was inserted, False if already present."""
        with self._lock:
            if item in self._set:
                return False
            self._set.add(item)
            return True
```

Call sites in `elements/lib/utils.py` and `form.py` should use `add_if_absent` (or equivalent) instead of separate `in` + `add`.

### `ThreadSafeTelemetry` (list + Counter, one lock)

```python
from __future__ import annotations

import collections
import threading
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:
    from streamlit.proto.PageProfile_pb2 import Command


class ThreadSafeTelemetry:
    """Guards tracked_commands and tracked_commands_counter together."""

    __slots__ = ("_lock", "_commands", "_counter")

    def __init__(self) -> None:
        self._lock: Final[threading.Lock] = threading.Lock()
        self._commands: list[Command] = []
        self._counter: collections.Counter[str] = collections.Counter()

    def maybe_append_command(
        self,
        command: Command,
        *,
        max_commands: int,
        max_per_command: int,
    ) -> None:
        with self._lock:
            if len(self._commands) >= max_commands:
                return
            name = command.name
            if name not in self._counter or self._counter[name] < max_per_command:
                self._commands.append(command)
            self._counter.update([name])

    def snapshot_commands(self) -> list[Command]:
        with self._lock:
            return list(self._commands)

    def clear_and_reset(self) -> None:
        with self._lock:
            self._commands = []
            self._counter = collections.Counter()
```

Implementation PR can either lift the exact conditionals from `metrics_util.py` into this type (as above) or keep `metrics_util` logic but require it to call a single `with telemetry.lock:` — prefer **one method** so the lock discipline stays encapsulated.

### `reset()` on `ScriptRunContext`

`reset()` (~L147–L162) today assigns fresh `set()` / `list` / `Counter()`. After the change:

- Either replace fields with **new** wrapper instances, or
- Call `clear_and_reset()` on each existing wrapper.

Replacing instances is simpler if any code accidentally retained a reference to the old wrapper (unlikely). Reusing instances avoids extra allocations; pick one style and apply consistently.

### Post-run consumers (snapshots)

| Consumer | Today | After |
|----------|-------|--------|
| `_fragment_storage.clear(new_fragment_ids=ctx.new_fragment_ids)` | `set` | `ctx.new_fragment_ids.snapshot()` or `set(ctx.new_fragment_ids.snapshot())` |
| Page profile / `commands=ctx.tracked_commands` | `list` | `ctx.tracked_telemetry.snapshot_commands()` |
| `on_script_finished(ctx.widget_ids_this_run)` | `set[str]` | Pass `set(ctx.widget_ids_this_run.snapshot())` or widen type to `AbstractSet[str]` |

`session_state.py` (~L597, ~L861–L873) and `safe_session_state.py` should accept any `Collection[str]` or `Iterable[str]` if we want to avoid copying twice; otherwise `set(snapshot)` is fine.

### Performance

- One lock acquisition per widget/form/fragment/metrics touch; same asymptotics as today.
- No cross-field locking except telemetry’s intentional pairing.
- Uncontended locks are cheap; under parallel fragments, expect low contention.

## Alternatives Considered

| Option | Assessment |
|--------|------------|
| **Per-thread sets, merge after join** | Fails for duplicate detection across threads without a different design (global registry with serial merge phase, etc.). Much larger change. |
| **Rely on GIL** | Not a language guarantee; wrong on free-threaded Python. Rejected. |
| **`queue.Queue` for commands** | Thread-safe append, but does not replace `Counter` co-updates; still need locking for “len + counter check + append” together. Adds overhead vs list+lock. |
| **Third-party concurrent collections** | Extra dependency; stdlib locks are sufficient and auditable. |
| **`threading.RLock` instead of `Lock`** | Unnecessary unless re-entrant call paths appear; prefer `Lock` until proven need. |

## Out of Scope

- Broader `ScriptRunContext` immutability or splitting context per thread — separate assessment.
- `ForwardMsgQueue` / `_enqueue` thread safety — separate PR (parallel fragments spec).
- `SafeSessionState` internal refactor — separate work; already synchronized.

## Testing Strategy

### Unit tests (implementation PR)

- **Concurrent set wrapper:** Many threads call `add` / `add_if_absent` / `__contains__` / `snapshot`; assert no lost elements, no `RuntimeError`, snapshot matches expected set.
- **Reset:** After `reset()` or `clear_and_reset()`, snapshot is empty; concurrent use after reset remains safe.
- **Telemetry:** Concurrent `maybe_append_command` (or equivalent); assert command list length and counter totals match single-threaded reference behavior.
- **Stress:** Optional `@pytest.mark.skipif` gated test on `python3.13t` when available in CI.

### Integration / E2E (feature PR, not this spec PR)

- Parallel fragment apps with widgets in multiple fragments; duplicate key / duplicate widget ID errors still fire correctly.
- Full script run then `fragment_storage.clear` and `on_script_finished` behave as today.

This spec PR adds **documentation only**; tests land with the implementation.

## References

- Parallel fragments tech spec: `specs/2026-03-05-parallel-fragments/tech-spec.md`
- Context definition: `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py` (fields ~L92–L104, `reset` ~L136–L178)
- Widget registration bookkeeping: `lib/streamlit/elements/lib/utils.py` (~L142–L148)
- Forms: `lib/streamlit/elements/form.py` (~L224–L226)
- Fragments: `lib/streamlit/runtime/fragment.py` (~L200)
- Metrics: `lib/streamlit/runtime/metrics_util.py` (~L528–L551)
- Runner: `lib/streamlit/runtime/scriptrunner/script_runner.py` (~L691, ~L724, ~L757)
