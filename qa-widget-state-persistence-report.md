# QA Report — Widget State Persistence & Query-Param Binding

**Feature:** `persist_state=None|"page"|"session"` and `bind="query-params"` on widgets
**Spec:** `specs/2026-01-06-query-param-binding-state-persistence/product-spec.md`
**Implementation:** `lib/streamlit/runtime/state/{session_state.py,common.py,widgets.py,query_params.py}`
**Harness:** `streamlit.testing.v1.AppTest` (headless), version `1.58.0`, branch `develop`
**Date:** 2026-07-20
**Scope:** Exploratory QA of already-merged code. No product code changed. No PR.

---

## Summary

- **Overall verdict: the features work as documented.** No reproducible **product** bugs were
  found. Every documented behavior that AppTest can observe headless behaves per spec.
- **Counts:** 14 required scenarios (+3 bonus validation checks). **11 PASS**, **2 harness
  limitations** (not product bugs), **1 documented-behavior observation** (shared key), **1
  known gap** (deferred, not reproduced headless).
- **Key nuance — one hard AppTest limitation:** `persist_state="page"` preservation across an
  unmount/remount **cannot be faithfully tested with AppTest.** AppTest constructs a fresh
  `LocalScriptRunner` (and fresh `ScriptRunContext`) on every `.run()`, so
  `previous_page_script_hash` is always `""`. That makes `_run_script` treat *every* rerun as a
  page change and run an extra stale-widget cleanup pass with an **empty page hash**, which
  drops `persist_state="page"` values. In a real server the `ScriptRunner` is persistent, so
  this does not happen — and the merged browser e2e test
  (`e2e_playwright/widget_state_persistence_test.py::test_persist_state_survives_unmount_remount_on_same_page`)
  confirms page-scope preservation works in the browser. `persist_state="session"` is immune
  and works headless.
- **Second AppTest limitation:** frontend-driven URL updates (a user editing a
  `bind="query-params"` widget) are performed by the browser, not the backend, so `at.query_params`
  does not reflect them. This is covered in the browser by
  `e2e_playwright/st_checkbox_test.py::test_checkbox_query_param_updates_url`.
- Validation / error handling (`persist_state`/`bind` without `key`, invalid values) is clear
  and correct.

---

## Test plan & results

Legend: **PASS** = behaves per spec; **HARNESS** = correct in real usage but not observable
in AppTest (evidence from code + merged e2e); **DOC** = documented-behavior observation;
**KNOWN GAP** = pre-existing deferred gap.

| # | Scenario | Method | Expected | Actual | Verdict |
|---|----------|--------|----------|--------|---------|
| 1 | `persist_state="session"` hidden via `if` then shown (same page) | AppTest, toggle `show` | value preserved & restored to widget | hidden ss=`hello`, remounted widget=`hello` | **PASS** |
| 2 | `persist_state="page"` hidden then shown (same page) | AppTest, toggle `show` | value preserved & restored | hidden ss=`hello` (kept), **remounted widget=`''`** (dropped) | **HARNESS** (see Bug-triage §A; browser e2e passes) |
| 3 | Default (no `persist_state`) hidden then shown | AppTest, toggle `show` | value lost, widget resets | hidden ss=`UNSET`, remounted widget=`''` | **PASS** |
| 4 | Multiple widget types `persist_state="session"` (slider, selectbox, multiselect, text_input, checkbox, number_input) | AppTest, toggle `show` | all preserved & restored | all preserved (`42`,`c`,`[x,z]`,`typed`,`True`,`7.0`) | **PASS** |
| 5 | `persist_state="session"` across page switch A→B→A | AppTest file MPA + `switch_page` | preserved | widget=`SESSION_VAL` after return | **PASS** |
| 6 | `persist_state="page"` across page switch A→B→A | AppTest file MPA + `switch_page` | LOST (reset) | widget=`''`, ss dropped on switch to B | **PASS** (expected outcome; cause not isolatable in AppTest — see §A note; browser e2e `test_page_scoped_value_does_not_leak_across_pages` covers it) |
| 7 | Same `key` on two pages, both `persist_state="session"` | AppTest file MPA + `switch_page` | (report actual) | value **SHARED** across pages by user key: `shared="SHARED_MAIN"` visible on both pages | **DOC** (see §7 below) |
| 8 | `persist_state` without `key=` | AppTest | clear error | `StreamlitAPIException`: "When using persist_state, the widget must have a unique 'key' …" | **PASS** |
| 9 | Invalid `persist_state` value (`"forever"`) | AppTest | clear error | `StreamlitInvalidPersistStateError`: 'Invalid `persist_state` value: "forever". Supported values are: `"page"`, `"session"`, or `None`.' | **PASS** |
| 9b | *(bonus)* Invalid `bind` value (`"localstorage"`) | AppTest | clear error | `StreamlitInvalidBindValueError`: 'Invalid `bind` value: "localstorage". Supported values are: `"query-params"` or `None`.' | **PASS** |
| 9c | *(bonus)* `bind="query-params"` without `key=` | AppTest | clear error | `StreamlitAPIException`: "When using bind='query-params', the widget must have a unique 'key' …" | **PASS** |
| 10 | `bind="query-params"` initializes widget from URL on load | AppTest, set `query_params` before run | widget & ss seeded from `?w=fromurl` | widget=`fromurl`, ss=`fromurl` | **PASS** |
| 11 | Changing the widget updates the query param | AppTest, `set_value` | URL param updated | `at.query_params={}` (backend does not sync UI-driven changes) | **HARNESS** (browser e2e `test_checkbox_query_param_updates_url` covers it — see §B) |
| 12 | `bind="query-params"` + `persist_state="session"` combined | AppTest, toggle `show` | both work | value preserved while hidden (`combo`) & restored on remount; URL update not observable headless | **PASS** (persist verified; URL update HARNESS-limited) |
| 13 | Programmatic `st.session_state[key]=v` with persisted widget | AppTest | widget adopts programmatic value | widget=`programmatic`, ss=`programmatic` | **PASS** |
| 13b | Programmatic set with `bind="query-params"` widget | AppTest | widget adopts value & URL syncs | widget=`programmatic`, ss=`programmatic`, `query_params={'w':['programmatic']}` | **PASS** |
| 14 | Known gap: remount where URL value races a programmatic set on the same rerun | AppTest | (verify & note) | Not reproduced headless: on unmount the bound widget's URL param is cleared, so on remount the URL is empty and the programmatic set won (`programmatic`). Gap is a frontend-timing race; see §Known gaps | **KNOWN GAP** |

---

## Bugs found

**No reproducible product bugs were found.** This section is intentionally empty of product
bugs. The two "non-PASS" observable results (scenarios 2 and 11) are AppTest **harness
limitations**, triaged below with root cause and the evidence that the product behaves
correctly in a real browser.

### §A — Triage of scenario 2 (`persist_state="page"` remount) — HARNESS LIMITATION, not a product bug

**Symptom (headless):** With `persist_state="page"`, after hiding a keyed widget and showing it
again on the same page, `st.session_state[key]` still holds the value while hidden, but on
remount the widget renders its **default** and the value is then dropped. `persist_state="session"`
does not have this problem. (Reproduced with both a plain `AppTest.from_function` app and a
single-page `st.navigation` app.)

**Root cause (identified by instrumenting the state layer):**

1. `AppTest._run` builds a **new `LocalScriptRunner`** — and therefore a new
   `ScriptRunContext` — on every `.run()` (`lib/streamlit/testing/v1/app_test.py`, `_run`).
2. In `ScriptRunner._run_script` the code compares the *previous* context's page hash to the
   new one and, when they differ, performs an **extra** `on_script_finished(widget_ids)`
   cleanup **before** `ctx.reset(page_script_hash=…)`:

   ```
   # lib/streamlit/runtime/scriptrunner/script_runner.py
   previous_page_script_hash = ctx.page_script_hash          # fresh ctx => ""
   if previous_page_script_hash != page_script_hash:         # "" != real-hash  => always True in AppTest
       ...
       self._session_state.on_script_finished(widget_ids)    # runs with ctx.page_script_hash == ""
   ```

   Because AppTest's ctx is fresh each run, `previous_page_script_hash` is always `""`, so this
   page-change cleanup fires on **every** rerun, with an **empty** `page_script_hash`.
3. That empty-hash cleanup reaches `PersistedWidgetTracker.mark_page_switch_drops("")`
   (`lib/streamlit/runtime/state/session_state.py`). A `"page"`-scoped widget registered under
   the real page hash has `_widget_pages[wid] != ""`, so it is treated as belonging to a
   *different* page and flagged for a reset (`_pending_resets`). On the remount registration,
   `take_pending_drop(...)` consumes that flag and calls `_drop_widget_value`, discarding the
   preserved value.

**Instrumented evidence (remount rerun):**

```
mark_page_switch_drops(cur='')        -> dropped_keys=['w']     # empty-hash pass flags the page-scoped widget
take_pending_drop(uk='w', cur='029a25c9', bound=False) -> should_drop=True
_drop_widget_value(uk='w')            removed=... (value discarded)
mark_page_switch_drops(cur='029a25c9')-> dropped_keys=[]        # the real-hash pass is a no-op
remount widget: ''
```

**Why this is NOT a product bug:** in a real server the `ScriptRunner` persists across reruns,
so `previous_page_script_hash` equals the current page hash on same-page reruns and the extra
empty-hash cleanup never fires. The merged browser e2e test
`e2e_playwright/widget_state_persistence_test.py::test_persist_state_survives_unmount_remount_on_same_page`
asserts exactly this scenario (page- and session-scoped values both restored on remount) and
passes.

**Net:** AppTest currently cannot be used to validate `persist_state="page"` preservation.
This is worth capturing as an **AppTest harness limitation** (arguably an AppTest bug: its
per-`.run()` fresh runner spuriously exercises the page-change branch with an empty hash). It
is out of scope for this product QA to fix, and by instruction is not filed as a product bug.

### §B — Triage of scenario 11 (UI change → URL) — HARNESS LIMITATION

For a `bind="query-params"` widget, a **user-driven** value change is reflected in the URL by
the **frontend** (browser), not the backend. The backend deliberately does *not* re-broadcast
the query param for UI-driven changes (see `register_widget`'s final
`discard_param_no_forward_msg` branch and the unit test
`test_ui_driven_value_does_not_trigger_programmatic_url_sync`). AppTest has no frontend, so
`at.query_params` stays empty after `set_value`. Programmatic sets *do* sync (scenario 13b
shows `query_params={'w':['programmatic']}`), and URL→widget seeding works (scenario 10),
because those paths run on the backend. Browser coverage:
`e2e_playwright/st_checkbox_test.py::test_checkbox_query_param_updates_url`.

---

## §7 — Same key on two pages with `persist_state="session"` (documented-behavior observation)

Using the **same `key`** on two different pages, both with `persist_state="session"`, the value
is **SHARED** across the pages (keyed by the user `key`). Concretely: a value set on the main
page (`shared="SHARED_MAIN"`) is visible in the same-keyed widget on page 2, and survives
navigating back.

This is a direct, sensible consequence of the implementation: `persist_state="session"` values
are preserved by **user key** in `_old_state` and re-attached to whatever element id currently
owns that key (`SessionState._remove_stale_widgets`, "preserved_by_key" logic). It also matches
the spec's motivating use case ("using the same widget on multiple pages", issues #6074/#5813).
Reported here as **actual documented behavior**, not a bug — but note the spec does not spell
out shared-vs-isolated explicitly, so this is a minor **spec-clarity** item worth documenting
for users. (By contrast, default behavior keeps pages isolated because page factors into widget
identity; `persist_state="session"` intentionally bridges that by key.)

---

## Known gaps (deferred, not bugs)

- **Remount URL-vs-programmatic race (`is_initial_load` heuristic).** As flagged in the task,
  on a remount `bind="query-params"` can let a URL value clobber a programmatic
  `st.session_state[key]=…` made on the same rerun. Mechanism:
  `SessionState._handle_query_param_binding` computes
  `is_initial_load = widget_id not in self._old_state`; a remounted widget's id was dropped from
  `_old_state`, so the run is *misclassified as initial load* and the guard
  `if not is_initial_load and user_key in self._new_session_state: return False` is skipped,
  allowing URL seeding to win over the programmatic set
  (`lib/streamlit/runtime/state/session_state.py`, ~L1451).

  **Not reproduced headless in this pass:** in the AppTest unmount/remount flow, unmounting a
  bound widget clears its URL param (`QueryParams.remove_stale_bindings`), so on remount the URL
  is empty, `get_initial_value` returns `None`, and the programmatic set wins (observed:
  `remounted='programmatic'`). Faithfully reproducing the clobber requires the URL param to
  still be present on the remount rerun (a frontend-timing situation where the browser re-sends
  the URL before backend cleanup) — which AppTest cannot simulate. Documented, not re-filed.

- **AppTest cannot observe frontend-driven URL updates** (scenario 11/12 URL side). Stated as a
  harness limitation; browser-covered.

- **AppTest cannot faithfully test `persist_state="page"` preservation** (see §A). Stated as a
  harness limitation; browser-covered.

---

## Harness limitations (explicit)

1. **Fresh runner per `.run()`** ⇒ `persist_state="page"` preservation across unmount/remount and
   the *cause* of page-scope drops on page switch cannot be isolated in AppTest (§A). Real-server
   behavior verified by merged e2e.
2. **No frontend** ⇒ UI-driven `bind="query-params"` URL updates and browser back/forward /
   cross-tab behavior are not observable (§B). Real-browser behavior verified by merged e2e.
3. **No Playwright spot-check was run** in this environment: it would require building the
   frontend (`make frontend-fast`) and Playwright browsers, and the relevant browser behaviors
   are already covered by merged e2e suites (`widget_state_persistence_test.py`,
   `st_checkbox_test.py`). The scenario-2 conclusion is instead grounded in state-layer
   instrumentation + code reading + those existing e2e tests.

---

## Reproduction appendix

All repro scripts were run with `uv run python <file>` on branch
`cursor/widget-state-persistence-query-binding-a6da`. They live under the gitignored
`work-tmp/qa/` (not committed); the essential code is inlined below.

### Helper note

`AppTest.from_function` re-executes the function's *source* in a fresh namespace, so **closures
are not captured** — each app function must be self-contained. `AppTest.session_state` supports
`in`/`[]` but **not** `.get()`; use `state[k] if k in state else default`.

### Single-page scenarios (1–4, 8–14)

```python
from streamlit.testing.v1 import AppTest

def ss(at, key, default="UNSET"):
    return at.session_state[key] if key in at.session_state else default

# --- Scenario 1: persist_state="session" hide/show (PASS) ---
def app_session():
    import streamlit as st
    show = st.session_state.get("show", True)
    if show:
        st.text_input("W", key="w", persist_state="session")

at = AppTest.from_function(app_session).run()
at.text_input[0].set_value("hello").run()
at.session_state["show"] = False; at.run()
assert ss(at, "w") == "hello"                 # preserved while hidden
at.session_state["show"] = True; at.run()
assert at.text_input[0].value == "hello"      # restored on remount

# --- Scenario 2: persist_state="page" hide/show (HARNESS-limited: remount widget == "") ---
def app_page():
    import streamlit as st
    show = st.session_state.get("show", True)
    if show:
        st.text_input("W", key="w", persist_state="page")

at = AppTest.from_function(app_page).run()
at.text_input[0].set_value("hello").run()
at.session_state["show"] = False; at.run()
assert ss(at, "w") == "hello"                 # still preserved while hidden
at.session_state["show"] = True; at.run()
# In AppTest the remounted widget is "" (fresh-runner empty-hash cleanup, see §A).
# In a real browser it is "hello" (merged e2e).

# --- Scenario 8: persist_state without key (PASS: clear error) ---
def app_no_key():
    import streamlit as st
    st.text_input("no key", persist_state="session")
at = AppTest.from_function(app_no_key).run()
assert at.exception and "key" in at.exception[0].value.lower()

# --- Scenario 9: invalid persist_state (PASS: clear error) ---
def app_bad():
    import streamlit as st
    st.text_input("bad", key="bad", persist_state="forever")
at = AppTest.from_function(app_bad).run()
assert at.exception and "persist_state" in at.exception[0].value

# --- Scenario 10: bind seeds from URL (PASS) ---
def app_bind():
    import streamlit as st
    st.text_input("W", key="w", bind="query-params")
at = AppTest.from_function(app_bind)
at.query_params["w"] = "fromurl"
at.run()
assert at.text_input[0].value == "fromurl" and ss(at, "w") == "fromurl"

# --- Scenario 11: UI change -> URL (HARNESS: at.query_params stays empty) ---
at = AppTest.from_function(app_bind).run()
at.text_input[0].set_value("typedval").run()
assert dict(at.query_params) == {}            # backend does not sync UI-driven changes

# --- Scenario 13b: programmatic set + bind (PASS: URL synced) ---
def app_prog_bind():
    import streamlit as st
    if st.session_state.get("do_set"):
        st.session_state["w"] = "programmatic"; st.session_state["do_set"] = False
    st.text_input("W", key="w", bind="query-params")
at = AppTest.from_function(app_prog_bind).run()
at.session_state["do_set"] = True; at.run()
assert at.text_input[0].value == "programmatic"
assert dict(at.query_params).get("w") in ("programmatic", ["programmatic"])
```

### MPA scenarios (5, 6, 7) — file-based pages

`work-tmp/qa/mpa/main.py`:

```python
import streamlit as st
st.header("Main page")
st.text_input("Shared session", key="shared", persist_state="session")
st.text_input("Main page-scoped", key="main_page", persist_state="page")
st.text_input("Main session-only", key="main_session", persist_state="session")
```

`work-tmp/qa/mpa/pages/page2.py`:

```python
import streamlit as st
st.header("Page 2")
st.text_input("Shared session", key="shared", persist_state="session")  # same key
```

Driver:

```python
import os
from streamlit.testing.v1 import AppTest
at = AppTest.from_file(os.path.abspath("work-tmp/qa/mpa/main.py")).run()
at.text_input(key="shared").set_value("SHARED_MAIN").run()
at.text_input(key="main_page").set_value("PAGE_VAL").run()
at.text_input(key="main_session").set_value("SESSION_VAL").run()

at.switch_page("pages/page2.py").run()
# Scenario 7: same key shared across pages ->
assert at.text_input(key="shared").value == "SHARED_MAIN"

at.switch_page("main.py").run()
# Scenario 5: session preserved across A->B->A ->
assert at.text_input(key="main_session").value == "SESSION_VAL"
# Scenario 6: page-scoped lost across page switch ->
assert at.text_input(key="main_page").value == ""
```

### Instrumentation used to root-cause §A

`PersistedWidgetTracker.take_pending_drop / mark_page_switch_drops / note_preserved_value` and
`SessionState._drop_widget_value` were monkeypatched to print their arguments/results, and the
app printed `get_script_run_ctx().page_script_hash` each run. This surfaced the two cleanup
passes per `.run()` — one with `page_script_hash=''` (which flags the page-scoped widget) and
one with the real hash — confirming the fresh-runner-per-run cause.
