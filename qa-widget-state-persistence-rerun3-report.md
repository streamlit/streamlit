# QA Report: `persist_state` widget-state persistence (final regression pass)

## Summary
- **Date:** 2026-06-25
- **Branch:** `cursor/widget-persistence-qa-rerun-3e1a`
- **Base:** `develop`
- **Feature:** `persist_state=None|"page"|"session"` — server-side widget-state
  persistence with no URL involvement, composing with the existing
  `bind="query-params"` parameter.
- **Context:** Final QA after a no-behavior-change backend refactor consolidating
  bookkeeping into `PersistedWidgetTracker`
  (`lib/streamlit/runtime/state/session_state.py`), splitting `register` from
  `take_pending_drop`, and tidying the bound-vs-page drop logic.
- **Total tests:** 15
- **Passed:** 15
- **Failed:** 0
- **Blocked:** 0

## Overall status

**PASS** — The refactor introduced no observable regressions. All spec requirements,
all four previously-fixed defects (BUG-1/2/3, Issue #1), and the bind/persist
composition all behave correctly when asserted against the **rendered widget UI
value** (not just the `st.session_state` readout). No backend exceptions or
feature-related frontend errors were observed.

## Test environment
- Driver: standalone Playwright (Chromium, headless) against the live `make debug`
  server at `http://localhost:3001` (backend `:8501`). E2E pytest under
  `e2e_playwright/` was intentionally not used (blocked by policy).
- Test app: `work-tmp/qa-widget-persistence-qa-rerun-3e1a/test_app.py` — an MPA built
  with `st.navigation`/`st.Page` (Page A + Page B). Uses `st.text_input` widgets so
  the rendered value is directly readable from the DOM (`input.value`); each keyed
  widget exposes a `.st-key-<key>` class. `st.session_state` readouts are rendered
  alongside for cross-checking.
- Debug session dir: `work-tmp/debug/20260625-183518-test_app.py-29140/`

## Test results

### Passed tests
| ID | Scenario | Notes |
|----|----------|-------|
| F8 | `persist_state` without `key=` raises | `StreamlitAPIException` raised |
| F9 | Invalid `persist_state` value raises | `StreamlitInvalidPersistStateError` raised |
| F1 | `persist_state="session"` same-page hide/show | UI value preserved (`SESSION_A`) |
| F2 | `persist_state="page"` same-page hide/show | UI value preserved (`PAGE_A`) |
| F3 | `persist_state=None` same-page hide/show | UI value reset to default (`""`) |
| F4 | `persist_state="session"` across A→B | UI value present on Page B |
| F5 | `persist_state="page"` across A→B→A (rendered on both) | UI value dropped (default) |
| F6 | `bind="query-params"` + `persist_state="page"` across A→B→A | UI value preserved (`BOUND_VAL`); URL param retained |
| F7 | Programmatic set composes with persisted widget | UI value `PROG_VALUE` |
| E2-session | session sibling preserved in Issue #1 flow | UI value preserved (`SOLO_SESSION`) |
| E2-plain | non-persisted sibling dropped in Issue #1 flow | UI value default (`""`) |
| BUG-1 | remount shows value AND follow-up rerun doesn't reset | preserved across remount + rerun |
| BUG-2 | `persist_state="session"` survives A→B→A | UI value `SESSION_MPA` on re-render |
| BUG-3 | programmatic pre-mount set adopted on first mount | UI value `PROG_VALUE` |
| Issue #1 | `persist_state="page"` (Page-A-only) dropped after A→B→A | UI value default (`""`) |

### Failed tests
None.

### Blocked tests
None.

## Regression scenarios (UI-value-asserted)

Each verdict below is based on reading the **actual rendered widget value** via
Playwright (`input.value`), with the `st.session_state` readout used only as a
secondary cross-check.

| Defect | Prior severity | Verdict | Evidence |
|--------|----------------|---------|----------|
| **BUG-1** | Blocker | **PASS** | After same-page hide→show, `session_text` input = `SESSION_A` and `page_text` input = `PAGE_A`; after a further "Rerun", both still `SESSION_A`/`PAGE_A` (no reset to default). Screenshot: `same_page_hideshow.png`. |
| **BUG-2** | High | **PASS** | `persist_state="session"` `session_text` set to `SESSION_MPA` on Page A; after A→B→A the re-rendered widget input = `SESSION_MPA`. Screenshot: `session_mpa_back_on_A.png`. |
| **BUG-3** | Medium | **PASS** | `st.session_state["prog_text"]="PROG_VALUE"` set while the widget was unrendered; on first mount the widget input = `PROG_VALUE` (readout also `PROG_VALUE` before and after mount). Screenshot: `programmatic_first_mount.png`. |
| **Issue #1** | Medium-high | **PASS** | `persist_state="page"` `solo_page_text` (rendered on Page A only) set to `SOLO_PAGE`; after A→B→A (Page B omits it) the re-rendered widget input = `""` (default) and the readout shows the default. In the same flow the `persist_state="session"` sibling input = `SOLO_SESSION` (preserved) and the non-persisted sibling input = `""` (dropped). Screenshot: `issue1_back_on_A.png`. |

## Spec requirement coverage

| Spec requirement | Covered by | Result |
|------------------|-----------|--------|
| 1. `persist_state` requires explicit `key=`; invalid values raise | F8, F9 | PASS |
| 2. `"session"` preserves when hidden AND across page switches | F1, F4, BUG-2 | PASS |
| 3. `"page"` preserves when hidden same-page, dropped on page switch (incl. destination not rendering it) | F2, F5, Issue #1 | PASS |
| 4. `None` (default) loses value when not rendered | F3, E2-plain | PASS |
| 5. `bind="query-params"` + `persist_state` compose (OR logic) | F6 | PASS |
| 6. Programmatic `st.session_state[key]=value` works with persisted widgets | BUG-3, F7 | PASS |

## Issues found

**No new issues found.**

### Non-issues / observations (benign)
- Frontend `console.error: "Cannot send rerun backMessage when disconnected from
  server."` lines appear in `frontend.log`. These are produced by the QA driver's
  own `page.goto()` full reloads between scenarios (each reload starts a fresh
  Streamlit session and disconnects the previous one). Not related to `persist_state`.
- `Warning: StatefulPopover/Popover: Support for defaultProps will be removed...` —
  pre-existing BaseWeb (third-party) React deprecation warnings, unrelated to this
  feature.
- No backend exceptions/tracebacks were logged during the entire run
  (`backend.log` clean).

## Recommendations
- None required for merge from a behavioral standpoint; the refactor is a clean
  no-regression change for the scenarios exercised here.
- (Optional, not a blocker) The bound widget (`bind="query-params"` +
  `persist_state="page"`) correctly keeps its URL query param across the page switch
  (`?bound_page_text=BOUND_VAL`). If product intends `persist_state`-only widgets to
  *never* touch the URL, that is already the case (only the `bind` widget mutates the
  URL); confirmed no `persist_state`-only key appeared in the query string.

## Notes / ambiguities
- The spec leaves open whether bound + persisted query params should be retained when
  not rendered / across pages (an "Open questions" item). This QA treats the observed
  behavior (param retained for the bound widget rendered on both pages) as acceptable;
  flagging it here rather than blocking.
- All assertions used `st.text_input` for easy DOM value reading. Other widget types
  (`checkbox`, `selectbox`, `slider`, `radio`, etc.) thread `persist_state` through the
  same shared `register_widget` path and are covered by unit tests in the branch; this
  QA pass did not separately exercise each widget type's UI, focusing instead on the
  state-persistence logic that the refactor touched.

## Artifacts (in `work-tmp/qa-widget-persistence-qa-rerun-3e1a/`)
- `test-plan.md` — QA test plan
- `test_app.py` — MPA Streamlit test app
- `qa_test.py` — Playwright QA driver
- `qa-report.md` — this report
- Screenshots: `initial_load.png`, `same_page_hideshow.png`,
  `session_mpa_back_on_A.png`, `bound_compose_back_on_A.png`, `issue1_back_on_A.png`,
  `programmatic_first_mount.png`
