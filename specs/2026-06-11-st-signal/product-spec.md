---
author: kmcgrady
created: 2026-06-11
---

# `st.signal` — scoped reruns for fragments scattered across the page

## Summary

`st.signal` creates a stateful signal object that connects widgets and fragments anywhere
on the page. When a signal fires — from a widget callback or an explicit `send()` — every
fragment *watching* it reruns in place, in execution order, and nothing else runs. This
generalizes `@st.fragment` from "a region that updates itself" to "regions that update each
other," without a full app rerun. As a companion, fragment functions become valid widget
callbacks (`on_click=my_fragment`), rerunning just that fragment from anywhere.

## Problem

### Current Behavior

A fragment rerun can only be triggered by widgets *inside* that fragment. This couples
**update scope to layout containment**: the widget you interact with and the elements that
should update must live in the same container subtree. Real dashboards don't work that way —
a sidebar filter typically drives a chart in one column, metrics in another, and nothing
else:

```python
country = st.sidebar.selectbox("Country", COUNTRIES)  # ← top-level widget

col1, col2 = st.columns(2)

@st.fragment
def chart_panel():
    st.plotly_chart(make_chart(country))

@st.fragment
def metrics_row():
    st.metric("Population", get_pop(country))

with col1:
    chart_panel()
with col2:
    metrics_row()

expensive_unrelated_section()  # reruns too — for no reason
```

Changing the selectbox triggers a **full app rerun**: both panels update, but so does every
other element on the page, including expensive sections that didn't change.

**Current workarounds:**

- Wrap the whole page in one giant fragment — loses granularity and forces the trigger
  widget and all its dependents into one subtree.
- Write to `st.session_state` in a callback and call `st.rerun()` — still a full rerun.
- Place duplicate "linked" widgets inside each fragment — duplicated UI and sync bugs.

[#10045](https://github.com/streamlit/streamlit/issues/10045) and
[#12799](https://github.com/streamlit/streamlit/issues/12799) ask for exactly this:
triggering specific fragment reruns from other fragments or from the main script. The
[parallel fragments spec](../2026-03-05-parallel-fragments/product-spec.md) explicitly
deferred "cross-fragment communication" as forward-compatibility work — this spec is that
work.

## Proposal

### API

#### `st.signal`

```python
def signal(
    key: str,
    *,
    initial: T | Callable[[], T] | None = None,
) -> Signal[T]: ...
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | `str` | (required) | A unique identifier for the signal within the session. Required and positional because signals, unlike elements, have no position in the element tree to derive a stable identity from. The `key` frames the API, mirroring `label` on widgets. |
| `initial` | `T \| Callable[[], T] \| None` | `None` | The signal's initial state, keyword-only. If a callable, it is invoked lazily on first use (and again after the signal's state is reset). Omit it for pure-trigger signals (`st.signal("refresh")`) whose watchers read their data elsewhere. |

`key` first / `initial` keyword-only keeps the required identity in the framing position and matches the widget convention (`label` positional, everything else keyword-only, principle #17).

#### `Signal[T]`

| Member | Description |
|--------|-------------|
| `value: T` | The current state. Readable anywhere, anytime. **Reading never subscribes** — only `watch=` creates a subscription. |
| `send(value: T) -> None` | Replace the state with `value` and fire the signal. Fully typed: a type checker rejects a `send()` whose value doesn't match `T`. |
| `__call__(value: T = unchanged) -> None` | Makes the signal a valid widget callback (see below). Bare call fires with the state unchanged (a pure "poke the watchers" event); with a value it is equivalent to `send(value)`. |

#### A signal is a callback

A `Signal` is directly usable in any `on_change` / `on_click` slot — that is the
primary way widgets fire signals, and it is what lets the runtime scope the rerun
to the signal's watchers (a signal in a callback slot is detected at widget
registration, before the rerun scope is decided).

- **`on_change=sig`** — fires the signal with its state unchanged. The widget's new
  value reaches watchers via `st.session_state[key]`, the usual channel.
- **`on_change=sig, args=(value,)`** — fires `sig.send(value)`. A signal callback
  takes **a single positional argument of type `T`** (the value to send). This is the
  same contract as `Signal.__call__`.
- **`kwargs` are rejected** for a signal callback (`send` takes one positional value,
  so there is nowhere to put them) — raises a `StreamlitAPIException` (fail fast,
  principle #23).

This makes the common case payload-free (`on_change=sig`) and the value-carrying case
explicit (`args=(value,)`), with no new widget parameter.

#### `watch` parameter on `@st.fragment`

```python
@overload
def fragment(
    func: F,
    *,
    run_every: int | float | timedelta | str | None = None,
    parallel: bool = False,
    watch: Signal[Any] | Sequence[Signal[Any]] | None = None,
) -> F: ...
```

A fragment with `watch=sig` (or `watch=[sig_a, sig_b]`) reruns in place whenever any
watched signal fires. The subscription registers when the fragment **executes** — a
fragment behind a false conditional is not subscribed (see Behavior).

#### Fragment functions as callbacks

Any `@st.fragment`-decorated function is a valid `on_click`/`on_change` callback:

```python
st.button("Refresh chart", on_click=chart_panel)
```

Interacting with the widget reruns **all currently-registered instances** of that fragment
function — and nothing else.

Unlike a signal callback, a fragment callback **does** accept `args`/`kwargs`, and they are
forwarded to the fragment when it reruns (since a fragment, unlike `send`, takes an arbitrary
signature):

```python
@st.fragment
def detail_panel(row_id, *, highlight=False): ...

detail_panel(current_id)                       # initial render, call-site args
st.button("Re-run highlighted",
          on_click=detail_panel, args=(current_id,), kwargs={"highlight": True})
```

When the button fires, the matching fragment reruns as `detail_panel(current_id, highlight=True)`
— the callback's `args`/`kwargs` override the fragment's original call-site arguments for that
rerun. With no `args`/`kwargs`, the fragment reruns with its original call-site arguments, as
before.

### Examples

**Basic usage** — a sidebar widget drives two panels, nothing else reruns:

```python
import streamlit as st

country = st.signal("country", initial="US")

# Bare attachment fires the signal; watchers read the widget via its key.
st.sidebar.selectbox("Country", COUNTRIES, key="c", on_change=country)

col1, col2 = st.columns(2)

@st.fragment(watch=country)
def chart_panel():
    st.plotly_chart(make_chart(st.session_state.c))

@st.fragment(watch=country)
def metrics_row():
    st.metric("Population", get_pop(st.session_state.c))

with col1:
    chart_panel()
with col2:
    metrics_row()

expensive_unrelated_section()  # does NOT rerun when the selectbox changes
```

**Typed payloads** — replace-on-send with a dataclass gives type-checked data flow:

```python
from dataclasses import dataclass

@dataclass
class Filters:
    country: str = "US"
    year: int = 2020

filters = st.signal("filters", initial=Filters())

def apply():
    filters.send(Filters(st.session_state.c, st.session_state.y))

st.sidebar.selectbox("Country", COUNTRIES, key="c", on_change=apply)
st.sidebar.slider("Year", 1990, 2026, key="y", on_change=apply)

@st.fragment(watch=filters)
def results():
    st.dataframe(query(filters.value.country, filters.value.year))

results()
```

`filters.send("oops")` is a type error, caught by mypy before runtime.

**Chained signals** — a watcher that recomputes data re-emits for its own dependents:

```python
country = st.signal("country", initial="US")
stats = st.signal("stats", initial=compute_stats)

@st.fragment(watch=country)
def chart_panel():
    normalize = st.checkbox("Normalize")        # local: reruns chart_panel only...
    s = compute(st.session_state.c, normalize)
    st.plotly_chart(make_chart(s))
    stats.send(s)                               # ...and re-emits downstream

@st.fragment(watch=stats)
def metrics_row():
    st.metric("Mean", stats.value.mean)
```

Whether `chart_panel` reruns because `country` fired or because its local checkbox was
toggled, `metrics_row` follows automatically. The data dependency lives in the code, not in
the position of a list.

**Fragment as a callback** — the smallest possible cross-page trigger:

```python
@st.fragment
def live_table():
    st.dataframe(fetch_rows())

live_table()
...
st.sidebar.button("Reload data", on_click=live_table)  # reruns only live_table
```

### Key decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Command name | `st.signal` | Matches the established reactive-programming term (SolidJS, Angular, Preact signals): a value plus subscribers. See naming alternatives below. |
| State model | Single generic value `Signal[T]`; **replace on send** | Replace + one typed object gives a type-checkable `send()` and typed reads (`sig.value.year`). Merge semantics and `*args/**kwargs` payloads are not statically checkable. |
| Identity | `key` explicit and **required** | Signals have no element-tree position to hash (unlike fragments). Auto-derived identity via compile-time magic is future work; an explicit key is unambiguous today. Duplicate keys in one run raise. |
| Firing | **Only explicit**: signal attached to `on_*`, or `send()` in code | A widget inside a watcher never fires the signal implicitly. Every widget's blast radius is readable at its call site. |
| Scope rule | Direct attachment (`on_change=sig` / `on_click=fragment_fn`) scopes the rerun to the watcher queue, suppressing the full rerun **and** the enclosing fragment's rerun. `send()` inside a plain callback or fragment body never widens or narrows the scope the interaction decided — it only adds watchers to the pending pass. | Suppression is the recoverable default: opting back in is one explicit step (make the enclosing fragment a watcher); opting out of an always-included enclosing fragment would be impossible. |
| Watcher order | Execution order — the order each watcher's fragment was *called* during the run that registered it (not source/declaration order; a watcher behind a conditional or in a loop takes its slot from when it ran), always, regardless of what triggered the fire | Deterministic order is what lets watcher N rely on watcher N-1 having run. Registration is call-time, so the order follows actual execution. |
| Watcher resolution | At fire time, against currently-registered fragments | A watcher behind a false conditional is simply absent. A fire with zero watchers updates state and is otherwise a no-op. |
| Lifecycle | State resets if the signal is not re-declared during a full run | Mirrors fragment lifecycle. Main-script signals persist across MPA page switches; page-script signals reset on navigation. |
| Coalescing | A signal fires at most once per pass; multiple `send()`s coalesce to the last value | Prevents redundant watcher runs and, combined with the cycle guard, makes cascades terminate. |
| Cycle guard | A signal cannot re-fire from within its own cascade | `A watches s1, emits s2` + `B watches s2, emits s1` degrades to one round with a warning instead of looping. |
| Parallel watchers | Serial watchers run serially in order; **consecutive** `parallel=True` watchers run as a concurrent batch; the next serial watcher waits for the batch to complete | Preserves ordering guarantees at batch boundaries while letting independent slow panels overlap. |
| `send()` in parallel workers | Prohibited (raises `StreamlitAPIException`) | Firing from a worker thread mid-batch has no well-defined position in the queue. Same guard pattern as other APIs restricted during parallel execution. |
| Errors | An exception in one watcher renders inline in its container; the rest of the queue continues | Existing fragment-queue behavior; consistent with parallel fragments. |
| Forms | No special behavior | Form values batch-apply first (existing semantics), then the fire scopes the rerun. |

### Naming alternatives

| Name | Verdict | Reasoning |
|------|:-------:|-----------|
| `st.signal` | ✅ PREFERRED | Established term for exactly this concept (state + subscribers). Noun (principle #31). Ages well if reactive features grow (derived/computed signals). |
| `st.event` | Rejected | Implies ephemeral, stateless semantics; this object holds state. Collides with common user variable names. |
| `st.dependency` | Rejected | Overloaded by packaging vocabulary ("install dependencies"). Describes the edge, not the object. |

<details>
<summary>Also considered: widget-side group parameter instead of a signal object</summary>

A `dependency=`/`updates=` kwarg on widgets naming the fragments to rerun:

```python
st.selectbox("Country", COUNTRIES, updates=[chart_panel, metrics_row])
```

**Why not:** the widget must enumerate all of its consumers, which inverts maintenance —
adding a panel means editing every widget that should drive it, possibly across files. The
subscription direction (fragments declare what they react to) scales with app size and
supports many-to-many naturally. It also adds a parameter to every widget signature, versus
reusing the existing `on_change`/`on_click` slots.

</details>

<details>
<summary>Also considered: automatic dependency tracking</summary>

Track which `session_state` keys (or signal values) each fragment reads, and rerun watchers
automatically when those values change — the Solara/Shiny reactive model, with no explicit
`watch=`.

**Why not (yet):** conditional reads create unstable subscriptions, execution order becomes
ambiguous, and "why did this rerun?" becomes hard to debug. The explicit API is designed not
to preclude it: *reading* `sig.value` deliberately does not subscribe today, so
auto-subscription can be added later as an opt-in without changing existing semantics.

</details>

### Behavior

#### Firing and scope

There are exactly two ways a signal fires; nothing fires implicitly:

1. **Direct attachment** — the signal (or a fragment function) *is* the `on_*` callback.
   Detected when the widget is registered, so the interaction requests a scoped rerun: the
   watcher queue runs, the full rerun is suppressed, and the enclosing fragment of the
   triggering widget is suppressed too (unless it is itself a watcher, in which case it runs
   in its execution-order slot).
2. **`send()` in code** — inside a plain callback, a fragment body, or the main script. The
   state updates and the signal's watchers join the *current* pass. The scope already decided
   by the interaction is never changed: a full rerun stays a full rerun (watchers render in
   normal script order); a fragment-scoped pass gains the watchers after the fragments
   already queued.

During a **full run**, `send()` only updates state — elements render top-to-bottom as
always, so a watcher placed *above* a `send()` renders with the previous value until the
next pass. This matches `session_state` semantics today and is documented rather than
patched (glitch-free re-enqueueing is possible future work).

#### Watcher execution

When a signal fires, its registered watchers rerun **in execution order — the order each
watcher's fragment was called during the run that registered it** (which equals top-to-bottom
source order only for a flat script; a watcher behind a conditional, in a loop, or called from
a helper takes its slot from when it actually ran), each into its own stable container,
exactly like fragment reruns today. Because the queue is sequential and all watcher functions
from one full run share the same module globals, a value computed by watcher N is visible to
watcher N+1 — though signal state and `session_state` are the durable channels (module globals
reset on the next full run).

The signal maintains the **dependency boundary**: watchers run in that execution order, and a
run of consecutive `parallel=True` watchers collapses into a single concurrent batch that must
fully join before the next serial watcher starts. So a `[serial, serial, parallel, parallel,
parallel, parallel, serial, serial]` watcher list executes as: two serial, then a 4-wide
batch (joined), then two serial — order preserved at every boundary, concurrency only inside
a batch. Ordering guarantees do not hold *within* a batch (use signal state / `session_state`
to communicate across one). This is the intended execution model; the initial implementation
runs all watchers serially and parallel batching lands as a follow-up (see tech spec).

The triggering widget's new value is applied to `session_state` before any watcher runs, so
every watcher sees it.

#### One footgun, documented

A *value* widget (e.g. selectbox) inside fragment `F` with `on_change=sig` suppresses `F`'s
own rerun: parts of `F`'s body that depend on that widget's value go stale until `F` next
reruns. This is the intended meaning of direct attachment ("this widget's only effect is
the declared scope") and is trivially fixed by adding `watch=sig` to `F`. The docs must
call this out; trigger-style widgets (buttons) are unaffected.

## Out of Scope (Future Work)

- **`sig.fired` introspection** — letting a multi-watch fragment ask which signal triggered
  the pass. Useful, deferred as an additive property.
- **Element-level watchers** (`sig.plotly_chart(lambda v: ...)`) — single-element
  subscriptions without a wrapper function. The `Signal` API deliberately keeps state behind
  `.value` so the attribute namespace stays free for this.
- **Compile-time key derivation** — Streamlit owns script compilation (`magic.py`
  precedent), so the assignment target name (`country = st.signal(...)`) could become the
  key automatically. Deferred; `key=` stays required until then.
- **Derived/computed signals** (`st.computed`) and **auto-subscription on read**.
- **AppTest helpers** and a **dev-mode signal inspector** (signals, watcher lists, fire log).
- **Glitch-free `send()` during full runs** (re-enqueueing already-rendered watchers).

## Checklist

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | ✅ Pure runtime feature; no platform-specific behavior. |
| No breaking API changes      | ✅ Additive: new command + new `watch` parameter; existing fragment/callback behavior unchanged. |
| No new dependencies          | ✅                     |
| Metrics collected            | `@gather_metrics` on `st.signal`; track `send()` and `watch=` usage. |
| Any security/legal impact?   | No. Signal state is session-scoped, server-side only. |
| Any docs changes needed?     | Yes — new concept page (signals & cross-fragment updates), `st.signal` API page, fragment docs update for `watch` and fragment-as-callback. |
