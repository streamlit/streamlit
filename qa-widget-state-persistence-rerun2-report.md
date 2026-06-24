# QA Report: `persist_state` widget state persistence

## Summary

- **Date:** 2026-06-24
- **Branch:** `cursor/widget-state-persistence-qa-rerun-0fe1` (detached at `a6da820887`),
  based on `cursor/widget-state-persistence-e211` (PR #15645)
- **Feature:** `persist_state=None|"page"|"session"` — server-side widget state
  persistence; composes with the pre-existing `bind="query-params"`.
- **Total tests:** 12
- **Passed:** 12
- **Failed:** 0
- **Blocked:** 0

## Overall status

**PASS** — All spec requirements and all four regression scenarios pass. The widget UI
value (the actual rendered `<input>`/number value read from the DOM) was asserted for every
restore/drop scenario, not just the `st.session_state` readout. No new issues were found.
Debug backend/frontend logs were clean of feature-related errors.

## Test environment

- Set up from scratch on the VM: installed `uv`, Node 24 (via nvm, `.nvmrc` requires v24),
  `protobuf-compiler` (3.21.12 ≥ MIN 3.20), Python dev deps (`uv sync --group dev`),
  frontend deps (`yarn install`), generated protobufs (`make protobuf`), and Playwright
  Chromium.
- Debug server: `make debug work-tmp/qa-widget-state-persistence-e211/test_app.py`
  - App URL: `http://localhost:3001` (backend on `:8501`)
  - Session dir: `work-tmp/debug/20260624-105225-test_app.py-14754/`
- Browser tests use a **fresh browser context per scenario**, so each scenario runs in an
  isolated Streamlit session (no cross-test state leakage).

## Test results

### Passed tests
| ID | Scenario | Notes |
|----|----------|-------|
| F1 | `persist_state` without `key` raises | `StreamlitAPIException`: "When using persist_state, the widget must have a unique 'key' …" |
| F2 | Invalid `persist_state` value raises | `StreamlitInvalidPersistStateError`: 'Invalid `persist_state` value: "bogus". Supported values are: `"page"`, `"session"`, or `None`.' |
| E2 | Default (no `persist_state`) needs no key | No exception; widget renders normally |
| F5 | Non-persisted value dropped when not rendered | `plain_text` → `UNSET`; `page_text`/`session_text` preserved in same flow |
| F7 | `persist_state="page"` dropped across page switch (destination renders widget) | Widget UI shows `""` on Page 2 and again on return to Page 1 |
| F8 | `bind="query-params"` + `persist_state` compose | URL gains `bind_value`; value preserved across hide/show via session scope |
| E3 | `persist_state` adds no query params | `page_text`/`session_text` absent from URL query string |
| F10 | `number_input`/`slider` support `persist_state` | `number_input` (session) restores `42` after hide/show; `slider` renders without error |

### Failed tests
None.

### Blocked tests
None.

## Regression scenarios

Each verdict below asserts the **rendered widget UI value** (DOM `<input>`/number value),
in addition to the `st.session_state` readout where relevant.

| ID | Was | Verdict | Evidence |
|----|-----|---------|----------|
| **BUG-1** | blocker | **PASS** | Same-page hide→show: `Page-scoped` input re-shows `page_value` and `Session-scoped` re-shows `session_value` on remount; a follow-up **Rerun** does NOT reset either to default. Screenshot: `BUG-1_pass.png` |
| **BUG-2** | high | **PASS** | `persist_state="session"` survives MPA A→B→A; the re-rendered `Session-scoped` input shows `session_value`. Screenshot: `BUG-2_pass.png` |
| **BUG-3** | medium | **PASS** | `st.session_state["prog_text"]="seeded_value"` set in a button callback before the persisted widget's first mount; on mount the `Prog widget` input shows `seeded_value` (readout `prog_text:seeded_value`). Screenshot: `BUG-3_pass.png` |
| **Issue #1** | medium-high | **PASS** | `persist_state="page"` widget rendered on Page 1 only (Page 2 omits it). After A→B→A, `Solo page` input shows `""` and `p1_page_text` session readout no longer contains `page_value` (value DROPPED). In the same flow, `Solo session` (session) is preserved (`session_value`) and `Solo plain` (non-persisted) is dropped (`""`). Screenshot: `Issue-1_pass.png` |

### Detail: BUG-1 (same-page hide → show)
- **Steps:** show widgets → set `Page-scoped=page_value`, `Session-scoped=session_value` →
  hide (uncheck) → show (check) → assert input values → click Rerun → re-assert.
- **Expected:** both inputs render preserved values on remount; rerun keeps them.
- **Actual:** matches expected. ✅

### Detail: BUG-2 (session survives page switch)
- **Steps:** show → set `Session-scoped=session_value` → nav Page 2 → nav Page 1 → assert input.
- **Expected/Actual:** input shows `session_value` on return. ✅

### Detail: BUG-3 (programmatic set before first mount)
- **Steps:** click "Seed prog value" (callback sets `st.session_state["prog_text"]` and shows
  the widget) → assert widget input + readout.
- **Expected/Actual:** widget mounts showing `seeded_value`. ✅

### Detail: Issue #1 (page scope dropped when destination omits widget)
- **Steps:** show → set Solo page/session/plain → nav Page 2 (does not render solo widgets;
  count asserted = 0) → nav Page 1 → assert.
- **Expected:** page-scoped dropped (UI + session_state default), session-scoped preserved,
  non-persisted dropped.
- **Actual:** matches expected — the earlier leak (page-scoped persisting like "session") is
  fixed. ✅

## Issues found

None. This was a confirmation run after the fixes from PR #15660 and the on-branch
page-scope-drop fix; all previously reported bugs are confirmed resolved and no new issues
surfaced.

## Recommendations

- The feature is behaving correctly across all spec requirements and regression scenarios;
  no code changes recommended from this QA pass.
- Existing E2E coverage in `e2e_playwright/widget_state_persistence_test.py` already mirrors
  these scenarios (including the Issue #1 case). No coverage gaps identified for the tested
  widgets (`text_input`, `number_input`, `slider`).
- Optional (out of scope for this run): extend explicit MPA + UI-restore E2E assertions to a
  couple more widget families (e.g. `selectbox`, `multiselect`) for breadth, since the
  preservation logic is shared but value-restoration deserialization differs per widget.

## Notes

- **Validation checks (F1/F2/E2)** were exercised via `streamlit.testing.v1.AppTest` because
  they raise at widget-registration time (before any browser render). The intentional
  `StreamlitInvalidPersistStateError` traceback in the runner output is the expected F2
  behavior, not a failure.
- **Log review:** The debug backend log contained only a benign `server.enableCORS=false`
  config warning. The frontend log showed only pre-existing third-party deprecation warnings
  (baseui `StatefulPopover`/`Popover` `defaultProps`) and "Cannot send rerun backMessage when
  disconnected from server" messages. The latter are artifacts of the QA harness closing each
  browser context between scenarios (the page briefly tries to rerun while disconnecting) and
  are unrelated to `persist_state`.
- **Files produced** (in `work-tmp/qa-widget-state-persistence-e211/`):
  `test-plan.md`, `test_app.py`, `qa_test.py`, `qa-report.md`, `results.json`,
  `debug_startup.log`, and screenshots `*_pass.png` for each browser scenario.
