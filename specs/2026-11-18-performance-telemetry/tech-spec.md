---
author: sfc-gh-lwilby
created: 2026-11-23
---

# Performance telemetry

## Summary

The [product spec](product-spec.md) defines what each performance telemetry addition reports and how its numbers fit together. This tech spec defines how each one is recorded.

Most of it is a shared server-side foundation, which covers:

- where each time is recorded, on every thread a run uses;
- how a time that another reported time already contains is detected;
- how parallel fragments get their own breakdown;
- how recording stays cheap and never breaks the app.

Cache usage and the parallel fragment breakdown are built directly on it, and query time, CPU time and per-function cache stats reuse it. Rerun reason and data size don't overlap other times, so they're recorded where the value is already known. Render timing is measured in the browser and joined to the run's page profile.

The [telemetry reference](../../.claude/skills/understanding-streamlit-architecture/references/telemetry.md) has the rules every new field follows; this spec doesn't repeat them.

## Problem

### A run's work spans several threads

A script run's work can happen on:

- **The script thread**, which runs callbacks, the script, and fragments without `parallel=True`.
- **Parallel fragment workers.** Fragments with `parallel=True` run on a `ThreadPoolExecutor` that `ParallelFragmentCoordinator` creates for each full run. One worker thread can run several fragments one after another. A worker runs each fragment inside a copy of the submitting thread's `contextvars`, so it starts with that thread's `FragmentThreadState`.
- **Attached threads.** User code creates these by starting its own thread and attaching it with `add_script_run_ctx`. The only one Streamlit attaches itself, the timer that shows a delayed spinner, records nothing. The [multithreading guide](https://docs.streamlit.io/develop/concepts/design/multithreading) says this isn't officially supported, so this design keeps their times in the run's totals but doesn't break them down. Streamlit's own background threads, such as cache refresh threads, have no `ScriptRunContext`, so they record nothing. An attached thread gets a deep copy of the attaching thread's `FragmentThreadState`, but not the `in_cached_function` ContextVar.
- **Async tasks**, which interleave on an event loop on any of these threads. A task's wall-clock time includes whatever other tasks run while it awaits.

### Reported times overlap

Two terms are used throughout:

- A **listed command** is one that appears in `commands` with its time: a top-level `st.*` call within the tracking limits.
- A **recorded cached call** is one counted in the page profile's `cache_usage`. A call whose time another reported time already covers, such as a cached call nested inside another, isn't recorded.

Most times in the page profile are spans of wall-clock time, and spans nest: a command inside a cached function, a cached call inside a command, a query inside either, and all of it inside a parallel fragment. For analysis to subtract times from `exec_time` without counting a span twice, each new time has to know whether the span it measures is already inside another reported time.

Before this design, only command tracking handled nesting: `command_tracking_deactivated` and `in_listed_command` in `ThreadState` keep nested commands out of `commands`. Each attached thread and parallel worker starts with tracking on, so its own top-level commands are listed. Nothing separated parallel fragments' times from the main script's.

The per-function server metrics at `/_stcore/metrics` (`FunctionCacheMetrics`) answer a different question, so they don't leave nested calls out. They describe each cached function over the life of the process: every call counts toward its function's hits and misses, recorded or not, and its compute and wait durations are inclusive. An outer function's compute time there includes its nested calls, which also record their own. Each function's numbers are correct on their own, but summing durations across functions counts nested time twice. These metrics are never added up against a run's time, so this design leaves them unchanged.

### Constraints

- **Cache hits are hot.** A hit takes microseconds, and parallel fragments can hit the same cache at the same time. A lock shared across a run's threads would make them wait on each other.
- **Telemetry runs inside and around user code**, including in `finally` blocks and while a `RerunException` or the script's own error is propagating.
- **Usage stats can be off.** With `browser.gatherUsageStats = false`, per-call work must stop at a cheap check.
- **The profile is built once, on the script thread**, at the end of the run, while threads the script doesn't join can still be running.
- **Existing fields keep their meaning.** `commands` and `cache_usage` cover the whole run, including parallel fragments.
- **Additions land separately.** Each addition is its own change, so each must work without the others, and they share proto field numbers, the per-thread record and the per-fragment entry.

## Proposal

The first sections, from [Where the state lives](#where-the-state-lives) to [Cost](#cost), describe the shared foundation, including the parallel fragment breakdown that other additions add per-fragment fields to. Each addition then has its own section, starting with [Cache usage](#cache-usage), followed by the [field numbers](#field-numbers) they share.

### Where the state lives

Per-run state lives on `ctx`, the run's `ScriptRunContext`, mostly in `ctx.shared`, which every thread in the run shares. Per-thread state lives in `ThreadState`. A simplified outline, leaving out fields unrelated to telemetry, with fields from later additions marked:

```python
# Render timing is measured only in the browser, so it has no server-side state.

class ScriptRunContext:  # ctx: reset() at the start of each run
    shared: SharedRunState
    rerun_reason: RerunReason  # rerun reason: set once, when the run starts
    rerun_element_type: str | None  # rerun reason


class SharedRunState:  # ctx.shared: shared by all the run's threads
    stats: RunStats
    parallel_fragments: ParallelFragmentUsageStats


class RunStats:  # one per run, shared by all its threads
    _local: threading.local  # _local.stats: each thread sees only its own ThreadRunStats
    _threads: list[ThreadRunStats]  # references to every thread's and fragment run's, for the profile builder


class ThreadRunStats:  # written only by its own thread
    counts_cpu: bool  # CPU time: the script thread's record or a fragment run's
    command_time: float  # listed commands on this thread
    command_cpu_time: float  # CPU time: listed commands on this thread
    cache: ThreadCacheStats
    query: ThreadQueryStats  # query time
    # data size: its counts go here once designed


class ThreadCacheStats:
    cache_data: CacheTotals  # calls, hits, misses, ... and compute, wait, overhead
    cache_resource: CacheTotals
    async_overlap_time: float  # time that overlapping async calls counted more than once
    tracked_command_time: float  # listed commands during recorded calls
    _calls_open: int  # recorded calls open on this thread, for is_in_call
    _calls_in_cache_code: int  # open calls hashing or reading a result
    _overlap: _OverlapGroup | None  # the current group of overlapping async calls
    # per-function cache stats: counters keyed by function go here once designed


class ThreadQueryStats:  # query time
    snowflake_connector: QueryTotals  # queries, failed, ... and time, time_in_cache, time_in_commands
    sqlalchemy: QueryTotals
    snowpark: QueryTotals


class ParallelFragmentUsageStats:
    _runs: list[ParallelFragmentRunStats]  # in the order the runs started
    wait_time: float  # the script thread waiting in join() or drain()


class ParallelFragmentRunStats:  # one fragment run on its worker thread
    start: float
    end: float | None
    stats: ThreadRunStats  # the worker's record while the fragment runs
    cpu_time: float | None  # CPU time: the worker thread, from start to end


@dataclass(frozen=True)
class FragmentThreadState:  # ThreadState: a ContextVar, copied to attached threads
    in_listed_command: bool
```

At the start of each run, `SharedRunState.reset()` replaces `stats` and `parallel_fragments` with new objects instead of clearing them. Late work from the previous run, such as a cached call on a thread the script didn't join, then finishes into the old objects, which nothing reads, instead of the new run's totals.

### Per-thread totals without locks

Each thread writes only to its own `ThreadRunStats`, so recording a command, cached call or query takes no lock. Every addition that records per call adds its counters to this one record. `RunStats` keeps two references to each record:

- **`_local.stats`**, a `threading.local`, lets a thread find its own record. `current_thread_stats()` creates it the first time the thread records something in the run.
- **`_threads`** lets the profile builder sum every record, including those of threads that have exited. A `threading.local` value is visible only to its own thread and disappears with it.

The lock is taken only to append to `_threads`, once per thread per run. A parallel fragment run appends its own record too (see [Recording a fragment run](#recording-a-fragment-run)).

The profile builder reads the records without locking them. A call adds its counts and times only when it finishes, so one still running is left out, and one finishing during the build may be partly included. Where it reads two related values, the order makes a race leave a value out rather than count it twice. For example, it reads a thread's `async_overlap_time` before its open overlap group, and closing a group clears it before adding its overlap, so a group that closes in between is left out (see [Async calls on one event loop](#async-calls-on-one-event-loop)).

### Covered spans

Reported times can contain each other: a cached call inside a listed command, a listed command inside a cached function, a query inside either, and all of them inside a parallel fragment. Each addition handles an overlap in one of two ways:

- **Leave it out.** Command and cache times count a span toward the innermost listed command or recorded cached call that contains it, and the outer ones leave it out. A cached call made inside a listed command isn't recorded, because the command's time covers it. A listed command inside a cached function is left out of the cached call's times, because the command reports it. See [Cache usage](#cache-usage).
- **Report it separately.** Query time and CPU time describe what kind of work happened, not where, so a span can be both, such as a query inside a cached function. Leaving it out of either would understate one of them, so they count the whole span and report the overlapping part in their own fields: `time_in_commands` and `time_in_cache` for queries, and `command_cpu_time` for CPU. See [Query time](#query-time) and [CPU time](#cpu-time).

Either way, the code checks four scopes to decide where a span's time goes. Each scope uses existing state, so telemetry adds nothing to what threads and tasks inherit. `ThreadState` and `in_cached_function` are both ContextVars, so each async task has its own. `ThreadCacheStats` belongs to one thread, so its flags cover every task on that thread. None of the scopes reach threads that a cached function attaches (see [Threads attached inside a cached function](#threads-attached-inside-a-cached-function)).

| Scope | How it's marked | Where it's visible | Used by |
|---|---|---|---|
| Listed command | `in_listed_command` in `ThreadState`, set by `gather_metrics` | The command's thread | Cache, query and CPU time |
| Recorded cached call | `ThreadCacheStats.is_in_call` | Every task on the calling thread | Command and query time |
| Cached function, same task | The `in_cached_function` ContextVar | The calling task, including async tasks it creates | Cache time |
| Cache code (hashing, reading the result, replaying elements) | `ThreadCacheStats.is_in_cache_code` | The calling thread | Cache time |

Command time and query time share one test for whether a span is inside a recorded cached call:

```python
def in_recorded_cached_call(thread_stats) -> bool:
    return thread_stats.cache.is_in_call
```

It covers everything on the thread that the call's times include: the cached function's computation, the cache's own work such as a `hash_funcs` function and, in async code, other tasks that run on the thread while the call awaits. Cached calls use stricter checks before skipping a nested call (see [Cache usage](#cache-usage)).

Parallel fragments need no scope. A fragment's values go to its own record through the swap described in [Recording a fragment run](#recording-a-fragment-run).

#### Threads attached inside a cached function

None of these scopes reach a thread that a cached function attaches with `add_script_run_ctx`. Its work is part of the computation, but it records its cached calls, listed commands and queries as its own, like any other attached thread, so the cached call's compute time also contains them. Telemetry never adds state to these threads or changes what `add_script_run_ctx` copies. They're user-created, Streamlit doesn't officially support them, and keeping the framework's behavior in them unchanged matters more than attributing their time. See [Known limitations](#known-limitations) and [Alternatives considered](#cover-threads-attached-inside-a-cached-function).

### Parallel fragments

#### Recording a fragment run

When the run gathers usage stats, `_run_parallel_fragment` (`fragment.py`) wraps each fragment in `ParallelFragmentUsageStats.recording_run()` on its worker thread. `recording_run()` gives the fragment its own `ParallelFragmentRunStats` entry and points the worker's recording at it until the fragment ends:

```python
with self._lock:
    run = ParallelFragmentRunStats(time.perf_counter())
    self._runs.append(run)
try:
    with self._stats.recording_into(run.stats):
        yield run
finally:
    run.end = time.perf_counter()
```

- **Start.** The start time is read and the entry appended under one lock, so entries are in start order.
- **The swap.** `RunStats.recording_into()` puts the fragment's own `ThreadRunStats` in the worker's `_local.stats`, and restores the previous record afterwards. The record is also in `_threads`, so everything the worker records while the fragment runs, its commands, cached calls and queries, counts toward both the fragment's entry and the run's totals.
- **End.** The entry records its end time, and its CPU time with the CPU time addition, even if the fragment raises.

A nested parallel fragment runs with its own entry, so its values aren't added to its parent's. Entries are per fragment run, not per worker thread, because a worker can run several fragments in turn.

#### Which threads count toward a fragment

Only the worker thread counts toward its fragment's entry. If user code in the fragment starts and attaches its own threads, they count toward the main script, like threads the main script attaches. Each gets its own record the first time it records something, so nothing it does reaches the fragment's record.

Because an entry counts only its worker's work, its times never overlap each other. So a fragment's user code time, its `exec_time` minus its command and cache times, can't go negative, and its CPU time can't exceed its `exec_time`. The cost, only in apps that attach their own threads, is that the main script's user code time can go negative: an attached thread usually runs while the script thread waits for the fragment, so its time overlaps `wait_time`.

#### Waiting for fragments

The script thread waits for its fragments in `ParallelFragmentCoordinator.join()` after the script ends, or in `drain()` when the script ends early, for example with `st.stop()`, a rerun request or an uncaught exception. `_recording_parallel_fragment_wait` (`script_runner.py`) times both and adds them to `wait_time`. If `join()` raises, the time of `join()` and then `drain()` is added, because the two run one after the other. `join()` waits for nested fragments too, so `wait_time` covers them.

`wait_time` is part of `exec_time`, but not of the main script's user code.

#### Building the entries

`_fill_parallel_fragment_usage` (`metrics_util.py`) fills `parallel_fragment_usage`, and leaves it unset when no parallel fragment ran:

- The first `_MAX_PARALLEL_FRAGMENT_RUNS` (25) runs to start get an entry each. Later runs are added together into `overflow`, which has no start time. `run_count` counts every run.
- Each entry's times are summed across sources: cache times across `st.cache_data` and `st.cache_resource`, and query times across query sources. Cache counts are reported once, in `parallel_fragment_usage.cache_usage`, across all runs, including the overflow.
- A run still going when the profile is built counts up to then. Its cached calls and queries still in progress aren't included, so its user code time reads high.

Only full runs have parallel fragments. A fragment rerun runs its fragments inline (`parallel and not ctx.fragment_ids_this_run` in `fragment.py`) and sends its own page profile.

#### Reading the numbers

Here, cache time means compute, wait and overhead time minus the async overlap time (see [Async calls on one event loop](#async-calls-on-one-event-loop)), for the run and for each fragment.

- A fragment's user code time is its `exec_time` minus its command time and cache time.
- The main script's user code time is:

  ```
  exec_time − prep_time − wait_time
    − (command time − fragments' command time)
    − (cache time − fragments' cache time)
  ```

  The fragments' times include the overflow entry.

Query time and CPU time don't change these formulas, because they report their overlaps separately. They split user code time further (see [Query time](#query-time) and [CPU time](#cpu-time)).

### Building the profile

`create_page_profile_message` reads one `time.perf_counter()` value and passes it to both `_fill_cache_usage` and `_fill_parallel_fragment_usage`. An overlap group still open and a fragment still running are measured to the same instant, so the top-level and per-fragment values agree. The script runner already builds the profile inside a `try`, so a failure there drops that run's profile and nothing else.

### Failures never reach the app

Following `$44 Contain Failures`, each hook that runs inside or around user code catches `Exception` and logs it at debug level, as `gather_metrics` already does. Where telemetry sets up a context manager around user code, an `ExitStack` guards entering it without also catching the user code's errors.

| Hook | Runs | If telemetry raises |
|---|---|---|
| `CacheCallTimer` | When a recorded cached call opens, around its compute and wait phases, and in `finish()`, a `finally` around the call | The call is missing from the run totals. The function's result or error is unchanged, and the thread's later cached calls are still recorded. |
| `_record_command_time` | After a command returns or raises `RerunException` | The command's time is missing from some destinations. |
| `recording_run()` in `_run_parallel_fragment` | Around each parallel fragment | The fragment runs without an entry. |
| `_recording_parallel_fragment_wait` | In a `finally` around `join()` and `drain()`, possibly while the script's error propagates | `wait_time` misses that wait. |
| Query hooks | Around `SnowflakeConnection.query()`'s execute call, in each SQLAlchemy execute event and in each Snowpark notification | The query is missing from the totals. Its result or error is unchanged. |
| CPU clock reads | At the start and end of the run, around listed commands and around each parallel fragment | The CPU fields are left unset. |

Unit tests inject a failure into each hook and check that the caller sees the same result or error as without telemetry.

### Cost

Following `$52 Pay Only for What You Use`:

- **Usage stats off.** Each hook stops at a check of `ctx.gather_usage_stats`. No fragment run or wait is recorded.
- **Locks** are taken once per thread per run to append its record to `_threads`, and once per parallel fragment run.
- **Payload.** `parallel_fragment_usage` is sent only by runs with parallel fragments, and adds at most about 4 KB (see the product spec).

### Cache usage

Cache usage leaves overlaps out. Before `start_call` records a cached call, it checks three of the scopes in [Covered spans](#covered-spans): a listed command, `in_cached_function` and cache code. If any of them is set, the call's time is already covered, and the call goes only to the server metrics. It doesn't skip calls just because another recorded call is open on the thread, so in async code a call that another task makes while one awaits is still recorded, and the overlap is reported instead (see [Async calls on one event loop](#async-calls-on-one-event-loop)). A task that an async cached function starts with `asyncio.create_task()` keeps a copy of `in_cached_function`, so its cached calls stay unrecorded even after the computation ends.

#### Commands inside cached calls

`ThreadCacheStats.tracked_command_time` counts the time of listed commands that ran on the thread while a recorded cached call was open. `CacheCallTimer` snapshots it when the call starts and when its computation starts, so `finish()` can take the commands out of the right times:

- **Compute time** is the computation's wall-clock time, minus commands during the computation on this thread.
- **Overhead time** is the rest of the call's wall-clock time, minus its wait and compute time and the remaining command time.

Both are clamped at zero.

`_record_command_time` (`metrics_util.py`) adds each listed command's time to the thread's record, which on a parallel fragment's worker is the fragment's:

```python
stats = ctx.shared.stats.current_thread_stats()
stats.command_time += seconds
stats.cache.record_tracked_command_time(seconds)
```

`record_tracked_command_time` takes the time only if a recorded cached call is open on this thread, so a command is subtracted from at most one cached call.

#### Cache code never awaits

A cached call made from inside the cache's own code, such as from a `hash_funcs` function, is already covered by the outer call's overhead time, so `start_call` skips it. `ThreadCacheStats` detects this with a count of calls currently in cache code. A call enters cache code when it opens, leaves while it waits for another caller or runs the function, and returns when that ends. Cache code never yields to the event loop, so a call that starts while the count is above zero must come from inside it.

This only holds if `CachedFunc` never awaits outside its wait and compute phases. Otherwise, another task's call on the same event loop would be skipped wrongly. A new `await` in `CachedFunc` must be wrapped in `leave_cache_code` and `enter_cache_code`. A unit test enforces this: it runs a miss, a waiting caller, a hit and a miss that raises, for both decorators, with a concurrent task that fails if it ever sees a call in cache code.

#### Async calls on one event loop

Async cached calls that are awaited at the same time each count the wall-clock time they share, so their sum can exceed the time that passed. Rather than change the calls' times, `ThreadCacheStats` reports the excess as `async_overlap_time`, which analysis subtracts from cache time:

- A group starts when a call opens on the thread while another is open, and ends when no call is open.
- The group adds up the compute, wait and overhead time, for both cache types, of the calls that finish while it's open.
- When the group closes, its span is its wall-clock time minus the listed command time on the thread during it, because the calls' own times already leave that out. Whatever the calls' total exceeds the span by is added to `async_overlap_time`.
- A group still open when the profile is built is measured up to then.

Calls that don't overlap add nothing. Calls on different threads are never compared, because times from concurrent threads are added together anyway (see [Known limitations](#known-limitations)). The run reports `CacheUsage.async_overlap_time`, and each fragment entry its `cache_async_overlap_time`.

#### Cost

- **Usage stats off.** `start_call` returns a timer that only updates the server metrics.
- **A recorded cache hit** adds one or two microseconds: a few `perf_counter` calls and attribute updates on the thread's own stats.
- **A recorded cache miss** runs the cached function exactly as without telemetry, with only the timer's bookkeeping around it.
- **Locks.** A cached call takes none.

### Query time

#### Where queries are caught

Each client library is hooked where Streamlit already creates or manages its objects. Recording never changes the cursors, engines or sessions an app gets, and uses only hooks the library provides. Nothing is imported unless the app already uses the library, and no hook is installed while usage stats are off.

| Source | Hook | Installed |
|---|---|---|
| Snowflake connector | `SnowflakeConnection.query()` times its own `cursor.execute` call. The cursor it creates, and the one `.cursor()` returns, is the connector's own. | Around each `query()` execute |
| SQLAlchemy | Cursor execute events on the engine behind `SQLConnection`, which also cover its `session` and its `execution_options()` copies. Other engines aren't affected. | When a `SQLConnection` connects |
| Snowpark | A `QueryListener` on sessions from `SnowflakeConnection.session()` and on the active session. Snowpark notifies it on the thread that ran the query, after the query finishes and without its duration, so Snowpark queries are counted but not timed. Needs Snowpark 1.26 or later. Added only when thread-safe sessions are on (`PYTHON_SNOWPARK_ENABLE_THREAD_SAFE_SESSION`): otherwise Snowpark's listener lock does nothing, and adding a listener to a session other threads are using could break a query whose listeners are being notified. | When a connection connects or a run starts |

Each `SQLConnection` engine gets its events once, when it connects, and each Snowpark server connection gets the listener at most once, so reruns and new sessions don't add more. A `SQLConnection` engine and a Snowpark session are shared across sessions and runs, so each recorded query finds its run through the calling thread's `ScriptRunContext`. A query on a thread without a run that gathers usage stats isn't recorded. A timed query's time covers only the driver's execute call, so fetching the results isn't included.

#### Recording and attribution

Queries are recorded in the thread's `ThreadRunStats`, under `query` (see [Per-thread totals without locks](#per-thread-totals-without-locks)). A parallel fragment's queries go to its own record through the same swap, so its entry reports `query_time`, `query_time_in_cache` and `query_time_in_commands`, summed across sources.

When a query starts, it's placed in at most one of the overlapping parts, using the tests in [Covered spans](#covered-spans):

```python
if thread_state.in_listed_command:
    return True, False  # inside a command
return False, in_recorded_cached_call(stats)
```

- **Inside a command** wins, because the command's time contains the query, and a cached call made inside a command isn't recorded.
- **Inside a cached call** covers everything on the thread that a recorded call's times include: its computation, the cache's own work such as a `hash_funcs` function and, in async code, other tasks' queries while it awaits.

So `time − time_in_cache − time_in_commands` is query time that's otherwise part of user code, and subtracting `time_in_cache` from cache time leaves the cache's other work.

#### Failures and cost

A hook that fails logs at debug level and never changes a query's result or error. Recording adds about 1.5 µs per timed query and about 0.5 µs per Snowpark query. A SQLAlchemy query adds about 5 µs, about half of it SQLAlchemy's own event dispatch, which any listener pays. A Snowflake query takes tens of milliseconds or more.

### CPU time

#### Clocks and span

CPU time is read with `time.thread_time()` for a thread and `time.process_time()` for the process. Every CPU field covers the run from the end of prep until the profile is built, the span of `exec_time − prep_time`, so that user code CPU time lines up with user code wall time:

```
user code CPU = script_cpu_time + parallel_fragment_cpu_time − command_cpu_time
```

| Field | Measures |
|---|---|
| `script_cpu_time` | The script thread |
| `command_cpu_time` | Listed commands on the script thread and in parallel fragments |
| `parallel_fragment_cpu_time` | All parallel fragment runs, including the overflow |
| `process_cpu_time` | The whole process |
| `ParallelFragmentRun.cpu_time` | One parallel fragment run, on its worker thread |

All the run fields are `optional`, so a run that only waits reports a real 0. They're set together, or all left unset where the platform has no per-thread CPU clock or reading it raises.

#### Attribution

- **Commands.** `gather_metrics` reads the thread's clock around each listed command and adds the difference to the thread's `ThreadRunStats`. `command_cpu_time` sums only the records whose thread's CPU time is also reported, `counts_cpu`: the script thread's record and each fragment run's. So user code CPU time never subtracts CPU time it didn't add. Commands without a listed time, because they're past the tracking limits or raise anything other than a rerun request, count as user code, matching wall time. Nested commands count toward the outer command.
- **Parallel fragments.** `recording_run()` reads the worker's clock when the fragment starts and when it ends, and stores the difference in the fragment's `ParallelFragmentRunStats`. `parallel_fragment_cpu_time` is summed from those entries when the profile is built, so no separate total is kept. The time is stored before the coordinator counts the worker as finished, so it's complete once `join()` or `drain()` returns. A parallel fragment nested in another has its own run on its own worker. A fragment without `parallel=True` counts toward the thread that runs it.
- **Fragment reruns** run on the script thread, so their CPU time is in `script_cpu_time` and `parallel_fragment_cpu_time` is 0.
- **Attached threads** are only in `process_cpu_time`, including their listed commands. Process CPU time also includes library thread pools, such as NumPy, Polars and DuckDB, the server itself and, on a shared server, other sessions.

A fragment's CPU time is compared with its `exec_time` to split its time into computing and waiting. Its commands' CPU time isn't split out per fragment.

#### Platforms and cost

On Windows, CPU clocks advance in steps of about 15.6 ms, so short spans often read 0 and only aggregates are meaningful. A listed command adds about 0.4 µs (two clock reads and an add), and a run about 1.5 µs. No clock is read while usage stats are off. Waiting for the GIL counts as waiting, not CPU time.

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
3. **When the run starts.** The script runner upgrades the reason if a higher-precedence one applies:
   - `initial_load` if the session has no current page yet;
   - `navigation` if the page changes;
   - `query_params_change` if the incoming query string differs from the session's query params, so params the script itself wrote don't count;
   - `widget_interaction` if `_call_callbacks` finds a changed widget.

   Runs with no reason, such as `AppTest` reruns, report `unknown`.

`rerun_element_type` comes from the changed widgets' metadata. `register_widget` takes a required keyword-only `element_type`, the same literal each widget uses for its element ID, so only Streamlit's fixed element type names are sent. Custom components report `component_instance` (v1) or `bidi_component` (v2), never the component's name. `register_widget` is internal but re-exported from `streamlit.runtime.state`, so a third-party caller that doesn't pass `element_type` gets a `TypeError`.

`_call_callbacks` already visits every changed widget, so the added work per run is collecting their metadata and one query param comparison, which runs only while usage stats are on.

### Data size

Each count is measured where it's already known, so none needs a second serialization pass:

- **Arrow bytes** are counted where dataframes and charts are serialized, in the serializing thread's `ThreadRunStats`.
- **Bytes received, and messages served from the browser's cache,** are counted in the browser, because only the browser knows which references it resolved locally.

The server doesn't count message bytes (see [Count message bytes on the server](#count-message-bytes-on-the-server)).

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

In `CacheUsage`, `async_overlap_time` is 3. In `ParallelFragmentRun`, 1–6 hold the foundation's times, 7–9 query time, 10 CPU time and 11 `cache_async_overlap_time`. Per-function cache stats and data size take the next free numbers when they're designed.

### Known limitations

- **Concurrent threads add up.** Times from different threads are added together, so the totals can exceed wall-clock time. Parallel fragments report their share. Threads that user code attaches have no breakdown, so in apps that use them, subtracting their times from `exec_time` can give a negative user code time.
- **Threads a fragment attaches** count toward the main script and usually overlap `wait_time`.
- **Threads a cached function attaches** record their cached calls, listed commands and queries as their own, while the cached call's compute time also contains them, so that time is counted twice.
- **Unfinished work.** Cached calls still running when the profile is built are left out, and a thread the script doesn't join can be partly included.
- **The async overlap is a total.** `async_overlap_time` corrects the sum of the cache times, but doesn't say which calls overlapped, so compute, wait and overhead time still overlap each other in async code.
- **Unrecorded query paths and Snowpark times.** The paths the product spec lists as not recorded stay in user code, and Snowpark queries are counted but not timed.
- **Profiles of interrupted runs are usually dropped.** A run cut short by a rerun request enqueues its profile, but the next run clears the forward message queue when it starts, and `AppSession._clear_queue` doesn't keep `page_profile` messages. This affects every field and is fixed separately.

## Alternatives considered

### One run total behind a lock

Every cached call would add to a single `CacheUsage` under a lock. It's simpler, but concurrent cache hits from parallel fragments would wait on each other, and the lock would cost more than the hit it measures. Per-thread stats are written without contention and combined once per run.

### Cover threads attached inside a cached function

Threads a cached function attaches could count as part of its computation, so their cached calls aren't recorded and their commands and queries come out of its compute time. Two ways were considered:

- **Copy `in_cached_function` to attached threads.** This would change element replay and the widget checks inside cached functions for those threads, which breaks the rule that telemetry never changes behavior. It also couldn't carry the threads' command time back to the cached call.
- **Share a scope object through `ThreadState`.** Every miss would run the cached function inside a `ThreadState` override, and `add_script_run_ctx` would hand user threads a shared, mutable framework object. It would also cover only threads that the cached function attaches before starting them. A worker that attaches itself, the usual pattern with `ThreadPoolExecutor`, builds its state from the `ScriptRunContext` alone, so its calls would still be counted twice.

Both put framework state into user-created threads that Streamlit doesn't officially support, to fix the numbers for a pattern that is rare and only partly covered. Leaving these threads alone keeps cache misses on the same code path as without telemetry.

### Scale overlapping async calls down

Each group's compute, wait and overhead times, for both cache types, could be scaled down to fit the group's span, so the cache times add up with no extra field. That needs every group's totals kept per field and rescaled when it closes, an open group rescaled when the profile is built, and other times measured during the calls, such as query time, would still be unscaled. Giving each shared instant to one call instead would need every call's intervals. One field that analysis subtracts is simpler, and works the same way for every cache time.

### Record per worker thread instead of per fragment run

Giving each worker thread its own `ThreadRunStats` would need no swap, but one worker can run several fragments, so per-thread entries would merge them and couldn't show which fragment held up the run.

### Count a fragment's attached threads toward the fragment

The entry would then cover all of a fragment's work. It would need a lock on each entry, and its times would sum across threads, so the fragment's user code time could go negative, which the product spec rules out. Attached threads are treated the same way everywhere instead, and a per-fragment breakdown of them can be added later if analysis needs it.

### Report the main script's share instead of whole-run totals

Top-level `commands` and `cache_usage` could leave out the fragments, so no subtraction is needed. That changes the meaning of existing fields, which existing analysis relies on. The fragments' share is reported separately instead.

### Clear the stats in place at the start of a run

Clearing would keep the same objects across runs, but a cached call or fragment still running from the previous run would then add its times to the new run. It also can't reset each thread's `_local.stats`, because one thread can't clear another thread's `threading.local` value. The script thread would keep recording into last run's record, which the cleared `_threads` list no longer contains.

### A per-thread registry for each addition

Each addition could keep its own registry, with its own `threading.local`, `_threads` list, lock and `recording_into()`, so it lives entirely in its own module. That repeats the same code for cache stats, query time and data size, takes another lock per thread per run for each, and makes every addition edit `recording_run()` and `reset()`. Command time and command CPU time would also need their own routes to the fragment's entry, such as a `ParallelFragmentRun` in `ThreadState` with a check that the command ran on the worker. One record gives every per-thread value the same route.

### Count only queries during a computation as inside a cached call

Queries could count as inside a cached call only during the cached function's computation, using `in_cached_function`. That leaves out queries the cache's times still include: queries from a `hash_funcs` function, which are in overhead time, and other async tasks' queries while a call awaits, which are in its wall-clock time. Subtracting both `time_in_cache` and the cache time would then count those queries twice. Using the same test as command time removes the gap.

### Record every Snowflake connector cursor and SQLAlchemy engine

`SnowflakeConnection` could create its cursors as a `SnowflakeCursor` subclass that times `execute`, and SQLAlchemy events could be installed on the `Engine` class, so queries on `conn.cursor()` and on engines the app creates would be recorded too. Both reach into objects the app uses. The cursor subclass depends on the connector's internals, which differ between major versions: connector 5 no longer routes `execute_async` and `describe` through `execute`. A connector version that changed those internals again would break every query, not just the telemetry. Wrapping the cursor `.cursor()` returns in a proxy avoids the subclass, but still hands the app an object that isn't the connector's own, which breaks `isinstance` checks and code that relies on the cursor's type. Class-wide SQLAlchemy events run inside every engine in the process, including ones Streamlit never created. Missing those queries is the safer failure, so only Streamlit's own calls are timed until the libraries provide hooks (see the product spec's open questions).

### Report parallel fragment CPU time only in aggregate

A single `parallel_fragment_cpu_time` needs no change to the per-fragment entries. It can't show whether the fragment that held up the run was computing or waiting, which is what the per-fragment breakdown is for. The aggregate is kept as well, because it's what the user code CPU formula needs.

### Count message bytes on the server

`ScriptRunContext.enqueue` calls `populate_hash_if_needed`, which serializes every message except references and `initialize` to compute its hash. The server could add each message's size to the enqueuing thread's `ThreadRunStats` there for a few additions per message. That would answer the same question as the browser's received bytes, how much data a run sends, but from what the server queued rather than what arrived: it would include messages cleared from the queue when a rerun starts. The browser's count is the more direct measure, so the server doesn't keep a second one.

## Open questions

1. **Guarding `start_call`.** `start_call` runs before every cached call and isn't wrapped in a guard. Its checks are attribute reads and a thread-local lookup, and the lookup appends the thread's stats to `_threads` under a lock once per run. A guard would cost little and would let a failure there fall back to a metrics-only timer.
2. **Attached threads in fragment entries.** Whether analysis needs a fragment's attached threads in its entry, which would need the locking described in [Alternatives considered](#count-a-fragments-attached-threads-toward-the-fragment).
3. **Per-function cache stats.** Where the random ID is stored, the cap per run, and which functions are kept past it: for example, the ones with the most cache time in the run.
4. **Data size for cached messages.** Whether a message sent as a reference to the browser's cached copy counts its full size, its reference's size or both, and whether compressed sizes are available without extra work.
