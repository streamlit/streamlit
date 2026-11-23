---
author: sfc-gh-lwilby-1
created: 2026-10-07
status: implemented
---

# Cancellable cache waits

## Summary

When a cached function misses, the first caller computes the value while every other
caller for the same key waits on a per-key lock. That wait cannot be interrupted, so when
a rerun abandons a run, the abandoned run's waiting threads stay asleep until the
computation finishes. This spec makes the wait a yield point, the same check every `st.*`
call already makes, so an abandoned run stops waiting within 100 ms. The thread computing
the value and the waiters in the run the user can see are unchanged. There is no API change.

The goal is narrow: bound the number of threads a server accumulates under repeated reruns.
It does not make live cache values arrive faster or provide a new way to run work in the
background.

## Problem

### How a cache miss waits today

`CachedFunc._handle_cache_miss` takes the key's lock and holds it while the user's
function runs (`lib/streamlit/runtime/caching/cache_utils.py`):

```python
with cache.compute_value_lock(value_key):
    # Re-read: another thread may have stored the value while we waited.
    ...
    computed_value = self._info.func(*func_args, **func_kwargs)
    return self._store_computed_value(cache, value_key, computed_value)
```

The lock is per cached function and per hashed arguments, so only callers asking for the
exact same entry wait on it. The first caller to get it computes. Everyone else sleeps in
`Lock.acquire()` with no timeout, then wakes, finds the stored value, and returns it.
Background refresh uses the same lock, but only with a non-blocking acquire. `async def`
cached functions use a separate future and never take this lock.

### Why abandoned runs stay alive

A run finds out that it has been stopped or replaced only at a yield point. Every `st.*`
call is one: enqueueing a message calls
`ScriptRunner._maybe_handle_execution_control_request()`, which raises `StopException` or
`RerunException` if the run should end. A thread asleep in `Lock.acquire()` never reaches a
yield point, so:

- **Main script.** With `runner.fastReruns` (on by default), a full rerun stops the current
  `ScriptRunner` and starts a new script thread. The old script thread, if it is waiting on
  the lock, stays asleep until the computation finishes.
- **Parallel fragments.** The abandoned run's script thread calls
  `ParallelFragmentCoordinator.drain()`, which sets the run's stop flag and then joins the
  pool with `shutdown(wait=True)`. Workers asleep on the lock never check that flag, so the
  script thread and the run's pool stay until the computation finishes.

Every click during a long cold computation therefore adds one more abandoned run to the
pile. The threads are released when the computation returns, so this is a peak, not a
leak. But the peak grows with `sessions × clicks during the computation`, not with the work
being done.

### Measurements

Measured on an Apple M4 Pro (14 cores, 24 GiB), idle server at 7–8 threads. "Fragments"
means three `@st.fragment(parallel=True)` fragments calling one cached function.

| Case | Compute | Peak threads |
|---|---|---|
| Fragments, 4 sessions × 5 clicks (load test) | 10 s sleep | 168 |
| Fragments, 8 sessions × 5 clicks (load test) | 10 s sleep | 304 |
| Fragments, 4 sessions × 5 clicks (experiment) | 8 s sleep | 113 |
| Main script, 4 sessions × 5 clicks (experiment) | 8 s sleep | 43 |

With three fragments, each abandoned run cost about 8 threads, and the count stayed linear
up to 48 overlapping runs. Computation length did not change the peak (3 s, 10 s, and 20 s
all peaked at 168–173 threads), and `runner.parallelMaxWorkers` did not cap it, because
that option limits workers within one run, not across abandoned runs.

Clicks stayed fast throughout (under 120 ms p95). The risk is the thread ceiling: 6144 per
process on macOS, and usually far fewer in a container, where the cgroup `pids.max` limit
is shared with every other process. This applies to every synchronous `@st.cache_data` and
`@st.cache_resource` miss, including cold and hard-expired keys under
`refresh_mode="background"`.

## Proposal

### Behavior

A thread that misses on a key is in one of three roles. Only the third changes.

| Role | Today | Proposed |
|---|---|---|
| **Owner**: holds the lock and runs the function | Runs to completion and stores the value | Unchanged |
| **Waiter in a live run** | Waits, then returns the stored value | Unchanged |
| **Waiter in an abandoned run** | Waits until the owner finishes | Raises the run's `StopException` or `RerunException` within 100 ms |

The owner keeps running so the value is computed and stored, and waiters in a live run
keep waiting so they render it when it arrives.

### Mechanism

The sketches below convey the approach, not the final code. See the
[implementation plan](#implementation-plan) for the authoritative, file-by-file steps and
tests to follow when building this.

While waiting, the thread polls the lock and runs the same yield check that `st.*` calls
run:

```python
_COMPUTE_LOCK_POLL_SECONDS: Final = 0.1


@contextlib.contextmanager
def _hold_compute_lock(lock: threading.Lock) -> Iterator[None]:
    yield_check = None
    if not lock.acquire(blocking=False):
        yield_check = (
            None
            if in_cached_function.get()
            else script_run_context.get_run_yield_check()
        )
        if yield_check is None:
            lock.acquire()
        else:
            while not lock.acquire(timeout=_COMPUTE_LOCK_POLL_SECONDS):
                yield_check()
    try:
        if yield_check is not None:
            yield_check()
        yield
    finally:
        lock.release()
```

`_handle_cache_miss` uses `_hold_compute_lock(cache.compute_value_lock(value_key))` in
place of `with cache.compute_value_lock(value_key):`.

This adds no hot-path cost: a hit never reaches it, and an uncontended miss still takes the
lock with one non-blocking acquire and never fetches the context — only a thread that
actually has to wait runs the loop.

#### The yield check

The yield check is `ScriptRunner._maybe_handle_execution_control_request`, the callable
already run at every `st.*` yield point. It dispatches on the calling thread and raises the
correct exception for that thread:

- On the script thread, it consumes a pending stop or rerun request and raises
  `StopException` or `RerunException`.
- On a parallel-fragment worker, it raises `StopException` once the run's coordinator has
  been told to stop, which `drain()` does when a run is abandoned.

Cache code **delegates** to this callable rather than raising `StopException` itself. That is
what makes an abandoned main-script wait able to rerun (not only stop), and keeps a worker
from ever raising a rerun it cannot service.

#### How cache code reaches it

The callable already flows into `ScriptRunContext.reset(yield_check=...)` and from there
into `ParallelFragmentCoordinator`. The change also stores it on the context as a field, and
adds a module-level helper in `script_run_context.py`:

```python
def get_run_yield_check() -> Callable[[], None] | None:
    ctx = get_script_run_ctx(suppress_warning=True)
    return ctx.yield_check if ctx is not None else None
```

`get_script_run_ctx()` returns the context of the **waiting** thread's run, not the owner's
— the waiter and the owner are different threads. So the check a waiter runs belongs to the
waiter's own run, and interrupting it leaves the owner's computation untouched. For a
parallel-fragment worker, the parent run's context is attached to the worker thread
(`_scoped_ctx_attach`), so this is still the waiter's own run. A thread with no context
(background refresh, the task pool, user-created threads) gets `None` and waits exactly as
today.

The `in_cached_function` guard and the `None` handling stay in `cache_utils`, so the context
does not need to know about caching. The helper is fetched once, after the non-blocking
acquire fails, and reused for the wait; the thread's context does not change mid-wait.

### Nested cached functions

A cached function can call another cached function. A thread waiting on the inner key is
the owner of the outer key. If its run is abandoned and the inner wait raised, the outer
computation would be thrown away, and the live run waiting on the outer key would have to
start it again. So the wait is not interruptible while the thread is inside a cached
function: `_hold_compute_lock` skips the yield check when `in_cached_function` is set, as
shown above.

A cached function that calls `st.*` is already interruptible at that call today. This
change does not add new interruption points inside cached functions.

### What changes for users

Almost nothing is observable from app code. Hits, owners, live waiters, background refresh,
and `async def` cached functions behave exactly as today. The only user-noticeable changes:

- A cached call that has to wait is now an interrupt point, like any `st.*` call. Code that
  catches `BaseException` around it can see `StopException` or `RerunException`.
  `except Exception` is unaffected: both derive from `BaseException`.
- With `runner.fastReruns = false`, a rerun requested while the script thread waits on a
  cold key now restarts the script promptly instead of looking frozen until the computation
  finishes. This has no negative effect: under `fastReruns = false` a rerun is already
  delivered at the next `st.*` yield point, so every `st.*` call is a preemption point
  already — the blocking cache wait was the one spot that was not. Making it a yield point
  only closes that gap. The owner is never interrupted (it is not at the wait point and is
  `in_cached_function`-guarded), so no computation is wasted; the restarted run waits on the
  same key and still gets the value when the owner stores it.

### Expected effect

What matters is how the thread peak scales.

Today it scales with `sessions × clicks during the computation`. Each click on a run with a
cold miss leaves another abandoned run asleep on the lock until the compute finishes, so the
peak keeps climbing as long as users rerun (the measurements above).

After the change, an abandoned run stops within 100 ms, so reruns no longer pile up. The peak
scales instead with the number of concurrent sessions: at most one live waiting run per
viewer, plus the owner's run for each in-flight key until it finishes, plus a small transient
overlap from abandoned runs still shutting down within their 100 ms window. Live runs still
wait, so every viewer's page still fills in on its own when the value arrives — the change
removes abandoned waiters, not live ones.

Exact figures are verified against the implementation by the tests in the
[implementation plan](#implementation-plan) (steps 3–6) and the before-and-after thread
measurement (step 7).

## Alternatives considered

### Run cold computations on a pool and rerun subscribers on completion

The owner submits the function to a process-wide pool and every caller returns
immediately; when the value is stored, each session that asked for it is rerun. This bounds
threads by the pool size and also makes a cold miss non-blocking.

Rejected as the fix for this problem because it changes much more than the wait:

- The function runs without a script context.
- The call needs a non-value return for "not ready yet".
- Errors surface on a later run.
- Distinct keys queue behind the pool.
- `@st.cache_resource` objects that only work on the thread that created them break.
- `AppTest` needs to wait for completion.

A prototype also lost the completion rerun for one fragment in 7 of 62 sessions. That
design is still worth pursuing for non-blocking cold starts, as a product decision of its
own. Until then, users can already approximate it by calling the cached function inside a
`@st.fragment(parallel=True)` fragment: the cold compute runs off the main script thread, so
the rest of the page stays responsive and that fragment fills in on its own when the value
is ready.

### Wake waiters on stop instead of polling

Replace the per-key `threading.Lock` with a small record holding a `threading.Condition`.
Each run registers a callback that notifies the conditions its threads are waiting on when
the run stops, so waiters leave instantly instead of within 100 ms.

Rejected: it buys nothing here. The only gain over polling is shaving up to 100 ms off how
fast an abandoned waiter leaves, plus avoiding a periodic wake-up — both negligible next to
the compute it is waiting on and the threads it frees. Against that it needs more code and
has to preserve background refresh, which acquires the lock without blocking and hands it to
a pool worker that releases it. A future "submit or subscribe to the in-flight computation"
abstraction could revisit a record like this, but it is not worth it on its own.

### Check only the parallel-fragment stop flag

The first experiment checked `coordinator.should_stop()` only. That fixes parallel
fragments but leaves abandoned main-script threads asleep, which is the 43-thread row
above. The yield check covers both shapes with one call.

### Bound how many runs can be draining

A cap on draining runs, or a process-wide worker bound, stops the climb by making new
reruns wait or fail. It does not free the threads that are asleep for no reason. It also
turns a resource problem into a user-visible one.

## Implementation plan

1. **Expose the yield check on the run context.**
   `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`: store the `yield_check`
   passed to `reset()` on the context as a field (default no-op), and add the module-level
   `get_run_yield_check()` helper that returns the current thread's context's check, or
   `None` when there is no context. Test in
   `lib/tests/streamlit/runtime/scriptrunner_utils/script_run_context_test.py` that the
   helper returns the callback given to the most recent `reset()`, and `None` off-thread.

2. **Make the miss wait cancellable.**
   `lib/streamlit/runtime/caching/cache_utils.py`: add `_hold_compute_lock`, use it in
   `_handle_cache_miss` in place of the bare `with` on the compute lock, skip the check when
   `in_cached_function` is set, and delegate to `get_run_yield_check()` rather than raising
   `StopException` directly. Leave the non-blocking acquire in
   `_maybe_trigger_background_refresh` unchanged.

3. **Unit tests for the wait.** `lib/tests/streamlit/runtime/caching/common_cache_test.py`,
   parametrized over `st.cache_data` and `st.cache_resource`:
   - A waiter whose yield check raises leaves within the poll interval. The owner still
     stores the value, and a later call is a hit.
   - A waiter whose yield check does nothing returns the owner's value.
   - A waiter inside a cached function is not interrupted.
   - An uncontended miss never calls the yield check.
   - A thread with no script context waits as today.

4. **Script-runner integration.**
   `lib/tests/streamlit/runtime/scriptrunner/script_runner_test.py`, with a new script under
   `test_data/`: a main-script cold call held open by an event the test controls.
   - `request_stop()` ends the script thread before the computation is released.
   - With `runner.fastReruns = false`, `request_rerun()` restarts the script, and the
     restarted run gets the value.

5. **Coordinator integration.**
   `lib/tests/streamlit/runtime/parallel_fragment_coordinator_test.py`: `drain()` returns
   while a worker is waiting on a key that another thread owns.

6. **End-to-end check that the page still fills in.** Extend
   `e2e_playwright/st_fragment_parallel.py` and `st_fragment_parallel_test.py` with
   parallel fragments sharing a cold cached call that takes a few seconds. Click a button
   that reruns the app while the value is still computing, then assert that every fragment
   shows the value with no further interaction. This guards the "live waiters are
   unchanged" row.

7. **Before-and-after measurement.** Run the 4 sessions × 5 clicks case from the
   measurements above, for parallel fragments and for the main script, with and without
   the change. Record the thread peaks in the PR description. This is a manual check; the
   script that drives it is not committed.

8. **Release note.** One line: abandoned runs no longer hold threads while waiting for a
   cached value that another run is computing.

Steps 1–6 and 8 are one PR. Step 7 is verification for that PR.
