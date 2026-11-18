---
author: sfc-gh-lwilby-1
created: 2026-11-18
---

# Developer load trace: tech spec

## Summary

This spec describes how Streamlit records a trace of one run: spans for the server's work,
sampled Python stacks, and per-element browser timing, joined on one clock. The product
spec covers what developers and agents see. The design is based on a throwaway prototype
that implemented the full path end to end: tracer, sampler, browser timing, in-app panel,
files and CLI, plus overhead measurements. Where this spec relies on something the
prototype didn't try, it says so.

## Problem

The product spec covers the user problem. The technical constraints are:

- **Zero cost when nobody is tracing ($52).** Every `st.*` call, cache call and message
  passes through the hooks, so the hooks must cost almost nothing when off.
- **One set of instrumentation points.** The page profile (`PageProfile`, the per-run
  summary Streamlit sends as usage telemetry) already times commands, cache calls, fragments, CPU time and browser milestones for usage telemetry, and a planned
  OpenTelemetry (OTel) export will send per-run totals to an observability backend. The
  trace must add detail at the same points and use the same names, not build a parallel
  set of timers whose totals disagree.
- **Several threads.** Parallel fragments run on worker threads, and callbacks and cache
  computations can wait on other threads.
- **Two machines, two clocks.** The server and the browser have unrelated clocks, and
  half the load time can be in the browser.
- **Every platform ($36).** Locally an agent reads files. In SiS there's no file access and
  the browser is inside the host's iframe.

## Dependencies

The trace reuses the page profile's collectors, so it depends on these open PRs that add
them. The prototype was built on top of them:

| PR | What the trace uses |
|---|---|
| [#18026](https://github.com/streamlit/streamlit/pull/18026), [#18017](https://github.com/streamlit/streamlit/pull/18017) | Per-run cache totals and `CacheCallTimer`, which times each cached call |
| [#18021](https://github.com/streamlit/streamlit/pull/18021) | `RenderTimingTracker`: browser milestones and the "fully loaded" rule |
| [#18073](https://github.com/streamlit/streamlit/pull/18073) | Script, command and fragment CPU time |
| [#17961](https://github.com/streamlit/streamlit/pull/17961) | The rerun reason. The prototype didn't include it and inferred the trigger from `RerunData` |

The planned OTel export doesn't have a spec yet. This spec proposes how traced spans nest
under its per-run span (see "Relation to the OTel per-run span"). The OTel spec should
confirm or revise that.

## Proposal

### Overview

A trace is recorded in two halves that are merged at the end. The server records spans
and samples for the run and sends them before the script finishes. The browser keeps
recording rendering until the page is fully loaded, then sends its timing back for the
server to merge, summarize and write to files.

```
browser                                      server
───────                                      ──────
rerun BackMsg (trace_this_run = true) ─────► session allowed to trace? (decided at connect)
                                             start TraceRecorder for the run
                                             ├─ spans from the existing hooks
                                             └─ sampler thread (only while recording)
                                             run ends
      ◄────────────────── LoadTrace ForwardMsg (spans + samples), before script_finished
trace-mode RenderTimingTracker
  records milestones and per-element timing
  until fully loaded
browser timing BackMsg ────────────────────► merge, summarize, write files
      ◄────────────────── LoadTrace ForwardMsg (summary, final)
panel renders the merged trace
```

### Enabling and triggering

#### Per-session policy

When a session connects, the server evaluates
`server.allowLoadTrace` against the connection and stores `load_trace_allowed` on the
session. It's sent to the browser in `NewSession` so the browser knows whether to show the
controls and load the panel. The server checks the stored value on every trace request,
because the browser's copy isn't a trust boundary ($48).

`"local"` (the default) allows a session when all of these hold:

- The connection's peer address is loopback (`127.0.0.0/8` or `::1`).
- The request has no `Forwarded`, `X-Forwarded-For` or `X-Real-IP` header.
- A browser `Origin`, if present, has a loopback hostname (`localhost`, `127.0.0.1`,
  `[::1]`).

The `Origin` check catches reverse proxies on the same machine. They connect from
loopback, and some don't add forwarding headers (nginx's defaults don't). Browsers always
send the page's origin on WebSocket handshakes, and proxies rarely rewrite it. Non-browser
clients send no `Origin` and rely on the first two checks.

Agent API sessions go through the same check against their HTTP request.

#### How triggers reach the server

All three in-app triggers set `ClientState.trace_this_run` on a rerun BackMsg:

| Trigger | Which BackMsg carries the flag |
|---|---|
| Rerun and trace | The rerun the panel sends immediately |
| Trace next interaction | The next rerun the browser sends because of a user interaction. `run_every` auto-reruns (`is_auto_rerun`) don't take it |
| Reload and trace | The new session's first rerun. A `sessionStorage` key survives the reload, and the browser sends its first rerun after connecting, so the flag goes on that request |

Because the flag travels with the request that starts the run, the server keeps no
arming state (a record of which future run to trace) for browser triggers, and a trigger
can only trace its own session. The
prototype instead armed runs on the server, including "the next run of any session" for
page loads, which could trace another user's session on a shared server. The flag removes
that case.

The CLI needs to trace a page load it didn't start (`streamlit trace run --browser`). It
arms "the next new session" through `POST /_stcore/load-trace/arm`. The route is only
registered when `server.allowLoadTrace` isn't `"none"`, and only accepts requests that pass
the `"local"` checks above, even when the policy is `"all"`. The arm expires after 2
minutes.

#### Run lifecycle

- A run that ends in `st.rerun()` passes its `TraceRecorder` to the follow-up run, up to
  5 runs. Each run is a top-level `run` span in the same trace. This wasn't prototyped.
- When a new rerun request interrupts a traced run, the recorder finishes the partial
  trace with `status: "interrupted"`, and the flag carries over to the replacing run.
- Only one recorder runs per session at a time.

### Span model

Each span has:

- `id`, `parent`, `name` and `kind`
- `start_us` and `dur_us`, relative to the trace's start on the server's monotonic clock
- `thread` and `fragment_id`
- the call site, `site{file, line, func}`
- `attrs`

The kinds and the hooks that produce them:

| Kind | What it covers | Hook (in the prototype) |
|---|---|---|
| `run` | One script or fragment run, from the request to the last message | `ScriptRunner` |
| `prepare` | Work before the script body: widget state, page setup | `ScriptRunner` |
| `callbacks`, `callback` | Widget callbacks before the script body | `SessionState.call_callback` |
| `script` | The script body | `ScriptRunner` |
| `command` | One public `st.*` call | The `gather_metrics` wrapper. Private (`_`-prefixed) commands are skipped |
| `cache` | One cached call, with `result`: hit, miss, stale (an expired value returned while it refreshes in the background) or waited | `CacheCallTimer` |
| `cache_compute`, `cache_wait` | The function's computation on a miss, and time spent waiting for another thread's computation | `CacheCallTimer` |
| `fragment` | A fragment's body, sequential or parallel, with queue wait in `attrs` | The fragment wrapper |
| `wait` | The script waiting for parallel fragments after its body | `ScriptRunner` |
| `serialize` | Serializing one ForwardMsg, with its size | `ScriptRunContext.enqueue` and the WebSocket writer |

The call site is the innermost frame outside Streamlit and `threading`, found by walking
the stack once per span.

#### How spans nest

```
run
├─ prepare
├─ callbacks
│  └─ callback
├─ script                          (fragment, for a fragment run)
│  ├─ command
│  │  └─ serialize
│  ├─ cache
│  │  └─ cache_compute | cache_wait
│  │     └─ command ...            (commands inside the cached function)
│  ├─ fragment                     (sequential)
│  └─ wait                         (for parallel fragments)
├─ fragment                        (parallel, on worker threads)
└─ browser                         (merged from browser timing)
   └─ element
```

#### What's collected without a trace vs only while tracing

| Data | Page profile (usage stats on) | Planned OTel export | Only while tracing |
|---|---|---|---|
| Per-run totals: exec, prep, cache, CPU, browser milestones | Collected | Attributes on the per-run span | Copied into the trace |
| Fragment runs, browser phase | Totals only | A few coarse child spans | Full spans |
| Commands, cached calls, callbacks, serialization | Totals only | — | One span each |
| Sampled stacks | — | — | Recorded |
| Per-element browser timing | — | — | Recorded |

The page profile stays totals-only. A traced run turns on the page-profile collectors for
that run even if usage stats are off, so the trace can copy its totals. The page-profile
message is still only sent when usage stats are on.

#### Relation to the OTel per-run span

The trace's `run` span is the same span the OTel export emits per run: same start and end, and the same total attributes. The other spans
are its descendants. When the OTel export is configured, a traced run exports its spans
under the per-run span, and an untraced run exports only what the OTel spec defines.
Samples aren't spans. They'd be exported as an aggregated hot-path attribute on the
per-run span, or not at all, because OTel's profiling signal is still in development. The
Snowflake event table that SiS's warehouse runtime writes to allows at most 128
attributes or events per span. Each detail span stays well under that, but there are many
of them: a worst-case run produces about 900 spans. Open question 3 asks whether that
volume should go to the event table by default.

Proposed attribute names follow OTel semantic conventions where they exist, and use the
`streamlit.` prefix otherwise:

| Attribute | Example |
|---|---|
| `code.function.name`, `code.file.path`, `code.line.number` | `load_orders`, `/app/streamlit_app.py`, `78` |
| `thread.id`, `thread.name` | `ScriptRunner.scriptThread` |
| `streamlit.command.name` | `dataframe` |
| `streamlit.cache.type`, `streamlit.cache.result`, `streamlit.cache.ttl_seconds` | `data`, `miss`, `20` |
| `streamlit.fragment.id`, `streamlit.fragment.parallel` | |
| `streamlit.message.bytes` | `48213` |
| `streamlit.element.type`, `streamlit.element.delta_path` | `arrow_vega_lite_chart`, `[0, 4, 1]` |

The per-run totals keep whatever names the page profile and the OTel spec settle on.

### Sampling profiler

A standard-library thread calls `sys._current_frames()` every 5 ms while a recorder is
active, and records the stacks of the run's script thread and its fragment worker threads.
Each sample has:

- its thread and time
- its stack, stored as an ID into a shared table of unique stacks (interned)
- the innermost open span on that thread
- a weight: the wall time since the previous sample

Stacks drop the runtime frames above the app's first frame and collapse each run of
Streamlit frames into one `[streamlit] <function>` frame. Each stack entry records the
line that was executing, and each shared frame record stores the line where its function
is defined.

- **Rate.** 5 ms by default. It's set by `STREAMLIT_LOAD_TRACE_SAMPLE_MS`, for debugging
  only. It's not a config option.
- **The GIL.** The sampler needs the GIL. In CPU-bound pure-Python code it gets it at the
  interpreter's switch interval (5 ms by default), so samples land at switch points.
  Wall-time weights keep totals right, but placement within a span is approximate. C extensions that
  hold the GIL, such as pandas operations, delay the sample until they release it. The
  sample then still shows the Python line that called them, with the full delay as weight.
  Code that releases the GIL (I/O, `time.sleep`, many NumPy calls) is sampled on time and
  shows the calling line.
- **On-CPU vs off-CPU.** Samples don't say whether a thread was running or waiting, which
  confused the agent that tried the prototype (see "How a test agent used the prototype").
  The proposal is to read each sampled thread's CPU
  clock and mark a sample as on-CPU when the thread's CPU time advanced. On Linux,
  `time.pthread_getcpuclockid` with `time.clock_gettime` does this from Python. macOS and
  Windows would need a platform call, or their samples stay unmarked. This wasn't
  prototyped.
- **Python versions.** Streamlit supports Python 3.11 and later. `sys._current_frames()`
  and `co_qualname` behave the same across these versions. The prototype ran on 3.14.
  Free-threaded builds have no GIL to wait for, so samples are punctual, but taking
  another thread's frames isn't atomic there. This is an inference and needs testing.
  Python 3.15's built-in sampling profiler could replace the thread later. That's also an
  inference and wasn't tried.
- **Cost.** The sampler records its own CPU time in the trace: 11 to 34 ms per 3 to 5 s
  run in the prototype.

### Browser timing

The trace reuses `RenderTimingTracker` from
[#18021](https://github.com/streamlit/streamlit/pull/18021) (browser render timing for the
page profile), so milestones and "fully loaded" mean
the same thing in the trace as in the page profile: app shell ready, connected, first
content, script finished, and fully loaded (every visible content element is ready, with
a 30 s timeout).

- **A second tracker in trace mode.** The metrics tracker skips local hostnames, because
  local timing isn't representative for telemetry, and it reports only totals. A traced
  run creates a separate tracker with `collectTrace: true`, which runs on any host and
  records each new or changed element: type, delta path (its position in the element tree,
  such as `[0, 4, 1]`), registration, content committed,
  ready, code-chunk and media loads, and visibility. It replaces the metrics tracker in the
  React context for that run only.
- **Elements link to commands** through the delta path: a `command` span records the
  delta paths of the elements it produced, and each element records its own.
- **Reruns only show changed elements,** because unchanged elements don't re-render. The
  summary says so when nothing re-rendered.
- **Clock alignment.** The two clocks are aligned by estimating when the server's run
  started, in browser time. There are two estimates, and the earlier one is used, because
  each is late by its message's delivery delay:
  - when `NewSession` arrived
  - when the run's end arrived, minus the server's run duration

  For reruns, the server can't start before the browser asked, so the offset is at least
  zero, and the panel shows that bound. Page loads have no lower bound.
- **Sending timing back.** The browser sends its timing to the server in a BackMsg. The
  server merges it, writes the files, and replies with the summary in a final `LoadTrace`
  message. The prototype used an HTTP POST, which wouldn't work through every host. The
  BackMsg works wherever the WebSocket does.
- **Page loads armed from the CLI.** When a trace is armed with `--browser`, the server
  doesn't know in advance which page load will be traced. So the browser creates a
  provisional trace tracker on the first `NewSession` of every session where tracing is
  allowed, and drops it when the script finishes if no trace arrived.

### Protocol

| Message | Field | Purpose |
|---|---|---|
| `NewSession` | `bool load_trace_allowed` | Whether this session may trace. The browser uses it to show controls and lazy-load the panel |
| `ClientState` | `bool trace_this_run` | Requests a trace of the run this rerun starts |
| `ForwardMsg` | `LoadTrace load_trace` | `trace_id`, `json`, `summary_markdown`, `final`, `status` |
| `BackMsg` | `LoadTraceBrowserTiming load_trace_browser_timing` | `trace_id`, `json` |

The trace body is versioned JSON (`"version": 1`) rather than protobuf, because the same
document is the file format, the input to the exporters, and what agents read. The server
sends the first `LoadTrace` message before `script_finished`, so the browser knows to keep
collecting until fully loaded. In the prototype, the demo's trace was about 240 KB, mostly
samples.

### Trace document and files

The document holds:

- `version` and `trace_id`
- `status`: `complete`, `interrupted`, `truncated` or `timed_out`
- the trigger, and page and fragment IDs
- `spans`, plus interned `frames` and `stacks`, and `samples`
- `clock`: server markers and the estimated offset
- `browser`: milestones and elements
- `totals`, copied from the page profile

Files go to `.streamlit/traces/` next to the main script: `trace-<time>-<id>.json` and
`.md`, plus `latest.json` and `latest.md`. A single background thread writes them
atomically (temp file, then rename), off the script thread, because in the prototype
writing and summarizing on the script thread added about 13 ms per run. The folder keeps the last 20 traces, and gets a
`.gitignore` containing `*` when it's created, because traces contain absolute paths.
Files are written whenever a trace is recorded. In SiS they're inaccessible and
short-lived, which is harmless.

The Markdown summary is generated on the server, so the panel, the CLI and the files show
the same text. It lists, in order:

- an overview line;
- the slowest Streamlit work, grouped by span and call site, with self time;
- cached calls, grouped by function, call site and result;
- fragments;
- the script thread in order, with gaps labeled from the samples;
- the hottest call paths in the app's code, naming the first library frame they called
  into, such as `streamlit_app.py:11 <module> -> import pandas`;
- browser rendering;
- the run's totals.

### Frontend

- The panel is a lazily loaded chunk, imported only when `load_trace_allowed` is true, so
  the initial bundle doesn't grow ($52). It's a bottom drawer that keeps the app visible
  above it.
- **Timeline:** server thread lanes stacked by depth, a sampled "your code" lane under each
  thread, browser element lanes packed into rows, and milestone markers. The prototype
  draws with absolutely positioned DOM elements, which was fine for about 1,000 bars. Larger
  traces may need a canvas renderer.
- **Flame graph** over the samples, per thread or all threads, optionally grouped by the
  innermost Streamlit span, with click to zoom.
- **Summary tab** and a **span table** (sortable by duration and self time), which are the
  accessible views of the same data ($49).
- **Source links.** Call sites render as `file:line`. The prototype also linked
  `vscode://file/...`. The product spec's open question 2 covers other editors and SiS.
- **Exports.** The panel builds exports in the browser from the merged trace, because
  hosts may not expose extra HTTP routes. The CLI keeps the Python exporters (about 120
  lines in the prototype), so the TypeScript copy is kept in sync by shared test fixtures.
  The formats:
  - Perfetto: Chrome trace event format. Spans become complete (`X`) events on per-thread
    tracks, and milestones become instant events.
  - speedscope: one sampled profile per thread plus an evented profile of the spans.
- The panel uses theme tokens and existing BaseWeb components ($50). The prototype's
  inline styles were for speed only.

### Agent access

| Path | Where | Browser timing |
|---|---|---|
| `streamlit trace run --url URL` | Local | No. It opens a headless agent API session |
| `streamlit trace run --url URL --browser` | Local | Yes, when someone reloads the page |
| `streamlit trace summary` and `streamlit trace export` | Local | Whatever the trace has |
| Agent API interact request with `trace: true` | Wherever the agent API is enabled and the session is allowed | No |
| "Copy summary" in the panel | Anywhere tracing is allowed | Yes |
| Event table via the OTel export | SiS, once both specs land | Coarse only |

The server also logs `Load trace written to <path>` at info level.

#### How a test agent used the prototype

A fresh agent session got a one-line hint ("the app is slow; run
`streamlit trace --help`") and was told not to read the app's or Streamlit's source. It
ranked all five server-side slow patterns in the demo correctly, with call sites and
sensible fixes. It found three things confusing:

- An import shown only as `<module>`. This is fixed: a path now names the library it calls
  into.
- No on-CPU marker on samples.
- First-line vs executing-line differences between the JSON and the summary.

It was also tempted to add parallel fragment time to the critical path, when only the
`wait` span counts. The fixes weren't re-checked with a second agent.

### Security and privacy

| In the trace | Not in the trace |
|---|---|
| Absolute file paths, function names, line numbers (app and library code) | Argument values and return values |
| `st.*` command names, element types and delta paths | Widget labels and values, element content |
| Cache function names, TTLs and results | Cache keys and cached values |
| Thread names, message sizes, timing | Query text, data, secrets, environment |

- **Who receives a trace.** Only the session whose request was traced. The CLI's "next new
  session" arm is the only cross-session trigger, and it requires a local request.
- **The HTTP route** for CLI arming is registered only when the policy isn't `"none"`, and
  accepts only local requests. The panel needs no HTTP routes.
- **Telemetry** records that a trace was recorded and which trigger and tabs were used,
  never trace content.
- **SiS.** Tracing stays off until the host can say on the server side which sessions
  belong to editors. Traces are shown only to that editor's session and, if configured,
  exported to the account's own event table.

### Where the trace doesn't apply

- **`AppTest`.** The recorder works under `AppTest` (the overhead benchmark relies on it),
  but nothing requests a trace there and there's no browser. Exposing it, for example as
  `at.run(trace=True)` returning the document, is future work.
- **Static export.** A static export has no server and no runs, so there's nothing to
  trace.
- **`st.App` under an external ASGI server.** `st.App` builds its routes with the same
  `create_streamlit_routes` as `streamlit run`, so the trace routes and messages work the
  same. Files go next to the main script. A proxy in front of the ASGI server makes
  sessions non-local under `"local"`, as intended. The prototype didn't test this.

### Limits and failures

- At most 20,000 spans and 60 seconds of samples per trace. Past either limit, recording
  of that kind stops, and the trace is marked `truncated` and shown as truncated ($43).
- A traced run that hasn't fully loaded within the render-timing timeout (30 s) is
  finalized with the browser timing collected so far, with status `timed_out`.
- Any exception in the tracer is caught and logged. The run continues, and the panel shows
  that the trace failed ($44).
- The trace message is subject to `server.maxMessageSize`. Within the limits above, a
  trace stays far below the 200 MB default. The prototype didn't measure a 60-second trace.

### Overhead

Measured with `AppTest.run()` in a fresh process per configuration, alternating
configurations across rounds, with logging at error level, on an Apple Silicon laptop with
Python 3.14. Each number is the median of per-round medians. "Prototype base" is develop
plus the page-profile PRs above, without trace code.

Worst case: 600 commands and 300 cache hits per run, 20 runs × 7 rounds.

| Configuration | Median run | vs develop |
|---|---|---|
| develop | 118.4 ms | — |
| Prototype base | 120.1 ms | +1.4% |
| Tracing allowed, not recording | 121.1 ms | +2.3% |
| Tracing allowed, not recording, usage stats on | 121.3 ms | +2.4% |
| Recording, spans only | 137.9 ms | +16.5% |
| Recording, spans and sampling (5 ms) | 139.3 ms | +17.7% |

Demo app (mostly sleeps, about 3 s per run), 3 runs × 3 rounds.

| Configuration | Median run | vs develop |
|---|---|---|
| develop | 2,972 ms | — |
| Prototype base | 2,998 ms | +0.9% |
| Tracing allowed, not recording | 2,963 ms | −0.3% |
| Tracing allowed, not recording, usage stats on | 2,977 ms | +0.2% |
| Recording, spans only | 3,001 ms | +1.0% |
| Recording, spans and sampling (5 ms) | 3,023 ms | +1.7% |

- **Not recording** costs about 1 ms over the prototype base in the worst case, which is
  within run-to-run noise (single rounds varied by up to 18 ms). Each hook's first check
  is a module-level integer.
- **Spans** cost about 19 µs each in the worst case (about 17 ms for about 900 spans). This
  is inferred from the totals, not measured per span. It includes finding the call site
  and building the trace document.
- **Sampling** adds 1 to 1.5% on top of spans.

A traced run is slower, so the trace inflates the time of very call-heavy runs by up to
about 17%. The panel shows the sampler's own CPU time and the span count, so readers can
judge the distortion.

### Testing

- Python unit tests for the policy checks (loopback, forwarding headers, `Origin`), span
  nesting across threads, cache results, the `st.rerun()` chain, interruption, limits, and
  the summary's sections.
- Frontend unit tests for the trace-mode tracker, clock alignment, and the panel's views.
- E2E tests: record each trigger and check the panel, check that no controls render and
  no trace code loads when tracing isn't allowed, and check the exports.
- An overhead benchmark like the prototype's, with a regression threshold for the
  not-recording case.

## Alternatives considered

**Always-on recording of the last few runs.** It would answer "why was that load slow?"
after the fact, but it costs every run about 19 µs per span and keeps file paths in memory
for every session. It could be added later on top of the same recorder.

**The OpenTelemetry SDK as the tracer.** It would make export trivial, but adds a
dependency and per-span cost to every Streamlit install, and OTel has no settled model for
the browser half. The trace uses an OTel-compatible span model instead, so exporting is a
direct mapping.

**`cProfile` or `pyinstrument`.** `cProfile` is deterministic and slows Python-heavy code
substantially. Both hook one thread at a time through `sys.setprofile`, so parallel
fragments would need extra work, and `pyinstrument` is a dependency. Neither knows about
Streamlit's commands, caches or fragments, so they'd still need the spans.

**`sys.monitoring` (PEP 669) call events.** It's precise, but it pays per call for every
function in the app, which is more than the spans and sampler cost together.

**Showing the trace on a separate server-hosted page.** The browser already has half the
data and is the one place every platform can show a UI, so the trace opens in the app. A
separate page would need an extra HTTP route, which hosts like SiS may not expose.

**Perfetto or speedscope as the only viewer.** They're excellent, and the trace exports to
both, but uploading a file is a detour locally and impossible for most SiS users. Neither
knows how to link an element to the command that created it.

**React's `Profiler` for browser timing.** It's only active in profiling builds, which
Streamlit doesn't ship. The render-timing tracker measures DOM-level milestones in
production builds.

**A detailed page profile.** Adding per-call detail to the page profile would break its
fixed-size, totals-only design, and send detail as telemetry that only the developer
needs.

## Open questions

1. **SiS enablement.** See product spec open question 1. The server side only needs a
   per-connection signal it can trust.
2. **On-CPU marking** needs per-thread CPU clocks, which Python only exposes on Linux. Is
   it worth platform-specific code for macOS and Windows, or are unmarked samples
   acceptable there?
3. **Detail spans in the OTel export.** Product spec open question 4 asks whether to
   export them by default. The technical concern is volume: about 900 spans per run is a
   lot of event table rows.
4. **Attribute names** should be settled together with the OTel export spec.
5. **Large traces.** Is 20,000 spans and 60 seconds of samples the right cap, and should
   the timeline move to canvas from the start?
