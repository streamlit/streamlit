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

Install **one persistent, non-running event loop per session** on the script thread and set it
as that thread's current loop for the lifetime of the session.

All changes are in `lib/streamlit/runtime/scriptrunner/script_runner.py`:

- **Ownership.** The loop lives on the `ScriptRunner` instance as `self._event_loop`
  (`asyncio.AbstractEventLoop | None`), one per session. It is not exposed as public API.
- **Create.** In `_run_script_thread` (the script-thread entry point), immediately after the
  `ScriptRunContext` is attached and *before* the rerun loop, `_install_event_loop()` calls
  `asyncio.new_event_loop()` + `asyncio.set_event_loop(loop)`.
- **Non-running by design.** The loop is only *installed*, never run (no `run_forever()` on a
  helper thread). Because it never runs, user `asyncio.run(...)` and
  `loop.run_until_complete(...)` calls keep working with no "loop already running" conflict.
- **Reuse.** The same loop instance is reused across every rerun of the session. Reruns never
  create or close it.
- **Cleanup.** When the script thread stops, `_close_event_loop()` (in a `finally` around the
  rerun loop) best-effort cancels outstanding tasks, runs
  `loop.run_until_complete(loop.shutdown_asyncgens())`, then `loop.close()` and
  `asyncio.set_event_loop(None)`. Everything is wrapped in `try/except` (logged at debug) so
  cleanup can never block session shutdown.

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

## What worked cleanly

- The core change is tiny and self-contained: one field, two small helpers, one re-assert line.
- `asyncio.run()` backward-compat is genuinely unaffected — covered by
  `test_asyncio_run_unaffected_by_persistent_loop`, which asserts both the return value and that
  the persistent loop was not closed mid-run.
- Persistence and re-assert-after-`asyncio.run()` are covered by a single test script
  (`test_data/asyncio_event_loop.py`) that reruns once and captures the loop at the start of
  each run; the two captures are the same object.
- Cleanup on shutdown is deterministic (`test_event_loop_closed_on_shutdown`): the loop is
  closed and `self._event_loop` is reset to `None`.

## Tricky bits / surprises

- **Within-run gap after `asyncio.run()`.** The most subtle point: after a user calls
  `asyncio.run()`, `get_event_loop()` raises again *for the remainder of that same run*, because
  the re-assert only happens at run boundaries. This is acceptable for the #744 crashes (which
  happen at import/construction, before any user `asyncio.run()`), but it is a real edge. A
  production version could additionally re-assert after known unset points, or document it.
- `set_event_loop(None)` (not just closing the temp loop) is what actually breaks things — the
  fix is about *current-loop* state, not loop lifetime.
- `loop.run_until_complete(loop.shutdown_asyncgens())` briefly runs the loop, but only during
  teardown right before `close()`, so it does not violate the "never running during the session"
  property.

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
- **No public helper** to fetch the loop from arbitrary user-spawned threads.
- No async-aware cache decorators and no `nest_asyncio` auto-apply (both out of scope; installing
  a non-running loop is sufficient for the #744 crashes).

## Recommendation

The approach is **viable for a production implementation**. It is minimal, has no measurable
overhead (a loop is created once per session and never run), and cleanly preserves
`asyncio.run()` semantics — the key backward-compat risk. Before productionizing, the team
should decide how to handle the two known gaps: (1) the same-run re-assert gap after
`asyncio.run()`, and (2) parallel-fragment worker threads (per-worker loop installation). Neither
is a blocker for resolving the #744 crash class, which stems from `get_event_loop()` calls at
import/construction time.

## Out of scope (intentionally not built)

- Async-aware cache decorators (separate prototype).
- Running the loop in the background / true concurrent scheduling on the script thread.
- A public helper to fetch the loop from arbitrary user-spawned threads.
- Per-worker loops for parallel fragments.
- `nest_asyncio` auto-apply.
