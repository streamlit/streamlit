# QA Report — Parallel Fragments (`@st.fragment(parallel=True)`) + Fragment Outside-Container Writes

**Scope:** Exploratory QA of already-merged code on `develop`. No product code was changed;
the deliverable is this report. Findings are grounded in actual runs of a purpose-built
`AppTest` + direct-runtime harness (18 checks, all green) plus a review of the existing unit,
coordinator, and e2e suites.

**Feature under test**
- Product spec: `specs/2026-03-05-parallel-fragments/product-spec.md`
- Tech spec: `specs/2026-03-05-parallel-fragments/tech-spec.md`
- Implementation: `lib/streamlit/runtime/fragment.py`,
  `lib/streamlit/runtime/parallel_coordinator.py`,
  `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py` (`ThreadState`,
  `FragmentThreadState`), `lib/streamlit/runtime/scriptrunner/script_runner.py` (join/drain
  barrier), `lib/streamlit/delta_generator.py` (`_enqueue` restriction + outside wrappers),
  `lib/streamlit/elements/dialog_decorator.py`, `lib/streamlit/commands/execution_control.py`.

**Harness**
- Primary: `streamlit.testing.v1.AppTest` (headless). `AppTest`'s `LocalScriptRunner`
  subclasses the real `ScriptRunner`, so parallel fragments are genuinely dispatched to a
  `ThreadPoolExecutor` and joined at the barrier before the element tree is parsed. This
  makes `AppTest` a faithful harness for *what executed / what rendered*.
- Secondary: direct-runtime checks against `ThreadState` / `_check_not_parallel_worker`.
- Reproduction code: `work-tmp/qa_parallel/test_qa_parallel_fragments.py` (also inlined in the
  appendix). Run: `uv run pytest work-tmp/qa_parallel/test_qa_parallel_fragments.py -v`.

---

## Summary

- **Overall verdict: healthy.** Every documented behavior, restriction, and edge case I was
  able to exercise headlessly matches the spec. I found **no new bugs**.
- **Counts:** 14 scenarios (several with sub-cases), 18 executable checks. **Pass: 15
  checks / 11 scenarios fully verified headlessly.** **Known harness-gap: 3 checks / 3
  scenarios** (fragment-scoped-rerun path — see below), each cross-covered by the existing
  browser e2e suite and/or a direct-runtime gate check. **Bugs: 0.**
- **Key harness limitation (must-read):** `AppTest` always performs **full-app reruns** — its
  `RerunData` never sets `fragment_id_queue` (confirmed: no reference in
  `lib/streamlit/testing/v1/app_test.py`). Consequently a widget interaction inside a parallel
  fragment **re-dispatches the parallel worker** instead of triggering a *sequential
  fragment rerun*. This means the "only-that-fragment reruns" and "dialog/`switch_page`/
  `rerun(scope='fragment')` allowed on rerun" behaviors **cannot be observed via `AppTest`**.
  They are verified in the browser e2e suite (`e2e_playwright/st_fragment_parallel_test.py`)
  and, for the API gate, by a direct `ThreadState` check.
- **True concurrency / progressive rendering / timing / cooperative cancellation of a blocked
  thread** are not directly observable through `AppTest` (it inspects the final joined tree).
  Cancellation semantics are covered by `parallel_fragment_coordinator_test.py` (25 tests)
  and the e2e `st_stop` / `st_rerun` tests. I did **not** run the browser e2e suite in this
  environment (no browser / frontend build available; async env-setup exited non-zero) — I
  reviewed those tests as the reference for browser-only behavior.

---

## Test plan & results

| # | Scenario | Method | Expected | Result |
|---|----------|--------|----------|--------|
| S1 | 2+ parallel fragments + non-fragment content | AppTest | All fragments render; header + footer render | **PASS** |
| S2 | Mixed `parallel=True` + regular `@st.fragment` + trailing content | AppTest | All three render | **PASS** |
| S3 | Return value of a `parallel=True` call | AppTest | `None` (user return discarded) | **PASS** |
| S4 | `parallel=True` + `run_every` | AppTest + unit ref | Dispatches & runs once on initial run; timer reruns sequential | **PASS** (timer-msg + sequential rerun covered by unit suite) |
| S5 | Widget interaction → only that fragment reruns | AppTest | Only clicked fragment reruns | **KNOWN GAP** (AppTest full-rerun; e2e verifies) |
| S6a | `st.rerun(scope="fragment")` during initial parallel run | AppTest | `StreamlitAPIException` (existing guard) | **PASS** |
| S6b | `st.rerun(scope="fragment")` on widget rerun | AppTest | Works (sequential) | **KNOWN GAP** (AppTest full-rerun; e2e verifies) |
| S7 | Bare `st.rerun()` / `scope="app"` from parallel fragment | AppTest + coordinator unit ref | Full app rerun; siblings cancelled | **PASS** (rerun verified; cancellation via coordinator tests + e2e) |
| S8a | `@st.dialog` during initial parallel run | AppTest | `StreamlitAPIException`, helpful msg | **PASS** |
| S8b | Dialog from a button click (sequential rerun) | AppTest + direct gate | Dialog opens | **KNOWN GAP** (AppTest full-rerun); gate verified directly + e2e |
| S9 | `st.switch_page` during initial parallel run | AppTest | `StreamlitAPIException` | **PASS** |
| S10 | Regular fragment nested inside parallel | AppTest | Both render (inner on outer's thread) | **PASS** |
| S11 | `parallel=True` nested inside `parallel=True` | AppTest | Both render; outer waits for inner | **PASS** |
| S12 | Concurrent single-key writes from many parallel fragments | AppTest | No key lost/corrupted | **PASS** |
| S13 | One parallel fragment raises | AppTest | Error rendered; siblings + main continue | **PASS** |
| S14a | Regular fragment writes to an outside container | AppTest | Lands in place; resets on rerun (no dup) | **PASS** |
| S14b | Parallel fragment writes to an outside container | AppTest | `StreamlitAPIException` (documented restriction) | **PASS** |
| — | Direct gate: `_check_not_parallel_worker` fires only for workers | Direct | Raises when worker, no-op otherwise | **PASS** |

Execution evidence: `18 passed` for
`work-tmp/qa_parallel/test_qa_parallel_fragments.py`.

### Scenario notes

- **S1/S2** — All fragment outputs and the trailing `FOOTER` markdown are present in the final
  tree. Because the join barrier holds `scriptFinished` until all workers finish, `AppTest`
  reliably sees every worker's content. The *non-blocking dispatch* and *progressive*
  aspects (footer visible while a slow fragment is still loading) are timing properties
  `AppTest` cannot observe; the e2e `test_parallel_fragments_render_concurrently` /
  `..._preserve_source_order` cover call-site ordering in the DOM.
- **S3** — `ret = f(); st.session_state["ret_is_none"]` is `True` and `repr(ret) == "None"`,
  even though the fragment body `return`s a string. Matches the "call returns immediately
  with `None`" decision.
- **S4** — The parallel + `run_every` fragment dispatches and runs exactly once on the initial
  full-app run (`live_ran == 1`), no exception. The auto-rerun timer-message emission and the
  "reruns run sequentially" property are already covered by
  `fragment_test.py::test_run_every_arg_handling` and
  `::test_run_every_parallel_fragment_reruns_sequentially`, so I did not duplicate them.
- **S6a** — During the initial full-app run `fragment_ids_this_run` is empty, so
  `st.rerun(scope="fragment")` hits the pre-existing guard in
  `execution_control._new_fragment_id_queue` and renders
  *"scope=\"fragment\" can only be specified … during fragment reruns."* inline. This is the
  documented behavior (the `RerunException` is never even reached in the worker).
- **S7** — With `run_count` gating, the fragment calls `st.rerun()` on the first run; the app
  restarts and completes with `run_count == 2` and `RESTARTED` rendered. The *cancellation of
  in-flight siblings* is not observable via `AppTest`; it is covered by
  `parallel_fragment_coordinator_test.py` (`test_join_raises_stored_rerun_exception_with_data`,
  `test_join_raises_stored_stop_exception`, `test_drain_*`, first-writer-wins) and the e2e
  `test_parallel_st_stop_ends_script` / `test_parallel_st_rerun_restarts_app`.
- **S8a/S9** — Both raise `StreamlitAPIException` from `_check_not_parallel_worker` with the
  helpful, actionable message ("… cannot be called from a parallel fragment during the initial
  page load … gate the call behind a widget interaction"). Message names the offending API
  (`@st.dialog` / `st.switch_page`).
- **S10/S11** — Nested regular-in-parallel and parallel-in-parallel both render all content
  with the trailing footer, confirming the outer waits for inner completion before the barrier
  releases. (Dispatch-from-worker for nested parallel is additionally unit-covered by
  `fragment_test.py::test_nested_parallel_fragment_dispatches_from_worker`.)
- **S12** — 12 parallel fragments each writing a distinct `session_state` key: all 12 keys are
  present and correct after the run. No lost/torn writes at the dict level (consistent with
  the per-field locking described in the tech spec / `SharedRunState`). Note this verifies
  *single-key* atomicity only; multi-op read-modify-write is explicitly the user's
  responsibility (see Known limitations).
- **S13** — The raising fragment renders its `ValueError("kaboom")` exception; the sibling's
  `OK_DONE` and the main script's `FOOTER` are both present — error isolation holds. (Exact
  container placement of the error is a DOM property covered by the e2e
  `test_parallel_fragment_error_renders_in_container`.)
- **S14a** — A regular (sequential) fragment writing into an outside `st.container()` renders
  `OUTSIDE_1`; after a widget-triggered rerun the outside content is exactly `["OUTSIDE_2"]` —
  replaced in place, not duplicated/stale. This exercises the per-fragment
  `OutsideContainerWrapper` re-emit-and-reset path (`_reset_outside_wrappers`).
- **S14b** — A `parallel=True` fragment writing into an outside container raises
  `StreamlitAPIException` ("Writing to containers outside a parallel fragment is not allowed
  during the initial page load …"). This is the intended, shipped behavior — see the spec
  reconciliation note below.

---

## Bugs found

**None.** No reproducible defects were found in the exercised behaviors. Every documented
restriction fired with a clear, actionable message, and every happy-path scenario produced the
expected element tree and session state.

---

## Spec reconciliation note (not a bug)

The tech spec's *"External container writes"* section (lines ~990–1051) proposes blocking
**all element writes** from a parallel worker to a container outside its scope. The shipped
code implements exactly this in `delta_generator._enqueue` (raises for
`ts.is_parallel_worker` when the cursor path is outside the fragment path), and
`_needs_outside_wrapper` short-circuits to `False` for parallel workers. Meanwhile the newer
`fragmentOutsideWrites` series added the `OutsideContainerWrapper` redirection for
**sequential** fragments (verified in S14a). These two are consistent: **sequential fragments
get wrapper redirection; parallel workers are blocked.** The task brief's S14 wording ("a
parallel … fragment writes into a container … output lands in the right place") is slightly
optimistic for the *parallel* case — the actual (and, per the spec's non-determinism
rationale, correct) behavior is to raise. Flagged here only so the brief and the code aren't
read as contradictory.

---

## Known limitations (deferred by design — not bugs)

Confirmed against the spec's "Key decisions" / "Forward compatibility" so they are **not**
reported as defects:

1. **Parallel fragment *reruns* are sequential (MVP).** `parallel=True` only parallelizes the
   initial full-app run; `run_every` / widget / `rerun(scope="fragment")` reruns execute
   sequentially on the script thread. Dispatch guard: `if parallel and not
   ctx.fragment_ids_this_run` in `fragment.py`.
2. **No built-in loading indicator.** The reserved container is empty until the worker
   produces output; `parallel=True` is a pure execution modifier. Users add their own
   (`st.spinner`, etc.).
3. **Cooperative (not preemptive) cancellation.** A worker blocked in external I/O won't see
   the stop/rerun signal until it returns and hits the next yield point; the barrier waits for
   it. Inherent to Python threading.
4. **Session-state atomicity is per-operation only.** Multi-op sequences (`+=`,
   read-modify-write) can lose updates under concurrency — the user's responsibility
   (`SafeSessionState`'s `RLock` releases between ops).
5. **GIL / CPU-bound work.** Real parallelism today is for I/O-bound work; CPU-bound work only
   parallelizes on free-threaded Python. MVP targets standard Python.
6. **Restrictions during the parallel batch.** `@st.dialog`, `st.switch_page`, and
   outside-container writes are prohibited during the initial parallel run; all are allowed
   during sequential fragment reruns (gated behind user interactions).

---

## Harness limitations (stated explicitly)

1. **`AppTest` cannot simulate fragment-scoped reruns.** It builds `RerunData` with no
   `fragment_id_queue`, so *every* widget interaction is a full-app rerun. Empirically
   confirmed: clicking one parallel fragment's button re-runs **both** fragments
   (`a_runs, b_runs → 2, 2`). This makes S5, S6b, and S8b unobservable in `AppTest`:
   - **S5** ("only that fragment reruns") — asserted the observed AppTest behavior (both
     rerun) to make the gap reproducible; real behavior covered by e2e
     `test_parallel_fragment_rerun_only_reruns_self`.
   - **S6b** ("`rerun(scope='fragment')` on widget click works") — under AppTest the full
     rerun re-enters the parallel path where `fragment_ids_this_run` is empty, so the guard
     rejects it; real behavior is a valid sequential rerun.
   - **S8b** ("dialog from button click works") — under AppTest the worker is re-dispatched
     (`is_parallel_worker=True`) so the dialog guard still fires. I verified the underlying
     gate directly: `_check_not_parallel_worker` raises only when `is_parallel_worker` is
     True and is a no-op when False (the sequential-rerun state). Full flow covered by e2e
     `test_parallel_fragment_allows_dialog_on_rerun`.
2. **No timing / progressive-rendering / true-concurrency observation.** `AppTest` parses the
   final joined tree, so it cannot measure the load-time speedup, progressive fill order, or
   the cancellation of a mid-flight blocked thread. These are covered by the coordinator unit
   tests and the browser e2e suite.
3. **Browser e2e not executed here.** No browser / frontend build in this environment (async
   env-setup exited non-zero). The e2e specs were reviewed as the reference for DOM ordering,
   container placement, and sequential-rerun behavior, not run.

---

## Reproduction appendix

Full harness: `work-tmp/qa_parallel/test_qa_parallel_fragments.py`. Run with:

```bash
uv run pytest work-tmp/qa_parallel/test_qa_parallel_fragments.py -v
# 18 passed
```

Key representative snippets (see the file for all 18 checks):

**S3 — return value is `None`:**

```python
@st.fragment(parallel=True)
def f():
    st.markdown("BODY")
    return "should-be-discarded"

ret = f()
st.session_state["ret_is_none"] = ret is None   # -> True
st.session_state["ret_value"] = repr(ret)        # -> "None"
```

**S8a — dialog blocked during initial parallel run:**

```python
@st.dialog("D")
def dlg():
    st.write("dialog body")

@st.fragment(parallel=True)
def f():
    st.markdown("FRAG")
    dlg()   # -> StreamlitAPIException: "@st.dialog cannot be called from a parallel fragment ..."

f()
```

**S12 — concurrent single-key writes not lost:**

```python
def make(i):
    @st.fragment(parallel=True)
    def f():
        st.session_state[f"k_{i}"] = i
    return f

for i in range(12):
    make(i)()
# after run: all of k_0..k_11 present and correct
```

**S14b — parallel fragment outside-container write is blocked:**

```python
outside = st.container()

@st.fragment(parallel=True)
def f():
    with outside:
        st.markdown("OUTSIDE_FROM_PARALLEL")   # -> StreamlitAPIException (outside + parallel)
    st.markdown("INSIDE")

f()
```

**Direct gate check (sequential path allows restricted APIs):**

```python
from streamlit.runtime.fragment import _check_not_parallel_worker
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState

ThreadState.initialize(is_parallel_worker=True)
# _check_not_parallel_worker("@st.dialog") -> raises StreamlitAPIException

ThreadState.initialize(is_parallel_worker=False)
_check_not_parallel_worker("@st.dialog")     # no-op (sequential rerun)
_check_not_parallel_worker("st.switch_page") # no-op
```

**Empirical proof of the AppTest full-rerun limitation:**

```python
# Two parallel fragments, each bumping its own counter and rendering a button.
at.run()                       # a_runs, b_runs == 1, 1
at.button(key="btn_a").click().run()
# a_runs, b_runs == 2, 2  <-- BOTH reran => full-app rerun, not fragment-scoped
```

### Cross-referenced existing coverage (reviewed, not re-reported as new)

- `lib/tests/streamlit/runtime/fragment_test.py` — parallel dispatch, return-`None`,
  sequential-during-rerun, nested dispatch, `run_every` sequential rerun,
  pre-allocated-container skip, `is_parallel_worker` inheritance, API-restriction gate.
- `lib/tests/streamlit/runtime/parallel_fragment_coordinator_test.py` (25 tests) — submit /
  outstanding counter, nested submit, join/wait/yield, drain, first-writer-wins,
  ctx + `ThreadState` propagation and isolation, `max_workers` validation.
- `e2e_playwright/st_fragment_parallel_test.py` — concurrent render, source-order,
  container pre-allocation, widget rerun-only-self, dialog/`switch_page` block + allow-on-
  rerun (incl. nested), `st.stop`/`st.rerun` cancellation, error-in-container.
