# Long-Running Tasks — Coverage of the `st.background_task` Proposal

_Which long-running-work use cases from the threading/async issue backlog would be solved by
the `st.background_task` design sketched in
[#6687 (comment)](https://github.com/streamlit/streamlit/issues/6687#issuecomment-4129427835),
and which would remain unmet._

---

## Executive Summary

- **13 distinct long-running-task use cases** were extracted from the issue backlog (drawn
  from the 34 issues reviewed in the threading/async gap analysis, filtered to those whose
  underlying need is "work that takes a long time").
- The proposed **`st.background_task(fn, args=..., key=...)`** API — fire-and-forget work
  that **survives reruns**, is **deduplicated by key**, **auto-reruns on completion**,
  **produces data (not UI)**, **doesn't block interactions**, and is **cleaned up at session
  end** — is a precise fit for one shape of long-running work: **a discrete job that starts,
  runs off the script thread, finishes, and yields a result.**
- **Coverage tally: ~2 use cases fully solved, ~6 partially solved, ~5 not solved.**
  - **Solved:** the canonical "slow query / batch job → render result when ready" cases
    (UC1, UC2) and lifecycle cleanup *for tasks the API itself manages* (UC12a). This is
    exactly the #6687 ask and a large share of the demand.
  - **Partial:** long query *with cancellation* (UC3), CPU/multiprocessing (UC4), periodic
    refresh (UC5), persistent connections (UC7), interruption/cancellation (UC11), progress
    reporting (UC13) — the core "don't block, render when done" works, but a second
    dimension (true parallelism, cancellation, progress, or persistence) is missing or an
    open question.
  - **Not solved:** continuous/streaming output (UC8, UC9), external event-driven push
    (UC6), cross-session broadcast (UC10), and cleanup of *user-spawned* threads/processes
    (UC12b). These have a fundamentally different shape — **no terminal "done" state**,
    **many updates over time**, or **scope beyond one session** — that the
    running→done→result model structurally doesn't capture.
- **Headline:** `st.background_task` cleanly closes the single biggest "discrete long job"
  gap that parallel fragments deliberately left open. The remaining unmet demand clusters
  into **streaming** (the maintainer's separate `st.background_stream` / #14524),
  **external/event-driven triggers and cross-session push** (Theme 5 of the prior analysis),
  and **CPU parallelism** — none of which a finishing, session-scoped task can serve.

---

## The proposal (as written in #6687)

> **`st.background_task`** — a managed API for kicking off long-running work that survives
> reruns.
> ```python
> task = st.background_task(slow_query, args=(params,), key="my_query")
> if task.running:
>     st.info("Query running...")
> elif task.done:
>     st.dataframe(task.result)
> ```

Stated properties:

| Property | Detail |
|----------|--------|
| Survives reruns | The work outlives a single script run / interaction. |
| Dedup by `key` | Same key = same task, not a new one on each rerun. |
| Auto-rerun on completion | Runtime triggers a rerun when the task finishes — no polling. |
| Produces data, not UI | The task returns a result; the script renders it. |
| Non-blocking | Doesn't block user interactions while running. |
| Session-scoped cleanup | Tasks are cleaned up when the session ends. |
| Managed context | Unlike raw threads, has `ScriptRunContext`, can trigger reruns, tied to session lifecycle. |

**Open questions the author flagged:** API shape (decorator vs. function), which concrete
use cases matter, and **how important cancellation is when inputs change**. These open items
are the reason several use cases below land as "Partial."

**Explicitly complementary to parallel fragments:** `@st.fragment(parallel=True)` gives
concurrency *within* a run (independent UI sections load together); `st.background_task`
gives work that *outlives* the run and produces data rather than UI.

---

## Methodology

Starting from the 34 issues in the threading/async gap analysis, I selected those whose
underlying user need is "something takes a long time and I don't want it to block / I want it
to keep going," then decomposed them into discrete use cases (a single issue can map to more
than one). Each use case is assessed against the seven stated properties above, judged
**Solved / Partial / Not Solved**, with the boundary made explicit.

Demand signal is the body 👍 reactions plus comment volume; for closed issues the closure
reason is noted. (Reaction counts understate confirmed bugs, which attract fewer votes than
feature requests.)

Relevant issues and demand: #6687 (16 👍), #2838 (30 👍), #2180 (16 👍), #4788 (28 👍),
#1012 (11 👍), #8182 (6 👍), #9021 (6 👍, closed), #2975 (5 👍), #12076 (2 👍), #10578 (2 👍),
#6818 (2 👍, closed), #6508 (1 👍, closed/dup), #2927 (0 👍), #5826 (0 👍), #573 (0 👍),
#14523 (1 👍).

---

## Use-Case Inventory & Assessment

### UC1 — Slow one-shot query / API call, render result when ready (non-blocking)
**Issues:** #6687, parts of #2838. **Need:** kick off a slow query, keep the page
interactive, fill in the result when it lands.
**Assessment: ✅ Solved.** This is the proposal's canonical example. `st.background_task`
runs the query off the script thread, leaves the UI responsive, and auto-reruns to render
`task.result`. Dedup-by-key prevents relaunching on every interaction (the exact failure of
the naive `add_script_run_ctx` thread workaround).

### UC2 — Long ML training / batch job that yields an artifact
**Issues:** #6687 (jrieke explicitly lists "model training"), #14523 (epoch loops).
**Need:** run a training/batch job, get a model/file/result, don't freeze the app.
**Assessment: ✅ Solved (core), with a caveat.** A discrete job that produces a result fits
perfectly. **Caveat:** if `background_task` is implemented on threads, CPU-bound training
won't gain multi-core parallelism under the GIL (only on free-threaded Python) — but the
*primary* value here (don't block the UI, render when done) is delivered regardless. True
CPU speedup is UC4.

### UC3 — Long DWH/SQL query that the user may want to cancel
**Issues:** #8182, #8181. **Need:** render-when-ready **and** the ability to abort a costly
query (multi-user DWH cost concern).
**Assessment: ⚠️ Partial.** The "run + render" half is solved. **Cancellation is the
author's explicit open question**, and even if added it would be cooperative — a thread
blocked inside a database driver call won't observe a cancel until the call returns (same
Python limitation parallel fragments hit; pairs with `st.yield_point()` / #14523). So
"abort a stuck query to stop DWH cost" is not guaranteed.

### UC4 — CPU-bound parallel compute (multiprocessing)
**Issues:** #4788 (28 👍), #8521, #1012. **Need:** use multiple cores for heavy compute
(`multiprocessing` / `ProcessPoolExecutor`).
**Assessment: ⚠️ Partial (leaning Not Solved for the core ask).** `background_task` makes
heavy compute non-blocking and renders the result — useful — but #4788's actual ask is
**CPU parallelism**. If the API is thread-based, the GIL prevents real speedup; and the
multiprocessing-specific pain (child re-importing the script, pickling page-defined
functions, `if __name__=="__main__"`, orphaned child processes from #1012) is untouched
unless `background_task` explicitly supports a process backend with managed child lifecycle.

### UC5 — Periodic background refresh / polling an external source
**Issues:** #2180 (16 👍), #2975 (REST poll loop), #2838. **Need:** keep data fresh by
re-pulling on an interval / when a source changes.
**Assessment: ⚠️ Partial.** A `background_task` is a one-shot job (running→done); periodic
refresh is closer to `run_every`. You could re-launch the task on completion to approximate
polling, but that's a workaround, and #2180's real ask ("rerun **when** the DB/file/Redis
key changes") is event-driven, not poll-on-a-timer — see UC6.

### UC6 — External event-driven push (websocket / Redis / Kafka subscription)
**Issues:** #2927, #2180 (16 👍), #1012 (Kafka). **Need:** an external event stream pushes
updates into the app as they arrive.
**Assessment: ❌ Not Solved.** A subscription never "finishes" and emits **many** events; the
running→done→`auto-rerun-on-completion` model assumes a single terminal result. This is a
push/trigger need (Theme 5 of the prior analysis: a public `request_rerun(session_id)` /
event-callback), not a finishing task. You could host a forever-running consumer inside a
task, but `.done` would never fire and you'd still need a separate rerun-trigger mechanism.

### UC7 — Long-lived persistent connection across reruns
**Issues:** #744 (ib_insync TWS socket), #1012 (Kafka consumer). **Need:** open a connection
once, keep it alive across many interactions, send/receive on it.
**Assessment: ⚠️ Partial (awkward fit).** Dedup-by-key means a task isn't relaunched, so a
long-running task *could* hold a connection alive while it runs. But the model is "produce a
result and finish," not "maintain an interactive connection you read/write across reruns."
A persistent connection that also needs to push inbound messages collapses into UC6. Better
served by a session-scoped resource + a push API than by a finishing task.

### UC8 — Incremental streaming that survives user interaction (LLM/agent chat)
**Issues:** #12076, #10578, #9021. **Need:** stream tokens into the UI continuously while the
user can still interact, without the stream being torn down by reruns.
**Assessment: ❌ Not Solved.** `background_task` explicitly "produces data rather than UI"
and exposes a binary running/done — it renders a *final* result, not a token-by-token live
stream. The maintainer recognized this and filed a **separate** proposal,
`st.background_stream` (#14524), for rerun-resilient streaming. So this high-growth use case
is out of scope for `background_task` by design.

### UC9 — Infinite producer/consumer loop updating the UI live
**Issues:** #6508, #6818. **Need:** an `asyncio.Queue` + `gather(produce, consume)` pushing
live frames/metrics indefinitely.
**Assessment: ❌ Not Solved.** Same structural mismatch as UC8 — there is no terminal "done,"
just continuous updates. A task that runs forever never triggers the completion rerun and
would hold resources for the session; the need is continuous push/streaming, not a job.

### UC10 — Cross-session broadcast (notify all sessions on shared update)
**Issues:** #2838 (`ahoereth`'s notify-all for a shared `@st.cache_resource`). **Need:** when
a shared/background resource updates, refresh **every** connected session.
**Assessment: ❌ Not Solved.** The proposal is explicitly **session-scoped** ("cleaned up
when the session ends"). Broadcasting to all sessions is a different lifetime and scope; it
needs a runtime-level push API, not a per-session task.

### UC11 — Cancellation / interruption of in-flight work
**Issues:** #8182, #2975 (15 comments), #10578. **Need:** Stop button (or input change)
actually halts running work; hung threads/loops are killable.
**Assessment: ⚠️ Partial / open.** Cancellation-on-input-change is the author's flagged open
question. Even if added, it inherits Python's cooperative-cancellation limit (can't force-kill
a blocked C call or a tight loop with no checkpoints — #2975). Realistically pairs with
`st.yield_point()` (#14523). So "cancel a managed task" may land; "guarantee a hung task
dies" will not.

### UC12 — Lifecycle cleanup of long-running work
**Issues:** #1012 (orphaned child processes), #5826 (joining user threads), #573 (orphan
detection). **Need:** spawned work is cleaned up on session end / shutdown.
**Assessment: Mixed — ✅ Solved (a) / ❌ Not Solved (b).**
- **(a) Tasks the API manages:** session-scoped cleanup is a stated property → solved.
- **(b) User-spawned threads / child processes** created outside the API (#1012, #573,
  #5826) are still unmanaged and can orphan. `background_task` only governs work routed
  through it; it doesn't retrofit cleanup onto raw `threading.Thread` / `multiprocessing.Pool`.

### UC13 — Progress reporting during background work
**Issues:** #6687 (`CHerSun`: "if there'd be a way to report progress, not just a spinner").
**Need:** show real progress (%/status), not only running/done.
**Assessment: ⚠️ Partial / open.** The sketch exposes `running`/`done`/`result` but no
progress channel. Progress reporting from a task that "produces data, not UI" needs an extra
mechanism (e.g. a writable progress value the task can update and the script can read). Not
in the current sketch.

---

## Summary Table

| UC | Use case | Issues (👍) | Verdict |
|----|----------|-------------|---------|
| 1 | Slow one-shot query/API → render when ready | #6687 (16), #2838 (30) | ✅ Solved |
| 2 | ML training / batch job → artifact | #6687, #14523 | ✅ Solved (GIL caveat for CPU) |
| 3 | Long DWH query + cancel | #8182 (6), #8181 | ⚠️ Partial (cancel = open Q) |
| 4 | CPU-bound parallelism / multiprocessing | #4788 (28), #8521, #1012 (11) | ⚠️ Partial → ❌ for true parallelism |
| 5 | Periodic refresh / poll external source | #2180 (16), #2975, #2838 | ⚠️ Partial |
| 6 | External event-driven push (ws/redis/kafka) | #2927, #2180 (16), #1012 | ❌ Not Solved |
| 7 | Long-lived persistent connection | #744, #1012 | ⚠️ Partial (awkward fit) |
| 8 | Incremental streaming surviving interaction | #12076, #10578, #9021 (6) | ❌ Not Solved (→ #14524) |
| 9 | Infinite producer/consumer live updates | #6508, #6818 | ❌ Not Solved |
| 10 | Cross-session broadcast | #2838 (30) | ❌ Not Solved (session-scoped) |
| 11 | Cancellation / interruption of in-flight work | #8182 (6), #2975 (5), #10578 | ⚠️ Partial / open |
| 12a | Cleanup of API-managed tasks | (proposal property) | ✅ Solved |
| 12b | Cleanup of user-spawned threads/processes | #1012 (11), #5826, #573 | ❌ Not Solved |
| 13 | Progress reporting | #6687 (16) | ⚠️ Partial / open |

**Counts:** ✅ Solved ≈ 3 (UC1, UC2, UC12a) · ⚠️ Partial ≈ 6 (UC3, UC4, UC5, UC7, UC11, UC13)
· ❌ Not Solved ≈ 5 (UC6, UC8, UC9, UC10, UC12b).

---

## What remains unmet (and recommendations)

`st.background_task` is well-targeted at the **"discrete long job → result"** shape and, with
parallel fragments, covers most of the *one-run-or-one-job* spectrum. The unmet demand falls
into four coherent buckets, each better served by a dedicated mechanism than by stretching
`background_task`:

1. **Streaming / continuous output (UC8, UC9).** Highest-growth (LLM/agent chat).
   The author already split this out as **`st.background_stream` (#14524)** — keep it
   separate; the binary running/done model can't represent token streams or live feeds.

2. **External event-driven push & cross-session broadcast (UC6, UC10, parts of UC5/UC7).**
   Needs a **public rerun/push API** — `st.request_rerun(session_id)` / event-callback and a
   runtime-level broadcast — matching Theme 5 of the prior analysis (#2838, #2180, #2927).
   This is the natural partner to `background_task`: tasks produce data; a push API delivers
   externally-originated updates.

3. **True CPU parallelism (UC4).** Either a **process backend** for `background_task` with
   managed child lifecycle (addressing #4788/#1012 pickling + orphan cleanup), or shipping on
   **free-threaded Python** so threaded tasks parallelize CPU work. Decide explicitly which.

4. **Cancellation, progress, and unmanaged-work cleanup (UC3, UC11, UC12b, UC13).** Resolve
   the proposal's open questions: (a) cooperative cancellation on input change, paired with
   **`st.yield_point()` (#14523)**; (b) a **progress channel** beyond running/done (#6687);
   (c) be clear that orphaned *user-spawned* threads/processes (#1012, #573, #5826) remain
   out of scope unless routed through the API.

**Bottom line:** of the long-running-task backlog, `st.background_task` as sketched would
fully resolve the headline "slow job, render when ready" demand (~3 use cases incl. the
literal #6687 ask), partially address ~6 (where a second dimension — cancellation, progress,
CPU parallelism, or persistence — is missing or undecided), and leave ~5 unmet because they
are streaming, event-driven, or cross-session by nature. Those five are not gaps *in* the
proposal so much as adjacent features (`st.background_stream`, a push/trigger API, a process
backend) that should be planned alongside it.

---

_Sources: the `st.background_task` proposal
([#6687 comment](https://github.com/streamlit/streamlit/issues/6687#issuecomment-4129427835)),
the long-running-task issues listed above (read in full incl. comments), and the prior
`threading-issues-gap-analysis.md`._
