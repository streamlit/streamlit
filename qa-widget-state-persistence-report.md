# QA Report: `persist_state` widget state persistence

**Feature**: `persist_state=None|"page"|"session"` widget parameter (PR #15645)
**Branch**: `cursor/widget-state-persistence-e211`
**Spec**: `specs/2026-01-06-query-param-binding-state-persistence/product-spec.md`
**Date**: 2026-06-19
**Method**: Playwright against a live `make debug` server (multi-page `st.navigation`
app), asserting both `st.session_state` readouts and rendered widget UI values.

## Summary

| Metric | Count |
|--------|-------|
| Total scenarios | 7 |
| Passed | 4 |
| Failed | 3 |
| Blocked | 0 |

**Overall status: FAIL** — The core promise of the feature ("hide a widget, show
it again, get your value back") does not work for plain `persist_state`. The
value is preserved in `st.session_state` *while the widget is unmounted*, but it
is **not restored to the widget when it remounts**: the widget reappears with its
default value, and the next rerun overwrites the preserved value with that
default. This breaks `persist_state="session"` across page switches and the
programmatic-set scenario. Same-page "preserved while hidden" and the
`bind="query-params"` path both work.

## Result detail

| ID | Scenario | Result | Notes |
|----|----------|--------|-------|
| F6 | `persist_state` without `key=` raises | **PASS** | `StreamlitAPIException` shown, mentions `persist_state` + `key`. |
| F5 | Default (no `persist_state`) loses value when hidden | **PASS** | `default_slider` → `UNSET` after hide. |
| F1/F3/E1 | Value preserved in `st.session_state` while widget hidden (session + page scope, multiple widget types) | **PASS** | slider, selectbox, multiselect, text, checkbox, number all retained while unmounted. |
| I1 | Change → hide → **show again** → value restored to widget | **FAIL** | BUG‑1. On re-show the slider UI shows `0` while state still says `5`; a rerun then resets state to `0`. |
| E2 | `persist_state` + `bind="query-params"` | **PASS** | URL param present while shown; value preserved (OR logic) while hidden; bound widget also restores on re-show. |
| F2/F4 | MPA: session persists across page switch / page scope resets | **FAIL** | BUG‑2. After A→B→A the session selectbox resets to default `one` instead of `two` (consequence of BUG‑1). |
| F7 | Programmatic `st.session_state[key]=…` with persisted widget | **FAIL** | BUG‑1 variant. Value is in `session_state` but the remounted widget renders empty, then a rerun clears `session_state`. |

(IDs E3/E4/I2 from the test plan are exercised inside the scenarios above:
E3 = shared key text in F2/F4; E4 = repeated cycles reproduce BUG‑1; I2 = the
A→B→A leg of F2/F4.)

## Issues found

### BUG‑1 (Blocker): Preserved `persist_state` value is not restored to the widget on remount

- **Severity**: High / blocker — defeats the primary purpose of the feature.
- **Scope affected**: plain `persist_state="page"` and `persist_state="session"`
  (same-page re-show **and** cross-page return). `bind="query-params"` is **not**
  affected.
- **Steps to reproduce** (single page, `persist_state="session"` slider):
  1. Render the widget, set the slider to `5`.
  2. Hide the widget (e.g. `if False:`) and rerun. `st.session_state["session_slider"]`
     correctly reports `5`.
  3. Show the widget again.
  4. **Observed**: the slider renders at `0` (default) while `st.session_state`
     still reports `5` — a backend/frontend desync. On the next rerun the
     frontend's `0` is written back and `st.session_state` becomes `0`,
     permanently losing the preserved value.
  5. **Expected**: the remounted widget shows `5` and `st.session_state` stays `5`.
- **Evidence**: `screenshots/I1.png` — slider thumb at `0`, readout `session_slider: 5`.
- **Likely root cause** (`lib/streamlit/runtime/state/session_state.py`,
  `register_widget`): the code sets `widget_value_changed=True` to push the
  resolved value to the frontend only for restored **bound** values
  (`restored_bound_value`). There is no equivalent path for restored
  `persist_state` values, so on remount the backend keeps the preserved value but
  never tells the frontend to use it. The frontend mounts at the element default
  and then reports it back, clobbering the preserved value. This is corroborated
  by the E2 contrast: a widget with `bind="query-params"` **does** restore its
  value (and URL param) on re-show, while a pure `persist_state` widget does not.

### BUG‑2 (High): `persist_state="session"` not preserved across MPA page switches

- **Severity**: High — a primary spec requirement
  ("`persist_state="session"` preserves widget value across MPA page switches").
- **Steps to reproduce**:
  1. On Page A set a `persist_state="session"` selectbox to `two`.
  2. Navigate to Page B, then back to Page A.
  3. **Observed**: the selectbox is back to its default `one`.
  4. **Expected**: `two`.
- **Evidence**: `screenshots/F2_F4.png`.
- **Relationship**: This is a direct consequence of BUG‑1 — the widget remounts
  on return to Page A and is not seeded with the preserved value. Fixing BUG‑1 is
  expected to fix this. Note: `persist_state="page"` resetting after a page switch
  could not be independently confirmed as *correct* deletion, because BUG‑1 makes
  every remounted widget reset to default regardless of scope.

### BUG‑3 (Medium): Programmatic value not applied to a remounted persisted widget

- **Severity**: Medium.
- **Steps to reproduce**:
  1. On a run, set `st.session_state["prog_text"] = "programmatic_value"`
     (widget not yet rendered). The readout confirms the value is in state.
  2. Render the `persist_state="session"` text input with that key.
  3. **Observed**: the text input renders empty; a subsequent rerun then clears
     `st.session_state["prog_text"]` as well.
  4. **Expected**: the widget initializes to `programmatic_value` (normal
     Streamlit behavior for setting `session_state` before widget creation).
- **Evidence**: `screenshots/F7.png`.
- **Relationship**: same frontend-seeding gap as BUG‑1 (the resolved value is not
  pushed to the frontend on first mount when the value lives in old state rather
  than the current run's `_new_session_state`).

### Observation (Low): stale readout via lingering key→id mapping

When a persisted widget is unmounted and the user visits another page that does
not render it, `st.session_state[key]` continues to report the old value (read
through the still-present user-key → stale-widget-id mapping) for several reruns.
This is a state-cleanliness/display artifact rather than a functional restore; it
does not reflect a value that the widget would actually adopt.

## What works

- Validation: `persist_state` without `key=` raises a clear `StreamlitAPIException`;
  invalid values are rejected by `StreamlitInvalidPersistStateError` (verified in
  the diff/unit tests).
- Default behavior is unchanged (`persist_state=None` loses value when not rendered).
- Server-side preservation **while a widget stays unmounted**, for both `page`
  and `session` scope, across slider/selectbox/multiselect/text/checkbox/number.
- `bind="query-params"` combined with `persist_state` (E2): value preserved (OR
  logic), URL param present while shown, and the bound widget correctly restores
  on re-show.

## Recommendations

1. **Fix BUG‑1 first** (it subsumes BUG‑2 and BUG‑3). In `register_widget`, when a
   value was preserved for a `persist_state` widget (and when an existing
   `session_state` value should seed a freshly mounted widget), set
   `widget_value_changed=True` so the resolved value is pushed to the frontend on
   (re)mount — mirroring the existing `restored_bound_value` handling for
   `bind="query-params"`.
2. **Add e2e coverage for the remount/restore path.** The existing
   `widget_state_persistence_test.py` only asserts "preserved while hidden" (via
   `st.session_state` readouts) and "page value not leaked" (where the widget is
   re-rendered on the second page, masking the bug). Add tests that:
   - show a persisted widget again after hiding and assert the **widget UI value**
     and that a follow-up rerun does not clobber it;
   - set a `persist_state="session"` value on page A, switch away and back, and
     assert the value is restored on the re-rendered widget.
3. After the fix, re-validate `persist_state="page"` deletion-on-switch as an
   independent behavior (currently indistinguishable from BUG‑1's reset).

## Artifacts

- Test plan: `work-tmp/qa-widget-state-persistence-e211/test-plan.md`
- Test app: `work-tmp/qa-widget-state-persistence-e211/test_app.py`
- QA suite: `work-tmp/qa-widget-state-persistence-e211/qa_test.py`
- Diagnostic probes: `debug_probe.py`, `debug_probe2.py`, `debug_probe3.py`
- Screenshots: `work-tmp/qa-widget-state-persistence-e211/screenshots/`
  (`I1.png`, `F2_F4.png`, `F7.png`, `E2.png`)
- Run logs: `work-tmp/qa-run3.log` (final suite run)
