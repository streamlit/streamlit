# Threading, Async & Concurrency — Issue Gap Analysis

_How `@st.fragment(parallel=True)` (parallel fragments) maps to the long tail of
Streamlit threading / multiprocessing / async / concurrency issues, and what gaps remain._

---

## Executive Summary

- **Issues reviewed: 34.** All **29** issues labeled `area:threading/processing` (open and
  closed) were read in full — original report **and** every comment — plus **5**
  closely-related issues referenced by the parallel-fragments specs but carrying different
  labels (`feature:st.fragment`, `feature:st.rerun`, `feature:runtime`, `area:frontend`).
- **10 themes identified** by grouping issues on the *underlying user need* rather than the
  surface error. The same error string ("missing ScriptRunContext", "Event loop is closed")
  shows up across several unrelated use cases, so symptoms were deliberately not used as the
  grouping key.
- **Coverage assessment: parallel fragments decisively solves 1 theme** — the single
  highest-value one (concurrent loading of independent page sections, the use case the
  feature was designed for, anchored by #8490 @ 108 👍 and #7851 @ 38 👍). It **partially
  helps 3 themes** (calling `st.*` from threads, thread-safety of internal machinery,
  script cancellation) and **does not address 6 themes**.
- **The largest remaining demand is in async/asyncio** (#8488 @ 148 👍, #8308 @ 100 👍,
  #8161 @ 69 👍 — ~330+ reactions combined) and **background/server-push execution**
  (#2838, #2180, #6687). These are explicitly scoped *out* of parallel fragments and are
  acknowledged in the spec as separate future features (`st.background_task()`, native
  async support).
- **Parallel fragments is honestly a narrow, well-targeted feature, not a general
  concurrency solution.** It removes the most common *supported-pattern gap* (running
  independent dashboard sections in parallel) and hardens a lot of internal thread-safety,
  but it deliberately does not become the answer to async, background work, external rerun
  triggers, multiprocessing, or interruption/cancellation.

---

## Methodology

### Gathering

1. **Labeled issues.** The canonical set is everything tagged `area:threading/processing`,
   fetched via the GitHub GraphQL API (the REST/search `labels=` filter and `gh search`
   both misbehaved with the available token — see note below):

   ```graphql
   repository(owner:"streamlit", name:"streamlit") {
     label(name:"area:threading/processing") {
       issues(first:100, states:[OPEN,CLOSED]) { ... }
     }
   }
   ```

   This returned **29** issues (`totalCount: 29`), all of which were read.

2. **Related-but-unlabeled issues.** The keyword search the task suggested
   (`threading OR multiprocessing OR async ...`) could not be used reliably here: with the
   environment's token, both `gh search issues` and the GraphQL `search(type:ISSUE)` query
   returned **only pull requests**, not issues, regardless of the `is:issue` qualifier (the
   repo has a very large, recent volume of parallel-fragments PRs that dominate relevance
   ranking). Rather than rely on a broken search, the supplementary set was taken from the
   issues **explicitly cross-referenced inside the two parallel-fragments specs and inside
   the labeled threads themselves**, then individually verified via `gh issue view`:

   | # | Title | Why included |
   |---|-------|--------------|
   | #9904 | Stale output from long-running computation shows as not-stale on rerun | Cited in product spec as a parallel/threading bug |
   | #10045 | Fragment-to-fragment (co-fragment) communication | Cited in spec "Forward compatibility" |
   | #12799 | Fragments: selective rerun and execution control | Cited in spec "Forward compatibility" |
   | #10578 | Input events immediately terminate everything | Cited in spec re: background tasks; rerun interruption |
   | #2975  | Server shutdown fails to exit while processing infinite loop | Cancellation/yield-point lineage of #14523 |

3. **Deduplication.** The supplementary set was de-duplicated against the 29 labeled issues
   (no overlap). Total unique issues analyzed: **34**.

### Reading

Every issue was read with `gh issue view <n> --repo streamlit/streamlit` including the full
body and **all** comments. Comment threads were the richest source — most of the actual
"what was the user really doing" signal (LangChain/LangGraph callbacks, `ib_insync`,
Kafka consumers, barcode scanners, BI dashboards, LLM streaming, `nest_asyncio` import
crashes) lives in the comments, not the original post, along with the community workarounds
(`add_script_run_ctx`, `with_streamlit_context`, `get_global_loop`, monkey-patched
`request_rerun`, `streamlit_callbacks`, `streamlit-process-manager`).

### Grouping

Issues were grouped by underlying need. A single issue can legitimately touch two themes
(e.g. #1012 is both "multiprocessing" and "cleanup/cancellation"); in those cases it is
listed under its primary theme and cross-referenced. The demand signal per theme is the sum
of body 👍 reactions plus a note on comment volume / duplicate-closures, which indicate
real-world recurrence even when reaction counts are low.

### Assessing against parallel fragments

Each theme is judged **Solved / Partially Solved / Not Solved** against what the product and
tech specs actually deliver:

- `parallel=True` runs each fragment in a **thread-pool worker** during the **full-app run
  only**; a barrier joins all workers before `scriptFinished`.
- Real concurrency for **I/O-bound** work today (GIL released during I/O); **CPU-bound**
  work only parallelizes on free-threaded Python (PEP 703), which is explicitly *not* gated.
- Hardened internal thread-safety: `SafeSessionState` RLock, `SharedRunState` locks for
  widget/form/fragment ID sets, `PagesManager`/`FragmentStorage` locks, per-thread
  `FragmentThreadState` via `ContextVar`, thread-owned cursors.
- **Restrictions:** `@st.dialog` and `st.switch_page` prohibited in parallel workers; no
  external-container writes from workers; return value always `None`.
- **Explicitly out of scope / deferred:** native async, background tasks that outlive the
  run, parallel fragment *reruns*, cross-fragment communication, multiprocessing, external
  rerun triggers. The spec names `st.background_task()`, `st.yield_point()` (#14523), and
  native async support as *separate* future work.

---

## Theme Analysis

### Theme 1 — Concurrent loading of independent page sections (page-load speedup)

**User need:** "My dashboard has N independent sections, each doing a slow query/API call.
They run sequentially, so total load time is the sum. I want them to load in parallel so
total time is the max of any one section, and I want each to appear as it finishes."

**Issues:**
- #8490 — Add support for multi-threading/multi-processing in Streamlit (**108 👍**, 10 comments)
- #7851 — Make Streamlit more friendly to multi-threading (**38 👍**, 2 comments)
- #6687 — Non-script-blocking functions for long-running tasks / "fill-in" (**16 👍**, 7 comments) — *also Theme 4*
- #4788 — Using `multiprocessing` module (for parallel data loads) (**28 👍**) — *primarily Theme 2*
- #1326 — the recurring real use case behind the `add_script_run_ctx` workaround — *primarily Theme 6*

**Demand signal:** Very high. #8490 is the single strongest signal in the entire area and
is named in the product spec as the motivating issue. #7851 explicitly bundles "undefined
behavior … empty session state" from ad-hoc threads. Comments repeatedly describe BI
dashboards (PowerBI-style lazy "fill-in" loading in #6687), multi-source data fetches, and
"run independent sections concurrently."

**Assessment: ✅ Solved.** This is precisely what `parallel=True` was designed for. Adding
the parameter to each section's fragment dispatches it to a worker thread; the main thread
continues; a barrier joins before completion; content renders progressively into the
reserved container as each thread finishes. For the dominant I/O-bound case (DB queries,
HTTP, file reads — all release the GIL) this delivers real wall-clock speedup, and it
replaces the fragile `add_script_run_ctx` workaround with a supported, context-correct,
exception-handled path. The "fill-in independently" UX from #6687 is met for work that fits
within a single run.

**Residual nit:** the "fill-in" request in #6687 also wants a per-section loading indicator;
the spec deliberately ships *no* built-in loading UI (`parallel=True` is a pure execution
modifier), leaving users to add `st.spinner`/future `st.skeleton`. Minor.

---

### Theme 2 — CPU-bound parallelism & multiprocessing

**User need:** "I have CPU-heavy work (data transforms, model scoring, image/video
processing, scientific compute). I want it to actually use multiple cores, typically via
`multiprocessing` / `ProcessPoolExecutor`."

**Issues:**
- #4788 — Using `multiprocessing` module (**28 👍**, 6 comments)
- #8521 — Multiprocessing failing with `concurrent.futures.ProcessPoolExecutor` (6 👍, closed/"works now-ish", really needs `if __name__=="__main__"`)
- #1012 — Play nicer with scripts that spawn child processes (**11 👍**, 7 comments) — *cleanup also Theme 7*

**Demand signal:** Moderate-high and persistent. Comment threads show repeated confusion:
child processes re-import and re-run the Streamlit script ("Warning: to view a Streamlit
app … run it with `streamlit run`"), pickling of page-defined functions fails, the
`if __name__=="__main__"` guard is non-obvious, and `ProcessPoolExecutor` startup adds
seconds of overhead. #1012 shows orphaned child processes hanging the session and requiring
SIGKILL.

**Assessment: ❌ Not Solved.** Parallel fragments use a **thread pool**, not processes.
- Under standard (GIL) Python, CPU-bound work in a parallel fragment **does not** run on
  multiple cores — threads can't execute Python bytecode simultaneously. The spec is candid
  about this: CPU-bound parallelism only materializes on **free-threaded Python (PEP 703)**,
  which is a non-gating "opportunistic" goal, not a delivered capability.
- None of the multiprocessing-specific pain (child-process re-import, pickling, `__main__`
  guard, orphaned-process cleanup on stop/rerun) is touched by parallel fragments.

**Remaining gap:** A supported story for CPU-bound parallelism — either first-class
guidance/support for `ProcessPoolExecutor` (process re-import avoidance, child cleanup tied
to session lifecycle, per #1012) or shipping on free-threaded Python so thread-based
fragments genuinely parallelize CPU work.

---

### Theme 3 — Native async / asyncio support and async libraries

**User need:** "I want to use `async`/`await`, async libraries (httpx, aiohttp, asyncpg,
LangChain `astream`, `ib_insync`, pyppeteer), and `asyncio` event loops inside Streamlit —
without event-loop crashes."

**Issues:**
- #8488 — Native asyncio support (**148 👍**, 10 comments) — the umbrella issue
- #8308 — `st.cache_resource`/`st.cache_data` should support async functions (**100 👍**, 11 comments)
- #8161 — Async generators in `write_stream` (**69 👍**, closed/**completed**)
- #744  — "There is no current event loop in thread" with asyncio (11 👍, **32 comments**)
- #12076 — "Event loop is closed" with `write_stream` + LangGraph `astream` (2 👍, 8 comments)
- #6836 — Async programming guide (10 👍, closed/duplicate of #8488)
- #6508 — Stopping an asyncio producer/consumer corrupts session_state (closed/duplicate of #8488)
- #6818 — Async code fails to use session_state on Cloud (fast reruns) (closed/completed)
- #12051 — `ThreadPoolExecutor` "missing ScriptRunContext" with LangChain agents (7 👍) — *context also Theme 6*

**Demand signal: Highest in the entire area.** ~330+ reactions across the top three alone,
plus #744's 32-comment thread of users hitting event-loop errors merely by *importing*
async-dependent libraries (`ib_insync`, `nest_asyncio`, holoviews, coiled). Workarounds are
everywhere and brittle: per-thread `asyncio.new_event_loop()`, `nest_asyncio`,
`to_sync_generator`, a cached "global loop" running in a daemon thread (`get_global_loop`),
and third-party libs (`streamlit-concurrency`). Maintainers repeatedly funnel duplicates
into #8488 and state async is "not officially supported … yet."

**Assessment: ❌ Not Solved (with a thin partial).**
- Native async is explicitly a **separate, planned feature**, not parallel fragments. The
  product spec shows `@st.fragment(parallel=True) async def …` only as a *future*
  composition once async support lands.
- **Thin partial:** because each parallel worker runs in its own thread with a copied
  context, an `async def` body inside a worker can `asyncio.run(...)` on a clean thread
  loop (the same trick people do manually today), and concurrency *between* fragments is
  achieved with sync code. But this does **not** deliver: `await` at script top level,
  caching async functions (#8308), async generators beyond the already-shipped
  `write_stream` case (#8161), or the import-time event-loop crashes of #744 (those happen
  on the main script thread, before any fragment runs).
- The `@st.cache_resource` + async event-loop reuse bug (#12076) is independent of fragment
  execution and remains.

**Remaining gap:** The biggest unmet demand in this whole area. Needs the dedicated native
async workstream: an event loop available to the script thread, `await`-able cache
decorators, and library-thread context propagation.

---

### Theme 4 — Background tasks that outlive a single script run

**User need:** "Kick off long-running work (a slow query, a training job, a generation),
let the page stay interactive, and fill in the result when it's ready — possibly continuing
across reruns. Fire-and-forget that survives the run."

**Issues:**
- #6687 — Non-script-blocking functions / `st.run_in_background` (**16 👍**, 7 comments)
- #5826 — Joining user threads (0 👍, lifecycle of user threads) — *also Theme 7*
- (overlaps #2838, #2180 — see Theme 5)

**Demand signal:** Moderate but high-quality. #6687 proposes `@st.run_in_background` and a
PowerBI-style lazy-fill UX; the thread includes a detailed maintainer (sfc-gh-lwilby)
design comment for **`st.background_task(fn, key=...)`** with `.running`/`.done`/`.result`
and auto-rerun on completion. Several commenters run micro-SaaS apps that offload heavy work
to edge functions because Streamlit can't do this natively.

**Assessment: ❌ Not Solved.** Parallel fragments are **bounded to the run** — the join
barrier waits for every worker before `scriptFinished`, and cancellation on rerun is
cooperative. A 30-second job in a parallel fragment **holds the barrier open** and blocks
the next rerun. The spec's own "indivisible long-running operation" addendum states this
plainly and names **`st.background_task()`** as the complementary, *separate* API. The
maintainer comment on #6687 confirms parallel fragments and background tasks are different
concepts (different lifetime, purpose, mental model).

**Remaining gap:** A managed background-task API: work that runs off the script thread,
survives reruns, is deduplicated by key, triggers a rerun on completion, and is cleaned up
on session end. Not delivered.

---

### Theme 5 — Triggering reruns from outside the script (server-push / event-driven)

**User need:** "Something *external* to the current script run should update the UI — a
websocket/Redis message, a Kafka record, a DB/file change, a background thread finishing, a
barcode scanner, another session. I want `st.request_rerun(session_id)` / push, not polling."

**Issues:**
- #2838 — Trigger a script re-run from another thread (**30 👍**, 9 comments)
- #2180 — Rerun when filesystem/DB/external data source changes (**16 👍**, 11 comments)
- #4391 — `request_rerun` a session via external sources / session_id (2 👍, 3 comments)
- #2927 — Time or event (websocket/redis) callbacks (0 👍, 3 comments; community lib `streamlit_callbacks`)
- #315  — Allow writing to Streamlit from multiple threads (1 👍) — *also Theme 6*

**Demand signal:** Moderate-high and very concrete. Users monkey-patch internals to reach
`session.request_rerun()` / `_handle_rerun_script_request()` across all sessions
(notify-all pattern for `@st.cache_resource` data shared between clients), build
`streamlit_callbacks`, and hack tornado handlers. Use cases: Kafka consumers, barcode
scanners (#8490 comments), IoT/linac image streams (#2180), notifications.

**Assessment: ❌ Not Solved.** Parallel fragments provide no mechanism to trigger a rerun
from outside the current run, and they cannot push updates from a long-lived external
thread. This need is adjacent to Theme 4 (background work) and to cross-fragment
communication (Theme 10); the spec lists external trigger sources only as *forward
compatibility* ("the fragment rerun dispatch path … should be general enough to support new
trigger sources"), not as delivered functionality.

**Remaining gap:** A public, session-addressable rerun/push API (e.g.
`st.request_rerun(session_id)` or an event-callback primitive), plus a supported
"rerun-on-external-change" trigger. Still entirely workaround territory.

---

### Theme 6 — Calling `st.*` from user- or library-created threads (ScriptRunContext)

**User need:** "I (or a library I use — LangChain, joblib, MQTT, a callback-based SDK)
create threads, and I want `st.write`/progress/containers to work from them without the
'missing ScriptRunContext' warning and without the output silently disappearing."

**Issues:**
- #1326 — Improve "missing ScriptRunContext" threading error (**46 👍**, **34 comments**)
- #12051 — `ThreadPoolExecutor` "missing ScriptRunContext" with LangChain/LangGraph (7 👍, 3 comments)
- #5402 — "Bad 'setIn' index" when using `st.cache_data` in a thread (8 👍) — *also Theme 9*
- #315  — Allow writing to Streamlit from multiple threads (1 👍) — *also Theme 5*

**Demand signal:** High and long-running. #1326 is one of the oldest/most-commented threads;
it documents the `add_script_run_ctx` workaround **and** its caveats (maintainer: "calling
any Streamlit function from another thread is undefined behavior … race conditions"). A
recurring, important finding in the comments: even *with* `add_script_run_ctx`, output often
**doesn't appear** because the script finishes before the thread writes (stale/missing
output). The community converged on `with_streamlit_context` and `get_streamlit_cb`
decorators specifically to make LangChain callbacks render.

**Assessment: ⚠️ Partially Solved.**
- **Solved for the in-run case:** parallel fragments are the *supported* way to run threaded
  work whose output renders correctly — they propagate `ScriptRunContext`, copy the DG/cursor
  context, hold the barrier so output isn't lost, and handle exceptions. Users who reached
  for `add_script_run_ctx` to parallelize *their own* sections get a first-class replacement.
- **Not solved for foreign threads:** threads created *by libraries* (LangChain's
  `ThreadPoolExecutor`, joblib, SDK callback threads in #12051/#1326) are still outside the
  fragment model and still need manual context propagation. Parallel fragments don't
  auto-attach context to threads the user didn't dispatch through the decorator.

**Remaining gap:** An ergonomic, supported helper to render from arbitrary user/library
threads (a public `with_streamlit_context`-style API), and integration so popular callback
handlers (LangChain) "just work."

---

### Theme 7 — Cancelling / interrupting long-running work and cleaning up

**User need:** "When I press Stop (or rerun, or shut down the server), the running work
should actually stop — including tight loops with no `st.*` calls, hung threads, and child
processes — and resources should be cleaned up."

**Issues:**
- #8182 — Script cancellation from the GUI (6 👍, 7 comments)
- #2975 — Server shutdown fails to exit while processing an infinite loop (5 👍, **15 comments**)
- #1012 — Child processes orphaned on interrupt/stop (**11 👍**) — *also Theme 2*
- #573  — Detect when an orphaned thread is left running (0 👍, `status:unlikely`)
- #9904 — Stale output from a long-running computation shows as not-stale on rerun (1 👍)
- #14523 — `st.yield_point` — cooperative cancellation checkpoint (1 👍)

**Demand signal:** Moderate but technically deep. The threads converge on one root cause
(maintainer tvst in #2975): Python can't force-kill threads, so Streamlit checks a stop flag
only at `st.*` yield points; code in tight loops or blocking calls never yields. Costly DWH
queries can't be cancelled (#8182); infinite loops require SIGKILL (#2975); child processes
orphan (#1012). A community branch even injects `SystemExit` via `ctypes`.

**Assessment: ⚠️ Partially Solved (mostly complementary, not delivered).**
- Parallel fragments **inherit and slightly worsen** the cooperative-cancellation limitation:
  a worker blocked in a long I/O/compute call won't see the cancel signal until it returns,
  and the barrier waits for it. The spec is explicit ("does not make long-running blocking
  calls responsive").
- The genuine answer is **`st.yield_point()` (#14523)** — filed *alongside* parallel
  fragments as the complementary cancellation primitive. It is **proposed, not shipped**, and
  even when shipped requires users to insert checkpoints manually.
- #9904 (stale output bleeding across reruns) is the exact failure mode the join-barrier +
  delayed `clearStaleNodes` design targets for *fragment* threads, so parallel fragments
  reduce this class of bug for the supported path — but ad-hoc user threads and indivisible
  blocking calls remain.
- Hung-thread/child-process/infinite-loop termination (#2975, #1012, #573, #8182) is **not
  addressed**.

**Remaining gap:** Ship `st.yield_point()`; provide a real cancellation/interruption story
for tight loops, hung threads, and child processes; orphan-thread detection.

---

### Theme 8 — Protecting critical sections / state from rerun interruption

**User need:** "A widget interaction triggers a rerun that kills my in-progress script
mid-way, corrupting a state machine, a generator, or a long-lived connection. I want to mark
code as uninterruptible / queue the interaction instead of tearing everything down."

**Issues:**
- #10578 — Input events immediately terminate everything (2 👍, 9 comments) — `generator already executing`
- #9021 — Disable rerun while heavy tasks run / "froze interface" (6 👍, closed/completed)
- #6508 — Stopping an asyncio producer/consumer → "session_state has no key" (closed/dup) — *also Theme 3*

**Demand signal:** Moderate, but the #10578 discussion is high-value: maintainer
(sfc-gh-lwilby) and reporter explore a **`@st.critical_section`** decorator and conclude
this is a real, "somewhat common" need; it spawned a dedicated proposal for
**rerun-resilient streaming** (`st.background_stream` / #14524). #9021 is the same need from
the streaming-response angle (don't rerun while a stream is updating the UI).

**Assessment: ❌ Not Solved.** Parallel fragments don't change the rerun-interruption model
for the main script or for state mutated outside the fragment; an external rerun cancels
in-flight parallel workers (cooperatively). Session_state writes are single-operation atomic
(RLock) but multi-op read-modify-write across an interruption is explicitly the user's
responsibility. The `@st.critical_section` / `st.background_stream` ideas are separate,
undelivered proposals.

**Remaining gap:** A way to protect a code/state region from rerun teardown (or queue the
triggering interaction), and rerun-resilient streaming for LLM/chat apps.

---

### Theme 9 — Thread-safety of internal machinery under concurrent use

**User need (implicit):** "When concurrency happens (my threads, fast reruns, the file
watcher), Streamlit's own internals shouldn't throw cryptic errors or corrupt the frontend."

**Issues:**
- #5402 — "Bad 'setIn' index" with `st.cache_data` spinner in a thread (8 👍, 3 comments)
- #6404 — Race conditions → `KeyError` in module reloading (**10 👍**, 9 comments, `status:confirmed`)
- #6818 — Async session_state fails on Cloud due to fast reruns (closed/completed) — *also Theme 3*
- #15374 — Regression: `_run_with_thread_state()` arg mismatch with `run_every` (closed/completed)

**Demand signal:** Moderate; these are confirmed bugs, not feature votes, so reaction counts
understate them. #6404 has a reproducible stress harness; #5402 reproduces in the cloud;
#15374 flooded a production Sentry (~50 events/4h).

**Assessment: ⚠️ Partially Solved.**
- The parallel-fragments work **directly hardened** several of these internals:
  `SharedRunState` locks the widget/form/fragment-ID sets, `PagesManager` and
  `FragmentStorage` gain locks, `SafeSessionState` RLock, thread-owned cursors with
  `_check_owner`. This addresses the *class* of races in #5402 (concurrent delta/cursor
  access from threads) and #6818 (session_state under concurrency) for the supported path.
- Notably, **#15374 is a regression introduced *by* the parallel-fragments refactor**
  (`FragmentThreadState` ContextVar / PR #15072), affecting `@st.fragment(run_every=...)` —
  so this workstream both fixes and (temporarily) creates thread-safety bugs. It was fixed,
  but it underscores the blast radius.
- **Not solved:** #6404 (file-watcher vs. import machinery race on `sys.modules`) is in the
  module-reload path, untouched by fragment threading; and ad-hoc user threads that bypass
  the supported path can still hit the original `setIn` race.

**Remaining gap:** Thread-safe module reloading (#6404); ensure the new threading
infrastructure doesn't regress existing single-thread paths (lesson from #15374).

---

### Theme 10 — Cross-fragment communication & selective rerun control

**User need:** "Trigger a *specific* fragment's rerun from elsewhere (another fragment / the
main script), and/or prevent certain fragments from re-executing on a full rerun — without
rerunning the whole app."

**Issues:**
- #10045 — Fragment-to-fragment (co-fragment) communication (**12 👍**, 1 comment)
- #12799 — Fragments: selective rerun and execution control (**12 👍**, 2 comments)

**Demand signal:** Moderate and growing; commenters call advanced rerun-flow control
"crucial," especially for dialogs and coordinated multi-fragment updates.

**Assessment: ❌ Not Solved (explicitly forward-compat).** The tech spec lists
cross-fragment communication (#10045, #12799) under "Forward compatibility" and only commits
to keeping the dispatch/cancellation path *general enough* to support it later. Parallel
fragments still rerun only on their own widget/`run_every`; programmatic targeting of
another fragment's rerun and "skip this fragment on full rerun" are not delivered.

**Remaining gap:** A `st.rerun(scope=[...])` / fragment-keyed trigger API and a way to mark
fragments as "don't re-execute unless inputs change."

---

## Gap Summary Table

| # | Theme | Issues (👍) | Status vs. parallel fragments | Remaining gap |
|---|-------|-------------|-------------------------------|---------------|
| 1 | Concurrent loading of independent page sections | #8490 (108), #7851 (38), #6687 (16) | ✅ **Solved** | None material; no built-in per-section loading UI |
| 2 | CPU-bound parallelism & multiprocessing | #4788 (28), #8521 (6), #1012 (11) | ❌ **Not Solved** | GIL blocks CPU parallelism (needs free-threaded Py); multiprocessing re-import/pickling/child-cleanup untouched |
| 3 | Native async / asyncio & async libraries | #8488 (148), #8308 (100), #8161 (69), #744 (11), #12076, #6508, #6818, #6836, #12051 | ❌ **Not Solved** (thin partial: worker has own thread loop) | Native `await`, async cache, import-time loop crashes, loop reuse — separate async workstream |
| 4 | Background tasks outliving the run | #6687 (16), #5826 | ❌ **Not Solved** | Fire-and-forget work that survives reruns → `st.background_task()` (not built) |
| 5 | External rerun triggers / server-push | #2838 (30), #2180 (16), #4391 (2), #2927, #315 | ❌ **Not Solved** | Public `request_rerun(session_id)` / event-callback / rerun-on-external-change |
| 6 | Calling `st.*` from user/library threads | #1326 (46), #12051 (7), #5402 (8), #315 | ⚠️ **Partial** | Foreign (library) threads still need manual context; want supported `with_streamlit_context` + LangChain integration |
| 7 | Cancellation / interruption / cleanup | #8182 (6), #2975 (5), #1012 (11), #573, #9904, #14523 | ⚠️ **Partial** (inherits limitation; `st.yield_point` complementary, unshipped) | Ship `st.yield_point()`; kill hung threads/loops/child procs; orphan detection |
| 8 | Protect critical sections from rerun interruption | #10578, #9021 (6), #6508 | ❌ **Not Solved** | `@st.critical_section` / rerun-resilient streaming (`st.background_stream`, #14524) |
| 9 | Thread-safety of internal machinery | #5402 (8), #6404 (10), #6818, #15374 | ⚠️ **Partial** (hardened supported path; introduced+fixed #15374 regression) | Thread-safe module reload (#6404); avoid regressing single-thread paths |
| 10 | Cross-fragment communication & selective rerun | #10045 (12), #12799 (12) | ❌ **Not Solved** (forward-compat only) | Fragment-keyed `st.rerun(scope=[...])`; skip-on-full-rerun control |

Legend: ✅ Solved · ⚠️ Partially Solved · ❌ Not Solved.

---

## Recommendations

Prioritized by demand signal × strategic fit, given parallel fragments has shipped.

1. **Native async / asyncio support (Themes 3) — highest priority.**
   Largest unmet demand by far (#8488 148 👍, #8308 100 👍, #8161 69 👍; #744's 32-comment
   import-crash thread). Concretely: (a) provide an event loop on the script thread so
   `await`/`asyncio.run` and async-lib imports don't crash; (b) `await`-able
   `st.cache_data`/`st.cache_resource` (#8308); (c) fix cached-async-client loop reuse
   (#12076). This composes with parallel fragments (`async def` worker bodies) per the spec's
   own roadmap, so it builds on, rather than conflicts with, what shipped.

2. **`st.background_task()` (Themes 4 & 5, partly 8) — high priority.**
   Already designed in the #6687 maintainer comment; directly addresses background execution
   (#6687) and, with auto-rerun-on-completion, a large part of external-trigger demand
   (#2838 30 👍, #2180 16 👍). It cleanly fills the gap parallel fragments deliberately left
   (work that outlives the run). Pair with rerun-resilient streaming (`st.background_stream`,
   #14524 / #10578 / #9021) for the LLM-chat critical-section case.

3. **Ship `st.yield_point()` (Theme 7) — high priority, low cost.**
   Already specced (#14523), already named in the parallel-fragments tech spec as the
   complementary cancellation primitive, and needed to make parallel fragments themselves
   cancellable during long blocking calls. Closing this materially improves Stop/rerun
   responsiveness (#8182, #2975) for both sequential and parallel code.

4. **Supported thread-context helper + LangChain integration (Theme 6) — medium-high.**
   A public, documented equivalent of the community `with_streamlit_context` /
   `get_streamlit_cb` decorators, plus making the bundled LangChain callback handler
   propagate context (#1326 46 👍, #12051). Affects a core, fast-growing use case (LLM
   agents) that parallel fragments does not cover because the threads are created by
   libraries, not the user.

5. **External rerun / push API (Theme 5) — medium.**
   A public `st.request_rerun(session_id)` (or event-callback) plus a supported
   "rerun-on-external-change" trigger (#2838, #2180, #2927, #4391). Many users are
   monkey-patching internals today; a sanctioned API removes a whole class of fragile hacks.

6. **Cross-fragment communication & selective rerun (Theme 10) — medium.**
   `st.rerun(scope=[fragment_keys])` and skip-on-full-rerun control (#10045, #12799). The
   spec already commits to keeping the dispatch path general enough; this is the natural
   next iteration on the fragment model.

7. **CPU-bound / multiprocessing story (Theme 2) — medium-low (strategic).**
   Two paths: (a) certify/ship on free-threaded Python (PEP 703) so existing parallel
   fragments parallelize CPU work with no API change — the highest-leverage option; (b)
   first-class guidance/support for process pools with child-process cleanup tied to the
   session (#4788, #1012). Lower near-term priority but unlocks a class of apps threads
   can't serve.

8. **Thread-safe module reloading & regression guards (Theme 9) — ongoing hygiene.**
   Fix the file-watcher/`sys.modules` race (#6404), and treat the #15374 regression as a
   cautionary case: the new threading infrastructure must be regression-tested against the
   existing single-thread and `run_every` paths.

---

_Sources: all 29 `area:threading/processing` issues (open + closed) plus 5 spec-referenced
issues (#9904, #10045, #12799, #10578, #2975), read in full including comments; and
`specs/2026-03-05-parallel-fragments/{product-spec.md,tech-spec.md}`._
