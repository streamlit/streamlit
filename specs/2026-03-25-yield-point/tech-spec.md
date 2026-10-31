---
author: sfc-gh-lwilby
created: 2026-03-25
---

# st.yield_point — Cooperative cancellation checkpoint

## Summary

This spec defines `st.yield_point()`, a no-UI imperative API in the same family as
`st.rerun()` and `st.stop()`. It gives user code an explicit place to observe pending
execution-control requests (full-app rerun, stop, and — with parallel fragments —
coordinator cancellation) without enqueueing a `ForwardMsg`. The spec covers a
**streamlit-extras** prototype (pure Python, no frontend) to validate naming and usage,
then a **Streamlit core** implementation wired to `ScriptRunner` and parallel-fragment
cancellation. Related discussion: [streamlit/streamlit#14523](https://github.com/streamlit/streamlit/issues/14523).

## Problem

### Yield points today

Streamlit interrupts running scripts when a rerun or stop is pending by checking at
**yield points**. Most `st.*` calls eventually enqueue a `ForwardMsg`; on each enqueue,
`ScriptRunContext` invokes `ScriptRunner._enqueue_forward_msg()`, which calls
`_maybe_handle_execution_control_request()`. That method consults
`ScriptRequests.on_scriptrunner_yield()` and raises `RerunException` or `StopException`
when appropriate. See `lib/streamlit/runtime/scriptrunner/script_runner.py` (e.g.
`_enqueue_forward_msg` and `_maybe_handle_execution_control_request`, ~L402–453).

`SafeSessionState` also invokes a `yield_callback` (the same execution-control check) on
session-state mutations, so `st.session_state[...]` acts as an additional implicit yield
point (`lib/streamlit/runtime/state/safe_session_state.py`).

**Gap:** If user code spends a long time in a tight CPU loop, blocking I/O, or library
code that never touches `st.*` or `st.session_state`, there are **no** yield points. The
script cannot observe a pending rerun or stop until that stretch finishes. Users sometimes
insert `st.empty()` inside loops as a workaround because it enqueues a delta and triggers
the check — but that is non-obvious, pollutes the element tree, and misuses a display API
for control flow.

### Parallel fragments amplify the issue

Parallel fragments (`@st.fragment(parallel=True)` — see
[tech spec: parallel fragments](../2026-03-05-parallel-fragments/tech-spec.md)) use a
`ParallelFragmentCoordinator` with a `_cancel_event`. When one thread calls
`st.stop()` or `st.rerun(scope="app")`, the coordinator signals siblings; each sibling
is expected to notice cancellation at its **next** yield point (typically the next
`st.*` call). The join barrier polls `_yield_check()` (again tied to script-runner yield
logic) while waiting for worker threads.

**Problem:** A worker blocked for tens of seconds on a database call does not run any
`st.*` until the call returns, so cancellation and join latency are bounded by the
slowest blocking operation, not by user-chosen checkpoints.

| Scenario | Without `yield_point` | With `yield_point` |
|----------|----------------------|---------------------|
| Main thread tight loop | Stuck until loop ends | Interrupts at next call |
| Parallel fragment after I/O | Stuck until next `st.*` | Can check after I/O returns |
| Rerun during join | Threads may be stuck in I/O | Faster unwind if loops call `yield_point` |

`st.yield_point()` closes this gap: an explicit, semantic checkpoint that runs the same
logic as an implicit yield after a `ForwardMsg`, extended so **non-script** threads
(particularly parallel fragment workers) can observe coordinator cancellation.

### Related issues

- [#14523](https://github.com/streamlit/streamlit/issues/14523) — Feature request for
  `st.yield_point()`.
- [#2838](https://github.com/streamlit/streamlit/issues/2838) — Triggering rerun from
  another thread (high interest). `st.yield_point()` is the complementary direction:
  observing pending interrupts **from within** a running thread cooperatively.

## Proposal

### Public API (target shape)

```python
def yield_point() -> None:
    """Cooperative checkpoint for pending rerun/stop (and fragment cancellation).

    Does not render UI or enqueue a ForwardMsg. When a full-app rerun or stop is
    pending (per ScriptRequests), raises the same exceptions as other yield points.
    When only non-preempting fragment-scoped work is pending, returns immediately.
    In parallel fragment worker threads, also observes coordinator cancellation.
    Outside an active Streamlit script context, no-op.
    """
```

**Behavior (normative intent):**

1. **Main script thread / sequential fragments:** Call the same execution-control path
   used when enqueueing a `ForwardMsg` — i.e. consult `ScriptRequests.on_scriptrunner_yield()`
   and raise `RerunException` / `StopException` when that layer returns a request. Respect
   existing fragment-scoped rerun rules: if the pending rerun would not preempt the
   current script run (see `_fragment_run_should_not_preempt_script` in
   `script_requests.py`, ~L250–291), return without raising.

2. **Parallel fragment worker threads:** Not on the script thread, so the current
   `_maybe_handle_execution_control_request()` early-return path applies today. Extend
   behavior so these threads can still **exit cooperatively** when the parallel
   coordinator has been cancelled (and when a full-app rerun/stop should tear down
   workers). Concretely, align with the sketch:

   ```python
   def _maybe_handle_execution_control_request(self) -> None:
       if not self._is_in_script_thread():
           ctx = get_script_run_ctx()
           if ctx and ctx.parallel_coordinator.is_cancelled():
               raise StopException()
           return
       # ... existing ScriptRequests logic ...
   ```

   `st.yield_point()` should invoke this unified check (or a shared helper) so worker
   threads see cancellation without enqueueing UI.

3. **Outside Streamlit context:** No-op — no exceptions, no side effects (same spirit as
   other APIs that guard on missing `ScriptRunContext`).

4. **Performance:** Hot path is “no pending request”: should reduce to the same fast path
   as `on_scriptrunner_yield()` (single lock acquisition when state is CONTINUE or
   non-preempting fragment rerun) plus coordinator flag read for worker threads.

### streamlit-extras prototype

Before landing in core, ship a **pure Python** extra in
[streamlit/streamlit-extras](https://github.com/streamlit/streamlit-extras) to validate
the API name, docs, and real-app usage. No protobuf or frontend changes.

**Packaging:** Follow existing extras conventions: `@extra` decorator on the public
function, module-level `__title__` and `__desc__`, register the subpackage so it appears
in the gallery/tests (see e.g. `streamlit_extras/stoggle/__init__.py`).

**Design question:** Core wires yield checks through `ScriptRunner` instance methods.
Extras cannot rely on private `ScriptRunner` APIs long-term. Options:

**Option A: Callback on `ScriptRunContext` — preferred for alignment with core**

- Add a `yield_check: Callable[[], None] | None` (or similar) on `ScriptRunContext`,
  populated by `ScriptRunner` alongside the coordinator’s `yield_check` (same callable:
  `_maybe_handle_execution_control_request` once extended for worker threads).
- Prototype in extras: `get_script_run_ctx()` → if ctx and `ctx.yield_check`, call it;
  else no-op.
- **Pros:** Matches `ParallelFragmentCoordinator`’s injection pattern; stable once core
  adds the field; extras stay thin.
- **Cons:** Requires a small **core** change (context field + wiring) even for the
  prototype, unless the prototype is documented as “requires nightly / specific Streamlit
  version” — team should decide whether the extras release targets `develop` only or
  gates on version.

**Option B: Implement via `st.empty()` internally**

- Extras `yield_point()` calls `st.empty()` (or another minimal delta) to force
  `_enqueue_forward_msg` and thus the existing yield check on the **script thread only**.
- **Pros:** Works on released Streamlit without new context fields; trivial to ship.
- **Cons:** Creates an invisible element per call (layout/hydration noise); **does not**
  solve parallel worker cancellation (workers should not enqueue arbitrary deltas from
  the wrong thread); semantically wrong for a “no UI” API.

**Option C: Import ScriptRunner / runtime internals**

- Reach into `streamlit.runtime.scriptrunner...` private symbols.
- **Pros:** Might avoid new context API in the short term.
- **Cons:** Fragile across releases; discouraged for extras meant for broad use.

**Recommendation:** For **released** Streamlit compatibility, Option B is a poor fit for
parallel fragments and for honest “no UI” semantics. Prefer **Option A** with an explicit
note in the extras README: minimum Streamlit version once the context hook ships, or ship
extras prototype behind a feature flag / `try/except ImportError` for the new attribute.
If the team wants zero core changes first, document Option B as **main-thread-only**
stopgap with bold warnings.

**Migration:** When core adds `st.yield_point()`, extras can deprecate the extra in favor
of `import streamlit as st; st.yield_point()`, or make the extra a one-line forwarder for
older Streamlit versions.

### Streamlit core implementation

1. **Module:** Add `lib/streamlit/commands/yield_point.py` (or fold into
   `execution_control.py` next to `stop` / `rerun` if maintainers prefer one module —
   this spec names a dedicated file per issue discussion).

2. **Export:** Register in `lib/streamlit/__init__.py` and the appropriate command
   re-export / `DeltaGenerator` mixin if other imperative commands use that pattern
   (mirror `stop` / `rerun`).

3. **Implementation:** Obtain `ScriptRunContext` via `get_script_run_ctx()`. Invoke the
   shared execution-control check (extended `_maybe_handle_execution_control_request` or
   extracted `run_yield_point_check(ctx)` used by both `ScriptRunner` and the public
   command). Ensure thread identity and `_execing` semantics remain correct — calling
   `yield_point()` from the main script thread while `exec()` is active must behave like
   a ForwardMsg yield; from a worker, coordinator + eventual ScriptRequests rules apply
   as designed.

4. **Typing:** Return `None`; do not use `NoReturn` (unlike `stop()`), since the call
   usually returns.

5. **Documentation:** User-facing docstring emphasizes cooperative cancellation, loops,
   and parallel fragments; notes that blocking I/O cannot be interrupted mid-call
   (only after return + `yield_point()`).

### Testing strategy (for implementation PRs)

**Unit tests** (`lib/tests/streamlit/...`):

- Pending full-app rerun: `yield_point()` raises `RerunException` with expected
  `RerunData`.
- Pending stop: raises `StopException`.
- Non-preempting fragment-scoped rerun only: returns `None`.
- No pending request: returns `None`; verify minimal overhead / lock behavior if needed.
- Parallel fragment thread (mock coordinator): when `is_cancelled()`, raises
  `StopException`; when not cancelled and no rerun, returns `None`.
- No `ScriptRunContext`: no-op, no exception.

**E2E tests** (`e2e_playwright/`):

- App with a long-running loop and `yield_point()` in the loop; widget interaction
  schedules rerun; assert UI updates within a bounded time (not after full loop).
- Parallel fragment scenario (once feature exists): cancellation responsiveness with
  `yield_point()` after simulated work.

**Typing tests:** `lib/tests/streamlit/typing/` entry asserting `yield_point` is callable
and returns `None`.

This spec PR does not add those tests; implementation PRs should.

## Alternatives Considered

### Workarounds

- **`st.empty()` in loops** — Works only on the script thread; side effects on element
  tree; poor discoverability. Rejected as the long-term answer.
- **Frequent `st.session_state` touches** — Couples control flow to state access; same
  parallel-thread limitations for workers.

### Naming

- **`st.yield_point()`** — Accurate for Streamlit internals (“yield” matches
  `on_scriptrunner_yield`); may sound like generator `yield` to some Python users.
  Docstring can disambiguate.
- **`st.checkpoint()`** — Friendly but overloaded (checkpoints in ML, transactions).
- **`st.cooperate()`** — Vague; doesn’t signal “check for rerun/stop”.

**Recommendation:** `st.yield_point()` unless user research favors something clearer for
app authors.

### Automatic yield injection

- **`sys.settrace` / bytecode rewriting / periodic timers** — Could insert checks without
  user calls. **Rejected for v1:** high complexity, debugger interactions, non-deterministic
  performance, and unclear semantics on worker threads.

### Stronger interruption

- **SIGALRM / thread.kill** — Not portable; unsafe with locks and native extensions.
  Out of scope for cooperative API.

## Out of scope (future work)

- **`st.background_task()`** or a full task queue — Different lifecycle from script runs.
- **`st.request_rerun()` from arbitrary threads** — See #2838; not solved by
  `yield_point()` alone.
- **Automatic insertion of yield points** — Compiler/runtime magic; see above.
- **Rerun-resilient streaming** — Long-running generators and resumable streams across
  reruns.
- **Guaranteed maximum latency** — Still depends on user code calling `yield_point()`;
  blocking syscall cannot be cut short without OS/async patterns.

## References

- `lib/streamlit/runtime/scriptrunner/script_runner.py` — `_enqueue_forward_msg`,
  `_maybe_handle_execution_control_request`
- `lib/streamlit/runtime/scriptrunner_utils/script_requests.py` —
  `on_scriptrunner_yield`
- `lib/streamlit/runtime/state/safe_session_state.py` — `yield_callback`
- [Parallel fragments tech spec](../2026-03-05-parallel-fragments/tech-spec.md)
