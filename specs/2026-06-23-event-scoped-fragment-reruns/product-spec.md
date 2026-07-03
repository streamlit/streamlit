---
author: lawilby
created: 2026-06-23
---

# Event-scoped fragment reruns

## Summary

A recurring criticism of Streamlit is that the full-script rerun model prevents "event-based"
execution — running only the code affected by an interaction — which has pushed some users to
event-driven alternatives (NiceGUI, Reflex, Shiny). This spec proposes the *Streamlit-native* answer:
let a widget's **event handler trigger a rerun of a specific, addressable fragment** (via
`st.rerun(target=...)`) — and the triggering widget can live anywhere — so a single event updates only
its dependent region, without adopting the element-handle / state-class boilerplate those frameworks
require, and without abandoning the rerun model.

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

### The model: targeted reruns, the "Streamlit-y" way to do events

The proposal supplies exactly those two missing pieces — an outside trigger and a name — and ties them
to an event: a widget's callback (`on_change` / `on_click`) is the trigger, and `target=` is the name,
so `st.rerun(target=...)` re-evaluates only the named fragment(s), wherever the triggering widget
lives. The callback is the event; re-running the targeted fragment is the handler's effect. Nothing
new is invented — it's the fragments, reruns, and callbacks Streamlit already has, combined into a
targeted, event-based rerun.

#### The API: `st.rerun(target=...)`

`st.rerun` is already the sanctioned *imperative* control-flow verb (alongside `st.stop`), and it
already supports `scope="fragment"`. The proposal extends it so an event handler can target a
*specific* fragment by name — the verb you call from the handler described above. The triggering
widget can live anywhere, in the main script or inside another fragment:

```python
@st.fragment(key="charts")                # name the fragment (see "Addressing fragments")
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

`target` accepts a **single fragment key or a list of keys**; passing a list reruns all of them in one
ordered pass.

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

**Alternative parameter names considered:**

- **Expanding `scope`** (e.g. `st.rerun(scope="fragment", key=...)`) — rejected: `scope` is the
  app-vs-fragment *level* (a `Literal["app", "fragment"]`); overloading it to also carry *which*
  fragment conflates two distinct concerns.
- **`fragment=` / `fragments=`** — rejected: ties the name to fragments specifically and reads
  awkwardly for the single-or-list case; `target` is neutral and works for one key or many.
- **`key=`** — rejected: ambiguous on `st.rerun` ("the key of what?"). `target` states intent
  ("rerun this target").
- **`target`** (chosen) — reads clearly and leaves `scope` free for the app/fragment distinction.

### Limiting targeted reruns to callbacks

For the MVP, `st.rerun(target=...)` is **only valid from a widget callback** — called anywhere else
(partway through the main script body or a fragment body) it raises a `StreamlitAPIException`. (Plain
`st.rerun()` is now allowed inside a callback too, triggering a full rerun; this removes the previous
restriction, where `st.rerun` in a callback was a no-op that emitted a warning — a behavior change for
any app that relied on that no-op.)

This is a deliberate starting point we may relax later. For now the restriction buys four things:

- **Execution stays easy to reason about.** Callbacks run as a distinct phase *before* the run body,
  so a targeted rerun is applied at that clean boundary: the callback phase finishes and then — before
  the pending run's body executes — Streamlit preempts the run and executes only the target(s), with
  no partially-rendered output. Allowing the call mid-body would instead abandon a partially-executed
  script or fragment and jump elsewhere — a "goto" style of control flow that is hard to follow and at
  odds with the deterministic, top-to-bottom model.
- **It covers the use cases people actually ask for.** The requests behind this feature — dashboard
  filters, cross-filtering, fragment-to-fragment updates — are all "when the user does X, update
  region Y," which is exactly what a widget callback expresses.
- **Rerun cycles become impossible.** A targeted rerun can only originate from a callback, and a
  callback only fires on a user interaction; re-running a fragment executes just its body, which
  cannot itself issue a targeted rerun. So a fragment can never (directly or transitively) re-trigger
  itself — each interaction resolves to one bounded pass of fragment reruns and then stops. (This is
  strictly safer than calling `st.rerun` from a script or fragment body, where an unconditional call
  loops forever.)
- **The cases it leaves out have a better home.** The main thing a callback trigger can't express is
  a *data-driven* rerun — "when the underlying data refreshes, re-run the views that read it," with no
  user event involved. That is a declarative dependency (outputs subscribe to inputs), which we think
  belongs in a future declarative data layer rather than being bolted onto the imperative `st.rerun`
  primitive (see "Out of scope").

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
st.button("Refresh", on_click=lambda: st.rerun(target="charts"))  # reruns every call site
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

### Fragment dependencies

Dependencies between fragments need **no new API**: an event callback expresses "when this changes,
update its dependents" by simply calling `st.rerun(target=...)` for them. Pass a list of keys
(or issue several `st.rerun` calls, which the request layer coalesces — see "Rerun coalescing and
precedence") to refresh several dependents in one ordered pass:

```python
def on_filter_change():
    st.rerun(target=["charts", "table"])   # both rerun in a single ordered pass
```

Dependencies can also be *conditional*, because they're just code:

```python
def on_filter_change():
    if expensive_input_changed():
        st.rerun(target="charts")
```

**No cycles.** Chaining dependencies this way can't create an infinite rerun loop. Because a targeted
rerun can only originate from a callback (a user event) and re-running a fragment executes only its
body — which cannot itself issue a targeted rerun — no fragment can directly or transitively
re-trigger itself. An `A → B → A` chain therefore cannot form, and each interaction resolves to a
single bounded pass of fragment reruns (see "Limiting targeted reruns to callbacks"). This is a
direct benefit of the callback-only restriction: the imperative loop that an unconditional `st.rerun`
can create in a script body is structurally impossible here.

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
    refreshing specific fragments (the entire callback-driven, event-based model this spec is built
    on). A declared graph reacts to "data X changed," not to an event, and has no handler hook — so
    `depends_on` would actually *preclude* that event-based model.
  - **Conditional dependencies** — a declared edge fires whenever its source changes; it can't be
    gated on a runtime condition.
  - **Dynamic targets** — `st.rerun(target=...)` can target a computed key; `depends_on` is a static
    list fixed at decoration time.
  - **Triggers from any widget** — an event handler on any widget can call `target=`, whether that
    widget is a manual "refresh" button, lives in the main script, or sits inside an unrelated
    fragment; a declared graph only reruns on changes to declared upstreams.

  Its only advantage over targeted reruns is enabling cycle detection *before* execution (the declared
  graph is known up front). We judge that insufficient to justify a second, more limited mechanism.

### Rerun handling: coalescing and precedence

Targeted reruns make it normal for a **single interaction to produce several rerun requests at once**
— a list `target`, multiple `st.rerun(target=...)` calls, or reruns from more than one widget callback
(e.g. a form submit that fires several `on_change` handlers). The request layer already coalesces
concurrent rerun requests into one run, but the way it merges them has to change so a cluster of
fragment targets all run while a full-app rerun still wins. Two rules govern the merge:

- **A full-app rerun trumps everything.** If *any* request in the interaction is a full-app rerun
  (`st.rerun()` with no `target`), the interaction collapses to a single full-app rerun and the
  individual fragment targets are dropped — they would all re-execute as part of the full pass anyway,
  which also avoids running the same code twice in close succession. This holds **regardless of the
  order** the requests were issued in, so the outcome never depends on widget-callback dispatch order.
- **Otherwise, all fragment targets are unioned.** With no full-app rerun in play, every targeted
  fragment accumulates (de-duplicated, order-preserving) into one ordered pass, so a single
  interaction re-runs each dependent fragment exactly once.

### Out of scope (future work)

- **Server-push / external events** — reacting to non-UI events (DB change feeds, queue messages,
  background threads): [#9052](https://github.com/streamlit/streamlit/issues/9052),
  [#11665](https://github.com/streamlit/streamlit/issues/11665). This needs a separate push primitive;
  targeted reruns are still client/script-initiated.
- **Automatic dependency inference** (Shiny/Reflex-style "read a value → subscribe") — a much larger
  change to the execution model; not proposed here.

## Checklist

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | ✅ — the mechanism is internal to Streamlit's existing fragment-rerun model. |
| No breaking API changes      | ✅ signatures — additive only (`st.rerun` gains an optional `target`, `st.fragment` gains an optional `key`). ⚠️ behavior — `st.rerun()` inside a widget callback previously no-op'd with a warning and now performs the rerun (see "Limiting targeted reruns to callbacks"). |
| No new dependencies          | ✅ |
| Metrics collected            | ✅ — add metrics for `st.rerun(target=...)`. |
| Any security/legal impact?   | None identified. |
| Any docs changes needed?     | Yes — `st.rerun` reference, fragment concept docs, and a "event-driven / partial updates" guide. |

## Open questions

- **Relaxing the callback-only restriction (post-MVP).** The MVP allows `st.rerun(target=...)` only
  from a widget callback (see "Limiting targeted reruns to callbacks"). Whether to later permit it
  from other contexts — and how to do so without reintroducing goto-style control flow or rerun
  cycles — is left open and can be driven by user demand. Data-driven reruns in particular are more
  likely to be served by a future declarative data layer than by loosening this primitive.
