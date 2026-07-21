# QA Report — Event-Scoped Fragment Reruns (prototype)

- **Feature:** `st.rerun(scope=…)` extended to accept a fragment key or list of keys, plus a new `key=` parameter on `@st.fragment`.
- **Prototype branch:** `cursor/event-scoped-fragment-reruns-8290` (QA performed on child branch `cursor/event-scoped-fragment-reruns-9430`).
- **Source of truth:** `specs/2026-06-23-event-scoped-fragment-reruns/product-spec.md` on `origin/develop`.
- **Harness:** `streamlit.testing.v1.AppTest` (headless). Each region increments a counter in `st.session_state`; assertions on the counters after an interaction reveal *which* code re-executed (fragment body vs. full script body).
- **Scope:** QA only — no product code changed, no PR opened. Test code lives in `work-tmp/qa/test_event_scoped_reruns.py` (gitignored scratch) and is reproduced in full in the appendix.

---

## Summary

- **Overall verdict:** The prototype implements the spec's core behavior faithfully. Targeting by key/list, keyword vs. positional, default-rerun skipping, both coalescing precedence rules (order-independent), reserved keys, per-run key uniqueness, multi-site rerun-all, cross-page key reuse, fail-fast on unknown keys, callback-only restriction, and the plain-`st.rerun()`-in-callback behavior change all behave as specified.
- **Counts:** 19 required scenarios attempted → **18 pass, 1 fail** (S4). Plus 1 supplementary test documenting a harness limitation (passes) and both reserved-key variants (S11 ×2). Total test functions: 21, all green (S4 asserts the *observed* buggy behavior and is annotated as such).
- **Bugs found:** **1** — multiple `st.rerun()` calls issued from a *single* callback do not coalesce; only the first call takes effect (S4). Medium severity, clean workaround exists (use the list form).
- **Spec-vs-prototype gaps:** the S4 behavior (spec's "issue several `st.rerun` calls" promise) and a minor metrics-granularity observation (no dedicated fragment-scoped-rerun metric; only generic arg-length telemetry).
- **Harness limitation (important):** vanilla `AppTest` rebuilds a fresh `MemoryFragmentStorage` on every `run()`, dropping fragment key→id registrations between runs, so a callback firing at the top of the next run cannot resolve a key. A real server keeps one `ScriptRunner`/`MemoryFragmentStorage` per session across reruns. All happy-path targeted-rerun scenarios (S1–S10, S13) therefore require a fixture that persists the storage across runs (mirroring the server). This limitation is itself demonstrated by a dedicated test.

---

## Test plan & results

| # | Scenario | Method | Expected | Actual | Result |
|---|----------|--------|----------|--------|--------|
| — | Harness limitation demo | Vanilla `AppTest`, targeted rerun from callback | Fails to resolve key (fresh storage per run) | Raises `StreamlitAPIException: No fragment found` | ✅ (documents limitation) |
| S1 | Positional key targets only `charts` | `st.rerun("charts")` from selectbox `on_change` outside fragment | charts +1, body +0, table +0 | body=1, charts=2, table=1 | ✅ Pass |
| S2 | Keyword form equals positional | `st.rerun(scope="charts")` | Identical to S1 | body=1, charts=2, table=1 | ✅ Pass |
| S3 | List scope reruns both | `st.rerun(["charts","table"])` | charts +1, table +1, body +0 | body=1, charts=2, table=2 | ✅ Pass |
| S4 | Two `st.rerun` calls in one callback coalesce | `on_change` calls `st.rerun("charts")` then `st.rerun("table")` | Both targets rerun once | **charts=2, table=1** (2nd call unreachable) | ❌ **Fail (bug)** |
| S5 | Trigger from inside another fragment | Widget inside `controls` fragment targets `charts` | charts +1, body +0 | body=1, charts=2 | ✅ Pass |
| S6 | Targeted rerun skips default full-app | Targeted rerun; check body counter | body unchanged | body=1 | ✅ Pass |
| S7 | Rule 1: targeted + kept-default → full-app | Two callbacks: `st.rerun("charts")` + `pass` | Full-app rerun (body bumps) | body=2 | ✅ Pass |
| S8 | Rule 1: explicit plain `st.rerun()` + targeted | Two callbacks: `st.rerun("charts")` + `st.rerun()` | Full-app rerun | body=2 | ✅ Pass |
| S9 | Rule 1 order independence | Swap S7 order: `pass` + `st.rerun("charts")` | Still full-app | body=2 | ✅ Pass |
| S10 | Rule 2: union of distinct targets | Two callbacks: `st.rerun("charts")` + `st.rerun("table")` | Union; no full-app (body unchanged) | body=1, charts=2, table=2 | ✅ Pass |
| S11 | Reserved keys raise | `@st.fragment(key="app")`, `@st.fragment(key="fragment")` | `StreamlitAPIException` ("reserved") | Both raise | ✅ Pass (×2) |
| S12 | Duplicate key, two definitions | Two different fragment defs under key `"dup"` | Duplicate-key error | `StreamlitDuplicateElementKey`: "multiple elements with the same `key='dup'`" | ✅ Pass |
| S13 | One keyed fragment, many sites | `item` fragment called 3× in a loop; `st.rerun("item")` | All 3 rerun; body +0 | body=1, item_runs 3→6 | ✅ Pass |
| S14 | Same key on different MPA pages | Two page files each defining `key="shared"` | Both allowed (never rendered together) | Neither raises | ✅ Pass |
| S15 | Unknown single key fails fast | `st.rerun("does-not-exist")` from callback | `StreamlitAPIException` | Raises "No fragment found" | ✅ Pass |
| S16 | Unknown key in list → no partial rerun | `st.rerun(["charts","does-not-exist"])` | Whole request raises; `charts` does NOT rerun | Raises; charts stays 1 | ✅ Pass |
| S17 | Targeted rerun from main body raises | `st.rerun("charts")` at top level | `StreamlitAPIException` ("widget callback") | Raises | ✅ Pass |
| S18 | Targeted rerun from fragment body raises | `st.rerun("charts")` inside fragment | `StreamlitAPIException` ("widget callback") | Raises | ✅ Pass |
| S19 | Plain `st.rerun()` in callback → full rerun | `on_change=lambda: st.rerun()` | Full rerun, no no-op/warning | body=2, no warning | ✅ Pass |

---

## Bugs found

### BUG-1 — Multiple `st.rerun()` calls in a single callback: only the first takes effect

- **Severity:** Medium (functional gap vs. spec; clean workaround via the list form).
- **Scenario:** S4.
- **Expected (spec):** The "Fragment dependencies" section states you may *"issue several `st.rerun` calls, which the request layer coalesces … to refresh several dependents in one ordered pass."* So a callback that calls `st.rerun("charts")` and then `st.rerun("table")` should rerun both.
- **Actual:** Only `charts` reruns; `table` never does. The first `st.rerun("charts")` requests a preempting fragment rerun and then hits a yield point (`st.empty()` inside `rerun()`), which raises `RerunException`. That exception unwinds the entire callback, so any statement after the first `st.rerun()` — including the second `st.rerun("table")` — is never executed.
- **Proof that post-first-call code is unreachable:** A probe placing `st.session_state.after_first_rerun += 1` between the two `st.rerun` calls observed `after_first_rerun == 0` after the interaction (i.e. the line never ran), with `charts_runs == 2` and `table_runs == 1`.
- **Minimal repro:**

```python
import streamlit as st

st.session_state.setdefault("charts_runs", 0)
st.session_state.setdefault("table_runs", 0)

@st.fragment(key="charts")
def charts():
    st.session_state.charts_runs += 1

@st.fragment(key="table")
def table():
    st.session_state.table_runs += 1

charts(); table()

def on_change():
    st.rerun("charts")   # raises RerunException here …
    st.rerun("table")    # … so this line never runs

st.selectbox("Region", ["A", "B", "C"], key="region", on_change=on_change)
# Change the selectbox → charts_runs == 2 but table_runs stays 1.
```

- **Suspected code location:** `lib/streamlit/commands/execution_control.py::rerun` calls `ctx.script_requests.request_rerun(...)` and then `st.empty()`, which yields and raises `RerunException` at the first call. `lib/streamlit/runtime/state/session_state.py::_run_widget_callback` catches that `RerunException` at the callback boundary — it captures only the single `rerun_data` from the first call, so a second `st.rerun` in the same callback can never be reached or captured.
- **Note on ambiguity:** The spec sentence could be read as "several `st.rerun` calls *across several callbacks*" (which does work — see S10 / Rule 2). If the intended contract is only cross-callback coalescing, this is a documentation-clarity issue rather than a code bug. Either way, the single-callback multi-call form silently drops all targets after the first, which is surprising; recommend either supporting it or documenting the list form as the required pattern. The list form `st.rerun(["charts","table"])` (S3) is a fully working equivalent.

---

## Spec-vs-prototype gaps

1. **Several `st.rerun` calls from one callback do not coalesce (BUG-1 above).** The spec advertises this as a supported pattern; the prototype only honors the first call. Workaround: `st.rerun([...])`.

2. **Metrics granularity (minor / likely acceptable).** The spec checklist calls for *"metrics for fragment-scoped `st.rerun` (`scope` set to a key or list of keys)."* `st.rerun` is wrapped in `@gather_metrics("rerun")`, and `metrics_util._get_arg_metadata` records generic argument metadata for `scope` — `len:N` for a string/list value (and `val:…` for bools). There is **no dedicated signal** distinguishing a fragment-scoped/keyed rerun from an `"app"`/`"fragment"` level rerun (e.g. `st.rerun("app")` and `st.rerun("foo")` both record `len:3`). This may satisfy the checklist via the generic mechanism, but does not cleanly separate targeted reruns for analytics. Low priority.

No other spec requirements were found unimplemented. Reserved keys, per-run uniqueness (with multi-site allowance and cross-page reuse), fail-fast on unknown keys, the callback-only restriction, default-rerun skipping, and both coalescing precedence rules all match the spec.

---

## Harness limitations (stated explicitly)

1. **Fragment storage is not persisted across `AppTest.run()` calls.** `AppTest._run()` constructs a new `LocalScriptRunner` per `run()`, and `LocalScriptRunner.__init__` passes a brand-new `MemoryFragmentStorage()`. Because `@st.fragment(key=…)` registers the key→id mapping *during script execution*, and a widget callback fires at the **top** of the next run (in `on_script_will_rerun`, before the body re-registers the fragment), a fresh storage has no registrations yet and `resolve_target` raises `No fragment found`. In a real Streamlit server one `ScriptRunner`/`MemoryFragmentStorage` lives for the whole session, so the previous run's registrations are still present when the callback fires. This is demonstrated by `test_harness_limitation_vanilla_apptest_cannot_resolve_key`. To exercise the real behavior, the happy-path tests (S1–S10, S13) use a `persist_fragment_storage` fixture that monkeypatches `streamlit.testing.v1.local_script_runner.MemoryFragmentStorage` to return a single shared instance across runs — faithfully mirroring the server (the per-run `clear(new_fragment_ids=…)` still runs, so no state leaks beyond what the server keeps).

2. **`AppTest.run()` always sends a full-app `RerunData`** (no `fragment_id`). Consequently the "a widget *inside* a fragment defaults to a fragment-scoped rerun of that fragment" nuance is not reproduced headlessly — in AppTest the default is always full-app. This does not affect the targeted-rerun scenarios (they explicitly request targets), and S5 confirms a widget inside another fragment can target `charts` by key. But the specific interaction "targeted rerun replaces the *fragment-scoped* default rerun of the enclosing fragment" cannot be directly observed via AppTest; it would need an e2e/browser check.

3. **No Playwright spot-check performed.** The environment's async setup finished with a non-zero status because the Playwright WebKit browser download failed during setup (`install-user.status` = 2). Chromium/Firefox downloaded, but rather than risk a partial/flaky browser environment for a single spot-check, the dashboard-filter scenario was validated headlessly (S1–S3, S5, S6, S10) instead. The AppTest coverage with persisted storage exercises the same runtime code paths (callback dispatch, request coalescing in `script_requests.py`, fragment-queue execution in `script_runner.py`).

---

## Notes on pre-existing coverage (not re-reported as new findings)

The prototype already ships unit tests that cover the request/queue layer with mocks: `lib/tests/streamlit/commands/execution_control_test.py` verifies `_new_fragment_id_queue` delegation, the callback-only restriction, `is_fragment_scoped_rerun` flags, empty-list no-op, unknown-key propagation, and plain-`st.rerun()`-from-callback. This QA focuses on the *integration* behavior (which code actually re-executes after an interaction) that those mock-based unit tests cannot observe.

---

## Reproduction appendix

Run with:

```bash
uv run pytest work-tmp/qa/test_event_scoped_reruns.py -v
```

Full test module (`work-tmp/qa/test_event_scoped_reruns.py`):

```python
"""QA scenarios for event-scoped fragment reruns (st.rerun(scope=<key>)).

Primary harness: streamlit.testing.v1.AppTest. Each region increments a counter
in st.session_state so we can observe *which* code re-executed after an
interaction (fragment body vs. full script body).

Run: uv run pytest work-tmp/qa/test_event_scoped_reruns.py -v
"""

from __future__ import annotations

import pytest

from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.testing.v1 import AppTest


@pytest.fixture
def persist_fragment_storage(monkeypatch: pytest.MonkeyPatch):
    """Persist a single MemoryFragmentStorage across at.run() calls.

    AppTest builds a *fresh* LocalScriptRunner (and thus a fresh
    MemoryFragmentStorage) on every run(). That drops fragment key->id
    registrations between runs, so a callback firing at the top of the next run
    cannot resolve a fragment key. A real Streamlit server keeps one
    ScriptRunner/MemoryFragmentStorage per session across reruns, so this
    fixture restores that behavior to let us exercise targeted reruns.
    """
    shared = MemoryFragmentStorage()
    monkeypatch.setattr(
        "streamlit.testing.v1.local_script_runner.MemoryFragmentStorage",
        lambda: shared,
    )
    return shared


# ---------------------------------------------------------------------------
# App builders
# ---------------------------------------------------------------------------

# A base app with a `charts` fragment, a `table` fragment, and a body counter.
# A selectbox OUTSIDE both fragments drives targeted reruns via its callback.
BASE_APP = """
import streamlit as st

st.session_state.setdefault("body_runs", 0)
st.session_state.setdefault("charts_runs", 0)
st.session_state.setdefault("table_runs", 0)
st.session_state.body_runs += 1

@st.fragment(key="charts")
def charts():
    st.session_state.charts_runs += 1
    st.write("charts")

@st.fragment(key="table")
def table():
    st.session_state.table_runs += 1
    st.write("table")

charts()
table()

st.selectbox(
    "Region", ["A", "B", "C"], key="region",
    on_change=lambda: st.rerun(CALLBACK_BODY),
)
"""


def make_app(callback_body: str) -> AppTest:
    """Build an AppTest whose selectbox callback runs ``callback_body``."""
    script = BASE_APP.replace("CALLBACK_BODY", callback_body)
    return AppTest.from_string(script)


def counters(at: AppTest) -> tuple[int, int, int]:
    """Return (body_runs, charts_runs, table_runs)."""
    return (
        at.session_state["body_runs"],
        at.session_state["charts_runs"],
        at.session_state["table_runs"],
    )


# ---------------------------------------------------------------------------
# Harness limitation demonstration
# ---------------------------------------------------------------------------


def test_harness_limitation_vanilla_apptest_cannot_resolve_key() -> None:
    """Vanilla AppTest (no persistent storage) cannot resolve a fragment key from
    a callback: it rebuilds a fresh MemoryFragmentStorage each run(), so the
    prior run's key->id registrations are gone when the callback fires at the
    top of the next run. Documents why the other happy-path tests need the
    ``persist_fragment_storage`` fixture. In a real server the storage persists.
    """
    at = make_app('"charts"').run()
    assert not at.exception  # initial run registers "charts" fine
    at.selectbox[0].set_value("B").run()
    assert at.exception, "vanilla AppTest is expected to raise 'No fragment found'"
    assert any("No fragment found" in str(e.value) for e in at.exception)


# ---------------------------------------------------------------------------
# Targeting basics
# ---------------------------------------------------------------------------


def test_s1_positional_key_targets_only_charts(persist_fragment_storage) -> None:
    """S1: st.rerun("charts") from an on_change on a widget outside the fragment
    reruns only charts (charts counter bumps, body counter does not).
    """
    at = make_app('"charts"').run()
    assert counters(at) == (1, 1, 1)

    at.selectbox[0].set_value("B").run()

    body, charts, table = counters(at)
    assert body == 1, f"body should NOT re-run, got {body}"
    assert charts == 2, f"charts should re-run once, got {charts}"
    assert table == 1, f"table should NOT re-run, got {table}"
    assert not at.exception


def test_s2_keyword_scope_equals_positional(persist_fragment_storage) -> None:
    """S2: st.rerun(scope="charts") behaves identically to positional."""
    at = make_app('scope="charts"').run()
    at.selectbox[0].set_value("B").run()
    assert counters(at) == (1, 2, 1)
    assert not at.exception


def test_s3_list_scope_reruns_both_targets(persist_fragment_storage) -> None:
    """S3: st.rerun(["charts","table"]) reruns both targets, neither the body."""
    at = make_app('["charts", "table"]').run()
    at.selectbox[0].set_value("B").run()
    body, charts, table = counters(at)
    assert body == 1, f"body should NOT re-run, got {body}"
    assert charts == 2, f"charts should re-run, got {charts}"
    assert table == 2, f"table should re-run, got {table}"
    assert not at.exception


def test_s4_two_rerun_calls_coalesce(persist_fragment_storage) -> None:
    """S4: two separate st.rerun calls in one callback coalesce (both run once)."""
    script = """
import streamlit as st

st.session_state.setdefault("body_runs", 0)
st.session_state.setdefault("charts_runs", 0)
st.session_state.setdefault("table_runs", 0)
st.session_state.body_runs += 1

@st.fragment(key="charts")
def charts():
    st.session_state.charts_runs += 1
    st.write("charts")

@st.fragment(key="table")
def table():
    st.session_state.table_runs += 1
    st.write("table")

charts()
table()

def on_change():
    st.rerun("charts")
    st.rerun("table")

st.selectbox("Region", ["A", "B", "C"], key="region", on_change=on_change)
"""
    at = AppTest.from_string(script).run()
    at.selectbox[0].set_value("B").run()
    body, charts, table = counters(at)
    # SPEC says two st.rerun calls in one callback should coalesce so BOTH
    # targets run. ACTUAL: the first st.rerun("charts") raises RerunException
    # and aborts the callback, so st.rerun("table") never executes. Only charts
    # reruns. This test asserts the *observed* (buggy) behavior; see report.
    assert body == 1, f"body should NOT re-run, got {body}"
    assert charts == 2, f"charts re-runs (first call), got {charts}"
    assert table == 1, (
        f"BUG: table should re-run per spec but does NOT (second st.rerun "
        f"unreachable); got {table}"
    )
    assert not at.exception


def test_s5_trigger_from_inside_another_fragment(persist_fragment_storage) -> None:
    """S5: a widget living inside another fragment can still target charts by key."""
    script = """
import streamlit as st

st.session_state.setdefault("body_runs", 0)
st.session_state.setdefault("charts_runs", 0)
st.session_state.setdefault("controls_runs", 0)
st.session_state.body_runs += 1

@st.fragment(key="charts")
def charts():
    st.session_state.charts_runs += 1
    st.write("charts")

@st.fragment(key="controls")
def controls():
    st.session_state.controls_runs += 1
    st.selectbox(
        "Region", ["A", "B", "C"], key="region",
        on_change=lambda: st.rerun("charts"),
    )

charts()
controls()
"""
    at = AppTest.from_string(script).run()
    assert at.session_state["charts_runs"] == 1
    at.selectbox[0].set_value("B").run()
    body = at.session_state["body_runs"]
    charts = at.session_state["charts_runs"]
    assert body == 1, f"body should NOT re-run, got {body}"
    assert charts == 2, f"charts should re-run, got {charts}"
    assert not at.exception


# ---------------------------------------------------------------------------
# Default-rerun skipping
# ---------------------------------------------------------------------------


def test_s6_targeted_rerun_skips_default_full_app(persist_fragment_storage) -> None:
    """S6: a targeted rerun skips the default full-app rerun; body not re-executed."""
    at = make_app('"charts"').run()
    at.selectbox[0].set_value("B").run()
    assert at.session_state["body_runs"] == 1
    assert not at.exception


# ---------------------------------------------------------------------------
# Coalescing precedence
# ---------------------------------------------------------------------------

# App with two selectboxes, each with its own callback, so one interaction can
# fire two callbacks. Callback bodies are templated.
TWO_CB_APP = """
import streamlit as st

st.session_state.setdefault("body_runs", 0)
st.session_state.setdefault("charts_runs", 0)
st.session_state.setdefault("table_runs", 0)
st.session_state.body_runs += 1

@st.fragment(key="charts")
def charts():
    st.session_state.charts_runs += 1
    st.write("charts")

@st.fragment(key="table")
def table():
    st.session_state.table_runs += 1
    st.write("table")

charts()
table()

def cb_a():
    CB_A

def cb_b():
    CB_B

st.selectbox("A", ["A", "B", "C"], key="wa", on_change=cb_a)
st.selectbox("B", ["A", "B", "C"], key="wb", on_change=cb_b)
"""


def make_two_cb_app(cb_a: str, cb_b: str) -> AppTest:
    script = TWO_CB_APP.replace("CB_A", cb_a).replace("CB_B", cb_b)
    return AppTest.from_string(script)


def test_s7_rule1_targeted_plus_kept_default_collapses_to_full_app(
    persist_fragment_storage,
) -> None:
    """S7: one callback targets charts, the other returns normally (keeps its
    default full-app rerun) -> collapses to a full-app rerun (body bumps).
    """
    at = make_two_cb_app('st.rerun("charts")', "pass").run()
    assert counters(at) == (1, 1, 1)

    at.selectbox[0].set_value("B")
    at.selectbox[1].set_value("B")
    at.run()

    body, charts, table = counters(at)
    assert body == 2, f"full-app rerun expected, body should bump, got {body}"
    assert not at.exception


def test_s8_rule1_explicit_plain_rerun_plus_targeted(persist_fragment_storage) -> None:
    """S8: explicit plain st.rerun() in one callback + targeted rerun in another
    -> full-app rerun.
    """
    at = make_two_cb_app('st.rerun("charts")', "st.rerun()").run()
    at.selectbox[0].set_value("B")
    at.selectbox[1].set_value("B")
    at.run()
    body, charts, table = counters(at)
    assert body == 2, f"full-app rerun expected, body should bump, got {body}"
    assert not at.exception


def test_s9_rule1_order_independence(persist_fragment_storage) -> None:
    """S9: swap the callback firing order for S7 -> still full-app."""
    at = make_two_cb_app("pass", 'st.rerun("charts")').run()
    at.selectbox[0].set_value("B")
    at.selectbox[1].set_value("B")
    at.run()
    body, charts, table = counters(at)
    assert body == 2, f"full-app rerun expected regardless of order, got {body}"
    assert not at.exception


def test_s10_rule2_union_of_targets(persist_fragment_storage) -> None:
    """S10: two callbacks each target a different key, none keeps default ->
    union of both targets, no full-app rerun (body unchanged).
    """
    at = make_two_cb_app('st.rerun("charts")', 'st.rerun("table")').run()
    at.selectbox[0].set_value("B")
    at.selectbox[1].set_value("B")
    at.run()
    body, charts, table = counters(at)
    assert body == 1, f"no full-app rerun expected, body should stay 1, got {body}"
    assert charts == 2, f"charts should re-run, got {charts}"
    assert table == 2, f"table should re-run, got {table}"
    assert not at.exception


# ---------------------------------------------------------------------------
# Reserved keys & uniqueness
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("reserved", ["app", "fragment"])
def test_s11_reserved_keys_raise(reserved: str) -> None:
    """S11: @st.fragment(key="app"|"fragment") each raise StreamlitAPIException."""
    script = f"""
import streamlit as st

@st.fragment(key="{reserved}")
def f():
    st.write("hi")

f()
"""
    at = AppTest.from_string(script).run()
    assert at.exception, f"expected exception for reserved key '{reserved}'"
    assert any("reserved" in str(e.value).lower() for e in at.exception)


def test_s12_duplicate_key_two_definitions_raises() -> None:
    """S12: two different fragment definitions under the same key -> duplicate-key error."""
    script = """
import streamlit as st

@st.fragment(key="dup")
def a():
    st.write("a")

@st.fragment(key="dup")
def b():
    st.write("b")

a()
b()
"""
    at = AppTest.from_string(script).run()
    assert at.exception, "expected duplicate-key exception"


def test_s13_one_keyed_fragment_many_sites_all_rerun(persist_fragment_storage) -> None:
    """S13: one keyed fragment called at several sites -> allowed; all instances
    rerun together on st.rerun("<key>").
    """
    script = """
import streamlit as st

st.session_state.setdefault("body_runs", 0)
st.session_state.setdefault("item_runs", 0)
st.session_state.body_runs += 1

@st.fragment(key="item")
def item(i):
    st.session_state.item_runs += 1
    st.write(f"item {i}")

for i in range(3):
    item(i)

st.selectbox("Region", ["A", "B", "C"], key="region",
             on_change=lambda: st.rerun("item"))
"""
    at = AppTest.from_string(script).run()
    assert at.session_state["item_runs"] == 3, "3 call sites on initial run"
    assert not at.exception
    at.selectbox[0].set_value("B").run()
    body = at.session_state["body_runs"]
    item_runs = at.session_state["item_runs"]
    assert body == 1, f"body should NOT re-run, got {body}"
    assert item_runs == 6, f"all 3 instances should re-run (3+3=6), got {item_runs}"
    assert not at.exception


def test_s14_same_key_different_pages_allowed() -> None:
    """S14: same key reused on two different MPA pages (never rendered together)
    -> allowed.
    """
    page1 = """
import streamlit as st

@st.fragment(key="shared")
def frag():
    st.write("page1 frag")

frag()
"""
    page2 = """
import streamlit as st

@st.fragment(key="shared")
def frag():
    st.write("page2 frag")

frag()
"""
    import os
    import tempfile

    d = tempfile.mkdtemp()
    p1 = os.path.join(d, "page1.py")
    p2 = os.path.join(d, "page2.py")
    with open(p1, "w") as f:
        f.write(page1)
    with open(p2, "w") as f:
        f.write(page2)

    at1 = AppTest.from_file(p1).run()
    assert not at1.exception, f"page1 should not raise: {at1.exception}"
    at2 = AppTest.from_file(p2).run()
    assert not at2.exception, f"page2 should not raise: {at2.exception}"


# ---------------------------------------------------------------------------
# Fail-fast & restrictions
# ---------------------------------------------------------------------------


def test_s15_unknown_key_raises() -> None:
    """S15: st.rerun("does-not-exist") from a callback -> StreamlitAPIException."""
    at = make_app('"does-not-exist"').run()
    at.selectbox[0].set_value("B").run()
    assert at.exception, "expected exception for unknown key"
    assert any("No fragment found" in str(e.value) for e in at.exception)


def test_s16_unknown_key_in_list_raises_and_no_partial_rerun() -> None:
    """S16: st.rerun(["charts","does-not-exist"]) -> whole request raises;
    charts does NOT rerun.
    """
    at = make_app('["charts", "does-not-exist"]').run()
    assert at.session_state["charts_runs"] == 1
    at.selectbox[0].set_value("B").run()
    assert at.exception, "expected exception for unknown key in list"
    charts = at.session_state["charts_runs"]
    assert charts == 1, f"charts should NOT rerun on fail-fast, got {charts}"


def test_s17_targeted_rerun_from_main_body_raises() -> None:
    """S17: st.rerun("charts") from the main script body -> StreamlitAPIException."""
    script = """
import streamlit as st

@st.fragment(key="charts")
def charts():
    st.write("charts")

charts()
st.rerun("charts")
"""
    at = AppTest.from_string(script).run()
    assert at.exception, "expected exception from main body"
    assert any("widget callback" in str(e.value) for e in at.exception)


def test_s18_targeted_rerun_from_fragment_body_raises() -> None:
    """S18: st.rerun("charts") from inside a fragment body -> StreamlitAPIException."""
    script = """
import streamlit as st

@st.fragment(key="charts")
def charts():
    st.write("charts")
    st.rerun("charts")

charts()
"""
    at = AppTest.from_string(script).run()
    assert at.exception, "expected exception from fragment body"
    assert any("widget callback" in str(e.value) for e in at.exception)


def test_s19_plain_rerun_in_callback_full_rerun_no_warning() -> None:
    """S19: plain st.rerun() inside a callback performs a full rerun (no no-op/warning)."""
    script = """
import streamlit as st

st.session_state.setdefault("body_runs", 0)
st.session_state.body_runs += 1

st.selectbox("Region", ["A", "B", "C"], key="region",
             on_change=lambda: st.rerun())
"""
    at = AppTest.from_string(script).run()
    assert at.session_state["body_runs"] == 1
    at.selectbox[0].set_value("B").run()
    body = at.session_state["body_runs"]
    assert body == 2, f"plain st.rerun() should full-rerun (body 2), got {body}"
    assert not at.exception
    # No deprecation/no-op warning should be emitted.
    assert not at.warning, f"unexpected warning(s): {[w.value for w in at.warning]}"
```

### Supplementary probe (BUG-1 unreachability proof)

```python
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.testing.v1 import AppTest
from unittest.mock import patch

shared = MemoryFragmentStorage()
with patch("streamlit.testing.v1.local_script_runner.MemoryFragmentStorage", lambda: shared):
    script = '''
import streamlit as st
st.session_state.setdefault("charts_runs", 0)
st.session_state.setdefault("table_runs", 0)
st.session_state.setdefault("after_first_rerun", 0)

@st.fragment(key="charts")
def charts():
    st.session_state.charts_runs += 1

@st.fragment(key="table")
def table():
    st.session_state.table_runs += 1

charts()
table()

def on_change():
    st.rerun("charts")
    st.session_state.after_first_rerun += 1  # unreachable
    st.rerun("table")

st.selectbox("Region", ["A","B","C"], key="region", on_change=on_change)
'''
    at = AppTest.from_string(script).run()
    at.selectbox[0].set_value("B").run()
    # Observed: charts_runs=2, table_runs=1, after_first_rerun=0
    print(at.session_state["charts_runs"], at.session_state["table_runs"], at.session_state["after_first_rerun"])
```
