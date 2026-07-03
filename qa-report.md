# QA report — Event-scoped fragment reruns (`st.rerun(target=...)` + `@st.fragment(key=...)`)

- **Prototype PR:** [#15794](https://github.com/streamlit/streamlit/pull/15794)
  (`[prototype][feature] Add st.rerun(target=...) for event-scoped fragment reruns`)
- **Spec:** [#15755](https://github.com/streamlit/streamlit/pull/15755)
  (`specs/2026-06-23-event-scoped-fragment-reruns/product-spec.md`)
- **Branch under test:** `cursor/event-scoped-fragment-reruns-8290`
  (checked out on `cursor/event-scoped-fragment-reruns-prototype-45a7`)
- **Build:** editable install of this branch (`uv sync --group test`, protobufs compiled from
  branch). Prototype API confirmed present:
  `"target" in inspect.signature(st.rerun).parameters` and
  `"key" in inspect.signature(st.fragment).parameters` are both `True`.
- **Scope:** QA only. No product code was modified and no PR was opened. Deliverable is this
  report plus the reproduction tests in `qa_repro/`.

---

## Summary

- **Overall verdict:** The core feature works. Naming a fragment with `@st.fragment(key=...)`
  and re-running it by name with `st.rerun(target=...)` from a callback, the main script body,
  or another fragment all behave as the spec describes — the targeted fragment re-executes and
  the main script body does not. Coalescing, error handling, key-lifecycle, and all existing
  (regression) behaviors are intact. The full existing Python suite for the touched areas passes
  (823 passed, 1 skipped).
- **One real bug (P1 for a documented sub-feature):** the **single documented "multiple call
  sites, one key" capability is unreachable** because `@st.fragment(key=...)` renders
  `st.container(key=key)`, so calling the same keyed fragment more than once raises
  `StreamlitDuplicateElementKey`. This breaks the spec's own "a fragment shown in three tabs
  refreshes in all three" promise (Scenario #5). The **primary single-call-site path is
  unaffected.**
- **One minor behavioral nuance (not a crash, arguably a spec ambiguity):** `st.rerun(target=[])`
  (empty list) degrades to a **full-app rerun**, not a no-op (Scenario #8).
- **Counts:** 14 spec scenarios attempted → **12 pass**, **1 pass-with-nuance** (#8), **1 fail /
  real bug** (#5). Reproduction suite result: **15 passed, 3 skipped, 1 xfailed** (the skips are
  AppTest-harness limitations re-covered faithfully at the ScriptRunner level; the xfail is the
  bug).
- **Known gaps (deferred, correctly out of MVP scope — not filed as bugs):** cycle/loop
  detection, `target`-specific metrics, docs guide, and E2E tests.

### Harness note (important, read before the results table)

`streamlit.testing.v1.AppTest` builds a **fresh** `LocalScriptRunner` — and therefore a **fresh,
empty `MemoryFragmentStorage`** — on **every** `.run()`. In the real runtime, `AppSession` owns
**one** `MemoryFragmentStorage` for the whole session. Two consequences shaped the harness:

1. **Callbacks/main-body targeting across an interaction.** A widget callback fires *before* the
   script body re-registers its fragments. In production the callback still resolves the target
   from the previous run's registration (persistent storage); under vanilla AppTest it raises a
   spurious `No fragment found for target ...`. To model production faithfully, the tests patch
   `local_script_runner.MemoryFragmentStorage` to a **single persistent instance** (helper
   `persistent_fragment_storage`). This is a *test-harness* workaround, not a product change.
2. **Fragment-scoped reruns from widgets.** AppTest turns **every** widget interaction into a
   **full-app** rerun (its `RerunData` never carries a `fragment_id`). It therefore cannot drive a
   fragment-scoped rerun the way the browser does when a widget *inside* a fragment changes.
   Scenarios #3/#13/#14 are therefore exercised at the **ScriptRunner level**
   (`qa_repro/test_qa_scriptrunner_reruns.py`), issuing the exact `RerunData` the frontend sends.

---

## Test plan & results

| # | Scenario | Method | Expected | Actual | Verdict |
|---|----------|--------|----------|--------|---------|
| 1 | Target from a widget **callback outside** the fragment | AppTest + persistent storage | Only the named fragment reruns; main body does not | `main_runs` stays 1, `frag_runs` 1→2, no warning/exception. The targeted rerun **preempts** the full rerun. | **PASS** |
| 2 | Target from the **main script body** (conditional) | AppTest | Fragment reruns; main body not re-run *by the target call* | On the 2nd full run, targeted rerun fires: `main_runs`=2, `frag_runs`=3 (body+target). | **PASS** |
| 3 | Target from **another fragment** | ScriptRunner (faithful) | Both fragments rerun; main body does not | `main_runs` stays 1; `b_runs` 1→2 and `a_runs` 1→2 (B targeted A). | **PASS** |
| 4 | Target a **list** of names; ancestors before descendants | Runtime (`resolve_target` + `order_fragment_ids`) | All resolve; parent ordered before child | List resolves to both ids; `order_fragment_ids` places `parent_id` before `child_id`. | **PASS** |
| 5 | One `key` at **multiple call sites** | Runtime + AppTest | All call sites render & rerun together | Storage resolves both ids, **but rendering a 2nd call site raises `StreamlitDuplicateElementKey`**; only the first site renders. | **FAIL (bug)** |
| 6 | **Coalescing** of several targeted reruns | Runtime (`ScriptRequests.request_rerun`) | Union, deduped, ordered; earlier target not dropped | `["a","b"]` then `["b","c"]` → `["a","b","c"]`; a later full rerun clears the queue. | **PASS** |
| 7 | **Unknown** target name | Runtime (`resolve_target`) | `StreamlitAPIException` naming the key + mentioning `@st.fragment(key=...)` and "rendered at least once" | Message contains all three cues. | **PASS** |
| 8 | **Empty** `target` list | Runtime + AppTest | No crash | No crash: `resolve_target([])==[]`; **but `st.rerun(target=[])` degrades to a full-app rerun** (`main_runs`→2), not a no-op. | **PASS (nuance)** |
| 9 | `target` combined with `scope="fragment"` | Runtime (`_new_fragment_id_queue`) | Does not error; targeting wins | `resolve_target` is used regardless of scope; `is_fragment_scoped_rerun=True`. | **PASS** |
| 10 | **Key change** on re-render | Runtime | Same `fragment_id`; new name resolves; old name stops | Re-register same id under new key → new resolves, old raises. | **PASS** |
| 11 | Fragment **no longer rendered** (conditional) | AppTest + persistent storage | Name stops resolving after the full run that dropped it | After 2nd run drops the fragment, `resolve_target("charts")` raises. | **PASS** |
| 12 | **Bare** `st.rerun()` (regression) | AppTest | Full-app rerun | `main_runs`→2. | **PASS** |
| 13 | `st.rerun(scope="fragment")` from inside a fragment (regression) | ScriptRunner (faithful) | Reruns just that fragment | `main_runs` stays 1; `frag_runs` reaches 3 (init+rerun+self-rerun). | **PASS** |
| 14 | Widget **inside** a keyed fragment (regression) | ScriptRunner (faithful) | Normal fragment-only rerun | `main_runs` stays 1; `frag_runs` 1→2. | **PASS** |

**Existing suites (regression sanity):** `fragment_test.py`, `script_requests_test.py`,
`execution_control_test.py`, `session_state_test.py` → **823 passed, 1 skipped**; the 13
fragment tests in `script_runner_test.py` → **13 passed**.

---

## Bugs found

### BUG-1 (High for the documented multi-call-site capability) — `@st.fragment(key=...)` collides on multiple call sites

- **Severity:** High for the specific "one key, many call sites / same fragment shown in
  multiple places" capability that the spec explicitly promises; **the primary single-call-site
  path is unaffected**, so the headline feature still works for the common case.
- **What's wrong:** the decorator threads the user-facing `key` straight into the fragment's
  container as an *element* key (`st.container(key=key)`). Element keys must be unique per run, so
  invoking the same keyed fragment from more than one call site raises
  `StreamlitDuplicateElementKey`. Only the first call site renders (its `frag_runs` counter is 1,
  not 2). The name index itself is fine — `resolve_target("shared")` correctly returns *both* ids
  — but you can never render two call sites to reach that path, so
  "`st.rerun(target=...)` reruns **every** call site" is effectively unreachable.
- **Contradiction with intended behavior:** the spec's *Addressing fragments* section states the
  key "identifies the *fragment function*, and `st.rerun(target=...)` reruns **every** call site
  of that function," and gives "a fragment shown in three tabs refreshes in all three" as a
  motivating example. The `@st.fragment` docstring added in the PR repeats this: "If the fragment
  function is called from multiple sites, every call site re-runs together." Scenario #5 is a
  listed acceptance test.
- **Scope of impact (reproduced):** fails identically at top level, inside `st.tabs`, and inside
  `st.columns`.
- **Suspected code location:** `lib/streamlit/runtime/fragment.py`, in `wrapped_fragment` where
  the fragment container is created:

```610:611:lib/streamlit/runtime/fragment.py
                        else st.container(key=key)
                    )
```

  Reusing the user-facing `key` as the container's element key is the collision source. Fragment
  identity is positional and independent of `key` (verified by Scenario #10), so the container
  key is not needed for identity; a per-call-site-unique key (or omitting the container key) would
  fix this while preserving addressing.
- **Minimal repro:**

```python
import streamlit as st

@st.fragment(key="shared")
def frag():
    st.write("hi")

frag()
frag()   # -> StreamlitDuplicateElementKey: multiple elements with the same key='shared'
```

  Automated: `qa_repro/test_qa_event_scoped_reruns.py::test_s5_multiple_call_sites_same_key`
  (marked `xfail(strict=True)` so the suite documents the bug and stays green; flip to see the
  failure).

### No other bugs

No crashes, incorrect targeting, lost coalescing, stale-index, or regression failures were found
across the other 13 scenarios and the existing suites. Section intentionally otherwise empty.

---

## Observations / spec ambiguities (not bugs)

- **OBS-1 — `st.rerun(target=[])` triggers a full-app rerun.** An empty list resolves to an empty
  fragment queue; because `if rerun_data.fragment_id_queue:` is falsy for `[]`, the runner takes
  the full-run branch. It does not crash (so it satisfies "no-op-style … no crash"), but a caller
  passing a dynamically-computed empty list (e.g. `st.rerun(target=selected)` when nothing is
  selected) will get an unexpected **whole-app** rerun rather than "rerun nothing." Worth a
  decision: treat empty `target` as a true no-op. Verified in
  `test_s8_empty_target_list` and `_fragment_run_should_not_preempt_script([], True) == False`.
- **OBS-2 — AppTest cannot exercise the feature out of the box.** As detailed in the harness note,
  vanilla AppTest both (a) resets fragment storage per `run()` (breaks callback/main-body
  targeting across an interaction) and (b) cannot issue fragment-scoped reruns from widgets. This
  is a *testing-tool* gap, not a product bug, but it means anyone writing AppTest coverage for
  this feature will need the persistent-storage workaround and/or ScriptRunner-level tests. If the
  feature graduates from prototype, consider teaching AppTest to persist fragment storage across
  runs and to model in-fragment widget interactions as fragment-scoped reruns.

---

## Known gaps (deferred, not bugs)

These are explicitly deferred by the spec ("Open questions" / "Out of scope") and/or the PR
description ("E2E Tests: Deferred (prototype scope)"), so they are **not** filed as defects:

- **Cycle / infinite-rerun detection.** No detect-and-raise or max-depth guard for `A → B → A`
  targeted-rerun loops. The spec leaves cycle avoidance to the developer for the MVP (same footgun
  as `st.rerun()` today) and lists automatic protection as a post-MVP open question. Confirmed
  absent in `fragment.py` / `execution_control.py`.
- **`target`-specific metrics.** `rerun` carries `@gather_metrics("rerun")`, but there is no
  dedicated metric distinguishing `st.rerun(target=...)` usage, which the spec checklist calls for
  ("add metrics for `st.rerun(target=...)`").
- **Docs.** No `st.rerun` reference update, fragment concept docs, or "event-driven / partial
  updates" guide (spec checklist marks docs as needed).
- **E2E (Playwright) tests.** None reference `rerun(target=` (`rg -l "rerun\(target" e2e_playwright`
  → none); PR states E2E is deferred.
- **Playwright spot-check not run in this environment.** This environment is headless with no
  browser driver wired up for `make debug`; per task instructions the optional Playwright
  spot-check was skipped. All behavioral findings above come from AppTest and direct ScriptRunner
  runs, which are sufficient to exercise the backend logic headlessly.

---

## Reproduction appendix

### Environment setup

```bash
# From repo root, on the prototype branch:
pip install uv && export PATH="$HOME/.local/bin:$PATH"
uv sync --group test
# Compile protobufs (protoc via grpcio-tools works if system protoc is absent):
uv pip install grpcio-tools
uv run python -m grpc_tools.protoc --proto_path=proto --python_out=lib --mypy_out=lib proto/streamlit/proto/*.proto
# Confirm prototype API:
uv run python -c "import streamlit as st, inspect; \
  assert 'target' in inspect.signature(st.rerun).parameters; \
  assert 'key'    in inspect.signature(st.fragment).parameters; print('prototype API present')"
```

### Running the QA suites

```bash
uv run pytest qa_repro/ -v
# => 15 passed, 3 skipped, 1 xfailed
#    - 3 skipped: AppTest cannot drive fragment-scoped reruns; those scenarios (#3/#13/#14)
#      are re-covered faithfully in test_qa_scriptrunner_reruns.py.
#    - 1 xfailed: BUG-1 (multiple call sites, one key).
```

### Files

- `qa_repro/test_qa_event_scoped_reruns.py` — AppTest + direct-runtime coverage of scenarios
  #1, #2, #4, #5, #6, #7, #8, #9, #10, #11, #12 (with #3/#13/#14 marked skip → see below). Includes
  the `persistent_fragment_storage` helper that patches
  `streamlit.testing.v1.local_script_runner.MemoryFragmentStorage` to a single instance so the
  harness matches production storage lifetime.
- `qa_repro/test_qa_scriptrunner_reruns.py` — faithful ScriptRunner-level coverage of the
  fragment-scoped-rerun scenarios #3, #13, #14. Uses a real `ScriptRunner` whose thread loop stays
  alive across reruns, plus a cross-thread `BARRIER` so the script publishes its (post-run)
  fragment id and blocks until the test injects the exact fragment-scoped `RerunData` the browser
  would send for an in-fragment widget change.

### Key repro snippets

BUG-1 (multiple call sites):

```python
import streamlit as st

@st.fragment(key="shared")
def frag():
    st.write("hi")

frag()
frag()   # StreamlitDuplicateElementKey: ...same key='shared'...
```

Scenario #1 — callback outside the fragment targets it (only the fragment reruns):

```python
from unittest.mock import patch
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.testing.v1 import AppTest

def script():
    import streamlit as st
    st.session_state.setdefault("main_runs", 0)
    st.session_state.setdefault("frag_runs", 0)
    st.session_state["main_runs"] += 1

    @st.fragment(key="charts")
    def charts():
        st.session_state["frag_runs"] += 1

    charts()
    st.button("go", on_click=lambda: st.rerun(target="charts"))

shared = MemoryFragmentStorage()
with patch("streamlit.testing.v1.local_script_runner.MemoryFragmentStorage", lambda: shared):
    at = AppTest.from_function(script).run()          # main_runs=1, frag_runs=1
    at.button[0].click().run()                        # main_runs=1, frag_runs=2  (full run preempted)
```

Scenario #3 — one fragment targets another (faithful, ScriptRunner level): see
`test_qa_scriptrunner_reruns.py::test_s3_target_from_another_fragment`.
