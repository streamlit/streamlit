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

### Addressing fragments (the one real design decision)

To target a fragment, it needs a stable, user-facing name. Fragment identity today is an internal
positional hash. There are two fundamentally different places to attach a name, which leads to two
families of options:

- **Per call site** (Option A): the name identifies one *instance* of a fragment, so the same function
  called twice yields two independently-targetable fragments.
- **Per function definition** (Option C): the name identifies the *fragment function*, and targeting
  reruns **all** of its call sites; users get instance-level granularity by defining distinct
  functions.

Whatever we pick must be **backwards compatible**: the fragment wrapper currently forwards `**kwargs`
straight to the user's function, so silently reserving `key` *at call time* would break any fragment
whose function already declares a `key` argument.

**Option A — call-time `key` (per-instance addressing)**

```python
# A1 (preferred within Option A): opt in via a decorator flag, then pass key at the call site
@st.fragment(addressable=True)   # opts the function into reserving a call-time `key`
def charts(): ...
charts(key="charts")
st.rerun(target="charts")

# A2 (variation): always reserve `key` at call time, no flag
@st.fragment
def charts(): ...
charts(key="charts")
```

- Pros: instance-level — the same function can back many independently-addressable fragments (e.g. one
  per tab or per row); the key reads as "on this fragment."
- Cons (A1): a second calling convention (a fragment is only key-addressable once declared
  `addressable`); the flag is a boolean (prefer enums — revisit if a third mode emerges).
- Cons (A2): **breaking** — unconditionally reserving `key` at call time collides with any existing
  fragment function that already takes a `key` parameter, violating *Minimize Migration Distance* and
  *Graceful Evolution*. A2 only becomes non-breaking via signature inspection, which is Option B.
- **Within Option A, A1 (opt-in) is preferred** over A2 precisely because A2 is not backwards
  compatible.

**Option B — signature-aware call-time `key`** (rejected)

Consume `key` as identity only if the user's function doesn't declare a `key` param, else forward it.
Non-breaking and ergonomic, but the same argument means different things depending on the function
signature — "clever but too clever" and a "same name, same behavior" violation. Documented here only
to record why we rejected it.

**Option C — decorator `key`, rerun all of the fragment's call sites** ✅ PREFERRED

The name lives on the decorator and identifies the *fragment function*. `st.rerun(target=...)` reruns
**every** call site of that function. If a developer needs two independently-targetable regions, they
define two fragment functions and factor any shared logic into a plain helper:

```python
@st.fragment(key="charts")       # names the fragment function
def charts():
    df = load(st.session_state.region)   # shared logic lives in a cached helper
    st.line_chart(df)
    st.dataframe(df)

charts()                          # any number of call sites; all rerun together on target
st.rerun(target="charts")
```

- Pros: **fully backwards compatible** — `key` is a new *decorator* parameter (like `run_every`,
  `parallel`); it never touches the user function's call signature. Simplest mental model ("the
  fragment function has a name; rerun reruns it"). Pure *Extend Before Inventing* — no new flag, no
  reserved call-time kwarg. Reruns-all is often what's wanted (a fragment shown in three tabs refreshes
  in all three).
- Cons: coarser — you cannot target a *single* instance of a function rendered in a loop; to get
  instance-level targeting you must define distinct functions (awkward for highly dynamic/looped
  content). `key` here means "per function," whereas widget `key` means "per instance" — a mild
  *Same Name, Same Behavior* nuance (defensible, since a fragment *is* its function).

#### Critical analysis: A vs. C, and why C is preferred

Per the [API design principles](../AGENTS.md), Option C is the stronger default:

| Principle | A1 (opt-in call-time key) | C (decorator key, rerun-all) |
|---|---|---|
| #26 Minimize Migration Distance / #25 Graceful Evolution | ✅ non-breaking (via flag) | ✅ non-breaking (decorator param) |
| #18 Extend Before Inventing | ⚠️ adds a new `addressable` flag concept | ✅ just another `@st.fragment` parameter |
| #1 Simplicity / #8 Semantic Names | ⚠️ two steps (declare flag, pass key) | ✅ one step ("name the fragment") |
| #27 Pythonic Idioms | ⚠️ reserved call-time kwarg | ✅ decorator configures the function |
| #20 One Use Case, One Command | ✅ | ✅ — and it nudges good factoring (one fragment fn per region) |
| #2 Progressive Disclosure | — | ✅ simple default; A layers on for instance targeting |
| Instance-level targeting (loops) | ✅ first-class | ❌ requires distinct functions |

The only thing C gives up is targeting an individual instance of a looped fragment — and that is an
**advanced, less-common** need for *external* targeting (an instance's own widgets already trigger its
own scoped rerun today). The common case the proposal exists for — "a filter updates these named
panels" — is fully and more simply served by naming functions. Crucially, the multi-call-site concern
that originally argued *against* decorator keys dissolves under the user's observation: **shared code
moves into a plain helper function, and each independently-targetable region becomes its own named
fragment function.** That is good app structure, not a workaround.

**Recommendation:** ship **Option C** as the default addressing mechanism, and treat **Option A1**
(opt-in call-time `key`) as a *progressive-disclosure* complement for the advanced case where a single
instance of a looped/dynamic fragment must be targeted externally. Option A2 and Option B are recorded
as rejected (compat and "too clever," respectively).

### 2. Fragment dependencies — and the cycle problem

Targeted reruns compose into **dependencies between fragments** without any new "dependency" API: a
fragment (or a callback) simply reruns the fragments that depend on it. Because the request layer
coalesces multiple targets into one ordered pass, an event can refresh several dependents at once:

```python
def on_filter_change():
    st.rerun(target="charts")
    st.rerun(target="table")   # both queued into a single ordered rerun pass
```

This deliberately avoids a declarative `depends_on=[...]` graph. A declared graph adds concepts
(subscription direction, framework-managed ordering) that targeted reruns already cover, and it can't
express *conditional* dependencies (`if expensive_input_changed: st.rerun(target="charts")`) that a
plain function can. (Recorded under Out of Scope.)

**The cycle problem.** Because this is imperative and developer-driven, nothing structurally prevents
a fragment from triggering a rerun that (directly or transitively) triggers itself — an infinite rerun
loop. This is the same class of footgun that `st.rerun()` already has today (calling it
unconditionally loops), but cross-fragment targeting makes indirect cycles (`A → B → A`) easier to
create accidentally. Mitigations to decide during tech-spec:

- **Detection over prevention.** Track the chain of fragment reruns triggered within a single
  interaction and raise a clear `StreamlitAPIException` ("Fragment rerun cycle detected: A → B → A …")
  rather than hanging — *Fail Fast, Fail Helpfully*.
- **Guidance.** Document that targeted reruns should be triggered by events/conditions, not
  unconditionally on every fragment run (mirroring existing `st.rerun` guidance).
- A declarative graph would let us detect cycles *statically*, but that's a reason to revisit
  `depends_on` later, not to ship it now.

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
- **Declarative `depends_on=[...]` dependency graph** — revisit only if imperative composition proves
  insufficient; would enable static cycle detection.
- **Automatic dependency inference** (Shiny/Reflex-style "read a value → subscribe") — a much larger
  change to the execution model; not proposed here.
- **Cross-fragment writes to outside containers** — tracked separately
  ([#15413](https://github.com/streamlit/streamlit/issues/15413)).

## Checklist

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | Should — builds on existing fragment rerun + WebSocket delta path; needs cross-platform e2e (embedded/mobile) for multi-fragment passes. |
| No breaking API changes      | ✅ with Option C (decorator `key`) — additive only; `st.rerun` gains an optional `target`, `st.fragment` gains an optional `key`. The opt-in call-time `key` complement (A1) is also additive. Option A2 (always-on call-time `key`) and Option B (signature-aware) would break compat and are rejected. |
| No new dependencies          | ✅ |
| Metrics collected            | TODO — track `st.rerun(target=...)` usage and cycle-detection triggers via `gather_metrics`. |
| Any security/legal impact?   | None identified. |
| Any docs changes needed?     | Yes — `st.rerun` reference, fragment concept docs, and a "event-driven / partial updates" guide. |

## Open questions

- **Addressing:** ship Option C (decorator `key`, rerun-all) alone first, or C + the A1 call-time
  complement together for instance-level targeting? For C, confirm the "rerun all call sites"
  semantics (and behavior when a keyed fragment has zero or many call sites). Does `target` accept a
  single key, a list of keys, or also a fragment handle object?
- **Parameter name:** `st.rerun(target=...)` vs reusing/expanding `scope`. `target` reads clearly and
  leaves `scope` for the app/fragment distinction.
- **Cycle handling:** detect-and-raise (preferred) vs a max-depth cap vs documentation only.
- **Stale-state semantics:** confirm a targeted rerun always produces the same output a full rerun
  would (i.e., dependents must read from `session_state`); decide whether to warn when a fragment
  reads a value that only exists in the skipped script body.
