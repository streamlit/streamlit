---
author: lukasmasuch
created: 2026-07-15
---

# Auto-rerun a page on an interval (`run_every` in `st.set_page_config`)

## Summary

Add a `run_every` parameter to `st.set_page_config` that reruns the entire page at a
fixed interval, without any user interaction. This brings `@st.fragment`'s `run_every`
behavior to the whole page and provides a first-class, native replacement for the popular
[`streamlit-autorefresh`](https://github.com/kmcgrady/streamlit-autorefresh) component —
the #1 used third-party Streamlit component — so live dashboards and monitoring apps no
longer need an external dependency or a blocking `while True: sleep()` loop.

```python
import streamlit as st

# Rerun the whole page every 5 seconds.
st.set_page_config(run_every="5s")

st.metric("Live requests/sec", get_current_rps())
```

## Problem

[#10485](https://github.com/streamlit/streamlit/issues/10485) asks to add `run_every` to
`st.set_page_config` so an entire app can auto-refresh on a schedule, explicitly noting it
"could be a nice replacement for the popular streamlit-autorefresh component."

Auto-refreshing on an interval is one of the most common requests for dashboards, live
metrics, log tailing, queue monitors, and status pages. Today users have three
unsatisfying options:

**1. Blocking loop (anti-pattern).** Ties up the script runner thread, breaks widgets,
and prevents the app from processing other events:

```python
while True:
    st.metric("CPU", get_cpu())
    time.sleep(5)
    st.rerun()  # never reached cleanly; fragile and blocks the session
```

**2. Third-party `streamlit-autorefresh` component.** The most popular workaround, used in
**~3% of all Streamlit apps** (#1 used component). It adds a frontend timer that pings the
server to rerun. It works well, but:

- It's an **external dependency** users must discover, install, and trust for something
  this fundamental.
- It renders as an (invisible) iframe component, with the usual component caveats
  (mounting, `key` management, re-mount on arg change).
- It is not integrated with Streamlit's own rerun model, multipage navigation, or
  fragment auto-rerun.

**3. Wrap everything in `@st.fragment(run_every=...)`.** Streamlit already supports
periodic reruns *per fragment*. But this only reruns that fragment — you cannot easily
auto-refresh the *whole* page (top-level widgets, `st.set_page_config`-level state,
sidebar content created outside a fragment, `st.navigation` routing). Restructuring an
entire page into a single fragment is awkward and often impossible, and fragments have
their own execution semantics that not every page wants.

### Why this matters

The mechanism for periodic reruns already exists and is battle-tested: `@st.fragment`'s
`run_every` uses a frontend timer that sends a rerun request on a schedule (the same
approach as `streamlit-autorefresh`, but native). We are exposing that proven behavior at
the page level — the natural place users already look (`st.set_page_config`) and the exact
place the issue requests. This is a small, additive API that removes the ecosystem's most
common reason to reach for a third-party component.

## Proposal

### API

Add `run_every` as a keyword-only parameter to `st.set_page_config`:

```python
def set_page_config(
    page_title: str | None = None,
    page_icon: PageIcon | None = None,
    layout: Layout | None = None,
    initial_sidebar_state: InitialSideBarState | None = None,
    menu_items: MenuItems | None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
) -> None:
```

**Parameter:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `run_every` | `int \| float \| timedelta \| str \| None` | `None` | The time interval between automatic full-page reruns. `None` disables auto-rerun. Minimum 1 second. |

`run_every` intentionally **matches `@st.fragment(run_every=...)`** in name, accepted
types, and meaning (API principles #7 Standardized Vocabulary and #10 Same Name, Same
Behavior). Accepted values:

- `None` (default) — no auto-rerun.
- `int` or `float` — interval in seconds (e.g. `5`, `2.5`).
- `str` — a Pandas
  [`Timedelta`](https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html)
  string (e.g. `"5s"`, `"1m"`, `"1.5 days"`, `"1h23s"`).
- `timedelta` — a `datetime.timedelta` (e.g. `timedelta(seconds=30)`).

It is keyword-only. `st.set_page_config` currently has no `*` separator, so we introduce
one before `run_every` (non-breaking — the existing five parameters remain positional).
This follows API principle #17 (enhancing arguments are keyword-only).

**Minimum interval (1 second).** Intervals below 1 second raise a `StreamlitAPIException`.
This is the one place page-level `run_every` intentionally diverges from
`@st.fragment(run_every=...)`, which allows sub-second reruns: a fragment tick re-runs one
section, whereas a page tick re-executes the whole script and re-renders the whole page, so
sub-second *full-page* reruns are disproportionately expensive (and DoS-adjacent at scale).
Browsers also throttle background-tab timers to ≥1 second, so a sub-second value is
unreliable regardless. We start with a floor because tightening it later would be breaking
while relaxing it is not; the difference from fragment is documented rather than silent.
`0`, negative values, and any interval that resolves to less than 1 second raise
`StreamlitAPIException` rather than silently disabling — pass `None` (not `0`) to turn
auto-rerun off.

### Examples

**Simplest — live dashboard:**

```python
import streamlit as st

st.set_page_config(page_title="Ops Dashboard", run_every="10s")

st.title("Live Operations")
st.metric("Active users", get_active_users())
st.line_chart(get_traffic_last_hour())
```

**Direct migration from `streamlit-autorefresh`:**

```python
# Before — external component
from streamlit_autorefresh import st_autorefresh
st_autorefresh(interval=2000, key="counter")   # milliseconds

# After — native, no dependency
st.set_page_config(run_every=2)                 # seconds
```

**Dynamic control (enable/disable and change interval at runtime).** `st.set_page_config`
can be called multiple times in a run; for each argument, the last call that passes it
wins, and omitting an argument leaves it unchanged. Combined with widgets, this lets users
pause or retune auto-refresh from the UI:

```python
import streamlit as st

st.set_page_config(page_title="Monitor")

col1, col2 = st.columns(2)
auto = col1.toggle("Auto-refresh", value=True)
interval = col2.select_slider("Interval", ["2s", "5s", "30s"], value="5s")

# The final resolved value for this run controls the timer.
st.set_page_config(run_every=interval if auto else None)

st.dataframe(get_job_queue())
```

**Composing with fragments.** Page-level `run_every` and fragment-level `run_every`
coexist. Use the page interval for the overall refresh and a faster fragment interval for
a hot section:

```python
st.set_page_config(run_every="60s")   # refresh the whole page every minute

@st.fragment(run_every="2s")          # this section refreshes faster
def live_ticker():
    st.metric("Price", get_price())

live_ticker()
st.dataframe(get_daily_summary())     # refreshed by the page-level interval
```

> [!NOTE]
> The `st.set_page_config` docstring should explicitly recommend
> `@st.fragment(run_every=...)` for more targeted updates. A page-level `run_every`
> re-executes the whole script and re-renders the entire page on every tick, which is
> wasteful when only one section changes on a schedule. Users should reach for page-level
> `run_every` when the whole page genuinely needs to refresh, and prefer wrapping the
> live section in a fragment otherwise. The docstring will link to `@st.fragment` and
> show the composition pattern above. It should also warn that, because each tick is a full
> rerun, page-level `run_every` dismisses an open `st.dialog` and resets an unsubmitted
> `st.form` — another reason to prefer a fragment (or to pause auto-refresh) for modal or
> multi-step flows.

### Behavior

- **Frontend-driven, non-blocking.** Like `@st.fragment(run_every=...)` (and
  `streamlit-autorefresh`), a timer in the browser sends a rerun request every interval.
  The server is *not* tied up between reruns and remains free to handle other sessions and
  events. This is the key advantage over `while True: sleep()`.
- **Full-page rerun.** Each tick reruns the whole script top-to-bottom, exactly like
  pressing "Rerun". Widget values, session state, and caches behave as they do on any
  normal rerun.
- **Per page.** `run_every` applies to the page that called `set_page_config`. On
  multipage navigation (`st.navigation` / `st.switch_page`), the timer is cleared; the
  destination page re-establishes its own timer if it sets `run_every`. This mirrors how
  fragment auto-reruns are cleared on page change.
- **Concurrent reruns (a tick coinciding with a user interaction, `st.rerun`, or a
  fragment rerun).** No special handling is needed — page-level auto-rerun uses the same
  rerun request path as everything else, and the existing machinery resolves overlaps:
  - *No lost input.* Every rerun request (auto or user) carries the browser's latest full
    widget-state snapshot, and the server coalesces pending rerun requests, so the newest
    state always wins — a concurrent tick never drops a user's edit.
  - *Bounded work.* A tick that arrives while a run is in flight is coalesced/preempted by
    the server rather than queued without limit (at most one extra run). Full reruns are
    deterministic for the same state, so a preempted or duplicated run simply restarts —
    correct, at worst slightly redundant.
  - *Natural debounce.* Every full rerun (including user-triggered ones) clears and re-arms
    the page timer, so the interval countdown restarts after each interaction. Active users
    effectively reset the timer instead of stacking a tick on top of their own rerun —
    matching `streamlit-autorefresh`'s default `debounce=True`. (This differs from fragment
    `run_every`, whose timer survives fragment-only reruns; a page tick is a full rerun,
    which resets it.)
  - *Slow apps.* If a run takes longer than `run_every`, effective cadence is bounded by
    run time — no backlog builds up (same as fragment `run_every`).
- **Pauses while an `st.dialog` is open.** A full-page rerun re-renders the script's element
  tree, which disrupts an open `st.dialog` (it can close or lose in-progress input), so
  auto-rerun ticks are skipped while an `st.dialog` is open and resume once it closes. This
  is low-effort and frontend-only — the app frontend already knows when an `st.dialog` is
  open (the same signal used to suppress the keyboard *rerun* shortcut while a
  non-dismissible dialog is open). Auto-rerun is not user-initiated, so it skips for *any*
  open `st.dialog` (unlike the manual rerun shortcut, which only guards non-dismissible
  ones). This is specific to `st.dialog`: app-chrome dialogs (*About*, *Deploy*, *Settings*)
  are app-shell state, not part of the script's element tree, so reruns don't disrupt them.
  Fragment `run_every` reruns are scoped and aren't affected.
- **Open dialogs and unsubmitted forms.** A tick is a full rerun, so — exactly like
  pressing "Rerun" — it re-executes the script and can dismiss an open `st.dialog` or reset
  an unsubmitted `st.form`. The natural debounce above softens this for active users (each
  interaction restarts the interval), but a tick can still interrupt a modal a user is
  slowly filling out. For modal or multi-step flows, prefer pausing auto-refresh (pass
  `run_every=None`) or scoping the live updates to a `@st.fragment(run_every=...)` rather
  than refreshing the whole page. Built-in "pause while a dialog is open" behavior is out of
  scope for v1 (see Out of Scope).
- **Resolution / disabling (multiple `set_page_config` calls in one run).** The timer is
  re-derived on every rerun from the value of the *last* call that **passed** `run_every`.
  Like the visual parameters, a call that **omits** `run_every` leaves the current setting
  untouched — a chrome-only `set_page_config(page_title=...)` after an earlier
  `set_page_config(run_every=5)` keeps the 5-second timer; it does not silently disable it.
  To turn auto-refresh off, pass `run_every=None` **explicitly** (e.g. when a toggle is off,
  as in the dynamic-control example); if no call in the run passes `run_every`, no timer is
  armed (and any timer from a previous run is cleared, since the timer is re-derived per
  run). So an explicit `None` matches `@st.fragment(run_every=None)` (no auto-rerun), while
  *omission* inherits like the other `set_page_config` parameters. This means the
  implementation must distinguish "argument not passed" from an explicit `None` — via an
  internal sentinel default (the standard Streamlit pattern for telling an unset keyword
  argument apart from an explicit `None`); users still simply write `run_every=None` to
  disable.
- **Background tabs.** Browsers throttle timers in inactive tabs (typically to ≥1s, and
  more aggressively when backgrounded). Very short intervals may therefore fire less often
  when the tab isn't focused. This is inherent to the frontend-timer approach (and matches
  both fragment `run_every` and `streamlit-autorefresh`); it will be documented, not
  worked around.
- **Validation.** Invalid interval strings raise the same `StreamlitBadTimeStringError`
  as `@st.fragment(run_every=...)`, via the shared `time_to_seconds` helper. Intervals that
  resolve to less than 1 second raise a `StreamlitAPIException` naming the offending value
  and pointing at the 1-second minimum (API principle #23 Fail Fast, Fail Helpfully).

### API location: options considered

**Option 1: `run_every` on `st.set_page_config`** ✅ PREFERRED

- Pros: Exactly what [#10485](https://github.com/streamlit/streamlit/issues/10485)
  requests. `set_page_config` is the natural, discoverable home for "page-wide settings
  configured once near the top." Reuses the existing `run_every` vocabulary and behavior
  from `@st.fragment` (principles #7, #10, #18 Extend Before Inventing). No new command in
  the flat namespace.
- Cons: `set_page_config` has historically configured visual *chrome* (title, icon,
  layout); auto-rerun is a runtime *behavior*, so this slightly stretches the command's
  scope (mild tension with principle #20 One Use Case, One Command). Mitigated by the fact
  that it is still an app-level, set-once-at-top page setting.

**Option 2: New command `st.autorefresh(...)` / `st.rerun_every(...)`**

- Pros: Cleanly separates "behavior" from "page chrome." Room for
  `limit`/count/`debounce` like the component. Could return a tick counter.
- Cons: Invents a new top-level command (against #18 and #21 Flat Namespace). Two ways to
  express periodic reruns (page command vs `@st.fragment(run_every=...)`) with different
  names is inconsistent (#5). Not what the issue asks for.

**Option 3: Config option (`config.toml`, e.g. `[runner] runEvery`)**

- Pros: Zero code; matches "environment settings live in config" (#38).
- Cons: Auto-refresh is app *behavior*, not deployment environment, so #38 actually argues
  *against* config. Can't vary per page, can't be toggled by a widget, not dynamic.

We adopt **Option 1**, matching the issue and maximizing consistency with the existing
`run_every` API. A separate `st.autorefresh` command and `limit`/count features are
deferred (see Out of Scope).

## Out of Scope (Future Work)

- **`limit` / max-refresh count and a returned tick counter.** `streamlit-autorefresh`
  returns an incrementing count and supports a `limit`. Users can replicate both with
  `st.session_state` today, so we ship the minimal API first (#4 Start Minimal) and add
  these only if there's demand.
- **`run_every` on `st.navigation` / app-wide across all pages.** v1 is per-page via
  `set_page_config`. A single global interval for a whole multipage app can be layered on
  later.
- **Sub-second intervals / high-precision guarantees.** v1 enforces a 1-second minimum
  (see Minimum interval). Intervals are best-effort browser timers subject to background-tab
  throttling, so we won't guarantee tight real-time cadence. Relaxing the floor below 1
  second (or making it configurable) can be revisited later based on demand — a non-breaking
  change.
- **Pausing on window blur, open dialogs, or unsubmitted forms / "smart" refresh.** Beyond
  the browser's native background throttling, v1 won't add explicit logic to pause ticks
  when the tab is hidden, an `st.dialog` is open, or an `st.form` has unsubmitted edits.
  Users can pause auto-refresh manually or scope live updates to a fragment; smarter
  built-in pausing can be layered on later.
- **Deprecating `streamlit-autorefresh`.** This is a community component; we simply provide
  a native alternative and can point to it in docs.

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ✅ Frontend-timer + standard rerun path; no server-side scheduling. Same mechanism as `@st.fragment(run_every=...)`, which already works across platforms. Background-tab throttling applies everywhere. |
| No breaking API changes | ✅ Additive keyword-only parameter; existing `set_page_config` calls are unaffected. Introduces a `*` separator before the new arg (non-breaking). |
| No new dependencies | ✅ Reuses `time_to_seconds` (Pandas already a dependency) and the existing `AutoRerun` frontend-timer machinery. |
| Metrics collected | `set_page_config` is already wrapped with `@gather_metrics`. Track `run_every` adoption vs. the component — not just whether it was set, but the interval value distribution, to inform whether the 1-second minimum should later be relaxed or raised. |
| Any security/legal impact? | Auto-rerun increases request volume; the 1-second minimum interval bounds worst-case full-page rerun frequency (mitigating DoS-adjacent risk from very short intervals). No new data exposure. |
| Any docs changes needed? | ✅ Document the new parameter on the `st.set_page_config` API page (the docstring should recommend `@st.fragment(run_every=...)` for more targeted updates), add a "Auto-refresh your app" how-to, and mention it as the native alternative to `streamlit-autorefresh`. |
