---
author: sfc-gh-lwilby
created: 2026-11-23
---

# Performance telemetry: recording and attribution

## Summary

The [product spec](product-spec.md) defines what each performance telemetry addition reports and how its numbers fit together. This tech spec defines the server-side machinery that makes them fit: where each time is recorded, how a span that another reported time already covers is detected on every thread a run uses, how parallel fragments get their own breakdown, and how recording stays cheap and can't break the app.

Cache usage and the parallel fragment breakdown are built on this design. Later server-side additions, such as query time, CPU time and per-function cache stats, reuse it instead of adding their own bookkeeping. The [telemetry reference](../../.claude/skills/understanding-streamlit-architecture/references/telemetry.md) has the rules every new field follows; this spec doesn't repeat them.

## Problem

### A run's work spans several threads

A script run's work can happen on:

- **The script thread**, which runs callbacks, the script, and fragments without `parallel=True`.
- **Parallel fragment workers.** Fragments with `parallel=True` run on a `ThreadPoolExecutor` that `ParallelFragmentCoordinator` creates for each full run. One worker thread can run several fragments one after another. A worker runs each fragment inside a copy of the submitting thread's `contextvars`, so it starts with that thread's `FragmentThreadState`.
- **Attached threads.** Threads started by user code and attached with `add_script_run_ctx` get a deep copy of the attaching thread's `FragmentThreadState`. The `in_cached_function` ContextVar isn't copied.
- **Async tasks**, which interleave on an event loop on any of these threads. A task's wall-clock time includes whatever other tasks run while it awaits.

### Reported times overlap

Two terms are used throughout:

- A **listed command** is one that appears in `commands` with its time: a top-level `st.*` call within the tracking limits.
- A **recorded cached call** is one counted in the page profile's `cache_usage`. A call whose time another reported time already covers, such as a cached call nested inside another, isn't recorded.

Every time in the page profile is a span of wall-clock time, and spans nest: a command inside a cached function, a cached call inside a command, a query inside either, and all of it inside a parallel fragment. For analysis to subtract times from `exec_time` without counting a span twice, each new time has to know whether the span it measures is already inside another reported time.

The per-function server metrics at `/_stcore/metrics` (`FunctionCacheMetrics`) answer a different question, so they don't follow this rule. They describe each cached function over the life of the process: every call counts toward its function's hits and misses, recorded or not, and its compute and wait durations are inclusive. An outer function's compute time there includes its nested calls, which also record their own. Each function's numbers are correct on their own, but summing durations across functions counts nested time twice. These metrics are never added up against a run's time, so this design leaves them unchanged.

Before this design, only command tracking answered that question, and only on one thread: `command_tracking_deactivated` and `in_listed_command` in `ThreadState` mark nested commands. Attached threads and parallel workers start with tracking on, so their top-level commands are listed. Parallel fragment times were mixed into the run totals with no way to separate them from the main script's.

### Constraints

- **Cache hits are hot.** A hit takes microseconds, and parallel fragments can hit the same cache at the same time. A lock shared across a run's threads would make them wait on each other.
- **Telemetry runs inside and around user code**, including in `finally` blocks and while a `RerunException` or the script's own error is propagating.
- **Usage stats can be off.** With `browser.gatherUsageStats = false`, per-call work must stop at a cheap check.
- **The profile is built once, on the script thread**, at the end of the run, while threads the script doesn't join can still be running.
- **Existing fields keep their meaning.** `commands` and `cache_usage` cover the whole run, including parallel fragments.

## Proposal

### Where the state lives

Per-run state hangs off `ctx.shared`, which every thread in the run shares. Per-thread state lives in `ThreadState`. A simplified outline, leaving out fields unrelated to telemetry:

```python
class SharedRunState:  # ctx.shared: one per script run, shared by all its threads
    cache_stats: RunCacheStats
    parallel_fragments: RunParallelFragmentStats


class RunCacheStats:
    _local: threading.local  # the calling thread's ThreadCacheStats
    _threads: list[ThreadCacheStats]  # every thread's, and every fragment run's


class ThreadCacheStats:  # written only by its own thread
    cache_data: CacheTotals  # calls, hits, misses, ... and compute, wait, overhead
    cache_resource: CacheTotals
    tracked_command_time: float  # listed commands during recorded calls
    _calls_in_cache_code: int  # open calls hashing or reading a result
    _overlap: _OverlapGroup | None  # overlapping async calls, scaled on close


class RunParallelFragmentStats:
    _runs: list[ParallelFragmentRun]  # in the order the runs started
    wait_time: float  # the script thread waiting in join() or drain()


class ParallelFragmentRun:  # one fragment run on its worker thread
    start: float
    end: float | None
    command_time: float  # listed commands on the worker thread only
    cache_stats: ThreadCacheStats


@dataclass(frozen=True)
class FragmentThreadState:  # ThreadState: one per thread, copied to attached threads
    in_listed_command: bool
    cache_compute: CacheComputeScope | None  # the copy shares the same object
    parallel_fragment_run: ParallelFragmentRun | None  # the copy shares the same object
```

`ScriptRunContext.reset()` calls `SharedRunState.reset()` at the start of each run, before any parallel fragment worker starts. `reset()` replaces `cache_stats` and `parallel_fragments` with new objects rather than clearing them, the same way it replaces the tracked command list. Work still running from the previous run, such as a cached call on a thread the script didn't join, holds direct references to that run's objects and finishes into them. Calls that start after the reset find the new objects through `ctx.shared`.

### Per-thread totals without locks

Each thread records into its own `ThreadCacheStats`, which `RunCacheStats.current_thread_stats()` keeps in a `threading.local`. A thread takes the `RunCacheStats` lock only the first time it records in a run, to register its stats. After that, only the owning thread writes them.

`create_page_profile_message` combines all registered stats without locking them:

- A recorded cached call adds its counts and times only when it finishes, in `CacheCallTimer.finish()`. A call still running when the profile is built is left out entirely.
- A call finishing on another thread while the profile is built can be partly included, because its fields are updated one at a time.
- Where the builder reads two related values, it reads them in the order that makes a race miss time rather than count it twice. For example, it reads a thread's totals before its open overlap group (see [Async calls on one event loop](#async-calls-on-one-event-loop)), so a group that closes in between is missed.

Later additions that record per call, such as query time and per-function cache stats, add their counters to the same per-thread record rather than registering a second `threading.local`. Parallel fragment runs then separate them too, through the swap described in [Recording a fragment run](#recording-a-fragment-run).

### Covered spans

Command and cache times follow one rule: **a span counts toward the innermost listed command or recorded cached call that contains it, and the outer ones leave it out.** A cached call made inside a listed command isn't recorded, because the command's time covers it. A listed command inside a cached function is left out of the cached call's times, because the command reports it. Times that can't leave an overlap out, such as query time, report the overlapping part separately instead (see [Applying the design to later additions](#applying-the-design-to-later-additions)).

The code checks five scopes to decide where a span's time goes:

| Scope | How it's marked | Where it's visible |
|---|---|---|
| Listed command | `in_listed_command` in `ThreadState`, set by `gather_metrics` | The command's thread |
| Cached function, same thread | The `in_cached_function` ContextVar | The calling context, including async tasks it creates |
| Cached computation, attached threads | A `CacheComputeScope` in `ThreadState.cache_compute` | Threads attached during the computation |
| Cache code (hashing, reading the result, replaying elements) | `ThreadCacheStats.is_in_cache_code` | The calling thread |
| Parallel fragment run | A `ParallelFragmentRun` in `ThreadState.parallel_fragment_run` | The worker thread only |

`start_call` checks the first four before it records a cached call. If any of them is set, the call's time is already covered, and the call goes only to the server metrics. The parallel fragment run isn't a reason to skip anything. It adds a second destination for times the top-level totals also get.

#### Commands inside cached calls

`ThreadCacheStats.tracked_command_time` counts the time of listed commands that ran on the thread while a recorded cached call was open. `CacheCallTimer` snapshots it when the call starts and when its computation starts, so `finish()` can take the commands out of the right times:

- **Compute time** is the computation's wall-clock time, minus commands during the computation on this thread, minus commands on threads it attached.
- **Overhead time** is the rest of the call's wall-clock time, minus its wait and compute time and the remaining command time.

Both are clamped at zero.

`_record_command_time` in `metrics_util.py` sends each listed command's time to up to two of three destinations:

```python
run = thread_state.parallel_fragment_run if thread_state is not None else None
if run is not None:
    run.add_command_time(seconds)
if ctx.shared.cache_stats.record_tracked_command_time(seconds):
    return
scope = thread_state.cache_compute if thread_state is not None else None
if scope is not None and scope.is_active:
    scope.add_command_time(seconds)
```

1. The thread's `ParallelFragmentRun`, if it's a parallel fragment's worker thread.
2. The thread's cache stats, if a recorded cached call is open on it. `record_tracked_command_time` returns whether it took the time.
3. Otherwise, the `CacheComputeScope` that attached this thread, while that computation is still running.

The second and third destinations are mutually exclusive, so a command is never subtracted from two cached calls.

#### Attached threads during a computation

On a miss, `CachedFunc` runs the function inside `computing_cached_value`, which puts a new `CacheComputeScope` into `ThreadState.cache_compute` for the length of the computation. `add_script_run_ctx` copies `FragmentThreadState` with `dataclasses.asdict`, which deep-copies its fields. The scope opts out of the copy:

```python
def __deepcopy__(self, memo: dict[int, object]) -> CacheComputeScope:
    return self
```

So the computing thread and every thread it attaches share one scope:

- While the computation runs, `is_active` is True, so the attached threads' cached calls aren't recorded and their listed commands add to the scope's command time.
- `end()` sets `is_active` to False under the scope's lock and returns that command time, which the cached call subtracts from its compute time.
- A computation that is already inside another keeps the outer scope, so threads that a nested cached function attaches report to the outermost recorded call.

The `in_cached_function` ContextVar can't do this, because `add_script_run_ctx` doesn't copy it. Copying it would also change behavior that depends on it, such as element replay and the checks for widgets inside cached functions.

Two cases fall outside the mark. A thread that attaches itself later, rather than being attached during the computation, doesn't inherit it, so its cached calls are recorded. A task that an async cached function starts with `asyncio.create_task()` copies `in_cached_function` and keeps it, so its cached calls aren't recorded even after the computation ends.

#### Cache code never awaits

`ThreadCacheStats` counts the open calls running the cache's own code. A call enters cache code when it opens, leaves it while it waits for another caller or runs the cached function, and returns when that ends. A cached call that starts while the count is above zero must come from inside that code, for example from a `hash_funcs` function, because that code never yields to the event loop. So `start_call` skips it.

The rule only holds if `CachedFunc` never awaits outside its wait and compute phases. Otherwise, another task's cached call on the same event loop would be skipped wrongly. A unit test runs a miss, a caller waiting for it, a hit and a miss that raises, for both decorators, with a concurrent task that watches the count, and fails if the task ever sees a call in cache code. A new `await` in `CachedFunc` must be wrapped in `leave_cache_code` and `enter_cache_code`.

### Async calls on one event loop

Async cached calls that are awaited at the same time each count the wall-clock time they share, so their sum can exceed the time that passed. `ThreadCacheStats` groups calls that overlap on its thread. A group starts when a call opens while another is open, and ends when no call is open:

- Calls that finish while the group is open add to the group's totals instead of the thread's.
- When the group closes, its span is its wall-clock time minus the listed command time on the thread during it, because the calls' own times already leave that out.
- If the group's recorded time exceeds its span, all of its compute, wait and overhead times, for both cache types, are scaled down by the same factor. Counts aren't scaled.
- A group still open when the profile is built is scaled to the time it has run so far.

Calls that don't overlap are added unscaled. Calls on different threads are never scaled against each other.

### Parallel fragments

#### Recording a fragment run

When a run gathers usage stats, `_run_parallel_fragment` (`fragment.py`) wraps each fragment in `RunParallelFragmentStats.recording_run()` on the worker thread:

```python
run = ParallelFragmentRun(time.perf_counter())
with self._lock:
    self._runs.append(run)
try:
    with self._cache_stats.recording_into(run.cache_stats):
        yield run
finally:
    run.end = time.perf_counter()
```

1. It creates a `ParallelFragmentRun` with the start time, and appends it to the run's list under a lock, so the list is in the order the fragments started.
2. `RunCacheStats.recording_into()` points the worker's thread-local stats at the fragment run's own `ThreadCacheStats` and registers it with the run's cache stats. The fragment's cached calls go into the fragment's entry and still count toward the top-level `cache_usage`. The worker's previous stats are restored when the fragment ends.
3. `ThreadState.update(parallel_fragment_run=run)` makes the run visible to `_record_command_time`. A nested parallel fragment starts with a copy of its parent worker's thread state, so this replaces the parent's run, and the nested fragment's commands aren't added to its parent.
4. When the fragment ends, normally or by raising, the run records its end time.

Recording is per fragment run rather than per worker thread, because one worker can run several fragments one after another, and each needs its own entry.

#### Which threads count toward a fragment

Only the worker thread counts toward its fragment's entry. `ParallelFragmentRun.add_command_time` ignores commands from any other thread, and `ParallelFragmentRun.__deepcopy__` returns the same object, so a thread the fragment attaches gets the run without a copy of its cache stats. The attached thread's cached calls register their own `ThreadCacheStats` in the top-level totals. So threads a fragment attaches count toward the main script, like threads the main script attaches.

This keeps each entry single-threaded, so a fragment's user code time, its `exec_time` minus its command and cache times, can't go negative. The cost is that the main script's user code time can: an attached thread usually runs while the script thread waits for the fragment, so its time overlaps `wait_time`.

#### Waiting for fragments

The script thread waits for its fragments in `ParallelFragmentCoordinator.join()` after the script ends, or in `drain()` when the script ends early, for example with `st.stop()`, a rerun request or an uncaught exception. `_recording_parallel_fragment_wait` (`script_runner.py`) times both and adds them to `wait_time`. If `join()` raises, the time of `join()` and then `drain()` is added, because the two run one after the other. `join()` waits for nested fragments too, so `wait_time` covers them.

`wait_time` is part of `exec_time`, but not of the main script's user code.

#### Building the entries

`_fill_parallel_fragment_usage` (`metrics_util.py`) fills `parallel_fragment_usage`, and leaves it unset when no parallel fragment ran:

- The first `_MAX_PARALLEL_FRAGMENT_RUNS` (25) runs to start get an entry each. Later runs are added together into `overflow`, which has no start time. `run_count` counts every run.
- Each entry's cache times are summed across `st.cache_data` and `st.cache_resource`. Cache counts are reported once, in `parallel_fragment_usage.cache_usage`, across all runs, including the overflow.
- A run still going when the profile is built counts up to then. Its cached calls still in progress aren't included, so its user code time reads high.

Only full runs have parallel fragments. A fragment rerun runs its fragments inline (`parallel and not ctx.fragment_ids_this_run` in `fragment.py`) and sends its own page profile.

#### Reading the numbers

- A fragment's user code time is its `exec_time` minus its `command_time`, `cache_compute_time`, `cache_wait_time` and `cache_overhead_time`.
- The main script's user code time is `exec_time − prep_time − wait_time`, minus the top-level command time less the fragments' command time, minus the top-level cache time less the fragments' cache time. The fragments' times include the overflow entry.

Later per-fragment fields, such as query time and CPU time, are recorded through the same `ParallelFragmentRun` and the same worker-thread rule.

### Building the profile

`create_page_profile_message` reads one `time.perf_counter()` value and passes it to both `_fill_cache_usage` and `_fill_parallel_fragment_usage`. An overlap group still open and a fragment still running are measured to the same instant, so the top-level and per-fragment values agree. The script runner already builds the profile inside a `try`, so a failure there drops that run's profile and nothing else.

### Failures never reach the app

Following `$44 Contain Failures`, each hook that runs inside or around user code catches `Exception` and logs it at debug level, as `gather_metrics` already does. Where telemetry sets up a context manager around user code, an `ExitStack` guards entering it without also catching the user code's errors.

| Hook | Runs | If telemetry raises |
|---|---|---|
| `CacheCallTimer.finish()` | In a `finally` around every recorded cached call | The call is missing from the run totals. The function's result or error is unchanged. |
| `computing_cached_value` | Around the cached function on a miss | Setup fails: the function runs without marking attached threads. Ending fails: the attached threads' command time isn't subtracted. |
| `_record_command_time` | After a command returns or raises `RerunException` | The command's time is missing from some destinations. |
| `recording_run()` in `_run_parallel_fragment` | Around each parallel fragment | The fragment runs without an entry. |
| `_recording_parallel_fragment_wait` | In a `finally` around `join()` and `drain()`, possibly while the script's error propagates | `wait_time` misses that wait. |

Unit tests inject a failure into each hook and check that the caller sees the same result or error as without telemetry.

### Cost

Following `$52 Pay Only for What You Use`:

- **Usage stats off.** `start_call` returns a timer that only updates the server metrics, after checking `ctx.gather_usage_stats`. No compute scope is created, and no fragment run or wait is recorded.
- **A recorded cache hit** adds one or two microseconds: a few `perf_counter` calls and attribute updates on the thread's own stats.
- **Locks** are taken once per thread per run to register its stats, once per parallel fragment run, and on a miss once to end its compute scope. An attached thread also takes the scope's lock for each listed command it runs during the computation.
- **Payload.** `parallel_fragment_usage` is sent only by runs with parallel fragments, and adds at most about 4 KB (see the product spec).

### Applying the design to later additions

Each addition settles its own fields when it lands. The design fixes how they're attributed:

| Addition | Measured on | Attribution |
|---|---|---|
| Query time | The thread that runs the query | Inside a listed command first (`time_in_commands`). Otherwise inside a cached call (`time_in_cache`), with the same test that `_record_command_time` uses: a recorded call open on the thread, or an active `CacheComputeScope` from the attaching thread. Added to the worker's `ParallelFragmentRun`. Counted in the per-thread record. |
| CPU time | Each thread, with `time.thread_time()` at boundaries already being timed | The script thread from the start of the run to the profile build; listed commands on the script thread, in `gather_metrics`; each fragment from `recording_run()` entry to exit on its worker. Process CPU time from the start of the run. |
| Per-function cache stats | `CacheCallTimer.finish()` | The same skip rules as `cache_usage`, kept in the per-thread record by function ID and capped when the profile is built. |
| Data size, rerun reason | Where the value is already known: message serialization, and the rerun request at run start | Neither overlaps other reported times, so neither uses the covered-span scopes. Neither is split per fragment. |

Using the same test as command time for query time keeps the subtraction consistent. While a sync cached call is open, its thread runs a query only from inside the computation or from a `hash_funcs` function. While an async cached call awaits, another task's query on the same thread counts as inside it, just as that call's compute time includes it.

### Known limitations

- **Concurrent threads add up.** Times from different threads are added together, so the totals can exceed wall-clock time. Parallel fragments report their share. Other attached threads have no breakdown, so subtracting their times from `exec_time` can give a negative user code time.
- **Threads a fragment attaches** count toward the main script and usually overlap `wait_time`.
- **Unfinished work.** Cached calls still running when the profile is built are left out, and a thread the script doesn't join can be partly included.
- **Scaling covers cache times only.** Overlapping async calls are scaled, but other times measured during them, such as query time inside cached calls, aren't.
- **Profiles of interrupted runs are usually dropped.** A run cut short by a rerun request enqueues its profile, but the next run clears the forward message queue when it starts, and `AppSession._clear_queue` doesn't keep `page_profile` messages. This affects every field and is fixed separately.

## Alternatives considered

### One run total behind a lock

Every cached call would add to a single `CacheUsage` under a lock. It's simpler, but concurrent cache hits from parallel fragments would wait on each other, and the lock would cost more than the hit it measures. Per-thread stats are written without contention and combined once per run.

### Copy `in_cached_function` to attached threads

Making `add_script_run_ctx` copy the ContextVar would mark attached threads without a new scope. It would also change element replay and the widget checks inside cached functions for those threads, which breaks the rule that telemetry never changes behavior. It also couldn't carry the attached threads' command time back to the cached call.

### Clip overlapping async calls instead of scaling them

Each instant that overlapping calls share could be given to one of them, so the totals match wall-clock time exactly. That needs every call's intervals and a rule for which call owns shared time. Scaling needs only each group's start, end and command time, and keeps the proportions between compute, wait and overhead.

### Record per worker thread instead of per fragment run

Giving each worker thread its own `ThreadCacheStats` would need no swap, but one worker can run several fragments, so per-thread entries would merge them and couldn't show which fragment held up the run.

### Count a fragment's attached threads toward the fragment

The entry would then cover all of a fragment's work. It would need a lock on each entry, and its times would sum across threads, so the fragment's user code time could go negative, which the product spec rules out. Attached threads are treated the same way everywhere instead, and a per-fragment breakdown of them can be added later if analysis needs it.

### Report the main script's share instead of whole-run totals

Top-level `commands` and `cache_usage` could leave out the fragments, so no subtraction is needed. That changes the meaning of existing fields, which existing analysis relies on. The fragments' share is reported separately instead.

### Clear the stats in place at the start of a run

Clearing would keep the same objects across runs, but a cached call or fragment still running from the previous run would then add its times to the new run. Replacing the objects keeps late work in its own run.

## Open questions

1. **Guarding `start_call`.** `start_call` runs before every cached call and isn't wrapped in a guard. Its checks are attribute reads and a thread-local lookup, and the lookup registers the thread under a lock once per run. A guard would cost little and would let a failure there fall back to a metrics-only timer.
2. **Attached threads in fragment entries.** Whether analysis needs a fragment's attached threads in its entry, which would need the locking described in [Alternatives considered](#count-a-fragments-attached-threads-toward-the-fragment).
