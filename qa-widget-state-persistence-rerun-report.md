# QA report — widget state persistence (`persist_state`) — RERUN

- **Feature:** `persist_state=None|"page"|"session"` on widgets (PR #15645) + remount/restore
  fix (PR #15660 "Restore persisted widget value to the frontend on remount").
- **Branch under test:** `cursor/widget-state-persistence-e211`
- **Date:** 2026-06-22
- **Method:** Full-stack Playwright against a live `make debug` server (Streamlit 1.58.0,
  Chromium), plus `AppTest` backend cross-checks for the MPA flow and validation errors.
- **Artifacts:** `work-tmp/qa-widget-state-persistence-e211-rerun/`
  (`test_app.py`, `pages/`, `qa_test.py`, `smoke_test.py`, `mpa_test.py`, `screenshots/`).

## Summary

| Metric | Count |
|--------|-------|
| Total scenarios | 11 |
| Passed | 10 |
| Failed | 1 |
| Blocked | 0 |

**Overall status: FAIL** — the three previously-failing regression scenarios (BUG-1,
BUG-2, BUG-3) are all **confirmed fixed**, and the core feature works well. However, QA
found **one new genuine bug**: `persist_state="page"` does **not** drop its value on a page
switch when the destination page does not render the widget (it leaks across pages, behaving
like `"session"`). This is a spec violation, so the overall verdict is FAIL pending a fix.

## Regression scenarios (explicit verdict)

| Bug | Prior severity | Verdict | Evidence |
|-----|----------------|---------|----------|
| **BUG-1** — same-page hide→show restores value; follow-up rerun does NOT reset it | blocker | ✅ **FIXED** | `BUG1_remount_restore_not_clobbered` PASS. Slider set to 5/7, hidden, re-shown → thumb shows 5/7; extra Rerun keeps 5/7. |
| **BUG-2** — `persist_state="session"` survives MPA A→B→A on the re-rendered widget | high | ✅ **FIXED** | `BUG2_session_survives_page_switch` PASS. Session selectbox set to "B", A→B→A, re-shown widget shows "B". |
| **BUG-3** — programmatic `st.session_state[key]=value` before a persisted widget mounts is applied on first mount | medium | ✅ **FIXED** | `BUG3_programmatic_set_before_mount` PASS. "Prefill" sets 42 while widget hidden; on mount the number_input shows 42. Backend `AppTest` also returns 42. |

## Detailed results

| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| F6 | `persist_state` requires `key=`; invalid value rejected | PASS | No-key → `StreamlitAPIException`; `persist_state="forever"` → `StreamlitInvalidPersistStateError`. Messages are clear and actionable. |
| SETUP | Set slider/selectbox/text/checkbox/number values | PASS | Baseline interactions register correctly. |
| F1/F3/F5 | hide via checkbox: session preserved, page preserved (same page), default lost | PASS | After hide+rerun: `f1_slider=5` (session), `f3_slider=7` (page), `f5_slider=UNSET` (default). |
| I1 / BUG-1 | show again → rendered widget restores value; extra rerun keeps it | PASS | See BUG-1 above. |
| E1 | session persistence across slider/selectbox/multiselect/text_input/checkbox/number_input | PASS | All types retained their values through the hide/show cycle. |
| E2 | `persist_state="session"` + `bind="query-params"` together | PASS | Value reflected in URL (`?e2_text=boundval`) when shown AND preserved when hidden (OR logic). |
| F7 / BUG-3 | programmatic set before persisted widget mounts | PASS | See BUG-3 above. |
| F2 / MPA setup | set session+page selectboxes on Page A | PASS | Values registered. |
| F2 / BUG-2 | `persist_state="session"` survives A→B→A | PASS | See BUG-2 above. |
| **F4** | `persist_state="page"` value LOST across page switch (A→B→A) | **FAIL** | Page-scoped value **leaks**: stays "C" instead of being dropped. See Issue #1. |
| — | `persist_state` adds no query params (page/session are server-side only) | PASS | No `f1_slider`/`f3_slider` params appear in the URL. |

## Issues found

### Issue #1 (NEW) — `persist_state="page"` leaks across a page switch when the destination page does not render the widget

- **Severity:** Medium-High (clear spec violation; edge of the page-scope semantics).
- **Spec rule violated:** *"`persist_state="page"` does NOT preserve widget value across
  page switches"* / *"persist if not rendered, but delete on page switch."*

**Steps to reproduce (live app):**
1. App with `st.navigation`; **Page A** renders a selectbox
   `key="a_page_select", persist_state="page"`. **Page B** does **not** render it.
2. On Page A, set `a_page_select = "C"`.
3. Navigate Page A → Page B → Page A.
4. Observe `st.session_state["a_page_select"]` and the re-rendered widget.

**Expected:** The page-scoped value is deleted on the page switch; on return to Page A the
widget renders its default ("A").

**Actual:** The value remains "C" — both in `st.session_state` (observed on Page B and on
return to Page A *before* the widget is even re-rendered) and on the re-rendered widget.

**Isolating evidence (single fresh browser session):**
```
on A set:  a_session_select: B | a_page_select: C | plain a_plain_select: C
on B diag: a_session_select: B | a_page_select: C
back on A (before reshow): a_session_select: B | a_page_select: C | plain a_plain_select: UNSET
re-shown widget values: session= B  page= C
```
- The **baseline** non-persisted widget (`a_plain_select`) is correctly dropped (`UNSET`).
- The **session**-scoped widget is correctly preserved (`B`).
- The **page**-scoped widget is incorrectly preserved (`C`) — it should be `UNSET`.

**Root-cause analysis (likely):**
- The pure-backend `AppTest` for the same flow **correctly drops** the page-scoped value
  (`mpa_test.py` → "on B: page= GONE"; after re-show → default "A"). So the backend
  stale-cleanup logic itself is sound.
- The discrepancy only appears in the **full stack**: because Page B never renders the
  widget, the backend never sends a "reset to default" instruction to the frontend (the
  `dropped_page_scoped_value` path in `SessionState.register_widget` only fires when the
  widget **re-registers** on a different page). The frontend therefore keeps the cached
  value "C" and re-sends it on every subsequent rerun (including the Page A rerun), which
  re-injects it into `_new_widget_state` and effectively resurrects it.
- This is the same class of frontend-cache-clobbering that BUG-1 addressed for the
  same-page remount case, but for the "intermediate page lacks the widget" MPA path it is
  not handled.
- The existing e2e test (`e2e_playwright/widget_state_persistence_test.py::test_page_scoped_value_does_not_leak_across_pages`)
  does **not** catch this because both of its pages render the page-scoped widget, so the
  re-registration-on-a-different-page drop path fires and resets the frontend.

- **Screenshot:** `screenshots/FAIL_F4_page_scoped_lost_across_pages.png`

## What works well

- All three prior regressions (BUG-1/2/3) are fixed and stable across repeated runs.
- `persist_state="session"` is robust: survives same-page hide/show and MPA page switches
  across many widget types (slider, selectbox, multiselect, text_input, checkbox,
  number_input).
- `persist_state="page"` works correctly for the **same-page** hide/show case and for the
  common MPA case where the widget is rendered on both pages.
- Validation is solid and user-friendly: missing `key` and invalid values raise clear,
  actionable exceptions.
- `persist_state` is correctly server-side only (no query-param pollution), and composes
  with `bind="query-params"` (OR logic for preservation).

## Recommendations

1. **Fix Issue #1:** Ensure a `persist_state="page"` value is dropped on a page switch even
   when the destination page does not render the widget. Options to consider:
   - When the backend drops a page-scoped value during stale-widget cleanup (page hash
     mismatch), also instruct the frontend to clear that widget's cached state (send a
     reset for the widget id), so it is not re-sent on later reruns.
   - Alternatively, when a page-scoped widget remounts and the backend has no live record
     of an owned value for the current page, treat any frontend-supplied value as stale and
     fall back to default.
2. **Add e2e coverage** for the "widget exists on one page only, navigate away to a page
   that doesn't render it, then back" scenario, plus a baseline (non-persisted) and
   `"session"` control in the same flow (this report's `debug_mpa.py` is a ready template).
3. Re-run this QA suite (`qa_test.py`) after the fix; expect 11/11 PASS.
