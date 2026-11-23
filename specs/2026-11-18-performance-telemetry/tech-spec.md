---
author: sfc-gh-lwilby
created: 2026-11-23
---

# Performance telemetry

## Summary

The [product spec](product-spec.md) defines what each performance telemetry addition reports and how its numbers fit together. This tech spec defines how each one is recorded.

Most of it is a shared foundation on the server: where each time is recorded, how a span that another reported time already covers is detected on every thread a run uses, how parallel fragments get their own breakdown, and how recording stays cheap and can't break the app. Cache usage and the parallel fragment breakdown are built directly on it. Query time, CPU time and per-function cache stats reuse it. Rerun reason and data size are recorded where the value is already known and don't overlap other times. Render timing is measured in the browser and joined to the run's page profile. The [telemetry reference](../../.claude/skills/understanding-streamlit-architecture/references/telemetry.md) has the rules every new field follows; this spec doesn't repeat them.

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
- **Additions land separately.** Each addition is its own change, so each must work without the others, and they share proto field numbers and the per-fragment entry.

## Proposal

The first sections, from [Where the state lives](#where-the-state-lives) to [Cost](#cost), describe the shared foundation, including the parallel fragment breakdown that other additions add per-fragment fields to. Each addition then has its own section, starting with [Cache usage](#cache-usage), followed by the [field numbers](#field-numbers) they share.

### Where the state lives

Per-run state hangs off `ctx.shared`, which every thread in the run shares. Per-thread state lives in `ThreadState`. A simplified outline, leaving out fields unrelated to telemetry, with fields from later additions marked:

```python
# Render timing is measured only in the browser, so it has no server-side state.

class ScriptRunContext:  # ctx: reset() at the start of each run
    shared: SharedRunState
    rerun_reason: RerunReason  # rerun reason: set once, when the run starts
    rerun_element_type: str | None  # rerun reason


class SharedRunState:  # ctx.shared: shared by all the run's threads
    cache_stats: RunCacheStats
    parallel_fragments: RunParallelFragmentStats
    query_stats: RunQueryStats  # query time
    command_cpu_time: float  # CPU time: added under a lock, from any thread
    # data size: its per-thread registry goes here once designed


class RunCacheStats:  # one per run, shared by all its threads
    _local: threading.local  # _local.stats: each thread sees only its own ThreadCacheStats
    _threads: list[ThreadCacheStats]  # references to every thread's and fragment run's, for totals()


class ThreadCacheStats:  # written only by its own thread
    cache_data: CacheTotals  # calls, hits, misses, ... and compute, wait, overhead
    cache_resource: CacheTotals
    tracked_command_time: float  # listed commands during recorded calls
    _calls_in_cache_code: int  # open calls hashing or reading a result
    _overlap: _OverlapGroup | None  # overlapping async calls, scaled on close
    # per-function cache stats: counters keyed by function go here once designed


class RunQueryStats:  # query time: the same pattern as RunCacheStats
    _local: threading.local  # _local.stats: each thread sees only its own ThreadQueryStats
    _threads: list[ThreadQueryStats]  # references to every thread's and fragment run's, for totals()
    _query_ids: list[str]  # with _query_ids_in_cache, the first 50, under a lock
    _query_ids_in_cache: list[str]


class ThreadQueryStats:  # query time: written only by its own thread
    snowflake_connector: QueryTotals  # queries, failed, ... and time, time_in_cache, time_in_commands
    sqlalchemy: QueryTotals
    snowpark: QueryTotals


class RunParallelFragmentStats:
    _runs: list[ParallelFragmentRun]  # in the order the runs started
    wait_time: float  # the script thread waiting in join() or drain()


class ParallelFragmentRun:  # one fragment run on its worker thread
    start: float
    end: float | None
    command_time: float  # listed commands on the worker thread only
    cache_stats: ThreadCacheStats
    query_stats: ThreadQueryStats  # query time
    cpu_time: float | None  # CPU time: the worker thread, from start to end


@dataclass(frozen=True)
class FragmentThreadState:  # ThreadState: one per thread, copied to attached threads
    in_listed_command: bool
    cache_compute: CacheComputeScope | None  # the copy shares the same object
    parallel_fragment_run: ParallelFragmentRun | None  # the copy shares the same object
```

At the start of each run, `SharedRunState.reset()` replaces `cache_stats`, `query_stats` and `parallel_fragments` with new objects instead of clearing them. Late work from the previous run, such as a cached call on a thread the script didn't join, then finishes into the old objects, which nothing reads, instead of the new run's totals.

### Per-thread totals without locks

Each thread writes only to its own `ThreadCacheStats`, so cached calls don't take a lock. `RunCacheStats` keeps two references to each record:

- **`_local.stats`**, a `threading.local`, lets a thread find its own record. `current_thread_stats()` creates it on the thread's first call in the run.
- **`_threads`** lets the profile builder sum every record, including those of threads that have exited. A `threading.local` value is visible only to its own thread and disappears with it.

The lock is taken only to append to `_threads`, once per thread per run. A parallel fragment run appends its own record too (see [Recording a fragment run](#recording-a-fragment-run)).

The profile builder reads the records without locking them. A call adds its counts and times only when it finishes, so one still running is left out, and one finishing during the build may be partly included. Where it reads two related values, the order makes a race miss time rather than count it twice. For example, it reads a thread's totals before its open overlap group (see [Async calls on one event loop](#async-calls-on-one-event-loop)).

Query time uses the same pattern with its own `RunQueryStats` (see [Query time](#query-time)).

### Covered spans

Reported times can contain each other: a cached call inside a listed command, a listed command inside a cached function, a query inside either, and all of them inside a parallel fragment. Each addition handles an overlap in one of two ways:

- **Leave it out.** Command and cache times count a span toward the innermost listed command or recorded cached call that contains it, and the outer ones leave it out. A cached call made inside a listed command isn't recorded, because the command's time covers it. A listed command inside a cached function is left out of the cached call's times, because the command reports it. See [Cache usage](#cache-usage).
- **Report it separately.** Query time and CPU time describe what kind of work happened, not where, so a span can be both, such as a query inside a cached function. Leaving it out of either would understate one of them, so they count the whole span and report the overlapping part in their own fields: `time_in_commands` and `time_in_cache` for queries, and `command_cpu_time` for CPU. See [Query time](#query-time) and [CPU time](#cpu-time).

Either way, the code checks five scopes to decide where a span's time goes. Each scope uses the existing mechanism that reaches exactly the code it must cover: `ThreadState` crosses into attached threads, and a ContextVar separates async tasks on one thread.

| Scope | How it's marked | Where it's visible | Used by |
|---|---|---|---|
| Listed command | `in_listed_command` in `ThreadState`, set by `gather_metrics` | The command's thread | Cache, query and CPU time |
| Cached function, same thread | The `in_cached_function` ContextVar | The calling context, including async tasks it creates | Cache and query time |
| Cached computation, attached threads | A `CacheComputeScope` in `ThreadState.cache_compute` | Threads attached during the computation | Cache and query time |
| Cache code (hashing, reading the result, replaying elements) | `ThreadCacheStats.is_in_cache_code` | The calling thread | Cache time |
| Parallel fragment run | A `ParallelFragmentRun` in `ThreadState.parallel_fragment_run` | The worker thread only | Every per-fragment field |

The parallel fragment run never takes time away from another total. It adds a second destination for times the top-level totals also get (see [Parallel fragments](#parallel-fragments)).

#### Attached threads during a computation

A cached function can start threads and attach them with `add_script_run_ctx`. Their work is part of the computation, but `in_cached_function` doesn't reach them: `add_script_run_ctx` doesn't copy ContextVars, and copying this one would change element replay and the widget checks for those threads.

So on a miss, `computing_cached_value` puts a `CacheComputeScope` in `ThreadState.cache_compute` for the length of the computation. `add_script_run_ctx` deep-copies `ThreadState`, but the scope's `__deepcopy__` returns itself, so the computing thread and every thread it attaches share one object:

- While the scope is active, the attached threads' cached calls aren't recorded, their queries count as inside the cached call, and their listed commands add to the scope's command time.
- `end()` deactivates the scope under its lock and returns that command time, which the cached call subtracts from its compute time.
- A nested computation keeps the outer scope, so everything reports to the outermost recorded call.

Two edge cases fall outside it. A thread attached from outside the computation doesn't get the scope, so its cached calls are recorded. A task that an async cached function starts with `asyncio.create_task()` keeps a copy of `in_cached_function`, so its cached calls stay unrecorded even after the computation ends.

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
2. `RunCacheStats.recording_into()` appends the fragment run's own `ThreadCacheStats` to `_threads` and puts it in the worker's `_local.stats`. The fragment's cached calls go into the fragment's entry and still count toward the top-level `cache_usage`. The worker's previous stats are restored when the fragment ends.
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

Query time and CPU time add per-fragment fields through the same `ParallelFragmentRun` and the same worker-thread rule (see [Query time](#query-time) and [CPU time](#cpu-time)).

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
| Query hooks | Around each driver execute call, and in each Snowpark notification | The query is missing from the totals. Its result or error is unchanged. |
| CPU clock reads | At the start and end of the run, around listed commands and around each parallel fragment | The CPU fields are left unset. |

Unit tests inject a failure into each hook and check that the caller sees the same result or error as without telemetry.

### Cost

Following `$52 Pay Only for What You Use`:

- **Usage stats off.** `start_call` returns a timer that only updates the server metrics, after checking `ctx.gather_usage_stats`. No compute scope is created, and no fragment run or wait is recorded.
- **A recorded cache hit** adds one or two microseconds: a few `perf_counter` calls and attribute updates on the thread's own stats.
- **Locks** are taken once per thread per run to register its stats, once per parallel fragment run, and on a miss once to end its compute scope. An attached thread also takes the scope's lock for each listed command it runs during the computation.
- **Payload.** `parallel_fragment_usage` is sent only by runs with parallel fragments, and adds at most about 4 KB (see the product spec).

### Cache usage

Cache usage leaves overlaps out. `start_call` checks the first four scopes in [Covered spans](#covered-spans) before it records a cached call. If any of them is set, the call's time is already covered, and the call goes only to the server metrics.

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

#### Cache code never awaits

`ThreadCacheStats` counts the open calls running the cache's own code. A call enters cache code when it opens, leaves it while it waits for another caller or runs the cached function, and returns when that ends. A cached call that starts while the count is above zero must come from inside that code, for example from a `hash_funcs` function, because that code never yields to the event loop. So `start_call` skips it.

The rule only holds if `CachedFunc` never awaits outside its wait and compute phases. Otherwise, another task's cached call on the same event loop would be skipped wrongly. A unit test runs a miss, a caller waiting for it, a hit and a miss that raises, for both decorators, with a concurrent task that watches the count, and fails if the task ever sees a call in cache code. A new `await` in `CachedFunc` must be wrapped in `leave_cache_code` and `enter_cache_code`.

#### Async calls on one event loop

Async cached calls that are awaited at the same time each count the wall-clock time they share, so their sum can exceed the time that passed. `ThreadCacheStats` groups calls that overlap on its thread. A group starts when a call opens while another is open, and ends when no call is open:

- Calls that finish while the group is open add to the group's totals instead of the thread's.
- When the group closes, its span is its wall-clock time minus the listed command time on the thread during it, because the calls' own times already leave that out.
- If the group's recorded time exceeds its span, all of its compute, wait and overhead times, for both cache types, are scaled down by the same factor. Counts aren't scaled.
- A group still open when the profile is built is scaled to the time it has run so far.

Calls that don't overlap are added unscaled. Calls on different threads are never scaled against each other.

### Query time

#### Where queries are caught

Each client library is hooked where Streamlit already creates or manages its objects. Nothing is imported unless the app already uses the library, and no hook is installed while usage stats are off.

| Source | Hook | Installed |
|---|---|---|
| Snowflake connector | Cursors from `SnowflakeConnection.query()` and `.cursor()` are created as a `SnowflakeCursor` subclass that times `execute`, which also covers `executemany`, `execute_async` and `describe`. | When the connection creates the cursor |
| SQLAlchemy | Cursor execute events on the `Engine` class, so every engine is covered, including the one behind `SQLConnection`. | When a `SQLConnection` connects, or when a run starts after the app has imported SQLAlchemy |
| Snowpark | A `QueryListener` on sessions from `SnowflakeConnection.session()` and on the active session. Snowpark notifies it on the thread that ran the query, after the query finishes and without its duration, so Snowpark queries are counted but not timed. Needs Snowpark 1.26 or later. | When a connection connects or a run starts |

The SQLAlchemy and Snowpark hooks are process-wide, so each recorded query finds its run through the calling thread's `ScriptRunContext`. A query on a thread without a run that gathers usage stats isn't recorded. A timed query's time covers only the driver's execute call, so fetching the results isn't included, and an async query's time covers only submitting it.

#### Recording and attribution

Queries are recorded the same way as cached calls. `RunQueryStats` in `SharedRunState` keeps a `ThreadQueryStats` per thread, which only that thread writes, and `reset()` replaces it at the start of each run. `RunParallelFragmentStats.recording_run()` also swaps in the fragment run's own `ThreadQueryStats` with `RunQueryStats.recording_into()`, so `ParallelFragmentRun` entries report `query_time`, `query_time_in_cache` and `query_time_in_commands`, summed across sources.

When a query starts, it's placed in at most one of the overlapping parts:

```python
if thread_state.in_listed_command:
    return True, False  # inside a command
# in_cached_function covers the computing thread, and in_cache_compute the
# threads it attaches with add_script_run_ctx.
return False, in_cached_function.get() or thread_state.in_cache_compute
```

- **Inside a command** wins, because the command's time contains the query, and a cached call made inside a command isn't recorded.
- **Inside a cached call** means inside a cached function's computation. `in_cached_function` is a ContextVar, so in async code it's set only for the task that's computing. Threads attached during the computation count through the shared `CacheComputeScope` (see [Attached threads during a computation](#attached-threads-during-a-computation)).

So `time − time_in_cache − time_in_commands` is query time that's otherwise part of user code, and subtracting `time_in_cache` from cache compute time leaves the cached functions' other work.

#### Query IDs

The run keeps the first 50 Snowflake query IDs it receives, under one lock in `RunQueryStats`, in two lists that share the limit: `query_ids` and `query_ids_in_cache`. The second list holds queries inside cached calls, whose results later runs and sessions can reuse.

#### Failures and cost

A hook that fails logs at debug level and never changes a query's result or error. Recording adds about 1 µs per timed query and about 0.7 µs per Snowpark query. A SQLAlchemy query adds about 5 µs, about half of it SQLAlchemy's own event dispatch, which any listener pays. A Snowflake query takes tens of milliseconds or more.

### CPU time

#### Clocks and span

CPU time is read with `time.thread_time()` for a thread and `time.process_time()` for the process. Every CPU field covers the run from the end of prep until the profile is built, the span of `exec_time − prep_time`, so that user code CPU time lines up with user code wall time:

```
user code CPU = script_cpu_time + parallel_fragment_cpu_time − command_cpu_time
```

| Field | Measures |
|---|---|
| `script_cpu_time` | The script thread |
| `command_cpu_time` | Listed commands, summed over the threads that ran them |
| `parallel_fragment_cpu_time` | All parallel fragment runs, including the overflow |
| `process_cpu_time` | The whole process |
| `ParallelFragmentRun.cpu_time` | One parallel fragment run, on its worker thread |

All the run fields are `optional`, so a run that only waits reports a real 0. They're set together, or all left unset where the platform has no per-thread CPU clock or reading it raises.

#### Attribution

- **Commands.** `gather_metrics` reads the thread's clock around each command and adds the difference to `SharedRunState.command_cpu_time` only if `SharedRunState.track_command()` kept the command. It's added under the lock that guards the tracked command list. Each listed command already takes that lock in `track_command()`, so holding it once more costs little and needs no per-thread record. Commands past the tracking limits, and commands that raise anything other than a rerun request, have no listed time, so their CPU time counts as user code, matching wall time. Nested commands count toward the outer command.
- **Parallel fragments.** `recording_run()` reads the worker's clock when the fragment starts and when it ends, and stores the difference in the fragment's `ParallelFragmentRun`. `parallel_fragment_cpu_time` is summed from those entries when the profile is built, the same way the overflow entry is, so there's no separate total to keep in step. The time is stored before the coordinator counts the worker as finished, so it's complete once `join()` or `drain()` returns. A parallel fragment nested in another has its own run on its own worker. A fragment without `parallel=True` counts toward the thread that runs it.
- **Fragment reruns** run on the script thread, so their CPU time is in `script_cpu_time` and `parallel_fragment_cpu_time` is 0.
- **Attached threads** are only in `process_cpu_time`, except for their listed commands. Process CPU time also includes library thread pools, such as NumPy, Polars and DuckDB, the server itself and, on a shared server, other sessions.

A fragment's CPU time is compared with its `exec_time` to split its time into computing and waiting. Its commands' CPU time isn't split out per fragment.

#### Platforms and cost

On Windows, CPU clocks advance in steps of about 15.6 ms, so short spans often read 0 and only aggregates are meaningful. A listed command adds about 0.4 µs (two clock reads and a locked add), and a run about 1.5 µs. No clock is read while usage stats are off. Waiting for the GIL counts as waiting, not CPU time.

### Per-function cache stats

Per-function stats are recorded in `CacheCallTimer.finish()`, with the same rules as `cache_usage`, so a nested call never counts twice. They follow the foundation:

- **Per-thread counters** keyed by function, in the thread's cache stats, combined when the profile is built. A parallel fragment's calls are in its own stats through the existing swap.
- **A random ID per function and server process**, created when the function's `FunctionCacheMetrics` entry is created in the process-wide registry, so it's stable for the life of the process and reveals nothing about the function.
- **A cap per run**, applied when the profile is built.

How the ID is stored, the cap, and which functions are kept past it are still open (see [Open questions](#open-questions)).

### Rerun reason

Rerun reason has no overlap with other times, so it uses none of the covered-span machinery. It's recorded in three steps:

1. **When a rerun is requested.** Each requester sets a reason on `RerunData`: `st.rerun()`, a file change, a fragment's `run_every` timer, or a request from the browser, which counts as a manual rerun.
2. **When requests are coalesced.** `ScriptRequests` merges requests that arrive before the run starts. `RerunReason.combine` keeps the reason that comes first in the product spec's order.
3. **When the run starts.** The script runner replaces the reason with a higher-precedence one if one applies: `initial_load` if the session has no current page yet, `navigation` if the page changes, and `query_params_change` if the incoming query string differs from the session's query params. Comparing against the session's own params means a query param the script itself wrote doesn't count as a change. Then, if `_call_callbacks` finds a changed widget, the run becomes `widget_interaction` unless a higher-precedence reason already applies. Runs with no reason, such as `AppTest` reruns, report `unknown`.

`rerun_element_type` comes from the changed widgets' metadata. `register_widget` takes a required keyword-only `element_type`, the same literal each widget uses for its element ID, so only Streamlit's fixed element type names are sent. Custom components report `component_instance` (v1) or `bidi_component` (v2), never the component's name. `register_widget` is internal but re-exported from `streamlit.runtime.state`, so a third-party caller that doesn't pass `element_type` gets a `TypeError`.

`_call_callbacks` already visits every changed widget, so the added work per run is collecting their metadata and one query param comparison, which runs only while usage stats are on.

### Data size

Data size is recorded where messages are already serialized. `ScriptRunContext.enqueue` calls `populate_hash_if_needed`, which serializes every message except references and `initialize` to compute its hash, so the message's size is known there, on the thread that enqueued it. Counting there costs a few additions per message and needs no second serialization pass.

Messages are enqueued from the script thread, parallel fragment workers and attached threads, so the counts follow the per-thread pattern of the foundation. They're totals for the run, not split per fragment. Arrow bytes and rows are counted where dataframes and charts are marshalled, which already knows them. The browser counts bytes and messages received, and messages served from its message cache, because only the browser knows which references it resolved locally.

What's counted when a message is sent as a reference to a copy the browser has cached, and whether compressed sizes are available, are still open (see [Open questions](#open-questions)).

### Render timing

Render timing is measured only in the browser and sent as its own `renderTiming` event, because fully loaded happens after the `PageProfile` message arrives. Holding back the `pageProfile` event instead would lose it whenever a slow page is closed while loading, which is the case that matters most.

#### Joining to the run

A per-page-load `run_index`, 0 for the first run, is set on both the `pageProfile` and `renderTiming` events of a run. Analysis joins them on `sessionId` and `run_index`. A run that never receives its `PageProfile` message sends no `renderTiming` event, because there's nothing to join it to. `renderTiming` is sent with `fetch(..., { keepalive: true })`, so it still goes out while the page is being hidden or closed.

#### Measuring a run

- **Start.** Milestones are measured from navigation start for the first run, and from when the browser sent the rerun request for later runs.
- **Elements.** A per-run `RenderTimingTracker` registers each new or changed element through `ElementContainer`. A probe inside the element's `Suspense` boundary marks when its code has loaded, and elements that draw or load asynchronously, such as charts, the dataframe grid, images, video and iframes, report when they finish through two small hooks.
- **Visibility.** A per-run `IntersectionObserver` decides which elements count toward fully loaded. Hidden content, such as collapsed expanders, unselected tabs, closed popovers and a collapsed sidebar, never intersects the viewport. Elements pushed out of view stop counting, and elements scrolled into view start.
- **Completion.** A run is fully loaded once its script has finished and every visible element is ready, after two more frames without changes, so late layout shifts are included.
- **After the script.** Code loading and media loading are each the union of the matching intervals of visible elements, clipped to the time from script finished to fully loaded, so ten images loading in parallel count once.
- **Exclusions.** A run is sent early with `was_hidden` if the page is hidden, or `was_superseded` if another rerun starts first. A run not fully loaded 30 seconds after its script finished is sent with `timed_out` and the number of elements still loading.

Only Navigation Timing, `requestAnimationFrame`, `IntersectionObserver` and the Page Visibility API are used. Largest Contentful Paint and Element Timing aren't, because some browsers lack them and they ignore canvas, which the dataframe grid and several chart libraries draw into.

#### Cost

Apps served from localhost, loopback addresses, `0.0.0.0` or private-network IPs create no tracker, and neither do apps with usage stats off. They pay one context read and no-op effects per element. With a tracker, each new or changed element adds a context provider, an empty probe and a few `performance.now()` calls, about 7 µs per element on a first load. No element re-renders for render timing, and observers and timers exist only while a run is measured.

### Field numbers

Each addition lands on its own, so field numbers are assigned here and don't depend on the order they land in:

| Addition | `PageProfile` | `MetricsEvent` |
|---|---|---|
| Cache usage, server uptime | 16, 17 | 50, 51 |
| CPU time | 18–21 | 52–55 |
| Parallel fragment breakdown | 22 | 56 |
| Query time | 23 | 57 |
| Rerun reason | 24, 25 | 58, 59 |
| Render timing (`run_index`, `render_timing`) | None, browser only | 60, 61 |

In `ParallelFragmentRun`, 1–6 hold the foundation's times, 7–9 query time and 10 CPU time. Per-function cache stats and data size take the next free numbers when they're designed.

### Known limitations

- **Concurrent threads add up.** Times from different threads are added together, so the totals can exceed wall-clock time. Parallel fragments report their share. Other attached threads have no breakdown, so subtracting their times from `exec_time` can give a negative user code time.
- **Threads a fragment attaches** count toward the main script and usually overlap `wait_time`.
- **Unfinished work.** Cached calls still running when the profile is built are left out, and a thread the script doesn't join can be partly included.
- **Scaling covers cache times only.** Overlapping async calls are scaled, but other times measured during them, such as query time inside cached calls, aren't.
- **Queries the cache's time contains but `time_in_cache` doesn't.** A query from a `hash_funcs` function is in the cache's overhead time, and another async task's query while a cached call awaits is in that call's wall-clock time. Neither runs inside a computation, so both count as query time outside cached calls, and subtracting both can count them twice. Both are rare.
- **Unrecorded query paths and Snowpark times.** The paths the product spec lists as not recorded stay in user code, and Snowpark queries are counted but not timed.
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

Clearing would keep the same objects across runs, but a cached call or fragment still running from the previous run would then add its times to the new run. It also can't reset each thread's `_local.stats`, because one thread can't clear another thread's `threading.local` value. The script thread would keep recording into last run's record, which the cleared `_threads` list no longer contains.

### One per-thread record for every addition

Cache, query and later per-call counters could share one per-thread object and one registry, so a parallel fragment run swaps a single record. Separate registries cost one more lock per thread per run each, but keep each addition in its own module, so it can land, change or be removed without touching the others.

### Classify queries with the command-time test

A query could count as inside a cached call whenever a recorded call is open on its thread, which is the test `_record_command_time` uses. That would also cover the two rare cases in [Known limitations](#known-limitations). But the product spec defines `time_in_cache` as queries during a computation, and a recorded call is also open while it hashes, waits and replays elements. The computation flags match that definition.

### Report parallel fragment CPU time only in aggregate

A single `parallel_fragment_cpu_time` needs no change to the per-fragment entries. It can't show whether the fragment that held up the run was computing or waiting, which is what the per-fragment breakdown is for. The aggregate is kept as well, because it's what the user code CPU formula needs.

## Open questions

1. **Guarding `start_call`.** `start_call` runs before every cached call and isn't wrapped in a guard. Its checks are attribute reads and a thread-local lookup, and the lookup appends the thread's stats to `_threads` under a lock once per run. A guard would cost little and would let a failure there fall back to a metrics-only timer.
2. **Attached threads in fragment entries.** Whether analysis needs a fragment's attached threads in its entry, which would need the locking described in [Alternatives considered](#count-a-fragments-attached-threads-toward-the-fragment).
3. **Per-function cache stats.** Where the random ID is stored, the cap per run, and which functions are kept past it: for example, the ones with the most cache time in the run.
4. **Data size for cached messages.** Whether a message sent as a reference to the browser's cached copy counts its full size, its reference's size or both, and whether compressed sizes are available without extra work.
