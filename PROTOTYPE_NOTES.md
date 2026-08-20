# Prototype: persistent event loop on the script thread

Prototype for [#744](https://github.com/streamlit/streamlit/issues/744). Streamlit runs user
code on a dedicated non-main thread (`ScriptRunner.scriptThread`). On CPython only the main
thread gets an implicit asyncio event loop, so any library that calls
`asyncio.get_event_loop()` at import or construction time crashes on the script thread with:

```
RuntimeError: There is no current event loop in thread 'ScriptRunner.scriptThread'.
```

This was reproduced directly against the unmodified code before implementing the fix.

## Approach

Install **one persistent, non-running event loop per session** on the script thread, owned by
`AppSession` for the full lifetime of the session.

Changes span two files:

- `lib/streamlit/runtime/app_session.py` — loop ownership and lifecycle.
- `lib/streamlit/runtime/scriptrunner/script_runner.py` — loop installation and re-assertion.

### Ownership: `AppSession._script_thread_event_loop`

- Created once in `AppSession.__init__` via `asyncio.new_event_loop()`.
- Passed into every new `ScriptRunner` via the `event_loop` constructor parameter.
- Closed (with best-effort task cancellation and `shutdown_asyncgens`) in `AppSession.shutdown()`
  — **not** on `request_script_stop()` (the reconnect path), so the loop survives transient
  disconnects and fastRerun `ScriptRunner` churn.
- If user code calls `loop.close()` mid-session, `_create_scriptrunner` detects the closed loop
  and recreates it before starting the next runner (defensive, best-effort).

### Installation: `ScriptRunner._install_event_loop`

- Called once per script thread, before the first run.
- Sets the provided loop as the script thread's current loop via `asyncio.set_event_loop(loop)`.
- Creates a new loop as fallback if none was provided or if the provided loop is already closed.
- The runner **never closes** the loop; the owner (`AppSession`) is responsible.

### Re-assertion: `ScriptRunner._run_script`

At the top of each run inside the rerun loop, `_run_script` re-asserts:

```python
if self._event_loop is not None:
    asyncio.set_event_loop(self._event_loop)
```

This is necessary because `asyncio.run()` calls `asyncio.set_event_loop(None)` in its `finally`
block after each invocation, which would otherwise leave the thread without a current loop.

### Thread exit

When the script thread finishes, `_run_script_thread` calls `asyncio.set_event_loop(None)` to
clean up thread-local state and clears `self._event_loop = None` to release the reference. The
loop itself is not touched here.

## The `asyncio.run()` re-assert (the important bit)

`asyncio.run()` creates its **own** temporary loop, runs the coroutine, and in its `finally`
block calls `asyncio.set_event_loop(None)` and closes *that temporary loop*. It does **not**
touch our persistent loop object — but it does leave the thread with **no current loop**.

Verified behavior on a non-main thread with our loop installed:

| Step | `asyncio.get_event_loop()` result |
|------|-----------------------------------|
| After `_install_event_loop()` | persistent loop ✓ |
| Immediately after `asyncio.run(coro())` (same run) | **RuntimeError** (loop was unset) |
| After re-assert `set_event_loop(self._event_loop)` | persistent loop ✓ |

`asyncio.run()` itself returns correctly (e.g. `42`) and our persistent loop is **not** closed.

To keep the persistent loop current across this, `_run_script` re-asserts
`asyncio.set_event_loop(self._event_loop)` at the **start of each script run** (top of the
rerun `while` loop). So the guarantee is: *at the start of every run, the persistent loop is
current.* A user's `asyncio.run()` in one run leaves the loop unset only until the next run's
re-assert restores it.

## Caching contract

The loop has true per-session lifetime under `AppSession` ownership.

**Supported:**
- Async client built each run, held in `st.session_state` — valid for the whole session; survives
  full reruns and transient websocket reconnects.
- Async client cached with `@st.cache_resource(scope="session")` — same guarantee.

**Unsupported (for now):**
- Globally cached (`scope="global"`, the default) loop-bound clients shared across sessions — the
  loop is per-session, so a global cache entry created on one session's loop will not work on
  another session's loop. Deferred to [#12076](https://github.com/streamlit/streamlit/issues/12076)
  / async-aware caching. **Do not** try to fix cross-session global cache here.

## What worked cleanly

- Ownership is a one-liner in `AppSession.__init__` and a parameter thread in
  `_create_scriptrunner`.
- `asyncio.run()` backward-compat is genuinely unaffected — covered by
  `test_asyncio_run_unaffected_by_persistent_loop`, which asserts both the return value and that
  the persistent loop was not closed mid-run.
- Same-loop identity across sequential `ScriptRunner`s (fastRerun) is covered by
  `test_same_loop_across_sequential_scriptrunners`.
- Loop closure on true session shutdown (not on reconnect) is covered by
  `test_script_thread_event_loop_closed_on_shutdown` and
  `test_script_thread_event_loop_not_closed_before_shutdown`.
- No `finally`-close in `ScriptRunner` means the loop survives runner churn without any extra
  synchronisation.

## Tricky bits / surprises

- **Within-run gap after `asyncio.run()`.** The most subtle point: after a user calls
  `asyncio.run()`, `get_event_loop()` raises again *for the remainder of that same run*, because
  the re-assert only happens at run boundaries. This is acceptable for the #744 crashes (which
  happen at import/construction, before any user `asyncio.run()`), but it is a real edge. A
  production version could additionally re-assert after known unset points, or document it.
- `set_event_loop(None)` (not just closing the temp loop) is what actually breaks things — the
  fix is about *current-loop* state, not loop lifetime.
- `loop.run_until_complete(loop.shutdown_asyncgens())` briefly runs the loop during teardown
  (in `_close_script_thread_event_loop`), but only after all script threads have been stopped, so
  it does not violate the "never running during the session" property.
- fastReruns serialisation: the old `ScriptRunner` may still be dying on its thread when the new
  one starts. Since `asyncio.set_event_loop` is thread-local, both threads can install the same
  loop object without conflict. The loop is never *run*, so concurrent install calls are safe.

## Limitations of the prototype

- **`asyncio.get_running_loop()` still fails.** Libraries that call `get_running_loop()` (as
  opposed to `get_event_loop()`) at import/construction still raise, because our loop is
  installed but not running. Fixing that would require actually running a loop, which is out of
  scope.
- **Same-run re-assert gap** after user `asyncio.run()` / `set_event_loop(None)`, described
  above.
- **Parallel-fragment worker threads are not covered.** Fragments that run on worker threads
  (see `ParallelFragmentCoordinator`) do not get a per-worker loop installed, so
  `get_event_loop()` on those threads still raises. Per-worker loops are explicitly out of scope
  for this prototype.
- **Global cache** (`@st.cache_resource` with default `scope="global"`) loop-bound clients are
  not supported across sessions (see caching contract above).
- **No public helper** to fetch the loop from arbitrary user-spawned threads.
- No async-aware cache decorators and no `nest_asyncio` auto-apply (both out of scope; installing
  a non-running loop is sufficient for the #744 crashes).

## Recommendation

The approach is **viable for a production implementation** with the `AppSession` ownership model.
It is minimal, has no measurable overhead (a loop is created once per session and never run), and
cleanly preserves `asyncio.run()` semantics — the key backward-compat risk. The loop now survives
fastRerun `ScriptRunner` churn and transient reconnects, satisfying the session-state and
session-scoped cache use cases. Before productionizing, the team should decide how to handle the
two known gaps: (1) the same-run re-assert gap after `asyncio.run()`, and (2) parallel-fragment
worker threads (per-worker loop installation). Neither is a blocker for resolving the #744 crash
class, which stems from `get_event_loop()` calls at import/construction time.

## Out of scope (intentionally not built)

- Async-aware cache decorators (separate prototype, see #12076).
- Running the loop in the background / true concurrent scheduling on the script thread.
- A public helper to fetch the loop from arbitrary user-spawned threads.
- Per-worker loops for parallel fragments.
- `nest_asyncio` auto-apply.
- Cross-session global cache support for loop-bound objects.
