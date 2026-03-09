---
author: sfc-gh-lwilby
created: 2026-03-05
---

# SafeSessionState Ownership Refactor

## Summary

Move `SafeSessionState` ownership from `ScriptRunner` to `AppSession` so that all session
state access — internal runtime paths and user-facing script code — goes through the
thread-safety lock. This eliminates a data race in `_handle_clear_cache_request()` and is
preparatory work for parallel fragments.

## Problem

### Current Ownership

`SafeSessionState` is a thread-safe wrapper around `SessionState` that serializes access
with an `RLock` and calls a `_yield_callback` at yield points to cooperatively interrupt
scripts. Today, `ScriptRunner` creates the `SafeSessionState` in its `__init__`:

```
AppSession
  ._session_state: SessionState           ← raw, no lock
  .session_state -> SessionState          ← property, exposes raw to callers

ScriptRunner.__init__()
  self._session_state = SafeSessionState(
      session_state,                       ← receives raw from AppSession
      yield_callback=self._maybe_handle_execution_control_request
  )

ScriptRunContext
  .session_state: SafeSessionState        ← set from ScriptRunner._session_state
```

### Race Condition

Three internal code paths access the raw `SessionState` directly, bypassing the lock:

1. **`runtime.py` health check** — polls `session.session_state[KEY]` from the async event
   loop. Not concurrent in practice (one-shot session), but still bypasses the lock.
2. **`SessionStateStatProvider.get_stats()`** — reads raw `SessionState` for metrics.
   Read-only but lock-free.
3. **`AppSession._handle_clear_cache_request()`** — calls `self._session_state.clear()`,
   mutating four internal dicts without the lock. **This can race with a script thread**
   writing through `SafeSessionState`.

The third case is a real bug: `SessionState.clear()` mutates `_old_state`,
`_new_session_state`, `_new_widget_state`, and `_key_id_mapper`. If a script thread
iterates or writes to these dicts concurrently (via `SafeSessionState`, which does acquire
the lock), the result can be `RuntimeError: dictionary changed size during iteration` or
`KeyError`. Under free-threaded Python (PEP 703 / no-GIL), this becomes a true data race
with potential memory corruption.

This race affects **both** server implementations (Tornado and Starlette) because they both
route through the same `Runtime.handle_backmsg()` → `AppSession._handle_clear_cache_request()`
code path.

### Why This Matters for Parallel Fragments

Parallel fragments will run multiple fragment threads concurrently, all sharing the same
`SessionState`. The current model where only the script runner thread accesses session state
becomes insufficient — the `SafeSessionState` lock must protect all access, including from
`AppSession` itself.

---

## Proposal

### Target Ownership

```
AppSession
  ._session_state: SessionState           ← raw, private, never exposed
  ._safe_session_state: SafeSessionState  ← wraps raw, owns the lock
  .session_state -> SafeSessionState      ← property, all callers get safe wrapper

ScriptRunner.__init__()
  (receives SafeSessionState from AppSession, no longer creates it)

ScriptRunContext
  .session_state: SafeSessionState        ← same object as AppSession's
```

### Changes

#### 1. `SafeSessionState` — add missing methods

Add `clear()` and `get_stats()` so that callers that previously accessed raw `SessionState`
for these operations can go through the safe wrapper. Fix `__repr__` to acquire the lock.

```python
def clear(self) -> None:
    with self._lock:
        self._state.clear()

def get_stats(self, _family_names=None) -> dict[str, list[CacheStat]]:
    with self._lock:
        return self._state.get_stats(_family_names)

def __repr__(self) -> str:
    with self._lock:
        kv = ((k, self._state[k]) for k in self._state._keys())
        s = ", ".join(f"{k}: {v!r}" for k, v in kv)
        return f"{{{s}}}"
```

#### 2. `AppSession` — create `SafeSessionState` in `__init__`

The `yield_callback` must point to the current `ScriptRunner`'s
`_maybe_handle_execution_control_request`, but `ScriptRunner` is created and destroyed on
each rerun. Solved with an indirection via a static method and a weakref to avoid preventing
garbage collection of the `AppSession`:

```python
# In AppSession.__init__:
self._session_state = SessionState()
weak_self = weakref.ref(self)
self._safe_session_state = SafeSessionState(
    self._session_state,
    yield_callback=lambda: AppSession._yield_to_scriptrunner_static(weak_self),
)

@staticmethod
def _yield_to_scriptrunner_static(weak_self):
    session = weak_self()
    if session is not None:
        runner = session._scriptrunner
        if runner is not None:
            runner._maybe_handle_execution_control_request()
```

When no runner exists (between runs, health check, cache clear), the callback is a no-op.

The `session_state` property return type changes from `SessionState` to `SafeSessionState`.

#### 3. `AppSession._handle_clear_cache_request` — use safe wrapper

```python
def _handle_clear_cache_request(self) -> None:
    caching.cache_data.clear()
    caching.cache_resource.clear()
    self._safe_session_state.clear()   # was self._session_state.clear()
```

#### 4. `ScriptRunner` — accept `SafeSessionState`

The `session_state` parameter type changes from `SessionState` to `SafeSessionState`.
The `ScriptRunner` no longer wraps it — it uses the instance passed by `AppSession`.

#### 5. `SessionStateStatProvider` — no code change

`AppSession.session_state` now returns `SafeSessionState`, which has `get_stats()`.
The stat provider's `session_state.get_stats()` call works transparently.

#### 6. `runtime.py` health check — no code change

Uses `__contains__` and `__getitem__`, both available on `SafeSessionState`.

### Files Modified

| File | Change |
|------|--------|
| `lib/streamlit/runtime/state/safe_session_state.py` | Add `clear()`, `get_stats()`, fix `__repr__` |
| `lib/streamlit/runtime/app_session.py` | Create `SafeSessionState` in `__init__`, add `_yield_to_scriptrunner_static`, update property type, update `_handle_clear_cache_request` |
| `lib/streamlit/runtime/scriptrunner/script_runner.py` | Accept `SafeSessionState` param, remove wrapping |
| `lib/streamlit/testing/v1/local_script_runner.py` | Pass `SafeSessionState` to parent `ScriptRunner` (was unwrapping to raw `_state`) |
| `lib/tests/streamlit/runtime/scriptrunner/script_runner_test.py` | Pass `SafeSessionState` to `TestScriptRunner` |
| `lib/tests/streamlit/runtime/app_session_test.py` | Update type assertions and internal field references |

### What Does NOT Change

- `SessionStateProxy` / `get_session_state()` — already return `SafeSessionState` via
  `ScriptRunContext`. No changes needed.
- The `RLock` itself — keep as-is. The existing TODO to downgrade to `Lock` is orthogonal.
- `testutil.py` and `app_test.py` — already construct `SafeSessionState` directly.

### Implementation Note: Weakref for GC

The `_yield_callback` stored in `SafeSessionState` must not hold a strong reference to
`AppSession`, because `SafeSessionState` is owned by `AppSession`. A bound method like
`self._yield_to_scriptrunner` would create a reference cycle that prevents `AppSession`
from being garbage collected (existing tests verify this property). The solution is a
`weakref.ref` to `self` captured in a lambda, with a static method that dereferences it.

---

## Checklist

| Item                         | ✅ or comment                                                   |
|------------------------------|-----------------------------------------------------------------|
| Works on SiS, Cloud, etc?   | ✅ No platform-specific code; both Tornado and Starlette fixed  |
| No breaking API changes      | ✅ `AppSession.session_state` type narrows from `SessionState` to `SafeSessionState`; `SafeSessionState` is a superset of `SessionState`'s public interface |
| No new dependencies          | ✅                                                               |
| Metrics collected            | N/A — internal refactor, no user-facing behavior change         |
| Any security/legal impact?   | ✅ Fixes a data race (improvement)                              |
| Any docs changes needed?     | No — internal only                                              |
