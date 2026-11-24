# Telemetry

What Streamlit records about running apps, how it reaches its destination, and the rules for adding to it.

There are two channels:

| Channel | Who receives it | Scope | Off switch |
|---|---|---|---|
| **Usage stats**: the `pageProfile` metrics event and a few page-load and UI events | Streamlit, from the browser (or the host page, see below) | One `pageProfile` event per script run | `browser.gatherUsageStats = false` stops the server from building page profiles and the browser from sending anything. A host `metricsUrl` of `"off"` only stops the browser from sending. |
| **Server metrics** at `/_stcore/metrics` | Whoever scrapes the endpoint, usually the hosting platform. Streamlit never sends it anywhere. | Per server process: cumulative counters and current gauges | None. Counters are always kept, but nothing leaves the server unless something scrapes the endpoint. |

## Usage stats

### Page profile

At the end of every script run, full or fragment-only, `script_runner.py` calls `create_page_profile_message` (`lib/streamlit/runtime/metrics_util.py`) and enqueues a `PageProfile` ForwardMsg (`proto/streamlit/proto/PageProfile.proto`). This happens only when `ctx.gather_usage_stats` is set, which comes from `browser.gatherUsageStats`. Runs cut short by `st.stop()` still send one. Runs that fail to compile don't. A run cut short by a rerun request, from `st.rerun()` or a user interaction, also enqueues one, but the next run clears the forward message queue when it starts (`AppSession._clear_queue`), which doesn't keep `page_profile` messages. So that profile usually never reaches the browser.

The proto field comments are the source of truth for each field's meaning. The fields by group:

| Group | Fields | What they hold |
|---|---|---|
| Commands | `commands` | Tracked `st.*` commands in call order: name, arguments (keyword, type name, position, and `len:<n>` or `val:<bool>` metadata) and time. See [Command tracking](#command-tracking). |
| Run timing | `exec_time`, `prep_time` | Microseconds. See [Run timing](#run-timing). |
| Run type | `is_fragment_run` | Whether the run was fragment-only. |
| Cache | `cache_usage` | For `st.cache_data` and `st.cache_resource` separately, the run's cached calls, hits, misses, stale hits and waits; the time spent computing on misses, waiting for another caller's computation and on other cache overhead; and how much concurrent async calls counted more than once. See [Cache totals](#cache-totals). |
| Parallel fragments | `parallel_fragment_usage` | Each `parallel=True` fragment run's start, wall-clock, command and cache times, and how long the script thread waited for them. Unset when none ran. See [Parallel fragments](#parallel-fragments). |
| Data size | `data_size` | Bytes of the Arrow data the run serialized for dataframes, data editors, tables, charts and custom components. Always set. See [Data size](#data-size). |
| Server process | `server_uptime_seconds` | Seconds since the runtime started, read at the start of the run. `optional`, so 0 is still sent. |
| | `agent_api_usage` | Agent API counts since the process started. Unset while every count is zero. |
| Errors | `uncaught_exception` | The exception type name, with a suffix only from fixed categories (see `format_uncaught_exception`). |
| Configuration | `config` | Names of config options set explicitly, never their values. `<name>:default` when set to the default value. |
| Dependencies | `attributions` | Modules from `_ATTRIBUTIONS_TO_CHECK` that are imported in the process. |
| Environment | `os`, `timezone`, `headless`, `server_mode`, `installed_skills`, `installed_agents` | Where and how the app runs, and which agent harnesses and Streamlit skills are installed. |

### The `pageProfile` event

`handlePageProfileMsg` in `frontend/app/src/App.tsx` spreads `PageProfile.toObject()` into a `pageProfile` event and adds browser-side values: `numPages`, `pageScriptHash`, `activeTheme`, `browserInfo`, `totalLoadTime` and `receivedMessages`. `totalLoadTime` is in microseconds, from handling the run's `NewSession` message to handling its `PageProfile` message. `receivedMessages` covers the same messages (see [Data size](#data-size)).

`MetricsManager.buildEventProto` (`frontend/app/src/MetricsManager.ts`) adds fields that every event carries, including:

- **IDs**: the anonymous ID cookie, machine IDs, `reportHash` (a hash of the installation ID and main script path), `appId` and `sessionId`.
- **Versions and environment**: `source` (`"browser"`), the Streamlit and Python versions, the server OS, `isHello`, `hasDisplay`, `isWebdriver` and `dev`.
- **Host metadata**, when the host provides it: `hostedAt`, `owner`, `repo`, `branch`, `mainModule` and `creatorId`.
- **Page context**: URL, title, path, referrer, query string, locale and user agent.

The event schema is `proto/streamlit/proto/MetricsEvent.proto`. Each page profile field is mirrored there under the same name ("Same as PageProfile.x"), because the event is built by spreading the page profile.

Other usage events are `viewReport` (once per page load), `updateReport` (each `NewSession`) and `menuClick` (with `label` and an optional `surface`).

### Delivery

`MetricsManager.initialize` sends events only if `gatherUsageStats` (from the `NewSession` config) is true and the host's `metricsUrl` isn't `"off"`. Events enqueued before then are held until initialization. The host config's `metricsUrl` selects the destination:

- **Unset or `""`**: the HTTPS destinations listed in the JSON file at `DEFAULT_METRICS_CONFIG`, cached in `localStorage`.
- **`"postMessage"`**: each event goes to the host window as a `METRICS_EVENT` message.
- **An HTTPS URL**: that URL instead of the defaults. A non-HTTPS URL is rejected, which turns sending off.

Dev builds of the frontend (`IS_DEV_ENV`) log events to the console instead of sending them. `make debug` passes `--browser.gatherUsageStats=false`, so it produces no page profiles. To check new fields end to end, run the app with `uv run streamlit run` and inspect the `page_profile` ForwardMsg or the event. From a source checkout, also pass `--global.developmentMode=false` to choose a `--server.port`.

## Run timing

All server times are wall-clock times in microseconds. `exec_time` and `prep_time` are measured on the script thread, and each command's time on the thread that called it:

- **`exec_time`** runs from the start of the run until the page profile is built. That includes widget callbacks, the script or fragments, and joining parallel fragment workers.
- **`prep_time`** is the part of `exec_time` before the script starts: resolving the page, cleaning up widget state and compiling the script. Callbacks run after it.
- **Command times** are the `time` of each entry in `commands`.
- **User code time** isn't sent. Analysis derives it from `exec_time - prep_time`, minus listed command time and cache time (compute + wait + overhead − `async_overlap_time`). When parallel fragments ran, also subtract `parallel_fragment_usage.wait_time`, and subtract the fragments' command and cache times from the top-level totals to get the main script's share. See [Cache totals](#cache-totals) and [Parallel fragments](#parallel-fragments). It's approximate:
  - Command times from parallel fragment workers and other attached threads are summed, so they can exceed the wall-clock time they overlap. `parallel_fragment_usage` reports the parallel fragments' share, so it can be subtracted. See [Parallel fragments](#parallel-fragments).
  - Commands past the tracking limits aren't listed, and a command that raises anything other than a rerun request is listed with time 0. Both stay inside `exec_time` and aren't subtracted, so their time counts as user code.
  - Work that happens inside a command counts as command time, for example a lazy Snowpark DataFrame passed to `st.dataframe` runs its query inside the command, and `st.write_stream` consumes its generator.
  - Cached function calls count as user code, except the cache write, which is tracked as a command (`_cache_data_object` or `_cache_resource_object`). Their times are reported separately in `cache_usage` and leave out listed command time, so subtracting them as well leaves the time spent outside the cache. Like command times, cache times from threads that ran at the same time are added together, so they can exceed wall-clock time. See [Cache totals](#cache-totals).
  - Queries count as user code too: `st.connection` times only creating or fetching the connection.

`totalLoadTime` is an optimistic lower bound on what the user waits for. It leaves out loading the page and JavaScript, opening the WebSocket, the time between a widget interaction and the run starting, and drawing after the `PageProfile` message arrives.

## Command tracking

`gather_metrics` (`metrics_util.py`) wraps public commands. For each call on a thread with a `ScriptRunContext` that gathers usage stats, it:

- Builds a `Command` from the function name and arguments. Commands defined outside Streamlit are named `external:<module>:<name>`. Custom components are named `component:<name>` (v1) and `component_v2:<name>` (v2).
- Adds it with `SharedRunState.track_command`, which enforces `_MAX_TRACKED_COMMANDS` (400 per run) and `_MAX_TRACKED_PER_COMMAND` (25 per name). Calls past the per-name limit increment an internal counter that isn't sent, and are left out of `commands`. Once `commands` holds 400 entries, further calls are ignored.
- Sets `command_tracking_deactivated` in `ThreadState` while the command runs, so commands nested inside it aren't tracked. Threads attached with `add_script_run_ctx` and parallel fragment workers start with tracking on, so a helper thread's top-level commands are tracked.
- Sets `in_listed_command` in `ThreadState` while a listed command runs, and reports the command's time to the run's cache totals when it ends. See [Cache totals](#cache-totals).
- Swallows any telemetry error, logging it at debug level, so telemetry can't break the app.

`SharedRunState` (`lib/streamlit/runtime/scriptrunner_utils/shared_run_state.py`) holds the per-run telemetry state shared by the script thread and its workers. `reset()` clears that state at the start of each run, before any parallel fragment workers start, and workers keep the same `SharedRunState`. It replaces `stats` with a new `RunStats`, and `parallel_fragments` with a new `ParallelFragmentUsageStats`, so a cached call or fragment still running from the previous run finishes into that run's totals.

## Cache totals

`CachedFunc` (`lib/streamlit/runtime/caching/cache_utils.py`) times each `st.cache_data` and `st.cache_resource` call with a `CacheCallTimer` (`cache_call_timer.py`). The timer updates the function's server metrics on every call. It adds the call to the run's `cache_usage` only if no other recorded time already covers it. A new lookup or compute path in `CachedFunc` needs the same timer calls, or its calls are missing from both. The module docstring lists the rules. In short, a call is recorded when it:

- Runs on a thread attached to a run that gathers usage stats. Background refreshes and `st.App` lifespan tasks run outside a script run, so cached calls made from them aren't recorded. A refresh itself isn't a lookup: the call that finds the stale value counts as a stale hit, and the refresh's compute time appears only in the server metrics.
- Is the outermost cached call on its thread. A nested call's time is in the outer call's time. That includes calls from a `hash_funcs` function while the outer call hashes its arguments. Threads that a cached function attaches with `add_script_run_ctx` record their cached calls as their own, so that time is counted twice: in those calls and in the outer call's compute time.
- Isn't inside a listed command, such as the `st.cache_resource` inside `st.connection`. A cached call inside a command past the tracking limits is recorded, because that command's time isn't listed.
- Finishes before the page profile is built.

A hit returned a stored value, including one another caller computed while this call waited. A miss ran the function. `cache_lookups` in the server metrics uses the same rule. The two differ only in which calls they cover: the server metrics count every call over the life of the process.

A recorded call's times leave out listed commands that run on its thread during it. Listed commands on threads that a cached function attaches stay in its compute time.

Async cached calls awaited concurrently on one event loop each count the wall-clock time they share. `ThreadCacheStats` groups overlapping calls, and when a group closes, adds how much the calls' times exceed the wall-clock time it spans, minus listed command time, to `async_overlap_time`. The cache time is compute, wait and overhead time minus `async_overlap_time`.

The overlap is measured only within one thread. Times from different threads are added together, so when cached calls on several threads run at the same time, the totals can exceed the time the run took. `parallel_fragment_usage` reports the parallel fragments' share. Other threads the app attaches have no such breakdown, so subtracting their cache times from `exec_time` can give a negative user code time.

Each thread records into its own `ThreadRunStats` (`lib/streamlit/runtime/scriptrunner_utils/run_stats.py`) without a lock, which keeps a cache hit's added cost to one or two microseconds. The record holds the thread's listed command time and its `ThreadCacheStats`, and new per-thread values belong there too. A thread takes `RunStats`'s lock only once per run, to register, and a parallel fragment once per fragment run. `create_page_profile_message` combines the threads' totals. A thread the script doesn't join can still be adding to its totals while they're read, so its calls can be partly included.

## Parallel fragments

Fragments with `parallel=True` run on worker threads alongside the main script, and only in full runs. When the run gathers usage stats, `_run_parallel_fragment` (`fragment.py`) records each one with `ParallelFragmentUsageStats.recording_run` (`lib/streamlit/runtime/scriptrunner_utils/parallel_fragment_stats.py`). For each fragment run, `parallel_fragment_usage` reports:

- When it started, measured from the start of the script run, and its wall-clock time. A run still going when the page profile is built counts up to then.
- The time of its listed commands, and its cache compute, wait, overhead and async overlap times. `RunStats.recording_into` gives the worker thread the fragment run's own `ThreadRunStats` while the fragment runs, because one worker thread can run several fragments one after another. Threads the fragment attaches get their own records, so only the worker counts toward the fragment.

The first `_MAX_PARALLEL_FRAGMENT_RUNS` (25) runs to start are listed, and later ones are added together into `overflow`. `run_count` and the cache counts in `cache_usage` cover every run. `wait_time` is how long the script thread waited for the fragments after the script ended. Normally that's `ParallelFragmentCoordinator.join()`. When the script ends early, for example with `st.stop()`, a rerun or an uncaught exception, it's `drain()`. If `join()` itself raises, both count, because `drain()` runs after it.

The fragments' commands and cached calls are also in the top-level `commands` and `cache_usage`. Here, cache time means compute, wait and overhead time minus the async overlap time. A fragment's user code time is its `exec_time` minus its command and cache times. The main script's is `exec_time - prep_time - wait_time`, minus the top-level command and cache times less the fragments'. Threads that a fragment attaches with `add_script_run_ctx` count toward the main script. Their time usually overlaps `wait_time`, while the script thread waits for the fragment, so subtracting both can make the main script's user code time negative. A nested parallel fragment is a run of its own, and its parent doesn't wait for it.

## Data size

Two values describe how much data a run sends, each measured where it's already known:

- **`data_size`, on the server**, is the Arrow data the run serialized for dataframes, data editors, tables, charts and custom component dataframe arguments. `convert_arrow_table_to_arrow_bytes` (`lib/streamlit/dataframe_util.py`) serializes every Arrow payload and adds its size to the calling thread's `ThreadRunStats`. It counts a payload even if the browser already has it, so it measures what the run puts on the page rather than what's transferred.
- **`receivedMessages`, in the browser**, is the bytes of the ForwardMsgs received from the run's `NewSession` through its `PageProfile`. `WebsocketConnection` passes each message's encoded size to `onMessage`, plus the cached copy's size for a cache reference, and `ReceivedMessagesTracker` (`frontend/app/src/util/ReceivedMessagesTracker.ts`) adds them up. It's measured in the browser because only the browser knows which references it resolved from its cache.

Both are encoded sizes before WebSocket compression, so the bytes transferred can be fewer. Neither side counts anything while usage stats are off. What counts toward a run:

- **Fragment runs:** a fragment-only run counts only its own payloads. Parallel fragments and threads attached with `add_script_run_ctx` record into their own `ThreadRunStats`, which count toward the run.
- **Runs that end early** with `st.rerun()`, `st.stop()`, `st.switch_page()` or an uncaught exception count what they serialized before they ended.
- **Messages after the `PageProfile`**, such as `ScriptFinished`, count toward no run.
- **Not counted:** elements replayed by an `st.cache_data` hit, which aren't serialized again; lazy dataframe chunks after the first, which are serialized without a `ScriptRunContext` and fetched over HTTP; and media files.

## Server metrics

`/_stcore/metrics` (`ROUTE_METRICS` in `lib/streamlit/web/server/starlette/starlette_routes.py`) serves stats from providers registered with the runtime's `StatsManager` (`lib/streamlit/runtime/stats.py`). The response is OpenMetrics text, or protobuf if the `Accept` header asks for `application/x-protobuf`. `?families=<name>` filters the families returned.

| Family | Source |
|---|---|
| `cache_memory_bytes` | Memory held by caches, session state, uploaded files and media files. With `server.enableExpensiveMemoryStats` off (the default), `st.cache_resource` and session state report entry and key counts instead of bytes. It's the only family the endpoint caches briefly, because it's costly to compute. |
| `session_events`, `session_duration_seconds`, `active_sessions` | Session lifecycle |
| `user_session_events` | Session events labeled with `st.user` attributes, only when `server.unsafeMetricsUserAttributes` is set |
| `cache_lookups`, `cache_compute_duration_seconds`, `cache_wait_duration_seconds`, `cache_evictions`, `cache_background_refreshes` | Per cached function, from `FunctionCacheMetrics` (`lib/streamlit/runtime/caching/cache_metrics.py`) |

Unlike the page profile, server metrics are labeled with app content, for example the `cache` label is the cached function's display name. Streamlit doesn't send them anywhere, but the endpoint has no authentication, so deployments must restrict access to it when labels hold private data.

## Adding telemetry

Choose the channel first. The page profile is for understanding how apps behave across many deployments, so it must be anonymous. Server metrics are for the operator of one deployment, and can name things in the app.

Rules for new page profile fields:

- **Anonymous.** Record counts, durations, values from a small fixed set, and random IDs. Never record names, keys, labels, paths, argument values or query text, and never hashes of them, because hashes of common names can be reversed. Older fields predate this rule: `pageScriptHash` and the component and `external:` names in `commands`. Keep them as they are, and don't copy them for new fields.
- **Fixed size per run.** Prefer per-run totals. If a list is needed, cap it and document what happens past the cap.
- **Only what varies between real apps.** Record values that depend on the app, its data, its hosting, the network, the device or how people use it. Costs that are fixed for a given input, such as how long one element type takes to draw, belong in the performance suite (`.github/workflows/performance.yml`).
- **Measure where the value is already known.** Don't add a serialization pass or a lock to the hot path to get a number. Keep overhead negligible next to the work being measured, for example a cache hit's argument hashing.
- **Respect `browser.gatherUsageStats`.** Collect nothing when it's off, on the server and in the browser.
- **Never affect the app.** Catch and log telemetry errors, as `gather_metrics` does, and don't change behavior to make something measurable.
- **Say how it adds up.** Document in the proto comment how a new time relates to `exec_time`, `prep_time` and command times, which threads count, and how it avoids counting the same time twice.
- **Keep existing meanings.** Don't change the meaning of an existing field or rename event keys. `MetricsManager.send` notes that the event schema changes only when the data team asks.

Plumbing for a new field:

1. Add it to `PageProfile.proto`. Use `optional` when 0 is a meaningful value (see `server_uptime_seconds`), and a submessage left unset when it has no data (see `agent_api_usage`).
2. Mirror it in `MetricsEvent.proto` with the same name, then run `make protobuf`.
3. Set it where the value is already known, usually in `create_page_profile_message`, and cover that with a Python unit test.
4. Extend the `pageProfile` case in `frontend/app/src/MetricsManager.test.ts` so the field is checked through `buildEventProto`.
