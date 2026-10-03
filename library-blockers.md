# Library blockers catalog: async & threading in Streamlit

**Purpose:** A curated, deduplicated catalog of real-world Python libraries that users
report as broken in Streamlit, and the *specific blocker* for each. This is a
discovery/cataloguing document only — it describes **what** breaks and **where** it is
reported, grouped by blocker type so each blocker can later be mapped to a solution.

**Scope of the mining:** open + closed `streamlit/streamlit` issues and, importantly, their
comment threads (where users name the exact library and paste the exact error), plus
reproduction apps in the `streamlit/st-issues` repo. Hub issues used as entry points:
#8488, #8308, #8161, #12076, #744, #1326, #8490, #9904, #10578.

> Note on the deliberate omission of solutions: this catalog does not propose, design, or
> evaluate fixes. Existing/proposed solution issues (e.g. #15807, #13143, #14524) are
> referenced only as *evidence that the blocker is real and tracked*, not as answers.

---

## Summary table

| Library (sub-API) | Category | Blocker type | Key evidence |
|---|---|---|---|
| `ib_insync` (via `eventkit`) | async | B1 import-time `get_event_loop()` | #744 (krambox, AlistairHaimes, d416, im-keiran) |
| `nest_asyncio` (`.apply()`) | async | B1 import-time `get_event_loop()` | #744 (Agerrr, dakotalk, joseberlines); #8488 (janantos, AutoGen) |
| `holoviews` / `panel` (via `tornado`) | async | B1 import-time `get_event_loop()` | #744 (bp6725) |
| `requests_html` (`HTMLSession`) | async | B1 import-time `get_event_loop()` | #744 (alexespencer, original report) |
| `pyppeteer` | async | B1 import-time `get_event_loop()` | #744 (original report jroakes) |
| `coiled` | async | B1 import-time `get_event_loop()` | #744 (tomgallagher) |
| `sketch` | async | B1 import-time `get_event_loop()` | #744 (Franky1) |
| `gremlinpython` (TinkerPop, via `tornado`) | async | B1 import-time `get_event_loop()` (on `conn.close()`) | #744 (lmeyerov) |
| `motor` / `beanie` (async MongoDB) | async | B2 loop-per-rerun / `Event loop is closed` | #744 (thorin-schiffer) |
| generic `asyncio.run(main())` pattern | async | B2 loop-per-rerun; run interrupted | #8488 (mescanne, dhdaines); #10578 |
| LangChain `ChatOllama` (`.astream`) + `st.write_stream` + `@st.cache_resource` | async | B3 cached async client bound to closed loop | #12076 (amanchaudhary-95, sfc-gh-nbellante) |
| `aiohttp` (cached client) | async | B3 cached async client bound to closed loop | #12076 (aj-jaiswal007) |
| async LLM clients generally (`@st.cache_*` on coroutine) | async | B4 cache decorators reject coroutines | #8308 (95 👍); #13143 |
| async generators / LLM async streams | async | B5 `st.write_stream` has no native async-gen support | #8161 (69 👍); #12076 |
| `playwright` (Windows) | async | B6 Selector vs Proactor event loop | #7825 (12 👍) |
| OpenRouter/OpenAI streaming client | async | B7 severe slowdown (suspected loop conflict) | #12323 |
| `paho-mqtt` (client callbacks) | threading | T1 lib-spawned thread → missing ScriptRunContext | #1326 (ansonnn07) |
| `joblib` (`Parallel`/`delayed`) | threading | T1 lib-spawned thread → missing ScriptRunContext | #1326 (Abdelgha-4) |
| LangChain / LangGraph (`StreamlitCallbackHandler`, `on_llm_new_token`) | both | T1 callback thread → missing ScriptRunContext, UI no-op | #1326 (jneeven, PlebeiusGaragicus, ging-dev, shiv248); #8490; #12051/#12052 |
| generic callback libs (callbacks on "Dummy"/pool threads) | threading | T1/T2 ctx added but UI still doesn't update | #1326 (mjpost, asehmi, mai-nakagawa) |
| OpenCV (`cv2`) video processing | threading | T3 background loop blocks interaction | #1326 (h3ll3r9) |
| long-running background thread generally | threading | T3 stale output / thread outlives run | #9904; #8488; #10578; #8490 (109 👍) |

**Category legend:** *async* = asyncio/event-loop; *threading* = ScriptRunContext /
thread-context; *both* = reported under both themes.

---

## Async / event-loop blocker groups

### B1 — Import-time `asyncio.get_event_loop()` fails on the script thread

**Symptom:** merely importing or initializing the library raises
`RuntimeError: There is no current event loop in thread 'ScriptRunner.scriptThread'.`
Streamlit runs the user script on a dedicated thread that has no asyncio event loop, and
these libraries call `asyncio.get_event_loop()` at module load / object construction
(behaviour hardened in Python 3.10+). The app never gets past the import line.

Root-cause confirmation in the tracker: the script runs on `ScriptRunner.scriptThread`,
which has no event loop, so any library calling `asyncio.get_event_loop()` there fails
([#744 triage comment](https://github.com/streamlit/streamlit/issues/744#issuecomment-3702348498)).

Libraries + evidence:
- **`ib_insync`** (fails inside its `eventkit` dependency's
  `util.py: main_event_loop = asyncio.get_event_loop()`), reproduced by multiple users with
  full stack traces:
  [krambox](https://github.com/streamlit/streamlit/issues/744#issuecomment-964543963),
  [AlistairHaimes](https://github.com/streamlit/streamlit/issues/744#issuecomment-986655102),
  [d416](https://github.com/streamlit/streamlit/issues/744#issuecomment-1005973043),
  [im-keiran](https://github.com/streamlit/streamlit/issues/744#issuecomment-1112345668).
  Follow-ups note the workaround "sort of works" but the app then hangs / hits
  `clientId already in use` on rerun
  ([d416](https://github.com/streamlit/streamlit/issues/744#issuecomment-1129963859)).
- **`nest_asyncio`** — `nest_asyncio.apply()` itself calls `get_event_loop()` and throws:
  [Agerrr](https://github.com/streamlit/streamlit/issues/744#issuecomment-613234131),
  [dakotalk](https://github.com/streamlit/streamlit/issues/744#issuecomment-686712930),
  [joseberlines](https://github.com/streamlit/streamlit/issues/744#issuecomment-1161775599).
  Also surfaces via AutoGen usage ([#8488 janantos](https://github.com/streamlit/streamlit/issues/8488#issuecomment-3170409691)).
- **`holoviews` / `panel`** — import chain reaches `tornado.wsgi` which calls
  `get_event_loop()` ([bp6725](https://github.com/streamlit/streamlit/issues/744#issuecomment-712945783)).
- **`requests_html` `HTMLSession`** — works as a plain script, breaks once `import streamlit`
  is added ([alexespencer](https://github.com/streamlit/streamlit/issues/744#issuecomment-1113955293));
  same class of problem as the original `pyppeteer`/`RenderHTML` report that opened #744.
- **`pyppeteer`** — original report (rendering a page for scraping) discussed in the
  [opening exchange](https://github.com/streamlit/streamlit/issues/744#issuecomment-561800883).
- **`coiled`** — same traceback ([tomgallagher](https://github.com/streamlit/streamlit/issues/744#issuecomment-1183304436)).
- **`sketch`** — needs an event loop present at import
  ([Franky1](https://github.com/streamlit/streamlit/issues/744#issuecomment-1491794486)).
- **`gremlinpython`** (Apache TinkerPop, uses `tornado`) — query succeeds but
  `remoteConn.close()` triggers `get_event_loop()` and raises the same
  `no current event loop` error ([lmeyerov](https://github.com/streamlit/streamlit/issues/744#issuecomment-685190131)).

**Popularity signal:** #744 has 33 comments, 11 👍, and ~10+ distinct reporters naming
different libraries with the identical traceback.

### B2 — `asyncio.run()` / new-loop-per-rerun: wrong loop, closed loop, interrupted run

**Symptom:** users run their async code via `asyncio.run(main())` at the end of the script
(or manually create a loop). Because a fresh loop is created (and torn down) per rerun, and
the old script thread may still be running, users hit: tasks landing on the wrong loop,
`RuntimeError: Event loop is closed` when reruns overlap or multiple sessions hit the app,
and coroutines that can no longer touch `st.*` because the run has moved on.

- Clear write-up of the three failure modes (`asyncio.run` → `Event loop is closed` under
  concurrency; per-eventlet loops → tasks on the wrong loop; cached loop across sessions →
  closed under simultaneous sessions) with a **`motor` / `beanie` (async MongoDB)** example
  passing an explicit `io_loop`:
  [thorin-schiffer](https://github.com/streamlit/streamlit/issues/744#issuecomment-2051218797)
  (also names Snowflake's async interface as motivation).
- Architectural description of why coroutines launched this way can't reliably reach `st.*`
  and why the old thread keeps running:
  [dhdaines](https://github.com/streamlit/streamlit/issues/8488#issuecomment-2724643471),
  [mescanne](https://github.com/streamlit/streamlit/issues/8488#issuecomment-2142763978).
- A long-lived network connection driven by a coroutine goes into an inconsistent state
  because a widget interaction terminates the in-progress run
  ([#10578 n0routine](https://github.com/streamlit/streamlit/issues/10578) — see also T3).

### B3 — Cached async client bound to an event loop that is later closed

**Symptom:** an async client is cached with `@st.cache_resource`; the client retains a
reference to the event loop that existed when it was created. On a later rerun a new loop
exists (or `st.write_stream` created and closed a temporary loop), and the cached client
tries to use the old, now-closed loop → `RuntimeError: Event loop is closed`.

- **LangChain `ChatOllama` `.astream` + `st.write_stream` + `@st.cache_resource`** — the
  canonical repro. Maintainer confirms the mechanism: `write_stream` spins up a temp loop to
  convert the async generator and closes it, but the cached client still points at that loop
  ([sfc-gh-nbellante](https://github.com/streamlit/streamlit/issues/12076#issuecomment-3137826119);
  [triage comment](https://github.com/streamlit/streamlit/issues/12076#issuecomment-3702352323)).
  The failure is isolated to the *cache + async* combination; sync-with-cache and
  async-without-cache both work ([amanchaudhary-95](https://github.com/streamlit/streamlit/issues/12076) opening report).
- **`aiohttp`** — same `Event loop is closed` when making API calls this way
  ([aj-jaiswal007](https://github.com/streamlit/streamlit/issues/12076#issuecomment-3184820681)).
- A related "keep one loop alive in a background thread across reruns" workaround also
  surfaces the threading warning (see T1):
  [amanchaudhary-95 Case 4](https://github.com/streamlit/streamlit/issues/12076#issuecomment-3239203334).

**Popularity signal:** #12076 has 8 comments, 2 👍; linked from #8488 as a concrete instance.

### B4 — `st.cache_data` / `st.cache_resource` cannot decorate async functions

**Symptom:** decorating an `async def` (coroutine) with a cache primitive doesn't work;
users must wrap the coroutine in a throwaway thread + `asyncio.run` to cache it. Affects any
async data-fetch / async LLM call people want to cache.

- Feature request with a large following and maintainer-provided thread/`asyncio.run`
  workarounds ([#8308](https://github.com/streamlit/streamlit/issues/8308), 95 👍;
  [kajarenc workaround](https://github.com/streamlit/streamlit/issues/8308#issuecomment-2724676924)
  shown in-thread).
- A community fork/prototype demonstrating the demand
  ([DrMagPie branch](https://github.com/streamlit/streamlit/issues/8308#issuecomment-2125502454));
  tracked as prototype #13143.

**Popularity signal:** #8308 — 95 👍, 11 comments, multiple "works for me / please ship it"
replies.

### B5 — `st.write_stream` has no native async-generator support

**Symptom:** passing an async generator (typical of async LLM SDKs) to `st.write_stream`
isn't supported; the sync-wrapper workaround "works for 1 step and then breaks immediately"
because each step opens/closes a new loop.

- Feature request ([#8161](https://github.com/streamlit/streamlit/issues/8161), 69 👍,
  CLOSED). Maintainer posts a `to_sync_generator` workaround
  ([lukasmasuch](https://github.com/streamlit/streamlit/issues/8161#issuecomment-2121009198));
  users report it breaks after the first chunk
  ([FilippTrigub](https://github.com/streamlit/streamlit/issues/8161#issuecomment-2162924173))
  and patch it with an explicit `new_event_loop()`
  ([lucasboscatti](https://github.com/streamlit/streamlit/issues/8161#issuecomment-2226430883)).
- Directly feeds into B3 (write_stream's temp-loop churn is what closes the cached client's
  loop in #12076).

### B6 — Windows: Streamlit forces `SelectorEventLoop`, breaking Proactor-only libs

**Symptom:** Streamlit's `_fix_tornado_crash` pins the Selector event loop on Windows.
Libraries that need the Proactor loop for async subprocesses (Playwright's driver) throw on
Windows.

- **`playwright`** (and "any other module relying on the Proactor event loop") —
  [#7825](https://github.com/streamlit/streamlit/issues/7825) (12 👍, CLOSED), citing
  Playwright's own "incompatible with SelectorEventLoop on Windows" docs.

### B7 — Severe slowdown with certain streaming HTTP clients (suspected loop conflict)

**Symptom:** identical OpenRouter API streaming code is ~16x slower inside Streamlit than in
a plain script; suspected interaction with Streamlit's event-loop handling. Weaker evidence
(one reporter, cause not confirmed), included as a tentative data point.

- **OpenRouter / OpenAI client** — [#12323](https://github.com/streamlit/streamlit/issues/12323)
  (1 👍), flagged as possibly loop-related in #12076 triage.

---

## Threading blocker groups

### T1 — Library-spawned threads hit "missing ScriptRunContext"; `st.*` calls no-op

**Symptom:** a library creates its own threads (callbacks, worker/thread pools) and calls
made from those threads log
`Thread '...': missing ScriptRunContext! This warning can be ignored when running in bare
mode` and any `st.*` calls silently do nothing (no output rendered). Users don't control the
thread creation, so they can't `add_script_run_ctx` at spawn time.

- **LangChain / LangGraph** via `StreamlitCallbackHandler` / `on_llm_new_token`: runnables
  spawn threads under the hood, so callbacks fire without context and nothing renders.
  - [#8490 PlebeiusGaragicus](https://github.com/streamlit/streamlit/issues/8490#issuecomment-2081118176)
    ("Invoking a runnable often creates new threads … causes a ScriptRunContext error").
  - [#1326 jneeven](https://github.com/streamlit/streamlit/issues/1326#issuecomment-2049823540)
    (LangChain spinning up threads), and the widely-reused decorator workarounds:
    [valkenburg-prevue-ch](https://github.com/streamlit/streamlit/issues/1326#issuecomment-2023149785),
    [ging-dev](https://github.com/streamlit/streamlit/issues/1326#issuecomment-2103233217),
    [shiv248](https://github.com/streamlit/streamlit/issues/1326#issuecomment-2345208923).
  - Dedicated bug: **`Thread 'ThreadPoolExecutor-4_0': missing ScriptRunContext`** with
    LangChain `create_react_agent` + `StreamlitCallbackHandler` when the tool call runs in a
    separate thread ([#12051](https://github.com/streamlit/streamlit/issues/12051), 7 👍;
    PR #12052; also fixes `langchain-ai/langgraph#101`).
- **`paho-mqtt`** — MQTT client callbacks run on the client's own thread → `missing
  ScriptRunContext` ([#1326 ansonnn07](https://github.com/streamlit/streamlit/issues/1326#issuecomment-1015553047)).
- **`joblib` `Parallel` / `delayed`** — user has no control over thread creation, same warning
  ([#1326 Abdelgha-4](https://github.com/streamlit/streamlit/issues/1326#issuecomment-1088520128)).
- **Generic async/callback libraries** — callbacks arrive on library "Dummy" threads
  ([#1326 mjpost](https://github.com/streamlit/streamlit/issues/1326#issuecomment-1228376759)).

Maintainer note that calling `st.*` from other threads is undefined/not thread-safe:
[tconkling](https://github.com/streamlit/streamlit/issues/1326#issuecomment-1024399877).

**Popularity signal:** #1326 — 34 comments, 36 👍 + 9 ❤️; #8490 — 109 👍.

### T2 — `add_script_run_ctx` added but UI still doesn't update (context timing)

**Symptom:** attaching the context (via `add_script_run_ctx` / decorating the callback)
removes the warning but the thread's `st.*` output still doesn't appear; it only works if
the context is attached at thread creation and the thread runs immediately — adding a
`time.sleep` (or attaching inside the callback) breaks it.

- Repeated reports that the warning goes away but the window doesn't update:
  [mjpost](https://github.com/streamlit/streamlit/issues/1326#issuecomment-1228376759),
  [arvindkr7](https://github.com/streamlit/streamlit/issues/1326#issuecomment-1309815864),
  [jiajiaxd](https://github.com/streamlit/streamlit/issues/1326#issuecomment-1312669479).
- Minimal demonstration that the same snippet works without `sleep` but fails with a 1s
  `sleep` before `st.text`:
  [mai-nakagawa](https://github.com/streamlit/streamlit/issues/1326#issuecomment-1597918085).
- `st-issues` repro `gh-5402/app.py` spawns 25 threads and attaches `add_script_run_ctx` to
  each purely to silence the `missing ScriptRunContext` warning
  (`issues/gh-5402/app.py`, citing #1326).

### T3 — Background threads outlive / are interrupted by the run; stale or lost output

**Symptom:** because every interaction starts a fresh script run on a new thread and kills
the in-progress one, background work either (a) keeps running as an orphaned thread whose
`st.*` calls throw or write stale output, or (b) is terminated mid-execution, corrupting
state. There is no lifecycle to tie a long-running thread to a session/run.

- Orphaned-thread behaviour described at the architecture level:
  [mescanne](https://github.com/streamlit/streamlit/issues/8488#issuecomment-2142763978),
  [dhdaines](https://github.com/streamlit/streamlit/issues/8488#issuecomment-2724643471).
- **Stale output shows as not-stale on rerun** from a long-running computation
  ([#9904](https://github.com/streamlit/streamlit/issues/9904)).
- **In-progress run terminated by input events**, breaking a "critical section" /
  long-lived connection driven by a coroutine
  ([#10578 n0routine](https://github.com/streamlit/streamlit/issues/10578#issuecomment-2694946566)).
- **OpenCV (`cv2`) video processing** blocks interaction because the processing loop occupies
  the run; user cannot click a warning button until the video finishes
  ([#1326 h3ll3r9](https://github.com/streamlit/streamlit/issues/1326#issuecomment-2121712545)).
- Broad demand for first-class multi-threading / background work
  ([#8490](https://github.com/streamlit/streamlit/issues/8490), 109 👍; use cases enumerated by
  [sfc-gh-jcarroll](https://github.com/streamlit/streamlit/issues/8490#issuecomment-2060387813)).

**Popularity signal:** #8490 — 109 👍; #8488 (native asyncio) — 152 👍 (largest of the hub set).

---

## Cross-reference: `st-issues` reproduction apps

- `issues/gh-6818/app.py` — async chronometer driven by `asyncio.run(run_chronometer(...))`
  at the end of the script (B2 pattern: per-rerun loop + coroutine touching session state).
- `issues/gh-5402/app.py` — spawns 25 `threading.Thread`s and calls `add_script_run_ctx(x)`
  on each solely to suppress `Thread '...': missing ScriptRunContext` (T1/T2; cites #1326).

---

## Notes on evidence quality

- The strongest, most-reproduced blocker is **B1** (import-time `get_event_loop()`), with a
  single shared traceback reported against many named libraries in #744.
- **B3** (cached async client + closed loop) has an explicit maintainer-confirmed mechanism in
  #12076 and a clean 3-case matrix isolating the failure.
- **T1** is the most-cited threading blocker, dominated by LangChain/LangGraph callback usage
  across #1326, #8490, and #12051/#12052.
- **B7** (#12323) is included as a weak/tentative signal — one reporter, root cause unconfirmed.
