# QA Report: Outside Container Writes for Fragments (PR #15623)

**Feature:** `@st.fragment` functions writing elements/widgets into containers declared
outside the fragment's scope (parent-scoped `st.container()`, `st.sidebar`, `st.bottom`),
redirected through implicit `Transparent` wrapper blocks.

**Branch under test:** `cursor/outside-container-writes-enabled-07e6`
**Spec reference:** `specs/2026-06-03-outside-container-writes/tech-spec.md` (PR #15413, merged)
**Test method:** Live apps via `make debug` + Playwright (Chromium, headless), backend/frontend log inspection.
**Date:** 2026-06-17

---

## Summary

**Overall assessment: FAIL (one significant correctness bug).** Confidence: **high.**

The feature works correctly for the large majority of scenarios — writing elements and
widgets to outside containers, widget state persistence, multiple fragments sharing a
container, sidebar/bottom direct writes, `run_every`, nested containers, `st.empty`,
forms, and the intentionally-blocked cases (`parallel=True`, dynamic/unestablished
containers) all behave as specified. **Element growth** and **footer preservation**
(the interleaving/overwrite invariant) work correctly.

However, there is **one reproducible, high-severity bug**: when a fragment writing to an
outside container **shrinks its element count** across reruns, the removed elements are
**not garbage-collected** — stale elements remain visible. This directly violates the
spec's testing-plan invariant (a) ("shrink ... does not leave stale fragment elements
behind") and affects **all** outside container types (captured `st.container()`,
`st.sidebar`, `st.bottom`). It does **not** affect in-scope fragment writes, confirming
the defect is specific to the implicit wrapper path.

A total of **18 distinct scenarios** were exercised with Playwright verification across
5 test apps; **16 passed, 1 failed (shrink), 1 is a confirming baseline.**

---

## Test matrix

| # | Scenario | App | Result |
|---|----------|-----|--------|
| S1 | Fragment writes `st.write` / `st.metric` / `st.dataframe` to an outside `st.container()`; header/fragment/footer ordering; no accumulation across reruns | `qa_core.py` | ✅ PASS |
| S2 | Fragment writes widgets (`button`, `text_input`, `selectbox`, `slider`, `checkbox`) to an outside container; **widget state persists** across fragment reruns | `qa_core.py` | ✅ PASS |
| S3 | Two different fragments write to the **same** outside container; each updates independently; non-fragment writes keep position | `qa_core.py` | ✅ PASS |
| S7 | Fragment conditionally writes via the `outside.empty()` placeholder pattern (show/hide) | `qa_core.py` | ✅ PASS |
| S9 | Nested container: fragment writes to `st.columns` inside an outside container; no column accumulation on rerun | `qa_core.py` | ✅ PASS |
| S10 | `st.empty()` as the outside container — replace semantics (exactly one element) | `qa_core.py` | ✅ PASS |
| S11a | Many elements (12) into an outside container; footer preserved | `qa_core.py` | ✅ PASS |
| S11b | **Shrink** 12 → 5 elements (stale leftovers must be removed) | `qa_core.py` | ❌ **FAIL** |
| S11c | **Growth** 5 → 12 elements; footer not overwritten | `qa_core.py` | ✅ PASS |
| S12 | `st.form` with widgets inside an outside container; submit works | `qa_core.py` | ✅ PASS |
| S13 | Main script + fragment interleaving — stable ordering (header/fragment/middle/fragment/footer) | `qa_core.py` | ✅ PASS |
| S4 | Fragment writes to `st.sidebar` **directly** (`st.sidebar.markdown`); growth keeps footer | `qa_roots.py` | ✅ PASS |
| S4s | Sidebar direct writes **shrink** 6 → 3 (stale must be removed) | `qa_roots.py` | ❌ **FAIL** |
| S5 | Fragment writes to `st.sidebar` via `with st.sidebar:` | `qa_roots.py` | ✅ PASS |
| S6 | Fragment writes to `st.bottom`; growth keeps footer | `qa_roots.py` | ✅ PASS |
| S6s | Bottom writes **shrink** 4 → 2 (stale must be removed) | `qa_roots.py` | ❌ **FAIL** |
| S8 | `run_every=1s` fragment writing to an outside container — no accumulation, content updates, footer preserved | `qa_runevery.py` | ✅ PASS |
| S14 | Regression: normal in-scope fragment still works | `qa_regression.py` | ✅ PASS |
| S15 | Regression: `run_every` for in-scope writes | `qa_runevery.py` | ✅ PASS |
| S16 | `parallel=True` fragment writing to an outside container raises `StreamlitAPIException` (intentionally blocked) | `qa_regression.py` | ✅ PASS |
| S17 | Dynamic selection: writing to a never-established outside container on a standalone rerun raises an informative error | `qa_dynamic.py` | ✅ PASS |
| BL | **Baseline**: in-scope fragment shrink 12 → 5 leaves **no** stale elements | `qa_regression.py` | ✅ PASS (control) |

> Note: the shrink failure is counted once per container type (captured container, sidebar,
> bottom) but is a single underlying defect (see Bug 1).

---

## Bugs found

### Bug 1 — Shrinking a fragment's element count in an outside container leaves stale elements (HIGH)

**Severity:** High — functional correctness defect that directly violates the spec's
stated testing-plan invariant and the PR's own acceptance criteria. It silently shows
incorrect/outdated content to end users.

**Affected:** All outside container types reached via the implicit wrapper —
captured `st.container()`, `st.sidebar` (direct writes), and `st.bottom`.
**Not affected:** In-scope fragment writes (baseline BL passes), element growth, and
footer/neighbor preservation.

**Expected:** When a fragment that writes to an outside container reruns with **fewer**
elements than the previous run, the removed elements are garbage-collected (as they are
for in-scope fragments). The spec testing plan states shrink "does not leave stale
fragment elements behind."

**Actual:** The first N fresh elements are written/updated, but the previously-written
extra elements **remain visible**. The wrapper's stale children are not pruned on a
fragment rerun.

**Evidence (captured `st.container()`, `qa_core.py`):** after shrinking 12 → 5, the
fragment reports `many_count is 5`, but the container shows:

```
many element 0 of 5    <- fresh
many element 1 of 5    <- fresh
many element 2 of 5    <- fresh
many element 3 of 5    <- fresh
many element 4 of 5    <- fresh
many element 5 of 12   <- STALE (should be removed)
many element 6 of 12   <- STALE
many element 7 of 12   <- STALE
many element 8 of 12   <- STALE
many element 9 of 12   <- STALE
many element 10 of 12  <- STALE
many element 11 of 12  <- STALE
many footer (main)     <- correctly preserved
```

Screenshot: `work-tmp/debug/screenshots/BUG_shrink_stale_elements.png`
(also `core_04_many_after_shrink.png`).

**Evidence (`st.sidebar`, `qa_roots.py`):** after shrinking the direct-sidebar writes
6 → 3, the sidebar shows `sidebar direct 0..2 of 3` (fresh) **plus** `sidebar direct
3..5 of 6` (stale), with `sidebar footer (main)` correctly preserved below.
Screenshot: `work-tmp/debug/screenshots/roots_03_sidebar_shrunk.png`.

**Evidence (`st.bottom`, `qa_roots.py`):** after shrinking 4 → 2, two fresh `of 2`
entries plus two stale `of 4` entries remain. Screenshot:
`work-tmp/debug/screenshots/roots_04_bottom.png`.

**Confirming control (in-scope, `qa_regression.py`):** an in-scope fragment shrinking
12 → 5 inside its **own** `st.container()` leaves **zero** stale elements
(`stale=0`). This isolates the defect to the implicit wrapper path rather than fragment
reruns in general. Screenshot: `work-tmp/debug/screenshots/regression_02_inscope_shrink.png`.

**Reproduction steps:**
1. `make debug work-tmp/debug/qa_core.py`
2. Open the app; scroll to the "many" section (a fragment writing N markdown lines into
   the outside container `many_container`).
3. Click the fragment's **"fewer"** button (reduces the count from 12 to 5).
4. Observe: 5 fresh `... of 5` lines appear, but 7 stale `... of 12` lines remain below
   them (before the main-script footer).

Minimal repro:

```python
import streamlit as st

outside = st.container()
if "n" not in st.session_state:
    st.session_state.n = 8

@st.fragment
def frag():
    if st.button("fewer"):
        st.session_state.n = 3
    with outside:
        for i in range(st.session_state.n):
            st.write(f"row {i} (n={st.session_state.n})")

frag()
```
Click "fewer": rows 3–7 from the previous run remain on screen.

**No backend or frontend exception** is raised — the backend logs confirm the fragment
reruns execute cleanly; the stale nodes simply are not cleared. This points at the
wrapper's stale-child garbage collection on fragment rerun (frontend
`ClearStaleNodeVisitor` traversal into the transparent wrapper block, and/or the
re-emission/scriptRunId stamping of wrapper children in
`_reset_outside_wrappers`) — investigation/fix is out of scope for this QA task.

**Coverage gap:** the existing e2e app `e2e_playwright/st_fragment_basics.py` exercises
interleaving with `uuid4()` content but a **constant element count**, so it does not
catch this shrink case. A variable-count (shrink) assertion should be added to the e2e
coverage.

---

## Warnings / observations (not bugs)

- **Growth and footer preservation work correctly.** In every container type (container,
  sidebar, bottom) growing the fragment's element count does **not** overwrite trailing
  main-script content — the interleaving/overwrite invariant (b) holds. See
  `roots_02_sidebar_grown.png`.
- **`run_every` is solid.** A `run_every=1s` fragment writing to an outside container
  never accumulates (always exactly one tick line across 6 samples), updates its content,
  and keeps header/footer in place.
- **Intentionally-blocked cases produce clear, actionable errors:**
  - `parallel=True` outside write → `StreamlitAPIException: Writing to containers outside
    a parallel fragment is not allowed during the initial page load...`
  - Writing to a never-established outside container on a standalone rerun →
    `StreamlitAPIException: A fragment tried to write to a container created outside the
    fragment, but that container was not written to during the initial run...`
- **Transparent wrapper is visually layout-transparent.** No extra border/padding/gap was
  observed around wrapped content; children render as direct items of the parent
  (see `core_01_initial.png`, `roots_01_initial.png`).
- **Console noise (pre-existing, unrelated):** baseui emits `Support for defaultProps will
  be removed...` React warnings, and transient `Cannot send rerun backMessage when
  disconnected from server` messages appear when a Playwright browser session closes.
  Neither is related to this feature.

---

## Screenshots

All under `work-tmp/debug/screenshots/`:

| File | Shows |
|------|-------|
| `BUG_shrink_stale_elements.png` | **Bug 1** — captured-container shrink leaving stale `... of 12` rows while `many_count is 5` |
| `core_04_many_after_shrink.png` | Bug 1 — full-page view after shrink |
| `roots_03_sidebar_shrunk.png` | **Bug 1** — sidebar shrink 6→3 with stale `direct 3..5 of 6` |
| `roots_04_bottom.png` | **Bug 1** — bottom shrink 4→2 with stale `of 4` rows |
| `regression_02_inscope_shrink.png` | Control — in-scope shrink leaves **no** stale elements |
| `core_01_initial.png` | Core app initial load (elements, widgets, two-fragment, nested, empty, many, form) |
| `core_02_widgets.png` | Widget state persistence after fragment rerun |
| `core_05_form.png` | `st.form` inside an outside container, submitted |
| `core_06_final.png` | Core app end state (no exceptions) |
| `roots_01_initial.png` | Sidebar + bottom initial layout |
| `roots_02_sidebar_grown.png` | Sidebar growth 3→6 with footer preserved |
| `runevery_01_initial.png`, `runevery_02_final.png` | `run_every` outside writes, no accumulation |
| `regression_01_initial.png` | Regression app |
| `regression_03_parallel_error.png` | `parallel=True` outside write exception |
| `dynamic_01_initial.png`, `dynamic_02_error.png` | Dynamic/unestablished-container error |

---

## Test artifacts

Apps (`work-tmp/debug/`): `qa_core.py`, `qa_roots.py`, `qa_runevery.py`,
`qa_regression.py`, `qa_dynamic.py`.
Playwright scripts: `test_qa_core.py`, `test_qa_roots.py`, `test_qa_runevery.py`,
`test_qa_regression.py`, `test_qa_dynamic.py`.

### Per-app Playwright results

- `qa_core` → 29/30 checks pass (the 1 failure is Bug 1, shrink).
- `qa_roots` → 16/18 checks pass (2 failures are Bug 1 on sidebar + bottom shrink).
- `qa_runevery` → 7/7 pass.
- `qa_regression` → 7/7 pass (incl. in-scope shrink control + parallel error).
- `qa_dynamic` → 3/3 pass.

## Recommendation

Address **Bug 1** before merge: stale children of an implicit wrapper must be
garbage-collected when a fragment rerun writes fewer elements than the prior run, matching
in-scope behavior. Add a variable-count (shrink) assertion to the e2e coverage in
`st_fragment_basics`, since the current constant-count tests do not catch this regression.
All other tested behavior matches the spec.
