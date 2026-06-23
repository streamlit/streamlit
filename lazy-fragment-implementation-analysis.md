# `st.fragment(lazy=True)` — Implementation Feasibility Analysis

**Issue:** [#14788](https://github.com/streamlit/streamlit/issues/14788) — *"`st.fragment(lazy=True)` — defer fragment execution until visible (viewport-triggered loading)"*
**Status:** Research / feasibility only. **No feature code is written and no PR is opened by this analysis.**
**Audience:** concurrency-roadmap (execution-model) exploration.

---

## 1. Executive summary

- **Verdict: feasible, but it is *not* a "one-keyword API addition."** The decorator surface is trivial, but a correct implementation touches five layers: the decorator/registration path, the proto schema, the script-run lifecycle, the frontend render tree + a brand-new viewport-detection subsystem, and the parallel-fragment scheduler. The closest existing precedent — `run_every`'s client-scheduled fragment rerun — gets us ~70% of the *transport* for free but **0%** of the *deferred-placeholder* and *viewport-detection* machinery.
- **The single biggest unknown is widget/`session_state` semantics for code that hasn't run yet.** A deferred fragment's widgets and its `st.session_state` writes do not exist until the fragment is scrolled into view. Any code elsewhere in the app that reads those keys (or any reaping of "stale" widgets in `SessionState.on_script_finished`) will behave differently from an eager fragment. This is a semantics decision, not just an engineering task, and it has no clean current answer.
- **Composition with `parallel=True` is the second hardest problem and is currently *blocked by an explicit guard*.** In `fragment.py:_fragment` the parallel dispatch is gated on `if parallel and not ctx.fragment_ids_this_run` — i.e. **parallel dispatch is deliberately skipped during fragment-scoped reruns**. A lazy reveal *is* a fragment-scoped rerun, so today a `lazy=True, parallel=True` fragment revealed below the fold would run **sequentially**, contradicting the issue's stated goal. Making revealed lazy fragments run in parallel requires extending the coordinator/scheduler to dispatch inside a fragment-queue run.
- **There is no existing viewport/visibility infrastructure in the frontend to build on.** A repo-wide search finds `IntersectionObserver` referenced only in a custom ESLint rule (`frontend/eslint-plugin-streamlit-custom/src/no-force-reflow-access.ts`), never in app/lib runtime code. The "I'm now visible → tell the server" half is greenfield.
- **The trigger round-trip can be reused almost verbatim.** Viewport reveal can send the *exact same* `BackMsg.rerun_script` (`ClientState.fragment_id`) that `run_every` and widget-driven fragment reruns already send (`WidgetStateManager.sendUpdateWidgetsMessage` → `App.sendRerunBackMsg` → `AppSession.request_rerun` → `fragment_id_queue` → `ScriptRunner._run_script`). **No new `BackMsg` type is required.** The request-coalescing logic in `script_requests.py` already appends new fragment ids into a `fragment_id_queue`, which is precisely the "add a fragment to the run set later" primitive we need.
- **Testing is a real cost, not a footnote.** Viewport-dependent execution is non-deterministic by nature and invisible to `AppTest` (no DOM/viewport). Without an eager fallback, lazy fragments simply never run under `AppTest`, static export (`ForwardMsgList`), or any headless consumer.

---

## 2. Proposed API & motivation (from #14788)

The issue (authored by `sfc-gh-lwilby`, state: OPEN) proposes adding a `lazy` keyword to `@st.fragment`. The only non-author comment is the automated prioritization bot; there is **no maintainer design discussion in the thread yet**, so all constraints below are inferred from the issue body + the current source.

**Proposed signature (quoted):**

```python
@overload
def fragment(
    func: F,
    *,
    run_every: int | float | timedelta | str | None = None,
    parallel: bool = False,
    lazy: bool = False,
) -> F: ...
```

**Proposed usage (quoted):**

```python
@st.fragment(lazy=True)
def expensive_chart():
    data = fetch_from_database()  # only runs when scrolled into view
    st.line_chart(data)

# Top of page — runs immediately
summary_metrics()

# Below the fold — deferred until user scrolls down
expensive_chart()
another_expensive_section()
```

**Composition with parallel (quoted):**

```python
@st.fragment(lazy=True, parallel=True)
def dashboard_card(query):
    data = run_query(query)
    st.metric(data["label"], data["value"])

# Visible row runs in parallel immediately
for q in visible_queries:
    dashboard_card(q)

# Below-the-fold row defers until scrolled into view,
# then runs its cards in parallel too
for q in more_queries:
    dashboard_card(q)
```

**Motivation (quoted/condensed):**
- *"Long dashboard pages with many SQL-backed sections — only the visible ones run queries on initial load, reducing total query cost and page load time."*
- *"Infinite-scroll-style apps with many sections where most content is below the fold."*
- Inspired by Sigma Computing dashboards that *"lazy-load visualizations — tiles below the fold don't execute their queries until the user scrolls them into view."*

**Stated relationship to parallel fragments (quoted):**
> Lazy fragments are **orthogonal** to `parallel=True` (#8490):
> - **`lazy`** controls *when* a fragment enters the execution pipeline (immediately vs. on viewport visibility).
> - **`parallel`** controls *how* scheduled fragments share the machine (sequential vs. concurrent threads).
> Both can be `True` simultaneously.

References cited in the issue: #14277 (parallel fragments product spec), #8490 (parallel fragments feature request).

---

## 3. Current fragment architecture (grounded in source)

### 3.1 Decorator & registration path — `lib/streamlit/runtime/fragment.py`

- **Public decorator:** `fragment()` (`fragment.py:628`, wrapped with `@gather_metrics("fragment")`) delegates to `_fragment()` (`fragment.py:442`). Current params are `func`, `run_every`, `parallel` — **there is no `lazy` param today, and the inner re-dispatch in `_fragment`'s `wrapper` (`fragment.py:458-465`) does not even forward `additional_hash_info`.**
- **Identity:** inside `wrap()` (`fragment.py:469`), `fragment_id = calc_hash(f"{module}.{name}{delta_path_str}{additional_hash_info}")` (`fragment.py:480-482`). Identity is a function of *function identity + its delta-path position*, so a fragment's id is stable across reruns as long as it's called from the same tree position.
- **Snapshots:** `wrap()` deep-copies `ctx.cursors` and the `context_dg_stack` (`fragment.py:478-479`). These snapshots are what later let a fragment-scoped rerun restore the right cursor/container position without re-running the surrounding script.
- **Registration:** `ctx.fragment_storage.register(fragment_id, wrapped_fragment, parent_fragment_id=...)` (`fragment.py:579-583`). Storage is `MemoryFragmentStorage` (`fragment.py:219`), a lock-guarded dict (`register` `:279`, `lookup` `:273`, `clear(new_fragment_ids)` `:264`, `order_fragment_ids` `:324` keeps queued ancestors before descendants).
- **Execution decision (the key branch):** at the end of `wrap()` (`fragment.py:585-594`):
  - `run_every` → enqueue an `AutoRerun` ForwardMsg (see 3.3).
  - `if parallel and not ctx.fragment_ids_this_run:` → `_dispatch_parallel_fragment(...)` then `return None` (`fragment.py:591-593`).
  - **else → `return wrapped_fragment()` runs the body inline, synchronously, right now** (`fragment.py:594`).
- **The body itself:** `wrapped_fragment()` (`fragment.py:488-577`) re-fetches `ctx`, and *if* this is a fragment run (`ctx.fragment_ids_this_run`) restores the cursor/dg snapshots and re-emits outside-container wrappers; it then enters `st.container()` (`fragment.py:542`), sets `delta_path`, and calls `non_optional_func(*args, **kwargs)` (`fragment.py:563`).

> **Critical observation for `lazy`:** on a normal full run, *registration and execution are fused* — `wrap()` registers the fragment and immediately calls `wrapped_fragment()`. A lazy fragment must **break that fusion**: register (so a later reveal can `lookup` it) and emit a placeholder, but **not** call `wrapped_fragment()`. The `parallel` branch already demonstrates the "register-now-run-later" split, and `_dispatch_parallel_fragment` (`fragment.py:811`) already demonstrates "pre-allocate the container on the main thread (`st.container()`), defer the body." Lazy is a third variant of this same split — defer the body to a *future client-triggered rerun* rather than to a worker thread.

### 3.2 Fragment-scoped run path — `lib/streamlit/runtime/scriptrunner/script_runner.py`

- `_run_script(rerun_data)` (`script_runner.py:528`): if `rerun_data.fragment_id_queue` is set, `fragment_ids_this_run = self._fragment_storage.order_fragment_ids(queue)` (`:614-617`) and `ctx.reset(fragment_ids_this_run=...)` (`:619-626`).
- Fragment-run branch (`:715-775`): for each `fragment_id`, `wrapped_fragment = self._fragment_storage.lookup(fragment_id)` then `wrapped_fragment()`. **A `FragmentStorageKeyError` is swallowed and the fragment skipped** (`:724-745`) — relevant because a lazy fragment that was cleared by an intervening full run can't be revealed.
- Full-run branch (`:777-807`): `clear_outside_wrappers()`, `exec(code, ...)`, `coordinator.join()`, then `fragment_storage.clear(new_fragment_ids=ctx.shared.new_fragment_ids.snapshot())` — **this is where any fragment not re-registered this run is evicted.**

### 3.3 `run_every` — the existing "client asks server to rerun fragment X" precedent

This is the closest analog to viewport-triggered execution; the transport is reusable.

1. **Server → client:** `wrap()` enqueues a `ForwardMsg` with `msg.auto_rerun.interval` and `msg.auto_rerun.fragment_id` (`fragment.py:585-589`). Proto: `AutoRerun.proto` (`interval`, `fragment_id`); carried as `ForwardMsg.auto_rerun = 21`.
2. **Client schedules:** `App.handleAutoRerun` (`frontend/app/src/App.tsx:1202`) does `setInterval(() => this.widgetMgr.sendUpdateWidgetsMessage(autoRerun.fragmentId, true), interval*1000)`; the interval id is tracked in `autoReruns` state and torn down by `cleanupAutoReruns()` on the next full rerun (`App.tsx:1379-1381`).
3. **Client → server:** `WidgetStateManager.sendUpdateWidgetsMessage(fragmentId, isAutoRerun)` (`WidgetStateManager.ts:831`) → `App.sendRerunBackMsg(...)` (`App.tsx:1916`) builds `BackMsg.rerunScript` (`ClientState`) with `fragmentId` set (`App.tsx:1993-2006`).
4. **Server dispatch:** `AppSession.request_rerun` (`app_session.py:~418`) reads `client_state.fragment_id`, **early-returns if `fragment_id and not self._fragment_storage.contains(fragment_id)`** (`app_session.py:442-448`), builds `RerunData(fragment_id=...)` (`:453-462`), and calls `self._scriptrunner.request_rerun(rerun_data)`.
5. **Coalescing:** `script_requests.py` `request_rerun` (`:186-245`) converts a single `fragment_id` into a `fragment_id_queue`, and — crucially — **appends a new fragment id to the existing queue if not already present** (`:216-223`). `_fragment_run_should_not_preempt_script` (`:87`, used by `on_scriptrunner_yield` `:250`) ensures a queued fragment run does not preempt a still-running full script.

> **Reusability for `lazy`:** steps 3–5 are *transport-identical* to what a viewport reveal needs. The only differences are (a) the trigger is an `IntersectionObserver` event rather than a `setInterval`, and (b) `is_auto_rerun` should likely be `false` (a reveal is user-driven, not a background timer). The coalescing queue (`:216-223`) is exactly the "add a fragment to the run set later" mechanism the task asks us to confirm exists — **it does, for the sequential case.**

### 3.4 Parallel fragments — `ParallelFragmentCoordinator` & lifecycle

- **Coordinator:** `lib/streamlit/runtime/parallel_coordinator.py`. A `ThreadPoolExecutor`-backed, **single-use-per-run** object: created fresh in `ScriptRunContext.reset()` (`script_run_context.py:270-273`), `submit()` captures `contextvars.copy_context()` + scoped ctx attach (`parallel_coordinator.py:105-157`), `join()` blocks the main thread until workers finish (`:205-230`), `drain()` cancels on error (`:232-241`).
- **Dispatch:** `_dispatch_parallel_fragment` (`fragment.py:811`) pre-allocates the container on the main thread via `st.container()` (so the frontend gets the container delta immediately), snapshots the dg stack, and `coordinator.submit(_run_parallel_fragment, ...)`. Worker entry `_run_parallel_fragment` (`fragment.py:849`) sets `pre_allocated_container_fragment_id` + `is_parallel_worker=True`.
- **Worker safety restrictions:** `_check_not_parallel_worker` (`fragment.py:57`) forbids unsafe commands (`st.dialog`, `st.switch_page`, writing to outside containers) during the concurrent initial load; these only work in sequential fragment reruns.
- **Lifecycle coupling:** in the full-run branch, `coordinator.join()` runs *after* `exec(code, ...)` and *before* `fragment_storage.clear(...)` (`script_runner.py:795-807`). The coordinator is discarded at run end; **a fresh one is built for the next run, including each fragment-scoped rerun.**

> **The composition guard:** `if parallel and not ctx.fragment_ids_this_run` (`fragment.py:591`) means parallel dispatch only happens during *full* runs. During a fragment-scoped rerun (`ctx.fragment_ids_this_run` is truthy), the `parallel` branch is skipped and the fragment runs inline via `return wrapped_fragment()`. A lazy reveal is a fragment-scoped rerun, so **the current code path runs a revealed `lazy+parallel` fragment sequentially.** See §7.

### 3.5 Frontend render tree, placeholders, and the absence of viewport infra

- **Fragments are not a proto block type.** `@st.fragment` simply wraps its body in `st.container()` (`fragment.py:542`); fragment ownership is propagated to the frontend via `Delta.fragment_id = 8` and `NewSession.fragment_ids_this_run` (extended in `app_session.py:799`). On the client, `App.handleNewSession` (`App.tsx:1370`) branches: empty `fragmentIdsThisRun` → full reset (+ `cleanupAutoReruns`); non-empty → partial update that only refreshes `fragmentIdsThisRun`/`latestRunTime` and calls `elements.clearTransientNodes(fragmentIdsThisRun)` (`App.tsx:1408-1430`).
- **A skeleton element already exists.** `Skeleton.proto` (`Skeleton` element, `ELEMENT`/`APP` styles + optional `height`) renders via `frontend/lib/src/components/elements/Skeleton/Skeleton.tsx`. This is a ready-made "not-yet-rendered placeholder" primitive.
- **No viewport/visibility hook exists.** `IntersectionObserver` appears in the codebase **only** in `frontend/eslint-plugin-streamlit-custom/src/no-force-reflow-access.ts` (a lint rule), never in `frontend/app` or `frontend/lib` runtime code. There is no `useInView`/`useViewportSize` hook to reuse. The visibility-detection layer is entirely new code.

---

## 4. Proposed end-to-end mechanism for viewport-triggered execution

### 4.1 Backend: representing a deferred fragment on the initial run

In `_fragment.wrap()`, add a third branch alongside `run_every`/`parallel`. On a **full app run** when `lazy=True` and the fragment is *not* in `ctx.fragment_ids_this_run` (i.e. it isn't itself being revealed right now):

1. **Register** `wrapped_fragment` into `ctx.fragment_storage` exactly as today (`fragment.py:579`). This is mandatory: `AppSession.request_rerun` rejects a reveal whose `fragment_id` is not in storage (`app_session.py:442`).
2. **Pre-allocate the placeholder container** on the main thread — reuse the parallel pattern: enter `st.container()` so the fragment's delta-path slot is reserved in tree order (this is what guarantees no layout shift / sibling reordering when the real content arrives later — see §6.2 / §5.2). Inside it, emit a `Skeleton` element (`Skeleton.proto`) as the visible placeholder.
3. **Mark the container as a deferred/lazy fragment** so the frontend knows to (a) attach an `IntersectionObserver` and (b) which `fragment_id` to send when it becomes visible. This is the one genuinely new piece of protocol (see options in §6 — a field on the wrapping `Block`, vs. a dedicated message).
4. **Do NOT call `wrapped_fragment()`.** Return `None`.

When the fragment is later revealed, the reveal arrives as a fragment-scoped rerun with `fragment_id_queue=[id]`. In that run, `ctx.fragment_ids_this_run` contains the id, so `wrap()` takes its normal path and `wrapped_fragment()` executes — *replacing the skeleton content in place* because the cursor/dg snapshot restores the same delta path the placeholder occupied.

### 4.2 Frontend: visibility detection

- A new hook (e.g. `useFragmentVisibility`) attaches an `IntersectionObserver` to the placeholder block's DOM node. New code; there is no existing observer infra to extend (§3.5).
- **Root margin / preloading:** observe with a positive `rootMargin` (e.g. `200px 0px`) so the reveal fires *just before* the element scrolls into view, hiding round-trip latency.
- **Debounce / coalescing:** fast scrolling can make many placeholders cross the threshold in one frame. Debounce per animation frame and batch all newly-visible `fragment_id`s. The backend coalescing queue (`script_requests.py:216-223`) already merges multiple fragment ids, so the client may send them as several `ClientState` messages or (preferably) one batched run — see the `fragment_id_queue` open question in §5 / §6 Decision B.
- **One-shot:** once revealed, disconnect the observer for that node so it doesn't re-fire on every scroll.

### 4.3 The trigger back to the server

**Reuse the existing fragment-rerun round-trip — no new `BackMsg`.** On reveal, call the same path `run_every` uses: `widgetMgr.sendUpdateWidgetsMessage(fragmentId, /*isAutoRerun*/ false)` → `App.sendRerunBackMsg` → `BackMsg.rerun_script` with `ClientState.fragment_id`. Compared to `run_every`, the only differences are the *source* of the trigger (observer vs. timer) and `is_auto_rerun=false`.

This is strictly simpler than the `run_every` server side because **nothing new is emitted server-side to schedule the trigger** — the placeholder marker (4.1 step 3) is emitted once during the full run, and the client owns the "when."

### 4.4 Server-side on-demand execution

Handled entirely by the **existing** fragment-scoped rerun path (§3.2): `AppSession.request_rerun` → `RerunData(fragment_id=...)` → `script_requests` queue → `ScriptRunner._run_script` with `fragment_id_queue` → `order_fragment_ids` → `wrapped_fragment()` per id. The delta carries `fragment_id` and lands in the placeholder's container because of the restored cursor snapshot. **No new server execution machinery is required for the sequential case.**

### 4.5 Composition with `parallel=True`

This is where reuse stops. Two sub-cases:

- **Visible-on-load `lazy+parallel`:** should behave like plain `parallel=True` today — dispatched to the coordinator during the full run. But "visible on load" is a *frontend* fact the backend doesn't know at full-run time, so a `lazy` fragment is deferred *regardless* of whether it happens to be above the fold (the backend can't tell). It will therefore be revealed via a fragment-scoped rerun almost immediately after first paint. That means even an above-the-fold lazy+parallel fragment runs through the reveal path, not the full-run parallel path.
- **Revealed-below-the-fold `lazy+parallel`:** the reveal is a fragment-scoped rerun, and **`fragment.py:591`'s guard skips parallel dispatch during fragment runs**, so the fragment runs sequentially on the script thread. To honor the issue's "those should also run in parallel," the implementation must either (a) batch all simultaneously-revealed fragment ids into one `fragment_id_queue` run *and* lift the `not ctx.fragment_ids_this_run` guard so that, within a fragment-queue run, `parallel=True` fragments are dispatched to the (freshly created) coordinator and `join()`ed before the run ends; or (b) introduce a distinct reveal-scheduling model. Either way this is **net-new scheduler behavior**, not reuse. See §7.

### 4.6 Flow summary

```
FULL RUN (top-to-bottom):
  summary_metrics()            -> runs inline, emits real deltas
  expensive_chart()  [lazy]    -> wrap(): register in fragment_storage
                                         + st.container() reserves delta slot
                                         + emit Skeleton placeholder
                                         + mark block deferred(fragment_id)
                                         + return None   (body NOT executed)
  ...                                                    |
                                                         v
CLIENT:
  render tree -> Skeleton in reserved slot
  IntersectionObserver(rootMargin) on the deferred block
  scroll -> block (nearly) visible
        -> sendUpdateWidgetsMessage(fragment_id, isAutoRerun=false)
        -> BackMsg.rerun_script { ClientState.fragment_id }
                                                         |
                                                         v
SERVER:
  AppSession.request_rerun -> contains(fragment_id)? -> RerunData(fragment_id)
  script_requests: fragment_id -> fragment_id_queue (coalesce)
  ScriptRunner._run_script: fragment_ids_this_run=[id]
        -> fragment_storage.lookup(id) -> wrapped_fragment()
        -> body executes; deltas carry fragment_id; replace skeleton in place
  [parallel] -> only parallel if scheduler guard is lifted (see §7)
                                                         v
CLIENT:
  partial NewSession (fragmentIdsThisRun=[id]) -> clearTransientNodes
  real content replaces Skeleton at the same delta path (no reorder)
```

---

## 5. Hard problems & open questions

### 5.1 Widget state & `session_state` for code that hasn't run — *biggest unknown*
A deferred fragment's widgets are never registered on the initial run, and its `st.session_state` writes never happen until reveal.
- **Stale-widget reaping:** `SessionState.on_script_finished(active_widget_ids)` prunes widgets not seen this run. Because a lazy fragment doesn't run, its widget ids aren't "seen." This is *probably* fine while deferred (there's no widget yet), but on a **full rerun after reveal**, if the fragment re-defers (§5.3), the just-created widgets would be reaped and their values lost. Needs a rule that protects the widget state of registered-but-deferred fragments (analogous to how `run_every` race conditions are handled at `script_runner.py:724-745`).
- **Cross-fragment reads:** `summary_metrics()` (or any sibling) reading `st.session_state["chart_result"]` that `expensive_chart()` is supposed to populate will `KeyError` until the chart is scrolled into view. With an *eager* fragment this works on first run. **This is a behavioral cliff with no clean answer** — document it, and/or provide the eager fallback (§5.4).
- **Current best answer:** *needs decision.* Recommend: deferred fragments contribute their registered (but not-yet-rendered) ids to a "protected" set so reaping doesn't drop their state across reveal/defer cycles; explicitly document that pre-reveal reads of a lazy fragment's outputs are undefined and should use the eager fallback.

### 5.2 Layout shift / element ordering
The placeholder must occupy the fragment's real delta-path slot so revealing it doesn't reorder siblings. **Mitigated by design:** pre-allocating `st.container()` on the main thread during the full run (the same trick `_dispatch_parallel_fragment` uses, `fragment.py:837-838`) reserves the slot; the reveal's cursor snapshot restores the same delta path. Residual issue: visual reflow when a fixed-height `Skeleton` is replaced by taller/shorter real content (a UX/`height=` hint question, not a correctness one).

### 5.3 Full reruns: re-run, persist, or re-defer?
On a top-level rerun, the script re-executes top-to-bottom; the lazy fragment's `wrap()` runs again and (by the §4.1 logic) would **re-defer** — re-emitting a skeleton even though the user already revealed it. Options:
- **Re-defer (simplest, surprising):** revealed content reverts to skeleton on every full rerun → flicker, lost scroll context. Violates least-surprise.
- **Persist "revealed" set:** track revealed `fragment_id`s (server-side in session, or client-side, re-asserted in `ClientState`); on a full rerun, fragments already revealed run eagerly (or immediately re-trigger). More code, but matches user mental model.
- **Current best answer:** *needs decision*, leaning "persist revealed set." This interacts with `fragment_storage.clear(new_fragment_ids=...)` (`script_runner.py:805`) — the revealed set must survive the clear.

### 5.4 Programmatic / off-screen / headless access (eager fallback)
If a lazy fragment is never scrolled into view, its body **never runs**: no output, no `session_state` writes. This breaks:
- `AppTest` (no viewport at all → fragment never executes).
- Static export / `ForwardMsgList` replay.
- SiS / embedded export, print-to-PDF, screenshot pipelines.
- Any sibling code depending on the fragment's output (§5.1).
- **Current best answer:** ship an **eager fallback**: `lazy` is treated as `False` whenever there is no real viewport (AppTest, headless, static export), or behind a "render all" affordance. Recommend `lazy` be a *hint* that degrades to eager rather than a hard contract. This must be decided before MVP because it determines testability (§5.6).

### 5.5 `run_every` + `lazy`, and nested fragments
- **`run_every` + `lazy`:** Should the timer start only after reveal? Almost certainly yes — a deferred fragment shouldn't poll while invisible (otherwise "lazy" saves nothing). Implementation: don't emit the `AutoRerun` message (`fragment.py:585-589`) until the fragment first runs (i.e. on reveal). Combined with "pause while off-screen," this overlaps with a separate desirable feature (pause `run_every` when tab/section hidden).
- **Nested fragments:** A lazy fragment inside a parallel parent, a lazy inside a lazy, etc. `order_fragment_ids` (`fragment.py:324`) and `clear_stale_descendants` (`fragment.py:292`) already encode ancestor/descendant ordering, but a *child* lazy fragment can't be revealed before its *parent* has run (it isn't registered yet). Reveal of a nested lazy fragment must therefore be gated on the parent already having executed. **Needs decision / careful sequencing.**

### 5.6 Headless / e2e / snapshot testing
Viewport-dependent execution is inherently non-deterministic. E2E (`make run-e2e-test`) must deterministically scroll placeholders into view and wait for the reveal round-trip; snapshot tests must account for the skeleton→content transition. The eager fallback (§5.4) is what makes unit/`AppTest` coverage possible at all. **Plan for new Playwright helpers and explicit "scroll + await fragment" assertions.**

### 5.7 SiS / embedded contexts
The scroll container in embedded/SiS contexts is often an iframe or a host-controlled scroll region, not the window. The `IntersectionObserver` `root` must be configurable to the correct scroll ancestor; `ClientState.context_info.is_embedded` (`ClientState.proto`) already signals embedding and can drive root selection. There may be hosts where viewport info is unavailable → fall back to eager (§5.4).

---

## 6. Implementation options & recommendation

### Decision A — How does the frontend learn a container is a deferred lazy fragment?

| Option | Mechanism | Pros | Cons |
|---|---|---|---|
| **A1. Field on the wrapping `Block`** | Add e.g. `Block.LazyFragment { string fragment_id; float root_margin; }` (or a bool + reuse `fragment_id` already on `Delta`) to the container block the fragment is wrapped in; child = `Skeleton`. | Travels with the existing container delta; no new top-level message; renders/garbage-collects with the block; natural place for the observer. | Touches `Block.proto`; the block-rendering switch must learn to attach an observer. |
| **A2. Reuse/extend `AutoRerun`** | Add a trigger enum to `AutoRerun` (`TIMER` vs `VIEWPORT`) and emit it for lazy fragments. | Maximizes reuse of `handleAutoRerun` plumbing. | Semantics mismatch: `AutoRerun` is a session-level timer keyed by id, not a per-placeholder DOM binding; the client still needs to know *which DOM node* to observe, which `AutoRerun` doesn't express. Awkward. |
| **A3. Dedicated `DeferredFragment` element/message** | New element proto rendered as skeleton + observer. | Clean separation; explicit. | Most new surface; duplicates what a `Block` field + existing `Skeleton` already give us. |

**Recommendation: A1** — a small marker on the wrapping `Block` (carrying `fragment_id` + optional `root_margin`), with the existing `Skeleton` element as the placeholder child. Minimal protocol surface, correct ownership/GC semantics, and the observer binds naturally to the block's DOM node.

### Decision B — How is the reveal trigger transported?

| Option | Mechanism | Pros | Cons |
|---|---|---|---|
| **B1. Reuse `BackMsg.rerun_script` (`ClientState.fragment_id`)** | Reveal calls the same path as `run_every`/widget fragment reruns. | **Zero new `BackMsg`**; reuses coalescing queue (`script_requests.py:216-223`) and the entire `_run_script` fragment path; battle-tested. | Single `fragment_id` per `ClientState` — batching N simultaneous reveals means N messages (coalesced server-side) unless we add a queue field. |
| **B2. New dedicated reveal `BackMsg`** | e.g. `BackMsg.reveal_fragments { repeated string fragment_ids }`. | Natural batching of multi-reveal; clearer intent; could carry viewport metadata. | New protocol + new server handler; diverges from the proven path for no functional gain in the MVP. |
| **B3. `BackendOperationRequest` side channel** | Use the existing no-rerun operation channel (`BackMsg.backend_operation_request`). | Exists already. | Wrong tool — it's explicitly "without script rerun"; a reveal *is* a (fragment-scoped) rerun. |

**Recommendation: B1 for MVP.** If multi-reveal batching proves important, extend `ClientState` with an optional `repeated string fragment_id_queue` (the server already speaks `fragment_id_queue` internally) rather than inventing a new message.

### Decision C — Parallel composition (see §7 for detail)

| Option | Mechanism | Pros | Cons |
|---|---|---|---|
| **C1. MVP: revealed lazy fragments run sequentially** | Leave `fragment.py:591`'s guard as-is. | No scheduler changes; lands lazy independently of parallel. | Violates the issue's lazy+parallel goal; revealed rows don't parallelize. |
| **C2. Lift the guard + batch reveals** | Allow parallel dispatch inside a `fragment_id_queue` run; coordinator created per run already (`script_run_context.py:270`). | Delivers the promised lazy+parallel behavior. | Real scheduler work + concurrency-safety review (the `_check_not_parallel_worker` restrictions, `fragment.py:57`, apply). |

**Recommendation: C1 for MVP, C2 as a fast-follow** once lazy-alone is proven.

### Overall recommended approach
- API: add `lazy: bool = False` to `_fragment`/`fragment` (+ overloads) and **fix the existing `wrapper` re-dispatch to forward all params** (`fragment.py:458-465` currently drops `additional_hash_info`).
- Backend: new "defer" branch in `wrap()` that registers + pre-allocates container + emits `Skeleton` + sets the `Block` lazy marker, and returns `None` without running the body.
- Proto: `Block` lazy-fragment marker (Decision A1). No new `BackMsg`.
- Frontend: `useFragmentVisibility` (`IntersectionObserver` + rootMargin + debounce + one-shot), wired to `sendUpdateWidgetsMessage(fragment_id, false)`.
- Server execution: unchanged (existing fragment-scoped path).
- Eager fallback: `lazy` degrades to eager under AppTest/headless/static export.

---

## 7. Complexity, risk & phasing

### Per-layer change summary

| Layer | Change | Relative size | Risk |
|---|---|---|---|
| Decorator (`fragment.py`) | `lazy` param; defer branch (register + reserve container + skeleton + return None); fix param forwarding | **M** | Med — must not break parallel/run_every branches; reaping interplay |
| Proto (`Block.proto`) | lazy-fragment marker field | **S** | Low — additive; needs `make protobuf` |
| Script lifecycle (`script_runner.py`, `script_requests.py`) | none for MVP (reuse fragment-queue path); guard against reaping deferred ids | **S–M** | Med — `fragment_storage.clear` vs deferred ids; revealed-set persistence |
| Frontend visibility (`frontend/lib`) | new `IntersectionObserver` hook + block wiring; render skeleton; send reveal | **L** | **High** — greenfield, no existing infra; debounce/rootMargin/embedded-root edge cases |
| Frontend session (`App.tsx`) | handle re-defer vs persist; partial-run interaction | **M** | Med — `handleNewSession` partial path, `cleanupAutoReruns` |
| Parallel composition (`fragment.py`, coordinator) | lift `not ctx.fragment_ids_this_run` guard; batch reveals; concurrency review | **L** | **High** — concurrency correctness; deferred to phase 3 |
| Testing (e2e + AppTest) | eager fallback; deterministic scroll helpers; snapshot handling | **M–L** | High — non-determinism is intrinsic |

**Riskiest unknowns, ranked:** (1) widget/`session_state` semantics for deferred-then-revealed fragments and the reaping interplay (§5.1); (2) the brand-new frontend viewport subsystem and its embedded/SiS edge cases (§3.5, §5.7); (3) parallel composition requiring scheduler changes the issue *assumes* is free (§4.5, §7/C2); (4) deterministic testing (§5.6).

### Suggested phasing
- **Phase 1 (MVP):** `lazy=True` for non-parallel fragments. Defer → skeleton → reveal-on-visible (sequential), reusing `BackMsg.rerun_script`. Eager fallback for headless/AppTest. Re-defer on full rerun (documented), or persist-revealed if cheap. **No parallel composition.**
- **Phase 2:** rootMargin preloading polish, multi-reveal batching (optional `ClientState.fragment_id_queue`), `run_every` deferral until reveal + pause-while-hidden, revealed-set persistence to avoid skeleton flicker on full reruns, embedded/SiS root configuration.
- **Phase 3:** `lazy + parallel` — lift the `fragment.py:591` guard, dispatch revealed fragments to the per-run coordinator, and run the concurrency-safety review (`_check_not_parallel_worker` semantics, `fragment.py:57`).

**Honest bottom line:** the decorator change is trivial; the *feature* is not. Phase 1 alone introduces a new frontend visibility subsystem and forces decisions about widget-state semantics and an eager fallback. The lazy+parallel story the issue treats as "orthogonal/free" actually requires removing an explicit guard and adding parallel dispatch to the fragment-rerun path. Treat this as a multi-layer feature with a meaningful frontend build and at least one genuine semantics decision — not a small API addition.

---

## 8. Composition with parallel fragments (summary)

- **They share the same scheduling substrate** (`fragment_storage`, `fragment_id`, fragment-scoped rerun path, `ParallelFragmentCoordinator`), so they *can* compose — but the current code **actively prevents** it via `if parallel and not ctx.fragment_ids_this_run` (`fragment.py:591`), which disables parallel dispatch during the exact (fragment-scoped) runs that a lazy reveal produces.
- **`lazy` = "when it enters the pipeline" (frontend-triggered), `parallel` = "how scheduled work shares the machine" (per-run coordinator).** The clean composition is: a reveal batches the visible fragments into one `fragment_id_queue` run; within that run, `parallel=True` members are dispatched to a freshly-created coordinator and `join()`ed before the run ends — i.e. extend the existing parallel mechanics to fire inside fragment-queue runs.
- **The "add a fragment to the run set later" primitive already exists** in `script_requests.py` (`:216-223`) for the sequential case. What does **not** exist is *parallel* execution of a dynamically-revealed set — that is the concrete delta for Phase 3.
