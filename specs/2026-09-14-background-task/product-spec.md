---
author: sfc-gh-lwilby-1
created: 2026-09-14
status: early draft
---

# Non-blocking background execution

## Summary

Keep the app responsive while long-running work runs off the script thread.

1. **Proposed now — non-blocking cached execution.** Run a cached function's computation
   off-thread and expose its state (`running` / `done` / `error`) instead of blocking, so a
   cold cache does not freeze the app.
2. **Future consideration (not proposed for immediate shipping) — `st.task`
   fire-and-forget.** A standalone handle-based API for non-memoized one-shot work (send an
   email, write to a DB, kick off a job). Documented here to scope out the different types of
   background work and position the primary design within that landscape, but it is a
   separate later effort — **out of scope for what we build first**.

## Problem

Streamlit's rerun model blocks the script thread for the entire duration of every
function call. When a cached function has a cold miss, or a user triggers a slow query,
the entire app freezes — no widget interactions are processed until the call returns.

Non-blocking execution is a long-standing community request:

- [#6687](https://github.com/streamlit/streamlit/issues/6687) — Original request for
  non-script-blocking functions (19 👍). Render the page, then "fill in" the slow part
  when it finishes — the canonical memoized-query case.
- [#8488](https://github.com/streamlit/streamlit/issues/8488) — Native asyncio support
  (148 👍), the strongest demand signal. We shipped the async library support (1.65's script-thread
  event loop) request, but `await` still blocks the script thread which is another limitation highlighted in this issue.
- [#10603](https://github.com/streamlit/streamlit/issues/10603) — Fragments as
  independent non-blocking tasks. A fragment in progress should not freeze the rest of the
  app — the same core need through the fragment metaphor.

**`refresh_mode="background"` already covers half of this, but not cold start.** Cache
background refresh keeps the *stale* path non-blocking: when a value exists but its TTL has
expired, it serves the stale value immediately and refreshes behind the scenes. But on a
**cold miss** (no value yet) it still blocks.

Users cannot build this themselves: there is no public API to trigger a rerun from a
background thread, so the closest workaround (a thread plus `run_every` polling) is fragile.

### Two kinds of background work

The axis that drives the design is whether the result should be **memoized**:

| | Cache the result (memoize) — **proposed now** | Run on demand (don't memoize) — **future `st.task`** |
|---|---|---|
| When | The result is a function of its inputs, worth reusing across reruns and sessions | Each call is an intentional one-shot action; returning a stale result would be wrong |
| Examples | A slow DB query or aggregation; an expensive deterministic computation over its inputs | Send an email, write to a DB, trigger a pipeline, generate a report, run an LLM chat completion |
| Non-blocking win | Cold start doesn't freeze the app; warm reads stay instant | The action runs off-thread while the app stays responsive |

The evidenced demand (#6687, #8488) is dominated by the memoized case — a slow query that
should fill in without freezing the page — which is what this spec proposes building now.

## Proposal

### Proposed — non-blocking cached execution

The proposed approach runs a cached function's computation off-thread and exposes its state
(`running` / `done` / `error`) instead of blocking. Every
alternative below shares this core and inherits memoization, retention (TTL /
`max_entries` / LRU), and cross-session dedup from the cache, and gives a synchronous warm
path: a fresh hit resolves immediately, same run, no extra rerun. (Wrapping a task around a
cached function cannot do this — it makes even warm reads async.)

#### Context-free execution (no `st.*` or session state)

Because the computation must not block, it runs off-thread and spans multiple script runs —
so it has no `ScriptRunContext`, and the function body must return data only: it must not use
`st.*` display commands, `st.session_state`, `st.user`, or session-scoped connections. This is intrinsic: a task's result is consumed on a *later*
rerun, after the originating run has ended, so there is no live delta path for `st.*` to
write to, and under cross-session sharing there is no single session's state to mutate.

This is stricter than `st.cache_data` today, which runs a cold miss in the script thread
where `st.*` and `st.session_state` work. So converting an existing cached function to the
non-blocking form is not transparent (Principle 26, minimize migration distance). Streamlit
should surface this — ideally a warning when a body issues `st.*` — though detecting an
off-thread `st.*` call may not be feasible.

Three alternatives are under consideration. They differ on two axes: entry point (a
`task=True` parameter on `st.cache_data`, vs. a new `.task()` accessor method) and return
shape (a value-or-status sentinel union, vs. a `Task[T]` handle).

#### Alternative A — sentinel pattern (`task=True`, returns value or status)

The decorated function keeps returning its value when ready; otherwise it returns a status
sentinel — following the `subprocess.Popen.poll()` precedent (returns `None` while running,
the result when done). Closest to today's `st.cache_data` mental model ("call it, get your
data — or a 'not ready' signal"), and the most distinct from the future `st.task`.

```python
@st.cache_data(ttl="5m", task=True)
def slow_query(region):
    return db.query("SELECT ... WHERE region = ?", region)

result = slow_query(region)          # -> R | st.RUNNING | st.TaskError
if result is st.RUNNING:
    st.info(f"Loading {region} data…")
elif isinstance(result, st.TaskError):
    st.error(f"Query failed: {result.exception}")
else:
    st.dataframe(result)             # result is R, unwrapped
```


#### Alternative B — `Task[T]` handle via `task=True` parameter

Same `task=True` entry point, but the call returns a `Task[R]` handle instead of a
value-or-sentinel. A `Task[R]` is a small object exposing the state of the off-thread
computation — `running` / `done` / `error` — plus `result` (the computed value, available
once `done`) and `error` (the exception, if it failed):

```python
@st.cache_data(ttl="5m", task=True)
def slow_query(region):
    return db.query("SELECT ... WHERE region = ?", region)

task = slow_query(region)            # -> Task[R]
if task.running:
    st.info(f"Loading {region} data…")
elif task.error:
    st.error(f"Query failed: {task.error}")
elif task.done:
    st.dataframe(task.result)
```

#### Alternative C — `.task()` accessor + `Task[T]` (recommended starting point)

A new method on the cached function (alongside the existing `func.clear()`), returning a
`Task[T]`; the plain call is untouched. This follows the async-variant-method pattern of
Celery `func.delay()`, Dask/RQ, and `concurrent.futures` `submit()`.

```python
@st.cache_data(ttl="5m")
def slow_query(region):
    return db.query("SELECT ... WHERE region = ?", region)

data = slow_query(region)            # unchanged: blocking, returns R
task = slow_query.task(region)       # non-blocking, returns Task[R]  (method name OPEN — see "Naming")

if task.running:
    st.info(f"Loading {region} data…")
elif task.error:
    st.error(f"Query failed: {task.error}")
elif task.done:
    st.dataframe(task.result)
```

All three alternatives are access-triggered: calling either returns the ready value or kicks
off the computation — there is no separate "start" step, since memoization makes repeated
access safe and idempotent.

This composes with `refresh_mode`: a fresh hit resolves immediately, while a cold miss or
hard expiry runs the computation off-thread instead of blocking — the gap `refresh_mode`
leaves open, since it only makes the *stale* path non-blocking. So `refresh_mode="background"`
still serves a stale value while it refreshes, and `refresh_mode="foreground"` shows the
loading state while an expired entry recomputes; either way the script never blocks.

The result lives in the cache (not `st.session_state`) and is copied per session on read like
`st.cache_data`, so cross-session sharing stays a pure performance optimization — one
session's mutations never affect another.

Cross-session dedup means several sessions requesting the same cold key run the computation
once (via the cache's per-key compute lock). On completion, every session holding a handle
for that key must be rerun — not just the one that initiated the compute — so no subscriber
is left stuck at `running`. This fan-out to all subscribers is a requirement of the design,
not only the initiator's rerun.

#### Alternative tradeoffs

All three produce the same behavior; they differ in entry point and return shape.

**A — sentinel.** The plain call returns `R | Running | TaskError`. The happy path is
ergonomic — the value comes back unwrapped, no `.result` — but a forgotten check breaks when
the sentinel is passed onward (caught on the first cold run), the caller must narrow the
union, and extra state like `refreshing` needs separate arg-keyed methods. The mode is fixed
at decoration. It is closest to today's `st.cache_data` mental model ("a value, or 'not
ready'"), and follows the `subprocess.Popen.poll()` precedent.

**B — handle via flag.** The same `task=True` call returns a `Task[R]` handle: uniform and
safe (you must read `.result`, so a forgotten check fails consistently), with a natural home
for `refreshing` and future state. Like A, the mode is fixed at decoration and the flag
switches the return type (an `open(mode=...)`-style change). Its mental model is a
promise/future.

**C — accessor (recommended).** A separate `.task()` method returns `Task[R]` while the plain
call stays `P → R` unchanged — so you get per-call choice (blocking and non-blocking from one
definition), the cleanest typing (no return-type switch), and full backward compatibility, at
the cost of a second entry point and a method name to choose. It follows the async-variant
method precedent (Celery `.delay()`, Dask/RQ/`concurrent.futures` submit).

The recommendation leans C for those reasons. A is the strongest differentiator from the
future `st.task` (described below) and the smallest step from today's cache mental model, but
the sentinel union is clunkier to use; B is the middle ground — handle safety with the
single-entry-point discoverability of a flag.

The context-free constraint above also favors C. The flag surfaces (A/B) make every call to
the function context-free, so adding the flag can silently break an existing cached function
that reads session state or emits UI; `.task()` leaves the plain call's `st.cache_data`
semantics intact and confines the constraint to explicit call sites.

A standalone command for the memoized case was also considered — e.g. `st.task(slow_query,
args=…, ttl=…)` instead of building on `st.cache_data`. Its implementation could reuse the
cache's storage, compute-lock, and eviction internals (so it need not be a parallel cache),
but the public surface would still duplicate the cache's configuration (`ttl`, `max_entries`,
`persist`, `hash_funcs`, …), split "how do I cache this?" across two commands, and forgo
inheriting an existing `@st.cache_data` decoration or offering the same function both blocking
and non-blocking. Since memoization is central to this use case, building on `st.cache_data`
is preferred; a standalone `st.task` is reserved for the non-memoized fire-and-forget case
below.

### Future consideration — `st.task` fire-and-forget (not proposed for immediate shipping)

Non-memoized one-shot work — side effects and jobs — is a different quadrant: you do not
want the result cached, and re-running is not safe (a second call sends a second email).
This would be a standalone, explicitly-triggered API.

```python
task = st.task(key="send_report")        # get-or-create a persistent, keyed handle

if st.button("Send report"):
    task.start(send_email, to, subject, body)   # explicit trigger; only on click

if task.running:
    st.info("Sending…")
elif task.done:
    st.success("Report sent!")
elif task.error:
    st.error(f"Failed to send: {task.error}")
```

## Two APIs, one mental model

Under the handle-based alternatives (B and C), the core interaction is identical to the
future `st.task`, so what users learn transfers (Alternative A expresses the same states as
sentinels instead):

```python
if task.running:  st.info("Loading…")
elif task.done:   st.write(task.result)
elif task.error:  st.error(task.error)
```

The differences reduce to a single, teachable safety rule:

> **Cached work runs on access, because repeating it is free. Side effects need an explicit
> `.start()`, because repeating them is dangerous.**

They also differ in what happens to the result: the cached accessor retains it, while
`st.task` delivers it once and drops it, leaving persistence to the caller. The `idle` and
`refreshing` states are edges most apps never branch on. Distinct entry-point names
(`slow_query.task(...)` vs `st.task(...)`) signal that these are two tools for two jobs that
share a handle type — not one API behaving inconsistently.

## Shared infrastructure

Both the proposed accessor and the future `st.task` run on a **process-wide bounded thread
pool** shared across all sessions, and
both trigger a targeted rerun of subscribing sessions on completion (fragment-scoped when
the call site is inside a fragment). When the pool is full, work queues rather than blocks —
the handle stays `running` and the script completes normally. There is no synchronous
fallback, which would defeat the purpose.

The pool size defaults to 4 and is configurable via `runner.taskMaxWorkers` in
`config.toml` (minimum 1). A conservative default keeps memory predictable in multi-session
deployments (each thread carries stack overhead). This is a separate pool from the cache's
background refresh (`runner.cacheBackgroundRefreshMaxWorkers`) — they cannot share one
executor because their policies differ: they size their worker counts independently, and on
saturation the accessor queues while background refresh skips (serving the stale value).

## Out of scope (future work)

- **Scheduled / cron-based execution**: A platform/deployment concern, not a Streamlit API —
  many Streamlit apps have no continuously-running server to drive a cron job (they scale to
  zero when idle). `st.App(lifespan=...)` handles startup warming; `st.cache_data` with
  `max_stale` and `refresh_mode="background"` keeps caches fresh during the app's lifetime. A
  future `st.task` could potentially integrate with platform scheduling primitives (e.g.
  Snowflake tasks) rather than running scheduling in-process.
- **Continuous / long-lived tasks**: Event listeners, polling loops, and subscription-based
  patterns (e.g., Firestore snapshots) are a different paradigm from run-to-completion.
  These fall under the reactive data layer exploration.
- **Progress reporting**: Intermediate progress from a running task (progress bars, status
  messages). Requested in [#6687](https://github.com/streamlit/streamlit/issues/6687).
  Requires the worker to communicate incremental state back; could be added later via a
  callback or shared-state mechanism on the handle.
- **Cancellation API**: Python threads are not safely killable; cancellation would be
  cooperative at best. Deferred pending demand.
- **Rerun-resilient streaming**: LLM streaming that survives widget interactions
  ([#14524](https://github.com/streamlit/streamlit/issues/14524)). Likely an extension of
  `st.write_stream`, potentially over the same executor.

## Checklist

| Item                         | ✅ or comment                                                        |
|------------------------------|----------------------------------------------------------------------|
| Works on SiS, Cloud, etc?    | ✅ Works on all supported runtimes. |
| No breaking API changes      | ✅ Additive. `st.cache_data` still returns `T`; the accessor is a new method. |
| No new dependencies          | ✅ Uses stdlib `concurrent.futures` and existing internal machinery (`request_rerun`, `call_soon_threadsafe`). |
| Metrics collected            | Needs instrumentation for adoption (cold-load submissions, completions, errors, cache-hit-vs-miss on the accessor). |
| Any security/legal impact?   | Cross-session execution sharing requires copy-on-read results and context-free bodies (see "Context-free execution"). No new endpoints or permissions. |
| Any docs changes needed?     | ✅ New API reference for the accessor (the future `st.task` gets its own docs later); one "when to use what" guide spanning cache background refresh, parallel fragments, and these APIs. |
