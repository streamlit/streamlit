# QA Report — Outside Container Writes for Fragments (re-run after merge-conflict resolution)

- **Feature / PR:** Outside container writes for `@st.fragment` (PR #15623, final PR in the 5-PR stack)
- **Branch under test:** `cursor/outside-container-writes-enabled-07e6`
- **Tech spec:** `specs/2026-06-03-outside-container-writes/tech-spec.md` (fetched from `origin/cursor/outside-writes-spec-to-develop`)
- **Date:** 2026-06-22
- **Method:** Hand-written Streamlit test apps run with `make debug` + headless Chromium Playwright scripts that interact with widgets and assert DOM content, ordering, element counts, and the absence of exception banners. Backend and frontend logs scanned for errors after each scenario.

## Summary

**Overall result: PASS. High confidence.**

This was a broad regression sweep specifically targeting the areas overlapped by the
`develop` cursor-API refactor (`get_locked_cursor()` → `open_block()`/`lock_element()`) and
its hand-resolved merge into the outside-writes stack: `_enqueue`/`_block` redirection, the
wrapper creation/reset lifecycle, and `RunningCursor.reset()`.

- **9 distinct test apps**, **10 Playwright verification runs**, **~70 individual
  assertions** across **20 distinct scenarios**. All assertions pass.
- The two critical invariants the merge could have broken — **cursor accumulation** (delta
  paths exceeding the frontend tree, "Bad delta path index" crashes) and
  **interleaving/overwrite** (a fragment's variable element count clobbering trailing
  neighbors) — both behave correctly in every container type (captured `st.container()`,
  `st.sidebar`, `st.bottom`, `st.empty()`).
- No `Bad delta path` errors, tracebacks, or unexpected `StreamlitAPIException`s appeared in
  any backend or frontend log during the sweep.
- The intentional guardrails (parallel outside writes blocked; writing to a never-established
  outside container on a standalone rerun) still raise their informative errors.

No code was modified (QA-only task). One issue found during testing was a **mistake in an
initial test app**, not a product bug — see [Warnings](#warnings).

## Test matrix

| # | Scenario | App | Result |
|---|----------|-----|--------|
| 1 | Fragment writes `st.write` / `st.metric` / `st.dataframe` to outside `st.container()`; footer preserved; no stale on rerun | `qa_core.py` | PASS |
| 2 | Fragment writes widgets (button/text/select/slider/checkbox) to outside container; **widget state persists** across fragment reruns | `qa_core.py` | PASS |
| 3 | **Two fragments** write to the same outside container; each updates independently, footer/middle stable | `qa_core.py` | PASS |
| 4 | Fragment writes to `st.sidebar` via `with st.sidebar:` **and** directly via `st.sidebar.…` | `qa_roots.py` | PASS |
| 5 | Sidebar widget / rerun triggers **fragment-only** rerun (main marker unchanged) | `qa_roots.py` | PASS |
| 6 | Fragment writes to `st.bottom`; updates in place, no stale | `qa_roots.py` | PASS |
| 7 | Captured container **grow (3→5)** without overwriting footer; **shrink (5→2)** with no stale rows; repeated grow/shrink cycles do not accumulate | `qa_lifecycle.py` | PASS |
| 8 | `st.sidebar` grow/shrink with header+footer interleaving | `qa_lifecycle.py` | PASS |
| 9 | `st.bottom` grow/shrink | `qa_lifecycle.py` | PASS |
| 10 | In-scope control: fragment shrinking inside its **own** container leaves zero stale elements | `qa_lifecycle.py` | PASS |
| 11 | Conditional write via `outside.empty()` placeholder claimed every run (documented pattern) | `qa_edge.py` | PASS |
| 12 | Nested containers: fragment writes to **columns inside** an outside container | `qa_edge.py` | PASS |
| 13 | `st.empty()` as outside container — **replace semantics** (exactly one element) | `qa_edge.py` | PASS |
| 14 | Fragment writes **many (12)** elements to an outside container; no duplication on rerun | `qa_edge.py` | PASS |
| 15 | `st.form` with widgets inside an outside container; submission works | `qa_edge.py` | PASS |
| 16 | `@st.fragment(run_every=1s)` writing to outside container — periodic reruns update in place, **no accumulation** | `qa_runevery.py` | PASS |
| 17 | Normal fragment behavior (in-scope writes); fragment-only vs full-app rerun counters | `qa_regression.py` | PASS |
| 18 | `parallel=True` + outside write → **blocked with informative error** | `qa_parallel.py` | PASS |
| 19 | Write to a never-established outside container on standalone rerun → **informative `StreamlitAPIException`** | `qa_never_established.py` | PASS |
| 20 | Registry eviction lifecycle: parent fragment recreates the container; child reruns reuse/rebuild wrapper cleanly | `qa_nested_fragments.py` | PASS |

Main-script ↔ fragment interleaving ordering stability is covered transversally by scenarios
1, 3, 7, 8, and 20 (every container under test carries a main-script header and footer around
the fragment's writes, and ordering was asserted before/after each interaction).

## Detailed observations

### Cursor-accumulation invariant (the primary merge risk)
The captured-container, sidebar, bottom, and `st.empty()` scenarios were each driven through
multiple standalone fragment reruns (and, for `run_every`, ~5 automatic ticks). In every case
the fragment's content was redrawn in place with a single copy — e.g. `run_every` showed
exactly one `auto tick #N` line and one timestamp after advancing from tick #2 → #6, with no
leftover prior ticks. This confirms `RunningCursor.reset()` and `_reset_outside_wrappers()`
re-zero the wrapper cursor correctly after the cursor-API refactor.

### Interleaving / overwrite invariant
Growth (3→5) never pushed over or replaced the trailing main-script footer (asserted via
substring index ordering: last fragment row index < footer index), and shrink (5→2) left no
stale rows (asserted rows ≥ 2 absent). Verified for captured container, sidebar, and bottom.

### Widget behavior
Widgets rendered into outside containers (and into the sidebar) trigger the **writing
fragment's** rerun, not a full app rerun — confirmed by a main-script run counter that stayed
fixed while the fragment's counter advanced. Widget values (text input) persisted across
fragment reruns.

### Guardrails
- Parallel worker writing outside its scope raises:
  `StreamlitAPIException: Writing to containers outside a parallel fragment is not allowed during the initial page load…`
- First-ever write to an outside container on a standalone fragment rerun raises:
  `StreamlitAPIException: A fragment tried to write to a container created outside the fragment, but that container was not written to during the initial run, so Streamlit could not reserve a stable position for it.`

## Bugs found

**None.** No product defects were observed. No `Bad delta path index …` crash (the original
symptom the feature fixes) occurred in any scenario, including the repeated grow/shrink cycles
and the parent/child fragment recreation lifecycle that stress the wrapper registry most.

## Warnings

1. **Test-app authoring pitfall (not a product bug).** My first version of the conditional
   `st.empty()` test created the `st.empty()` placeholder in the *main script* and had the
   fragment write into it only when a button was clicked. On the first click (a standalone
   fragment rerun) this correctly raised the "container was not written to during the initial
   run" `StreamlitAPIException`, because the fragment never claimed the slot during the full
   run. This is the **documented behavior** (tech spec, "Dynamic container selection"), and
   the fix was to follow the recommended pattern — claim the slot via `outside.empty()`
   *inside the fragment on every run*, then conditionally fill it. Worth flagging because it
   is an easy mistake for end users; the error message is informative and points at the right
   remedy.

2. **Pre-existing frontend console warnings (unrelated).** `baseui` emits
   `Support for defaultProps will be removed…` deprecation warnings, and a
   `Cannot send rerun backMessage when disconnected from server` log appears when the
   Playwright browser closes at end of test. Neither is related to this feature and both
   appear on unrelated components (tooltips, popovers, data-frame menus).

## Screenshots

All screenshots are in `qa-outside-writes-rerun-screenshots/` (also at
`work-tmp/debug/screenshots/`).

| Scenario | Files |
|----------|-------|
| Core: elements / widgets / two-fragment shared container | `core_01_initial.png`, `core_02_elements_rerun.png`, `core_03_widgets.png`, `core_04_shared.png` |
| Roots: sidebar (with-block + direct), bottom | `roots_01_initial.png`, `roots_02_sidebar_rerun.png`, `roots_03_bottom.png` |
| Lifecycle: grow/shrink for container, sidebar, in-scope | `life_01_initial.png`, `life_02_cont_shrink.png`, `life_03_sidebar.png`, `life_04_inscope.png` |
| Edge: nested columns, form, placeholder | `edge_01_initial.png`, `edge_02_nested.png`, `edge_03_form.png` |
| run_every periodic updates | `runevery_01.png`, `runevery_02.png` |
| Regression: normal fragment | `regression_01.png`, `regression_02.png` |
| Nested-fragment registry eviction | `nested_01.png`, `nested_02.png` |
| Guardrail errors | `err_parallel.png`, `err_never.png` |

## Reproduction

Test apps live in `work-tmp/debug/qa_*.py`; Playwright drivers in `work-tmp/debug/pw_qa_*.py`.
For each app:

```bash
make debug work-tmp/debug/<app>.py
STREAMLIT_APP_URL=http://localhost:3001 PYTHONPATH=. uv run python work-tmp/debug/pw_<driver>.py
```

The two error apps use a mode argument: `pw_qa_errors.py parallel` and
`pw_qa_errors.py never`.
