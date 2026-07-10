# Direct `threading` / `multiprocessing` support in Streamlit — technical research

**Scope:** what it would take to *fully and safely* support users (and libraries they use)
creating their **own** `threading.Thread`, `concurrent.futures.ThreadPoolExecutor` /
`ProcessPoolExecutor`, or `multiprocessing` workers and having `st.*`, session state,
caching and reruns work correctly from those threads/processes.

This is **not** the parallel-fragments feature (`@st.fragment(parallel=True)`), which is
already largely landed on `develop`. Parallel fragments cover the *framework-managed*
concurrency case; this report is about the *user-managed* case that parallel fragments
deliberately leave as "undefined behavior". It builds on the parallel-fragments specs and
reads the actual current code rather than restating the broad issue landscape.

Adjacent-but-out-of-scope (mentioned only where they overlap): native `async`/`asyncio`
(spec #15807), background tasks that outlive a run (`st.background_task()`, #10578), cache
background refresh (#14690/#15734), and external/server-push rerun triggers.

---

## Executive summary

- **The core problem is real and highly-demanded but structurally hard.** #8490 ("Add
  support for multi-threading/multi-processing", **109 👍, open**) is one of the strongest
  single feature signals in the tracker. Users don't just want faster dashboards (that's
  parallel fragments) — they spawn threads directly for long-running compute, slow DB
  calls, webhook callbacks, and, very commonly, because a **library** they use (LangChain /
  LangGraph, agent frameworks) spawns threads under the hood and then trips the "missing
  ScriptRunContext" warning.

- **Parallel fragments already built ~70% of the plumbing** that direct threading needs:
  thread-safe shared sets (`ThreadSafeSet`/`SharedRunState`), per-operation session-state
  locking (`SafeSessionState`), thread-safe delta delivery (`call_soon_threadsafe`),
  per-thread state via a `ContextVar` (`FragmentThreadState`/`ThreadState`), a
  context-propagating executor (`ParallelFragmentCoordinator`), and a join barrier. Direct
  threading is largely the problem of **exposing and generalizing** this machinery for
  *arbitrary* user threads, instead of only for framework-dispatched fragment workers.

- **The biggest remaining gaps are the write path and the run lifecycle**, not context
  propagation. Even with today's `add_script_run_ctx`, a user thread that calls `st.*`
  shares the run's `RunningCursor` objects (stored on `ctx.cursors`) with the main thread
  and races on cursor `_index` — parallel fragments dodge this by deep-copying the DG stack
  and pre-allocating a container, but that only happens on the coordinator dispatch path.
  And there is **no join barrier for user threads**: the barrier only waits for
  coordinator-submitted work, so a thread that finishes after `exec()` returns writes into
  an already-finished run (the stale-output bug, #9904).

- **A sanctioned public context-propagation API is the tractable, high-value first step.**
  `add_script_run_ctx` already exists and works (it's how every community
  `with_streamlit_context` / `run_in_thread` decorator is built), but it lives in
  `streamlit.runtime.scriptrunner` (internal namespace), is undocumented as public, and
  doesn't propagate cursor/fragment state on self-attach. A thin public wrapper (context
  manager / executor initializer) plus honest guardrails would resolve the single most
  common complaint (the LangChain warning) with modest risk.

- **Correct concurrent rendering from user threads is the hard, architectural part**, and
  some of it may never be fully safe. Deterministic output from N racing user threads
  writing to shared containers, force-cancellation of hung threads, and general
  multiprocessing (`ProcessPoolExecutor`) rendering all run into fundamentals (Python has no
  safe thread kill; `ScriptRunContext` is unpicklable; child processes have no websocket).
  These should be scoped as "compute-only, results-not-UI" rather than promised as
  transparent `st.*`-from-anywhere.

- **Recommendation:** fund an incremental, three-phase path — (1) public context
  propagation + guardrails + `st.yield_point` (#14523), (2) safe *rendering* from user
  threads by generalizing the parallel-fragments container/cursor isolation and adding a
  user-thread join barrier, (3) explicit multiprocessing/background *compute* guidance
  (results into session state, not `st.*` in the child). Treat transparent
  `st.*`-from-any-process and force-kill as non-goals.

---

## Current state: what works and what silently fails today

### The one supported-ish primitive: `add_script_run_ctx`

Context is attached to a thread as a plain attribute on the `Thread` object
(`SCRIPT_RUN_CONTEXT_ATTR_NAME`), and read back via `get_script_run_ctx()`:

```47:57:lib/streamlit/cursor.py
    ctx = get_script_run_ctx()

    if ctx is None:
        return None

    if root_container in ctx.cursors:
        return ctx.cursors[root_container]

    cursor = RunningCursor(root_container=root_container)
    ctx.cursors[root_container] = cursor
    return cursor
```

`add_script_run_ctx(thread, ctx)` (in
`lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`, re-exported from
`streamlit.runtime.scriptrunner`) is the mechanism every community workaround is built on
(`run_in_thread`, `with_streamlit_context`, `get_streamlit_cb`). As of the parallel-fragments
work it does more than attach the ctx: because `ContextVar`s do not cross thread boundaries,
it also snapshots the parent's `FragmentThreadState` and wraps `thread.run` to re-initialize
it when the child starts:

```379:403:lib/streamlit/runtime/scriptrunner_utils/script_run_context.py
    if parent_ts is not None:
        # Store the parent snapshot on the thread; the run() wrapper below
        # reads it at start time. Repeat add_script_run_ctx() calls refresh
        # the snapshot — last attach wins, matching the ctx attachment above.
        setattr(
            thread,
            _FRAGMENT_THREAD_STATE_FIELDS_ATTR,
            dataclasses.asdict(parent_ts),
        )
```

**Crucially, its own docstring documents that it is lossy on self-attach**: `fragment_id`
and `delta_path` are *not* propagated, and `active_script_hash` is forced to the main script
hash. So writes from the attached thread are not stamped with the parent's fragment, and MPA
v1 page bodies see the wrong hash.

### What genuinely works today

1. **Cross-session background threads that never call `st.*`.** The canonical pattern
   (maintainer-endorsed in #12668) — a `@st.cache_resource` singleton that starts a
   `daemon=True` thread doing pure compute / polling — works and is stable. The thread must
   not render, and must communicate via session state / external stores.
2. **Per-operation session-state access from an attached thread.** `SafeSessionState`
   wraps every read/write with an `RLock`, so individual `st.session_state[...]` operations
   from a worker are not torn (`lib/streamlit/runtime/state/safe_session_state.py`).
3. **Thread-safe delta delivery.** Any thread's `ctx.enqueue()` ultimately hops onto the
   server event loop via `call_soon_threadsafe`, so the browser queue is only ever touched
   by one thread. This is why "it sometimes works" for simple cases.
4. **Thread-safe run bookkeeping.** Widget-id / user-key / form-id / fragment-id sets are
   now `ThreadSafeSet` inside `SharedRunState`; telemetry is lock-guarded. These were
   hardened for parallel fragments and equally protect user threads.

### What silently fails, and *why* (grounded in the code)

| Failure | Root cause |
|---|---|
| **"missing ScriptRunContext!" warning; `st.*` becomes a no-op; output dropped** | A raw `threading.Thread` / pool thread / library thread has no ctx attribute. `get_script_run_ctx()` returns `None` and warns; `enqueue_message()` raises `NoSessionContext`. This is the LangChain/LangGraph case in #8490 and #12051. |
| **Cursor races → interleaved / overwritten / lost elements even *with* `add_script_run_ctx`** | `RunningCursor` objects live in `ctx.cursors`, which is a single dict shared across all threads on the ctx. `get_container_cursor()` hands both the main thread and the user thread the *same* cursor, and `RunningCursor.lock_element()` / `open_block()` mutate `self._index` with **no locking and no owner check**. Parallel fragments avoid this by (a) pre-allocating a container on the main thread and (b) **deep-copying the DG stack per worker** (`_prepare_dg_stack_for_worker` → `deepcopy`), but that only runs inside `_dispatch_parallel_fragment`. A user thread gets neither. (Note: the tech spec's `_check_owner`/`_owner_ident` design was *not* the approach that landed — isolation is via per-worker deep-copy, so there isn't even a `RuntimeError` safety net for user threads.) |
| **Output lost / stale output bleeds into the next run when the script finishes first** | The join barrier only waits for **coordinator** work: `ctx.parallel_coordinator.join()` after `exec()`. Arbitrary user threads are not tracked, so `scriptFinished` (→ frontend `clearStaleNodes`) fires while they're still running; late deltas land on a finished run. This is exactly #9904 (Thiago's stale-output bug). |
| **No cooperative cancellation of user threads** | `_maybe_handle_execution_control_request()` only cancels a worker if `ctx.parallel_coordinator.should_stop()` is set, and only coordinator workers are wired to that. A user thread is neither stopped on rerun nor joined; combined with non-daemon script threads this is the family of "can't interrupt / can't exit" bugs (#2975, #14523, #10578). |
| **Guardrails don't apply** | `is_parallel_worker` is only set on coordinator workers, so the `st.dialog` / `st.switch_page` / external-container-write guards silently don't fire for user threads — but user threads also don't get the protections those guards compensate for. |
| **Caching that renders misbehaves off-thread** | Cross-session cache *values* are fine (`compute_value_lock` is a plain `Lock`). But `@st.cache_data`/`@st.cache_resource` also draw a spinner and **replay recorded element messages** on a hit; both need a ctx + cursor and hit the same no-ctx/cursor-race issues. The widget-in-cache guard uses the `in_cached_function` `ContextVar`, which a raw thread won't have set. And session-scoped cache access from off-thread deliberately raises: "A session-scoped cache was accessed outside of the app execution thread." (`lib/streamlit/runtime/caching/cache_utils.py`). |

### Multiprocessing today

- **No context can cross a process boundary.** `ScriptRunContext` transitively holds
  unpicklable objects (`SafeSessionState`'s `RLock`, the enqueue callback bound to the
  event loop, `ParallelFragmentCoordinator` with a live `ThreadPoolExecutor`). There is no
  equivalent of `add_script_run_ctx` for processes and cannot be one without a serialization
  boundary.
- **Child processes re-import the script.** With the `spawn` start method (default on
  macOS/Windows and for `ProcessPoolExecutor`), the child re-imports the app module. #10163
  ("Make MPAv2 work with pure Python and with ProcessPoolExecutor", merged) fixed
  `st.navigation` / `st.page_link` crashing on import in pure-Python mode, so importing an
  MPA script inside a child no longer throws — but `st.*` calls in the child still cannot
  render (no ctx, no websocket).
- **Pickling page-defined functions.** Submitting a closure/lambda or a function defined in
  the running page module to `ProcessPoolExecutor` frequently fails to pickle under `spawn`.
- **No child-process lifecycle tie-in.** Children are not tracked against the session, so
  they can orphan if the session ends.

---

## Demand: issues & PRs

> The `area:threading/processing` label exists and is applied (e.g. #8490, #14523), but
> label-filtered listing was not queryable in this environment; the items below were read
> directly. Reaction/comment counts are as observed.

### Issues (direct-threading use case)

- **#8490 — "Add support for multi-threading/multi-processing in Streamlit"** — *open,
  109 👍, 10 comments.* The headline demand. Maintainer (jcarroll) response enumerates the
  three canonical use cases: **(a) long-running compute in the same process** (e.g. RAG
  indexing while the UI stays interactive), **(b) waiting on a slow DB/remote call**, **(c)
  waiting on a webhook/async callback** to push an update into a live session. Stated
  requirements: get data from the thread back into `session_state`, trigger a rerun from a
  thread (not just user interaction), optionally interrupt a thread on a user action. Multiple
  commenters hit it via **LangChain/LangGraph spawning threads internally** →
  `ScriptRunContext` error with `StreamlitCallbackHandler`. Converged community workaround:
  a `run_in_thread` decorator wrapping `threading.Thread` + `add_script_run_ctx`, often
  paired with `@st.fragment(run_every=…)` polling and session-state hand-off. Explicit ask:
  "package the `run_in_thread` decorator up."

- **#9904 — "Stale output from a long-running computation … shows as not stale when app
  rerun"** — *open, bug, confirmed.* Filed on Thiago's behalf. Directly documents the
  output-lifecycle gap: when a long op is stopped and rerun, old thread output lingers
  (shown as fresh) until the old thread finishes. Ships a Playwright repro. This is the
  concrete manifestation of "no user-thread join barrier + `clearStaleNodes` timing".

- **#14523 — "`st.yield_point` — cooperative cancellation checkpoint for long-running
  code"** — *open, `area:threading/processing`.* The complementary primitive: an explicit
  yield point so code that doesn't call `st.*` in a loop can still be interrupted. Referenced
  throughout the parallel-fragments tech spec as the answer to "a thread blocked in external
  code won't see cancellation." Needed for *any* cooperative-cancellation story, threads
  included.

- **#2975 — "Server shutdown fails to exit while processing infinite loop"** — *open, bug,
  confirmed, 5 👍, 15 comments (since 2021).* Root cause: the script thread is non-daemon and
  the cooperative interrupt only fires at `st.*` calls, so a tight loop blocks process exit.
  The same "Python can't safely interrupt a running thread" reality that bounds any
  force-cancel feature.

- **#10578 — "Input events immediately terminate everything?"** — *open, enhancement.*
  Adjacent (background-task lifetime): users want work to *survive* an interaction rather than
  be cancelled by the rerun. Overlaps direct threading in motivation, but is really the
  `st.background_task()` concept — noted, not in scope.

- **#10045 / #12799 — fragment-to-fragment communication / selective rerun & execution
  control** — *open, 12 👍 and 13 👍.* Adjacent: cross-unit triggering. Relevant only because a
  general "trigger a rerun from another execution unit" primitive would also serve a thread
  pushing an update.

### PRs (prior fix attempts and outcomes)

- **#12668 — "Make threading better: auto-add context, join() before script done"**
  (tvst) — *open, draft.* The most on-point prior attempt at *direct* threading. Two ideas:
  (1) a `StreamlitThread` subclass that auto-attaches the ctx, and (2) a `ScriptThread` that
  tracks all `StreamlitThread`s created during a run and `join()`s them before the script
  finishes — i.e. exactly the missing user-thread join barrier. The author flagged the open
  question of whether auto-join would break existing apps that rely on today's fire-and-forget
  behavior. In comments, kmcgrady confirmed this was on his list and told lwilby it's
  welcome to fold into the Parallel Fragments work — so the machinery that shipped for
  parallel fragments is the intended home, but the *user-thread* half was never finished.
  **Outcome: stalled/superseded, not rejected on merit.**

- **#12052 — "Add add_script_run_ctx to ensure Streamlit context for all callback
  methods"** (community) — *closed (stale, not rejected).* Fixed the LangChain
  `StreamlitCallbackHandler` `NoSessionContext` case (#12051, langgraph#101) by capturing the
  ctx in `__init__` and re-attaching in each callback. Maintainer asked for tests; PR went
  stale and auto-closed. **Signal: the LangChain thread-context pain is fixable with a
  small, well-scoped change; it lapsed for lack of test coverage / ownership, not because
  the approach was wrong.**

- **#10163 — "Make MPAv2 work with pure Python and with ProcessPoolExecutor"** —
  *merged.* Made `st.navigation` / `st.page_link` importable in pure-Python mode so a child
  process spawned by `ProcessPoolExecutor` doesn't crash on import. The one concrete
  multiprocessing fix that landed; it removes an import-time crash but does not make `st.*`
  render in the child.

- **#14928 — "mark script thread as daemon to allow process exit on hung scripts
  (#2975)"** — *open, draft.* Makes the script thread `daemon=True` so the process can exit
  when a script is stuck in a no-`st.*` loop. Documents the trade-off (daemon threads are
  killed abruptly at process exit) and references a 2021 sketch using
  `PyThreadState_SetAsyncExc` for graceful interrupt. Illustrates that even "let the process
  exit" is contentious; force-terminating threads is worse.

- **#13139 / #14443 — parallel-fragments prototypes** (Lukas; and a later prototype) —
  the DG isolation via `contextvars.copy_context()`, thread-safe queue, and progressive
  rendering barrier that became the shipped feature. Directly reusable infrastructure for
  direct threading.

- **Adjacent specs/PRs** (context, not in scope): #15807 persistent asyncio loop on the
  script thread; #14690 / #15734 cache background refresh; #14874 multi-runtime; the
  outside-container-writes spec (`specs/2026-06-03-outside-container-writes`).

**Demand read:** one very high-signal issue (#8490) plus a cluster of confirmed bugs
(#9904, #2975) and two stalled PRs (#12668, #12052) that each solved *part* of the problem
and lapsed for lack of ownership/tests rather than technical rejection. The LangChain
sub-case alone is a recurring, concrete, fixable pain point.

---

## Gap analysis by subsystem

### 1. Context propagation to arbitrary user/library threads

- **Today:** `add_script_run_ctx` works but is (a) in the internal `streamlit.runtime.*`
  namespace, (b) undocumented as public, (c) lossy on self-attach (`fragment_id`,
  `delta_path` dropped; `active_script_hash` forced to main), and (d) requires the parent to
  attach *before* `thread.start()` for the `thread.run` wrapper to fire. Library threads the
  user never constructs (LangChain's internal pool) can't be attached at all without wrapping
  the callback.
- **Gap:** no sanctioned public equivalent of the community `with_streamlit_context`, and no
  way to auto-propagate to an executor's worker threads (`ThreadPoolExecutor(initializer=…)`)
  or to a callback object.

### 2. Correct rendering from threads that finish after the script run

- **Today:** the join barrier waits only for coordinator work; user threads aren't tracked.
  `scriptFinished` → `clearStaleNodes` can fire mid-thread. Deltas carry absolute
  `delta_path`, so *ordering* is fine, but *lifecycle* is not: late writes attach to a
  finished (or subsequent) run. This is #9904.
- **Gap:** no user-thread registry + join barrier (the missing half of #12668), and no run
  "generation" fencing so a straggler thread's deltas from run N are dropped rather than
  shown during run N+1.

### 3. Thread-safety of the write path & session state for concurrent user threads

- **Today:** session state (per-op), shared sets, and delta delivery are thread-safe.
  **The cursor/DG write path is not, for user threads.** `ctx.cursors` holds shared
  `RunningCursor`s; `lock_element`/`open_block` mutate `_index` unlocked; the deep-copy +
  container-preallocation that makes this safe exists only on the coordinator dispatch path.
- **Gap:** a user thread has no isolated container/cursor space. Two user threads (or a user
  thread + main thread) writing `st.*` race on cursor index → nondeterministic/overwritten
  elements. Multi-op session-state sequences (`+=`) remain the user's responsibility (same as
  parallel fragments; documented, not a bug).

### 4. Multiprocessing-specific problems

- **Context can't cross processes** (`ScriptRunContext` is unpicklable) — no propagation
  mechanism exists or can exist without a serialization/IPC boundary.
- **Script re-import / `__main__` guard:** children re-import the app under `spawn`; #10163
  removed the MPA import crash but rendering still can't work in the child.
- **Pickling page-defined functions:** closures/lambdas/page-module functions frequently
  fail to pickle for `ProcessPoolExecutor`.
- **Child lifecycle:** no tie to session lifecycle → orphaned children; no cleanup hook.

### 5. Cache correctness from threads/processes

- **Values:** cross-session cache compute is lock-guarded and fine off-thread.
- **Rendering side effects:** spinner + cached-message replay need ctx + cursor → same
  no-ctx / cursor-race problems as §1/§3; `in_cached_function` `ContextVar` unset on raw
  threads weakens the widget-in-cache guard; session-scoped access off-thread deliberately
  raises. Across processes, on-disk (`cache_data`) caches can be shared but in-memory /
  `cache_resource` singletons cannot.

---

## Options & approaches (per gap)

### Gap 1 — Public context propagation

- **1a. Public context manager + decorator** (e.g. `with st.thread_context():` /
  `@st.thread_context`). Thin, documented wrapper over `add_script_run_ctx` that also
  propagates `fragment_id` / `delta_path` (fixing the self-attach loss). *Complexity: low.
  Risk: low.* Composes cleanly with parallel fragments (same `ThreadState` machinery).
  Directly resolves the #8490 LangChain complaint and supersedes the stalled #12052.
- **1b. Executor helper / initializer.** A documented `ThreadPoolExecutor` `initializer`
  (or a `st`-provided executor wrapper) that attaches the captured ctx to each worker.
  *Complexity: low–medium. Risk: low.* Good ergonomics for the pool case.
- **1c. Auto-attach via a `StreamlitThread` subclass** (the #12668 approach). Zero-config
  but only helps threads the user constructs (not library-internal pools) and changes
  default semantics. *Complexity: medium. Risk: medium* (surprising auto-join, see 2a).

> All three are guardrail-only for *context*; none makes concurrent *rendering* safe on
> their own. They must ship with explicit "safe to read state / compute; not safe to render
> concurrently" documentation to avoid over-promising.

### Gap 2 — Rendering / lifecycle for threads that outlive the run

- **2a. User-thread registry + join barrier** (finish #12668's second half). Track
  ctx-attached user threads and join them before `scriptFinished`, extending the existing
  coordinator barrier. *Complexity: medium. Risk: medium* — the #12668 author's own concern
  is that auto-join changes today's fire-and-forget behavior and could hang runs on a
  never-terminating thread. Likely needs opt-in + a timeout, and interacts with the
  daemon-thread question (#14928).
- **2b. Run-generation fencing.** Stamp deltas/threads with a run id and drop late deltas
  from a superseded run instead of rendering them. Fixes the *bleed* half of #9904 even
  without a full join. *Complexity: medium.* Best paired with 2a.
- **2c. Route user-thread rendering through a fragment-like reserved container.** Reuse the
  parallel-fragments primitive: give an attached thread its own pre-allocated container +
  deep-copied cursor space so its writes can't race the main trunk. *Complexity: medium–high*
  (needs a public seam to "open a container for this thread"). This is what makes §3 safe.

### Gap 3 — Concurrent write-path safety

- **3a. Reuse parallel-fragments isolation for user threads** — same deep-copy +
  pre-allocated container + `is_parallel_worker`-style external-write guard, exposed via 2c.
  *Complexity: medium–high. Risk: medium.* Highest-fidelity path; makes "render from a user
  thread" behave like a parallel fragment.
- **3b. Per-cursor locking / owner check.** Add the tech spec's original `_check_owner`
  (never landed) or a lock on `RunningCursor`. *Complexity: low–medium* but only converts
  silent corruption into a `RuntimeError` — it makes misuse *loud*, not *correct*, and
  ordering stays nondeterministic. Reasonable as a safety net beneath 3a.
- **3c. Document determinism limits.** Concurrent writes to a *shared* container are
  inherently nondeterministic; keep them prohibited (as parallel fragments already do for
  external containers) rather than trying to make them "work."

### Gap 4 — Multiprocessing

- **4a. Positioning + guardrails, not transparent `st.*`.** Officially support processes
  for **compute only**: run in the child, return picklable results, render on the main
  thread. Detect `st.*` calls with no ctx in a child and raise a clear, actionable error
  instead of the generic warning. *Complexity: low–medium. Risk: low.* Matches the reality
  that ctx can't cross processes.
- **4b. Picklability + `__main__`-guard guidance/lints.** Docs + optional runtime checks
  for un-picklable submissions and the re-import pitfall; build on #10163. *Complexity: low.*
- **4c. Session-scoped process lifecycle.** Track child processes against the session and
  terminate on session end. *Complexity: medium.* Avoids orphans; still no rendering in the
  child.

### Gap 5 — Cache from threads

- **5a. Make cache *value* computation officially thread-safe off-thread**, but require the
  rendering side effects (spinner, replay) to happen on the script thread — i.e. compute in
  the worker, replay on rerun. *Complexity: medium.*
- **5b. `show_spinner=False` fast-path when off-thread / no ctx**, with a clear error if a
  session-scoped cache is read off-thread (already the behavior; make it discoverable).
  *Complexity: low.*

### Cross-cutting — cancellation

- **`st.yield_point()` (#14523)** is the shared primitive for cooperative cancellation of
  *any* long-running code (threads included). *Complexity: low–medium.* Force-kill via
  `PyThreadState_SetAsyncExc` (the #14928/2021 sketch) is fundamentally unsafe (can corrupt
  locks / leak resources) and should stay a non-goal; daemon-thread process exit (#14928) is
  the pragmatic ceiling.

---

## Feasibility & recommendation

### What's realistically incremental on top of parallel fragments

- **Public context propagation (Gap 1a/1b).** The machinery exists and is exercised daily
  via `add_script_run_ctx`; the work is API surface, self-attach fidelity, tests, and docs.
  **Highest value-to-risk.** Resolves the most common complaint (#8490's LangChain case) and
  revives the intent of #12052.
- **`st.yield_point()` (#14523).** Small, self-contained, and a prerequisite for any honest
  cancellation story.
- **Run-generation fencing (Gap 2b).** Kills the stale-output *bleed* (#9904) without the
  risk of auto-join.

### What's harder / architectural

- **User-thread join barrier (Gap 2a / #12668).** Conceptually straightforward (extend the
  coordinator barrier) but semantically loaded: opt-in vs. default, timeouts, hang risk on
  non-terminating threads, and the daemon-thread interaction (#14928). Needs a small design.
- **Safe *rendering* from user threads (Gap 2c/3a).** Requires exposing the
  parallel-fragments container/cursor isolation as a general seam. This is the crux of making
  "`st.*` from my own thread" actually correct rather than merely non-crashing.

### What may never be fully safe (honest limits)

- **Force-cancelling a running thread.** Python has no safe thread kill; cooperative
  yielding (#14523) or daemon-thread process exit (#14928, #2975) is the ceiling.
- **Transparent `st.*` in a child process.** `ScriptRunContext` is unpicklable and the
  child has no websocket; multiprocessing should be **compute-only**, results marshalled
  back (Gap 4a). #10163 is the extent of "make imports not crash," not "make rendering work."
- **Deterministic concurrent writes to a shared container.** Inherently nondeterministic;
  keep prohibited (Gap 3c), as parallel fragments already do.

### Suggested phased order

1. **Phase 1 — Sanction what already works, safely.** Public `st.thread_context()` /
   decorator + executor initializer (1a/1b) with self-attach fidelity; `st.yield_point()`
   (#14523); run-generation fencing for #9904 (2b); clear off-thread errors for cache
   (5b) and multiprocessing `st.*` (4a). Scope: "propagate context; read state & compute
   from threads; don't concurrently render." Mostly additive, low risk, resolves the loudest
   pain.
2. **Phase 2 — Safe rendering from user threads.** Generalize the parallel-fragments
   container/cursor isolation (2c/3a) + optional user-thread join barrier with timeout
   (2a/#12668) + a `RunningCursor` owner check as a safety net (3b). This is where "direct
   threading with `st.*`" becomes genuinely correct.
3. **Phase 3 — Multiprocessing & long-lived compute as a distinct model.** Picklability /
   `__main__` guidance and lints (4b), session-scoped child cleanup (4c), thread-safe cache
   value computation (5a) — and hand off cross-rerun/background lifetimes to
   `st.background_task()` (#10578) rather than overloading direct threading.

**Bottom line:** "full direct threading support" is not one feature. Context propagation and
cancellation checkpoints are tractable near-term wins that parallel fragments already make
cheap; safe concurrent rendering is a real but bounded architectural investment reusing
existing isolation; and transparent multiprocessing rendering / force-kill should be
explicitly declared non-goals rather than promised.

---

## Sources

**Specs (source of truth for parallel fragments):**
- `specs/2026-03-05-parallel-fragments/product-spec.md`
- `specs/2026-03-05-parallel-fragments/tech-spec.md`
- `specs/2026-06-03-outside-container-writes/` (adjacent — external container writes)

**Code (current implementation read directly):**
- `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py` (`ScriptRunContext`,
  `ThreadState`/`FragmentThreadState`, `add_script_run_ctx`, `get_script_run_ctx`,
  `enqueue_message`)
- `lib/streamlit/runtime/parallel_coordinator.py` (`ParallelFragmentCoordinator`,
  `_scoped_ctx_attach`)
- `lib/streamlit/runtime/scriptrunner_utils/shared_run_state.py` (`SharedRunState`) and
  `.../thread_safe_set.py`
- `lib/streamlit/runtime/fragment.py` (`_dispatch_parallel_fragment`,
  `_run_parallel_fragment`, `_prepare_dg_stack_for_worker`, `_check_not_parallel_worker`)
- `lib/streamlit/cursor.py` (`RunningCursor`, `get_container_cursor`, `ctx.cursors`)
- `lib/streamlit/delta_generator.py` (`_enqueue` parallel-worker external-write guard)
- `lib/streamlit/runtime/state/safe_session_state.py` (`SafeSessionState` RLock)
- `lib/streamlit/runtime/scriptrunner/script_runner.py`
  (`_maybe_handle_execution_control_request`, `_is_in_script_thread`, join/drain barrier)
- `lib/streamlit/runtime/caching/cache_utils.py`,
  `.../caching/cached_message_replay.py` (off-thread cache/replay behavior)

**Issues:**
- #8490 (multi-threading/multi-processing; 109 👍) · #9904 (stale output) ·
  #14523 (`st.yield_point`) · #2975 (shutdown/hung loop) · #10578 (background/interrupt) ·
  #10045, #12799 (fragment↔fragment communication, adjacent)

**PRs:**
- #12668 (StreamlitThread auto-context + join) · #12052 (LangChain callback ctx, closed
  stale) · #10163 (MPAv2 + ProcessPoolExecutor, merged) · #14928 (daemon script thread) ·
  #13139 / #14443 (parallel-fragments prototypes)

**Adjacent specs/PRs (context only):** #15807 (persistent asyncio loop) · #14690 / #15734
(cache background refresh) · #14874 (multi-runtime).
