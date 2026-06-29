---
author: github-name
created: 2026-06-23
status: draft
---

# Event-scoped fragment reruns

## Summary

A recurring criticism of Streamlit is that the full-script rerun model prevents "event-based"
execution — running only the code affected by an interaction — which has pushed some users to
event-driven alternatives (NiceGUI, Reflex, Shiny). This spec proposes the *Streamlit-native* answer:
let developers **trigger a rerun of a specific, addressable fragment from anywhere** (via
`st.rerun`), so a single event updates only its dependent region — without adopting the element-handle
/ state-class boilerplate those frameworks require, and without abandoning the rerun model.

## Problem

### The criticism: "Streamlit can't do event-based execution"

Streamlit re-executes the **entire script top-to-bottom on every widget interaction**. This is the
defining trait of the framework and the thing newcomers and competitors most often single out. A
common version of the critique: every interaction "re-renders the page," so you "end up reaching for
`@st.cache_data`, `@st.cache_resource`, and `st.session_state` hacks just to work around the rerun."

This has been concrete enough to spawn alternative libraries that market themselves as the
event-driven "upgrade":

- **NiceGUI** was created explicitly as a reaction to Streamlit — the maintainers "like Streamlit but
  find it does too much magic when it comes to state handling." Every UI event invokes a Python
  handler and only the elements you explicitly update change.
- **Reflex** positions itself as "the framework Streamlit users move to": state lives in a Python
  class, components subscribe to the data they read, and "only the components affected by a change
  re-render. A slider change won't re-run your database query."
- **Shiny for Python** builds a reactive dependency graph and "minimally re-renders" only the outputs
  whose inputs changed.

The demand shows up directly in our own issue tracker. Read in full, these requests all describe the
same gap — *update only what an event affects, without a full rerun*:

| Issue | 👍 | Ask |
|---|---|---|
| [#10603](https://github.com/streamlit/streamlit/issues/10603) | 25 | Rerun a fragment from *anywhere*, not just from within itself (maintainer posted a workaround → not first-class today) |
| [#12396](https://github.com/streamlit/streamlit/issues/12396) | 19 | `st.filter_bar` to drive dependent views |
| [#12799](https://github.com/streamlit/streamlit/issues/12799) | 12 | Selective rerun + execution control for fragments |
| [#10045](https://github.com/streamlit/streamlit/issues/10045) | 12 | Fragment-to-fragment communication instead of rerunning the whole app |
| [#9052](https://github.com/streamlit/streamlit/issues/9052) | 11 | Rerun on events from third-party libraries (frames it as React's `useSyncExternalStore`) |
| [#12395](https://github.com/streamlit/streamlit/issues/12395) | 7 | Easier cross-filtering between charts/dataframes |
| [#12980](https://github.com/streamlit/streamlit/issues/12980) | 5 | Real-time chart updates without rerunning the entire script |

The canonical worked example is a **BI dashboard filter**: a region/date/category selector drives
several charts and dataframes, and changing the filter should recompute only the *dependent* views —
not the whole app, and not unrelated sections.

### Background: the rerun model is a feature, not just a constraint

Before "fixing" the rerun model, it's worth stating plainly why it exists and what we must not lose.
The rerun model is what makes Streamlit Streamlit:

- **Drop-in replacement for scripts.** You write straight-line Python top-to-bottom; converting a
  script to an app is "swap a variable for a slider." There are no callbacks to wire, no component
  graph, no element references to hold.
- **Deterministic output.** Given the same code and state, the UI is identical, because it is
  *recomputed* from state on every run rather than *mutated* incrementally. This is why Streamlit apps
  are easy to reason about and debug.
- **No manual diffing.** Users never call `element.update()` or manage subscriptions; they re-`st.`
  everything and the framework diffs.

The event-driven alternatives buy partial updates by giving these up: NiceGUI makes you hold element
handles and imperatively `.update()`/`.refresh()` them; Reflex makes you define a `State` class with
typed vars and computed properties and compile a React frontend. Both are more powerful for large
apps and both impose real boilerplate, a steeper learning curve, and (for NiceGUI) a shared event loop
that one blocking call can stall. **The goal of this spec is to close the event-execution gap while
keeping the rerun model's simplicity** — i.e., partial *re-evaluation*, never partial *mutation*.

We already ship the building block: **`@st.fragment`**. A fragment is a function whose reruns are
*scoped* — when a widget inside it changes, only that fragment re-executes, not the whole script.
What's missing is the ability to trigger a fragment's rerun **from outside itself** and to **address a
specific fragment by name**.

## Proposal

### 1. Programmatic, targeted reruns — the "Streamlit-y" way to do events

`st.rerun` is already the sanctioned *imperative* control-flow verb (alongside `st.stop`), and it
already supports `scope="fragment"`. The proposal extends it so it can target a *specific* fragment
from anywhere — a callback, the main script, or another fragment:

```python
@st.fragment(key="charts")                # name the fragment (see §"Addressing fragments")
def charts():
    df = load(st.session_state.region)    # read shared state, recompute
    st.line_chart(df)
    st.dataframe(df)

charts()

st.selectbox(
    "Region", REGIONS, key="region",
    on_change=lambda: st.rerun(target="charts"),   # event → re-run only the charts
)
```

Crucially this stays on the right side of Streamlit's model: `st.rerun(target=...)` triggers a
**re-evaluation** of the targeted fragment (it re-runs `charts()`), it does **not** hand the developer
an imperative `chart.update(data)`. The UI remains a pure function of state, so determinism is
preserved. The only discipline this requires is that data shared across fragments lives in
`st.session_state` (because a fragment-scoped rerun does not re-execute the surrounding script body).

**Why this is the minimal, on-principle design:**

- *Extend, don't invent* — no new command, no `State` class, no new paradigm. We loosen two existing
  restrictions on `st.rerun(scope="fragment")` (it can currently only target the *current* fragment,
  and only from inside a fragment rerun).
- *Reuses existing machinery* — the runtime already executes an ordered queue of fragment IDs without
  re-running the script body, and the request layer already coalesces multiple fragment-rerun requests
  into one ordered pass. Targeted reruns mostly need an *addressing* layer on top.

### Addressing fragments

To target a fragment, it needs a stable, user-facing name. Fragment identity today is an internal
positional hash; we add a name via a new **`key` parameter on the `@st.fragment` decorator**. The key
identifies the *fragment function*, and `st.rerun(target=...)` reruns **every** call site of that
function. When a developer needs two independently-targetable regions, they define two fragment
functions and factor any shared logic into a plain helper:

```python
@st.fragment(key="charts")       # names the fragment function
def charts():
    df = load(st.session_state.region)   # shared logic lives in a cached helper
    st.line_chart(df)
    st.dataframe(df)

charts()                          # any number of call sites; all rerun together on target
st.rerun(target="charts")
```

Why this shape:

- **Fully backwards compatible** — `key` is a new *decorator* parameter (like `run_every`, `parallel`)
  and never touches the user function's call signature. (Reserving `key` *at call time* would break
  any fragment whose function already declares a `key` argument, since the wrapper forwards `**kwargs`
  straight through.)
- **Simplest mental model** ("the fragment function has a name; rerun reruns it"), pure *Extend Before
  Inventing*, and *Pythonic* (the decorator configures the function).
- **Rerun-all is usually what's wanted** (a fragment shown in three tabs refreshes in all three), and
  it nudges good factoring — one fragment function per independently-updatable region.

#### Alternatives considered

**Call-time `key` (per-instance addressing).** The name is passed where the fragment is *called*, so
the same function can back many independently-addressable fragments. Two variants:

```python
# A1: opt in via a decorator flag, then pass key at the call site
@st.fragment(addressable=True)
def charts(): ...
charts(key="charts")

# A2: always reserve `key` at call time, no flag
@st.fragment
def charts(): ...
charts(key="charts")
```

- A1 is non-breaking but adds a second calling convention and a boolean flag concept.
- A2 is **breaking** — unconditionally reserving `key` at call time collides with any fragment whose
  function already takes a `key` parameter (violates *Minimize Migration Distance* / *Graceful
  Evolution*).
- **Why not the default:** versus the decorator `key`, call-time `key` loses on *Extend Before
  Inventing* (A1 needs a new `addressable` flag), *Simplicity* (two steps vs. one), and *Pythonic
  Idioms* (a reserved call-time kwarg), without a benefit compelling enough to justify a second calling
  convention. We therefore keep **A1 as a possible future, opt-in convenience** rather than the
  default.

**Signature-aware call-time `key`** (rejected). Consume `key` as identity only if the user's function
doesn't declare a `key` param, else forward it. Non-breaking and ergonomic, but the same argument means
different things depending on the function signature — "clever but too clever" and a *Same Name, Same
Behavior* violation.

### 2. Fragment dependencies

Dependencies between fragments need **no new API**: a fragment (or a callback) expresses "when I
change, update my dependents" by simply calling `st.rerun(target=...)` for them. Because the request
layer coalesces multiple targeted reruns into one ordered pass, a single event can refresh several
dependents together:

```python
def on_filter_change():
    st.rerun(target="charts")
    st.rerun(target="table")   # both queued into a single ordered rerun pass
```

Dependencies can also be *conditional*, because they're just code:

```python
if expensive_input_changed:
    st.rerun(target="charts")
```

**Cycles.** Because this is imperative and developer-driven, nothing structurally prevents a fragment
from triggering a rerun that (directly or transitively) triggers itself — an infinite rerun loop.
This is the same footgun `st.rerun()` already has today (calling it unconditionally loops); targeting
just makes indirect cycles (`A → B → A`) easier to create by accident. For the MVP, avoiding cycles is
the **developer's responsibility** — consistent with `st.rerun` today — so cycle handling is *not*
blocking. As a debugging aid and a possible future addition, Streamlit could track the chain of
targeted reruns within one interaction and raise a clear error when a fragment is re-triggered without
progress (the React "Maximum update depth exceeded" pattern). Whether and when to add this is left
open and can be driven by user demand.

#### Alternatives considered

**Declarative `depends_on=[...]` dependency graph.** Each fragment declares the
fragments/state it depends on, and the framework cascades reruns automatically. Not chosen for two
reasons:

- **Overlapping** — it provides essentially the same capability as `st.rerun(target=...)`, and
  offering both would mean two ways to do the same thing. To keep the API minimal and guide users
  down one path, we provide one (*Start Minimal*, *Extend Before Inventing*, *One Use Case, One
  Command*).
- **Strictly more limited** — a declared graph is pure data-flow with nowhere to run imperative logic,
  so it *cannot* express several things targeted reruns can:
  - **Event-handler-driven reruns** — running work in an `on_click`/`on_change` callback and then
    refreshing specific fragments (the entire §3 "event-based" model). A declared graph reacts to
    "data X changed," not to an event, and has no handler hook — so `depends_on` would actually
    *prevent* §3.
  - **Conditional dependencies** — a declared edge fires whenever its source changes; it can't be
    gated on a runtime condition.
  - **Dynamic targets** — `st.rerun(target=...)` can target a computed key; `depends_on` is a static
    list fixed at decoration time.
  - **Triggers from anywhere** — a manual "refresh" button, the main script, or an unrelated fragment
    can call `target=`; a declared graph only reruns on changes to declared upstreams.

  Its only advantage over targeted reruns is enabling cycle detection *before* execution (the declared
  graph is known up front). We judge that insufficient to justify a second, more limited mechanism.

### 3. A full "event-based" mode: fragment reruns in widget callbacks

Combine targeted reruns with the existing `on_change`/`on_click` callbacks and Streamlit gains a
genuine **event-based programming model** — events map to handlers that update only their dependent
regions — expressed entirely in normal Python and the existing widget API:

```python
@st.fragment(key="results")
def results():
    data = run_query(st.session_state.filters)   # only re-runs on relevant events
    st.dataframe(data)
    st.bar_chart(data, x="category", y="value")

st.multiselect("Filters", OPTIONS, key="filters",
               on_change=lambda: st.rerun(target="results"))

results()
```

A widget callback firing `st.rerun(target=...)` is the event; the targeted fragment re-evaluation is
the handler's effect. Compared to the alternatives, the developer writes **no element handles, no
`.update()` calls, no `outputs=[...]` wiring, and no state class** — just a fragment function, a
widget, and a one-line callback. The mental model stays "the (fragment) function re-runs and
re-renders from state."

This is the headline outcome: it answers the "Streamlit can't do event-based execution" criticism
*on Streamlit's own terms*, getting the bulk of the BI/reactivity benefit that drives users to
NiceGUI/Reflex while preserving the low-boilerplate, script-like, deterministic character the rerun
model exists to provide.

### Out of scope (future work)

- **Server-push / external events** — reacting to non-UI events (DB change feeds, queue messages,
  background threads): [#9052](https://github.com/streamlit/streamlit/issues/9052),
  [#11665](https://github.com/streamlit/streamlit/issues/11665). This needs a separate push primitive;
  targeted reruns are still client/script-initiated.
- **Automatic dependency inference** (Shiny/Reflex-style "read a value → subscribe") — a much larger
  change to the execution model; not proposed here.
- **Cross-fragment writes to outside containers** — tracked separately
  ([#15413](https://github.com/streamlit/streamlit/issues/15413)).

## Checklist

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | Should — builds on existing fragment rerun + WebSocket delta path; needs cross-platform e2e (embedded/mobile) for multi-fragment passes. |
| No breaking API changes      | ✅ — additive only; `st.rerun` gains an optional `target`, `st.fragment` gains an optional `key`. The future opt-in call-time `key` complement (A1) is also additive. The rejected always-on call-time `key` (A2) and signature-aware variants would break compat. |
| No new dependencies          | ✅ |
| Metrics collected            | TODO — track `st.rerun(target=...)` usage and cycle-detection triggers via `gather_metrics`. |
| Any security/legal impact?   | None identified. |
| Any docs changes needed?     | Yes — `st.rerun` reference, fragment concept docs, and a "event-driven / partial updates" guide. |

## Open questions

- **Addressing:** ship the decorator `key` (rerun-all) alone first, or together with the call-time
  `key` complement for instance-level targeting? Confirm the "rerun all call sites" semantics (and
  behavior when a keyed fragment has zero or many call sites). Does `target` accept a single key, a
  list of keys, or also a fragment handle object?
- **Parameter name:** `st.rerun(target=...)` vs reusing/expanding `scope`. `target` reads clearly and
  leaves `scope` for the app/fragment distinction.
- **Cycle handling:** detect-and-raise (preferred) vs a max-depth cap vs documentation only.
- **Stale-state semantics:** confirm a targeted rerun always produces the same output a full rerun
  would (i.e., dependents must read from `session_state`); decide whether to warn when a fragment
  reads a value that only exists in the skipped script body.
