---
author: sfc-gh-lwilby
created: 2026-11-18
---

# Performance telemetry

## Summary

Extend the per-run page profile so that Streamlit can see, across many deployments, how fast apps are for the people using them and where the time goes. This spec sets the strategy for a series of additions (cache usage, CPU time, query time, data size, rerun reason and browser render timing) and how their numbers fit together without counting the same time twice. The [tech spec](tech-spec.md) covers how the server records these times and attributes them across threads and parallel fragments.

## Problem

The page profile was built to show which commands apps use. As a measure of performance it has three gaps.

**Most of a slow run is unexplained.** A run reports its total time, its setup time and the time of each top-level `st.*` command. Everything else is user code: cached calls (hits and misses), queries, data processing and waiting on other services. In slow apps that's usually most of the run, so telemetry can't say whether an app would get faster from better caching, from query changes, from faster computation or from free-threaded Python.

**The browser timing stops early.** `totalLoadTime` ends when the run's `PageProfile` message reaches the browser. It leaves out loading the page, connecting, the time between a user's interaction and the run starting, and drawing the result. An app can look fast in telemetry while users stare at a half-drawn page.

**Runs can't be grouped by what the user did.** A first load, a slider change, a page navigation and a timed fragment rerun have different expectations, but the only distinction recorded today is whether a run was fragment-only.

Without these, there's no baseline for app performance, no way to tell which product work would help most, and no way to measure its impact after it ships.

## Proposal

### Questions to answer

Each addition exists to answer one of these questions about slow runs:

| Question | Addition |
|---|---|
| Is the time in the cache, in queries, or in other user code? | Cache usage, query time |
| Was the cache cold, and was that because the server process had just started? | Cache usage, server uptime |
| Which cached functions rarely hit, for example because an argument changes every run? | Per-function cache stats |
| Is user code computing, or waiting on something? | CPU time |
| Which parallel fragment held up the run, and where did its time go? | Parallel fragment breakdown |
| How much data does a run send to the browser? | Data size |
| Why did the run start, and which kind of widget started it? | Rerun reason |
| What did the user actually wait for, and what was the browser doing meanwhile? | Render timing |

### Principles

Every addition follows three principles:

- **Per-run totals, not traces.** Each addition adds a small, fixed-size set of numbers to each run. Per-call detail, such as the time of each query or each element, is left to a developer-facing trace (see [Out of scope](#out-of-scope)). The one capped exception is an entry per parallel fragment, because a run's time can't be explained without each fragment's own span.
- **Only what varies between real apps.** Telemetry records what depends on the app, its data, its hosting, the network, the device and how people use it. Costs that are fixed for a given input, such as how long a cache hit takes for a given result size or how long a chart type takes to draw, are measured by benchmarks in the performance suite instead.
- **The numbers add up.** Every new time is defined relative to the existing ones, so that analysis can subtract times without counting any span twice (see below).

### How the times fit together

On the server, a run's `exec_time` breaks down as follows:

```
exec_time
├── prep_time
├── command time: the sum of commands[].time
│   └── can include query time (time_in_commands)
└── user code: exec_time − prep_time − command time
    ├── cache time: overhead + wait + miss compute − async overlap
    │   └── can include query time (time_in_cache)
    ├── query time outside cached calls and commands:
    │   time − time_in_cache − time_in_commands
    ├── parallel fragment wait: the main script waiting for its fragments
    └── everything else
```

- **Cache time** leaves out time already in command time: `st.*` calls inside a cached function, and the cache write. It also leaves out cached calls made inside a command, such as the `st.cache_resource` call inside `st.connection`. A cached call nested inside another counts only toward the outer call.
- **Query time** reports the part that overlaps cache and command time separately, so it can be subtracted without counting any span twice (see [Query time](#query-time)).
- **CPU time** is a second view of the same spans rather than another slice. User code CPU time is the script thread's CPU time minus CPU time inside commands, and each parallel fragment reports its own. Comparing it with user code wall time splits user code into computing and waiting.
- **Parallel fragment wait** is the time the main script spent waiting for its parallel fragments to finish after it ended, including when it ended early, for example with `st.stop()`. In a run with parallel fragments, the tree describes the main script: use the command, cache and query times minus the fragment entries (see below). Each fragment's own time breaks down the same way from its wall time.
- **Concurrency**: parallel fragments report their own spans (see below), so their share can be subtracted from the main script's. Times from other threads that run at the same time, such as threads attached with `add_script_run_ctx`, count toward the main script and are still added together, like command times today, so they can exceed wall-clock time. That includes threads a parallel fragment attaches, and threads a cached function attaches, whose work its compute time also contains. Concurrent async cached calls on one event loop each count the time they share, so the run also reports how much they counted more than once (`async_overlap_time`), which cache time subtracts.

**Parallel fragments.** Fragments with `parallel=True` that run during a full run report into the same page profile, on worker threads that run alongside the main script. A parallel fragment started inside another one gets its own entry, and its parent doesn't wait for it, so its time isn't part of the parent's. A fragment rerun is a run of its own with its own page profile, so it needs no entry.

Each parallel fragment gets an entry with:

- its start time, relative to the start of the run, and its wall time;
- its listed command time;
- its cache compute, wait and overhead time, and its async overlap;
- its query time, with the parts inside cached calls and commands;
- its CPU time.

The run also reports how long the main script waited for its fragments to finish. Together with the start and wall times, that shows which fragments overlapped and which one held up the run, and the entries show where that fragment's time went. Each fragment's user code is its wall time minus its command and cache times, and can't go negative.

The top-level command, cache and query totals still cover the whole run, so the main script's share is the top-level value minus the fragment entries. Only cache counts, such as calls, hits, misses and the number of calls that waited, are reported once across all parallel fragments rather than per fragment. Hit rates belong to the cached functions, which per-function cache stats cover, while each fragment's own compute, wait and overhead times show where its time went.

The first 25 fragment runs to start get an entry, and later ones are added together into one overflow entry. Each entry adds about 145 bytes to the usage event's JSON, and only runs with parallel fragments send any, so the worst case adds about 4 KB. No fragment IDs or names are sent.

In the browser, render timing records when the screen reached each loading milestone for the user, measured from navigation start (for a first load) or from sending the rerun request (for a rerun). It doesn't time rendering or painting itself, such as how long React takes to render an element or a chart type takes to draw. Those costs are fixed for a given input and are measured by performance suite benchmarks. The milestones depend on what a real app shows, its network and the user's device, which benchmarks can't reproduce:

```
app shell ready → connected → first content → script finished → fully loaded
                                              └──── after the script ──────┘
                                                code loading, media loading
```

- **Script finished** is the end point of today's `totalLoadTime`, so the two can be compared.
- **Fully loaded** waits only for elements the user can see. Content in collapsed expanders, unselected tabs or a closed sidebar doesn't count.
- **Visible elements and viewport size** say how much fully loaded waited for. The number of visible elements separates a screen full of charts from one with a single table, which the `commands` list can't do because it counts every call, including content off screen. The viewport size bucket explains why that number varies, since a larger screen shows more of the page. The size is rounded into buckets so exact dimensions aren't sent. Together they add a few bytes per run.
- **The time after the script**, from script finished to fully loaded, reports how long the screen was waiting on element code or media (images, video and iframes) to load. Each is the time when at least one visible element was waiting on it, not the time of any one element, so the two can overlap. The rest of that time includes drawing charts and dataframes, which performance suite benchmarks measure. Drawing time depends somewhat on the data, so it could be split out later if analysis needs it.
- **Parallel fragments** are included. A full run waits for its parallel fragments to finish before it sends its `PageProfile` message, and their elements belong to that run, so its milestones cover them.

Fully loaded happens after the `PageProfile` message arrives, so render timing is a separate `renderTiming` event. It's joined to the run's `pageProfile` event by session ID and a per-page-load run index.

### Query time

Query time is reported per client library, because each one is hooked differently and covers different paths. Recording never changes the cursors, engines or sessions an app gets, and uses only hooks each library provides, so some queries aren't recorded (see the known gaps below):

| Source | Recorded |
|---|---|
| Snowflake connector | The query `SnowflakeConnection.query()` runs |
| SQLAlchemy | The engine behind `SQLConnection`, including its `session` |
| Snowpark | Sessions from `SnowflakeConnection.session()`, and the active session, on Snowpark 1.26 and later with thread-safe sessions on |

For each source, the run counts its queries, including how many failed and how many only looked up a result's shape (describe, which only Snowpark reports). It also reports how long the driver's execute call blocked. The time stops when the execute call returns, so fetching the results isn't included. A query that a cache hit makes unnecessary never runs, so it isn't recorded.

Query time can overlap time that's already reported, so each source also reports the count and time of queries in two places:

- **Inside cached calls** (`queries_in_cache`, `time_in_cache`): queries while a recorded cached call is open, which cache time already includes. That's mostly queries in the cached function's computation, but also queries from the cache's own work, such as a `hash_funcs` function, and in async code, other tasks' queries while the call awaits.
- **Inside commands** (`queries_in_commands`, `time_in_commands`): queries inside a listed command, which that command's time already includes. For example, a lazy DataFrame passed to `st.dataframe` runs its query inside the command.

A query counts toward at most one of the two. A query inside a listed command counts toward the command, even if a cached call is also open, because cache time leaves out listed commands.

The rest, `time − time_in_cache − time_in_commands`, is query time that's otherwise part of user code. Subtracting `time_in_cache` from cache time leaves the cache's other work. The counts include Snowpark queries, which aren't timed (see below). Each parallel fragment's entry reports its query time and the two parts in the same way. Queries on other threads the app attaches are added into the run's totals, like command and cache times.

Only counts and times are sent. No SQL text, parameters, object names, rows or connection details are sent.

Instrumentation is installed only when usage stats are on, and never changes a query's result or error. Recording adds about 1.5 µs per query for the Snowflake connector and about 5 µs for SQLAlchemy, mostly SQLAlchemy's own event dispatch. Working out whether a query is inside a cached call or a command adds well under 0.1 µs. A Snowflake query takes tens of milliseconds or more.

Known gaps:

- **Snowpark query times.** Snowpark tells query listeners about a query only after it finishes, without its duration, so Snowpark queries are counted but not timed. Timing them needs Snowpark's listeners to report each query's duration. Snowpark also doesn't report some failures, such as failed async jobs.
- **Snowflake connector queries outside `query()`.** The connector has no hook for when a query starts and finishes, so recording them would mean replacing or wrapping the cursor the app gets. That risks breaking queries on connector versions Streamlit isn't tested on, so these aren't recorded: queries on a cursor from `SnowflakeConnection.cursor()` or `raw_connection`, `write_pandas`, `execute_string`, `execute_stream`, and connections the app opens itself. Recording them needs a query start and finish hook in the connector.
- **SQLAlchemy engines the app creates.** Events are installed only on the `SQLConnection` engine, so engines the app creates with `create_engine` aren't recorded.
- **Snowpark without thread-safe sessions.** When thread-safe sessions are off, Snowpark doesn't guard its listeners, so adding one to a session other threads are using could break a query. Those sessions aren't recorded. Recording them safely needs a supported, thread-safe way to register a listener in Snowpark.
- **Other paths that aren't recorded.** Snowpark sessions the app creates, other than the active session; plain DB-API drivers; and custom `BaseConnection` classes.

### Rerun reason

A Streamlit app reruns its whole script, or one fragment, in response to almost everything a user does, so a single session produces many runs that people experience differently. A first load is expected to take a moment, while a slider change should feel instant. Each run records why it started, so performance can be scored separately for each kind of run, and for each kind of widget interaction:

- **Initial load**: the first run of a session.
- **Navigation**: a page change from the navigation menu or `st.page_link`, a `st.switch_page` call, or the browser's back and forward buttons.
- **Widget interaction**: a widget's value changed.
- **Query parameter change**: the URL's query string changed without a page change.
- **`st.rerun()`**: the app asked for a rerun.
- **File change**: a source file changed while run-on-save is on, which only happens during development.
- **Fragment auto-rerun**: a fragment's `run_every` timer fired.
- **Manual rerun**: any other request from the browser, such as the Rerun menu item, a rerun requested by the host, or a rerun after reconnecting.

Several rerun requests can be combined into one run, and one run can match several reasons. The run records only one, in the order listed above.

For widget interactions, the run also records the type of the widget that started it, such as a slider, a chart selection, a dataframe or a form's submit button. This is Streamlit's internal element type name, the same fixed name for every app, never the widget's key or a custom component's name. When several widgets changed at once, the run records their shared type, or the type of the widget that triggered the change, such as the button that submitted a form, or else "multiple".

### Data size

Data size shows whether slow runs are the ones that send a lot of data, for example whether SiS apps are slow because they send more, and whether that data is dataframes and charts. Each run reports three totals, in bytes:

- **Bytes received**: the messages the browser received for the run. Compared with the run's load time, it shows how much of a slow run's time could be transfer.
- **Bytes from the browser's cache**: messages the browser already had from an earlier run, which the server sent as short references instead, and how many there were. They explain runs that put a lot of data on the page but transfer little, such as most reruns.
- **Arrow bytes**: the dataframes, tables and charts the run serialized, counted even when the browser already has them. Their share of the run's data says whether advice about data volume applies, such as aggregating before charting, paginating, or loading dataframes lazily.

Rows, the largest payload and message counts aren't reported, because none of the questions above needs them.

### Additions

| Addition | What it adds | Measured in |
|---|---|---|
| Cache usage | Per cache type: calls, hits, misses, stale hits, waits, and compute, wait and overhead time; how much overlapping async calls counted more than once | Server |
| Server uptime | Seconds since the server process started, at the start of the run | Server |
| Per-function cache stats | The same counts and times per cached function, plus the count and time of the queries it ran, identified by a random ID per server process and capped per run | Server |
| CPU time | CPU time of the script thread, inside commands and of the whole process. Each parallel fragment's CPU time is part of the parallel fragment breakdown | Server |
| Parallel fragment breakdown | Per parallel fragment: start, wall, command, CPU, query, and cache compute, wait, overhead and async overlap time, capped per run; cache counts across all parallel fragments; how long the main script waited for them | Server |
| Rerun reason | Why the run started, such as a first load, a page change, a widget interaction or a fragment timer, and for a widget interaction, the type of widget, such as a slider or chart selection (see [Rerun reason](#rerun-reason)) | Server |
| Render timing | When the user's screen reached each loading milestone, what it waited on after the script finished, the number of visible elements, a viewport size bucket, and flags for hidden, superseded and timed-out runs. No per-element render or paint times | Browser |
| Data size | Bytes the browser received, the count and bytes of messages served from its message cache, and Arrow bytes for dataframes, tables and charts (see [Data size](#data-size)) | Server and browser |
| Query time | Per client library: query, failure and describe counts, and execute time, with the count and time inside cached calls and commands | Server |

Each addition describes its fields in `PageProfile.proto` (or `MetricsEvent.proto` for browser-only values), and documents its attribution rules in the telemetry reference when it lands.

### Open questions

1. **Unrecorded query paths.** Which of the [paths that aren't recorded](#query-time) are common enough in real apps to instrument, and whether fetching results should be timed. The safest way to close the largest gaps is in the Snowflake libraries: a query start and finish hook in the connector, and query durations in Snowpark's query listeners. A Streamlit API for queries that `query()` doesn't fit, such as statements without results or uncached reads, would also record more of them.
2. **Per-function payload.** The cap on per-function cache entries trades payload size against coverage of apps with many cached functions.
3. **Bytes on the wire.** WebSocket compression makes transferred bytes smaller than message sizes. Data size will report message sizes unless the compressed size is available without extra work.

## Out of scope

- **Exporting these numbers to a developer's own observability backend**, for example with OpenTelemetry. That's a separate spec, which would reuse the same per-run totals.
- **A developer-only trace of a single load** with per-call spans and per-element render times. That's also a separate spec.
- **Per-call and per-element timings in usage stats.** These would break the fixed-size rule. Fixed per-element costs are covered by performance suite benchmarks.
- **Changes to existing fields** or to the meaning of the server metrics at `/_stcore/metrics`.

## Checklist

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | ✅ Collected in the library and the browser on every platform that gets new Streamlit releases. SiS warehouse runtimes no longer get Streamlit updates, so on SiS these additions reach only the container runtime. Query recording uses only hooks the libraries provide and never changes the objects an app gets, so it can't break queries on platforms with their own connector builds. Snowpark query times wait on Snowpark's query listeners reporting durations. |
| No breaking API changes      | ✅ No public API changes; only new proto fields. |
| No new dependencies          | ✅ Query timing instruments database clients only when they're installed and in use. |
| Metrics collected            | ✅ This spec is about metrics. Everything is gated by `browser.gatherUsageStats`. |
| Any security/legal impact?   | No app content is added. |
| Any docs changes needed?     | The telemetry reference is updated as each addition lands. No user-facing docs changes. |
