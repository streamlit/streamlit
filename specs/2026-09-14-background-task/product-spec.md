---
author: sfc-gh-lwilby-1
created: 2026-09-14
status: early draft
---

# `st.task` — non-blocking background execution

## Summary

A managed API for running long-running work off the script thread so the app stays
responsive. The task survives reruns, optionally deduplicates across sessions (app-scoped
execution by default), and automatically triggers a rerun when the result is ready. The
user controls what to show in each state (loading, done, error) via a returned handle.

## Problem

Streamlit's rerun model blocks the script thread for the entire duration of every
function call. When a cached function has a cold miss, or a user triggers a slow query,
the entire app freezes — no widget interactions are processed until the call returns.

The community has asked for background execution for years:

- [#6687](https://github.com/streamlit/streamlit/issues/6687) — Original request for
  non-script-blocking functions (19 👍). Proposes a decorator/API that shows a spinner
  while a slow function runs without blocking downstream statements.
- [#8488](https://github.com/streamlit/streamlit/issues/8488) — Native asyncio support
  (148 👍), the strongest demand signal. While `async`/`await` support shipped in 1.65
  (script-thread event loop + async caches), `await` still blocks the script thread —
  the non-blocking execution gap is exactly what `st.task` addresses.
- [#10603](https://github.com/streamlit/streamlit/issues/10603) — Fragments as
  independent non-blocking tasks. Users want a fragment in progress to not freeze the
  rest of the app, and interactions elsewhere to not interrupt it — the same core need
  expressed through the fragment metaphor.

**No clean workaround exists today.** There is no public API to trigger a rerun from a
background thread, so users cannot build non-blocking execution themselves. The closest
pattern is spawning a thread that writes results to a shared variable, then polling with
`run_every` on a fragment to check for completion — but this has polling latency, no
lifecycle management, no deduplication, and no error propagation. Existing concurrency
features (parallel fragments, cache background refresh) address different needs and are
discussed in [Relationship to other features](#relationship-to-other-features).

### Use cases

| Use case | Description |
|----------|-------------|
| **Long-running query** | User picks filters, triggers a slow DB query. The rest of the page stays interactive; the result fills in when ready. |
| **BI dashboard with outlier query** | A dashboard has several fast data sources and one slow one (e.g., a 30-second aggregation). The user can interact with the sections that have already loaded — changing filters, navigating — while the slow section shows a spinner and fills in when ready. |
| **LLM / model inference** | Model calls that take seconds to minutes. User can interact with other parts of the app while waiting. |
| **File processing / report generation** | User uploads a file or kicks off a report. Processing runs off-thread; the result appears when done. |
| **Side-effect tasks** | Send an email, write to a database, trigger an external pipeline. Fire-and-forget work that shouldn't block the UI. |

## Proposal

### Command name: `st.task`

The simplest name that works. Streamlit can define "task" as a first-class concept
(managed, non-blocking, deduped, lifecycle-tied work), just as it defined "fragment."

Alternatives considered: `st.background_task` (fully self-documenting, but verbose at 15
chars and implementation-oriented — "background" describes the mechanism, not the user
intent) and `st.defer` (short and intent-oriented, but an imperative verb for a
handle-returning command, and "defer" implies "run later" rather than "run concurrently").

### API

This is a new command rather than an extension of `st.cache_data` because the return type
is fundamentally different. `st.cache_data` always returns `T` — there is no way to
express "no value yet, loading." A handle with explicit `running`/`done`/`error` states
requires a different API contract.

```python
st.task(
    func: Callable[..., T],
    *,
    args: tuple[Any, ...] = (),
    kwargs: dict[str, Any] | None = None,
    key: str | None = None,
    deduplicate: bool = True,
) -> Task[T]
```

Returns a `Task` handle that the script reads on each rerun to determine what
to render. If `key` is not provided, it is auto-generated from the function identity and
argument values (consistent with `st.cache_data` key generation).

### `Task` handle

```python
class Task[T]:
    @property
    def status(self) -> Literal["pending", "running", "done", "error"]: ...

    @property
    def running(self) -> bool: ...    # status in ("pending", "running")

    @property
    def done(self) -> bool: ...       # status == "done"

    @property
    def result(self) -> T: ...        # raises if not done

    @property
    def error(self) -> BaseException | None: ...  # the exception, if status == "error"
```

### Behavior

**Submission and deduplication.** When `st.task` is called:

1. The runtime looks up the task by `key` in the task registry.
2. If `deduplicate=True` (default), the registry is app-wide — all sessions share one
   execution per key. If a task with the same key is already running (submitted by this or
   another session), return a handle to the existing task. This avoids N sessions running
   N copies of the same slow query.
3. If `deduplicate=False`, the registry is per-session — each session gets its own
   execution even if the key matches. This is correct for side effects (emails, DB writes)
   where each call is an intentional action.
4. If no task exists for this key (or the existing task completed and was consumed),
   submit the function to the bounded thread pool and register it. The calling session is
   recorded as a subscriber.
5. Return a `Task` handle reflecting the current state.

The `key` identifies the task across reruns. When omitted, it is auto-generated from the
function and arguments (like `st.cache_data`). When `deduplicate=True` (default), two
calls with the same key share one execution regardless of which session made the call.

```python
# Auto-key from function + args — simplest usage
task = st.task(slow_query, args=(region,))

# Explicit key for side effects
task = st.task(send_email, args=(to, body), key=f"send_{report_id}", deduplicate=False)
```

**Auto-rerun on completion.** When the task finishes (success or error), the runtime
triggers a targeted rerun in every subscribing session. If the task was called inside a
fragment, only that fragment reruns (not the whole app). On the next rerun, the handle
reflects the completed state and the script renders the result.

**Superseding.** If a session calls `st.task` with a key that already has a completed
result, the handle returns that result immediately (`task.done` is `True`). When inputs
change (e.g., the user selects a different region), the auto-generated key changes and a
new task is submitted. The old task's result remains available under its original key
until it is no longer referenced by any session.

**Lifecycle.**

- A task is kept alive as long as at least one session has called `st.task`
  with its key during the current or most recent script run.
- When no session references a key (all subscribers disconnected, or the call site is no
  longer reached during reruns), the task and its result are eligible for cleanup.
- A running task whose last subscriber disconnects is allowed to complete (we cannot
  safely kill a Python thread), but its result is discarded.
- On app shutdown, all tasks are abandoned.

### Examples

**Basic usage — long-running query:**

```python
import streamlit as st

def slow_query(region):
    # Imagine this takes 30 seconds
    return db.query("SELECT ... WHERE region = ?", region)

region = st.selectbox("Region", ["US", "EU", "APAC"])

task = st.task(slow_query, args=(region,))

if task.running:
    st.info(f"Loading {region} data...")
elif task.error:
    st.error(f"Query failed: {task.error}")
elif task.done:
    st.dataframe(task.result)

# These are interactive even while the query runs
threshold = st.slider("Threshold", 0, 100, 50)
st.metric("Current threshold", threshold)
```

The first run submits the task and shows "Loading..." — the script completes immediately,
so the slider and metric below render and respond to interaction. When the query finishes,
the runtime triggers a rerun and `task.done` is `True`.

**Fire-and-forget side effect:**

```python
st.header("Sales Dashboard")
st.line_chart(cached_sales_data)
st.bar_chart(cached_revenue_data)

if st.button("Send report"):
    task = st.task(
        send_email,
        args=(to, subject, body),
        key=f"send_{report_id}",
        deduplicate=False,
    )
    if task.running:
        st.info("Sending...")
    elif task.done:
        st.success("Report sent!")
    elif task.error:
        st.error(f"Failed to send: {task.error}")

# Dashboard remains fully interactive while the email sends
region = st.selectbox("Region", ["US", "EU", "APAC"])
date_range = st.date_input("Date range", value=(start, end))
```

When called inside a fragment, task completion triggers only that fragment's rerun — not
the whole page.

### Error handling

- **Task function raises an exception:** The exception is captured. On the next rerun,
  `task.error` contains the exception and `task.status` is `"error"`. The user decides
  how to surface it (e.g., `st.error`, `st.exception`, retry logic).
- **Task function raises after all subscribers disconnected:** The exception is logged
  (warning level) and discarded.

### Thread pool

Tasks execute on a process-wide bounded thread pool shared across all sessions.
When the pool is full, new tasks queue until a slot opens — the handle stays in
`running` state and the script completes normally. There is no synchronous fallback
because that would block the script and defeat the purpose of the feature.

The pool size defaults to 4 (matching cache background refresh) and is configurable
via `runner.taskMaxWorkers` in `config.toml`. Minimum is 1. A conservative default
keeps memory usage predictable in multi-session deployments (each thread carries stack
overhead). The `deduplicate=True` default further reduces effective concurrency — many
sessions sharing the same query run it only once.

## When to use `st.task` vs. related features

| Situation | Use | Why |
|-----------|-----|-----|
| Function called repeatedly, cache usually warm | `st.cache_data` (+ `refresh_mode="background"` for stale-while-revalidate) | Returns `T` directly. Blocks only on cold miss — acceptable when the cache is usually warm. |
| Multiple dashboard sections backed by slow data sources | `@st.fragment(parallel=True)` | Concurrent within-run execution reduces total load time to `max(times)`. The app is unresponsive during loading, but the wait is shorter. |
| User triggers a slow operation, app must stay responsive | `st.task` | Non-blocking. The script completes immediately, the user interacts freely, and the result fills in when ready. |
| Dashboard cold start — first visit, no cached values | `st.task` | No stale value to serve, so `st.cache_data` would block. `st.task` lets the app render a loading state while data loads. |
| Fire-and-forget side effect (email, DB write) | `st.task` with `deduplicate=False` | Runs off-thread without blocking. Each call is independent. |


## Out of scope (future work)

- **Scheduled / cron-based execution**: A platform/deployment concern, not a Streamlit
  API. `st.App(lifespan=...)` handles startup warming; `st.cache_data` with `max_stale`
  and `refresh_mode="background"` keeps caches fresh during the app's lifetime.
- **Continuous / long-lived tasks**: Event listeners, polling loops, and subscription-based
  patterns (e.g., Firestore snapshots) are a fundamentally different paradigm from
  `st.task`'s run-to-completion model. These fall under the reactive data layer
  (`@st.data`) exploration.
- **Progress reporting**: Reporting intermediate progress from a running task (progress
  bars, status messages). Requested in [#6687](https://github.com/streamlit/streamlit/issues/6687).
  Requires the background thread to communicate incremental state back to the session;
  could be added later via a callback or shared state mechanism on the `Task` handle.
- **Cancellation API**: Explicitly cancelling a running task. Python threads are not safely
  killable; cancellation would be cooperative at best. Deferred pending demand signal.
- **Rerun-resilient streaming**: LLM streaming that survives widget interactions
  ([#14524](https://github.com/streamlit/streamlit/issues/14524)). Likely an extension of
  `st.write_stream` rather than a new command, potentially using the same background task
  executor internally.

## Validation

```python
# Valid:
st.task(slow_query, args=(region,))                                        # auto-key
st.task(slow_query, args=(region,), key="my_query")                        # explicit key
st.task(send_email, args=(to, body), key="send_report", deduplicate=False) # side effect

# Invalid:
st.task(slow_query, key="")          # ERROR: key must be non-empty
```

## Checklist

| Item                         | ✅ or comment                                                        |
|------------------------------|----------------------------------------------------------------------|
| Works on SiS, Cloud, etc?   | ✅ Works on all supported runtimes. |
| No breaking API changes      | ✅ New API, fully additive.                                          |
| No new dependencies          | ✅ Uses stdlib `concurrent.futures` and existing internal machinery (`request_rerun`, `call_soon_threadsafe`). |
| Metrics collected            | Needs instrumentation for adoption tracking (task submissions, completions, errors, dedup hits). |
| Any security/legal impact?   | ✅ No new security concerns. Tasks run in the same process with the same permissions. |
| Any docs changes needed?     | ✅ New API reference page. Guide for common patterns (loading states, combining with cache, fragment-scoped tasks). |
