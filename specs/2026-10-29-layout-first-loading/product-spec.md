---
author: lukasmasuch
created: 2026-10-29
---

# Layout-first loading for dashboards

## Summary

Dashboards feel fastest when they load layout first: titles, filters, and card frames paint
at once, skeletons hold the space of each expensive body, and the bodies fill in from
parallel fragments. Two merged fixes make the skeleton part work:

- [#17924](https://github.com/streamlit/streamlit/pull/17924) keeps the previous run's
  content mounted under a skeleton and covers it only after a 0.5s grace period. Cached
  reruns no longer flash the skeleton or remount the content.
- [#17920](https://github.com/streamlit/streamlit/pull/17920) makes `with st.skeleton()`
  fill its own slot until the first visible element is drawn there, and shows spinner text
  inside it as the skeleton's label. A parallel fragment called inside the block keeps the
  skeleton until the fragment draws.

The [`st.skeleton` spec](../2026-05-13-st-skeleton/product-spec.md) describes that behavior.
Screenshots show what they fixed: a [skeleton above the stale chart](./today-cache-miss.png),
now [covering it in place](./prototype-cache-miss.png), and
[two stacked loading indicators](./today-cache-spinner.png).

This spec covers the two remaining changes, both about fragments:

1. **A skeleton for a fragment's own reruns**, such as `run_every` refreshes and widgets
   inside the fragment.
2. **Parallel fragments start after the layout is sent**, so CPU-bound fragments can't hold
   back the cheap layout.

## Problem

### Use case

A dashboard is a grid of cards. Each card has a cheap header (title, help, filters) drawn by
the main script and an expensive body (a chart, dataframe, or metric that needs a query) in
a parallel fragment. The page should:

1. Paint the layout and a skeleton for every body, at its final size, before any expensive
   work runs.
2. Run the queries in parallel and fill in each card independently.
3. Update cached reruns in place, without a skeleton or a remount, and cover slow reruns
   with the skeleton at the content's size.

The embedded `developing-with-streamlit` skill recommends this pattern
([#17946](https://github.com/streamlit/streamlit/pull/17946)), and #8032 asked for
skeletons for the same reason.

### What happens today

The pattern that works today puts the skeleton at the call site:

```python
@st.fragment(parallel=True)
def revenue_body(region):
    st.bar_chart(load_revenue(region), height=260)


with st.container(border=True):
    st.subheader("Revenue by region")  # Cheap: drawn by the main script
    with st.skeleton(height=260):  # Sizes the first load
        revenue_body(region)
```

We measured it on develop with a card whose fragment takes 2s on its own rerun (method in
the [tech spec](./tech-spec.md#measurements)):

| Skeleton placement                                         | Full-app run                                              | The fragment's own rerun                                            |
| ---------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| Around the call (above)                                    | ✅ Skeleton from the first paint until the fragment draws | ❌ No skeleton: the old chart fades as stale for 2s                 |
| Around the call, plus `with st.skeleton()` inside the body | ✅                                                        | ✅ The skeleton covers the old chart after ~0.63s, which stays mounted |

Two problems remain:

- **Fragments that rerun on their own need two skeletons.** A fragment-only rerun runs only
  the fragment body, so it never re-enters the block around the call. A card whose fragment
  refreshes itself, or holds its own controls, needs a second `with st.skeleton()` inside
  the body. The `dashboard-metrics` template in #17946 does this for its chart cards.
- **CPU-bound fragments delay the layout.** Parallel workers start as soon as the fragment is
  called and compete for the GIL with the thread that sends messages to the browser. With
  two CPU-bound loaders, the 40 cheap elements after the cards reached the browser after
  **~750ms**, while with I/O-bound loaders they arrived within ~15ms. The script produced
  them in 10ms, so the browser gets the cheap layout late.

## Proposal

### 1. A skeleton for a fragment's own reruns

**Option A: Document the two-block pattern, no new API** ✅ PREFERRED

The block around the call sizes the first load. A body that's slow on its own reruns wraps
its content in a second `with st.skeleton()`:

```python
@st.fragment(parallel=True, run_every="15s")
def live_orders():
    with st.skeleton():  # Covers the fragment's own refreshes
        st.bar_chart(load_live_orders(), height=340)


with st.container(border=True):
    st.markdown("**Live orders**")
    with st.skeleton(height=340):  # Sizes the first load
        live_orders()
```

The inner block needs no height. On a full-app run, the outer skeleton covers it, and on
the fragment's own rerun it keeps the previous content's size.

- Pros: Works today and adds no parameter ($4 Start Minimal, $19 Design for Composition).
  Each block covers the runs that enter it, and the size stays at the call site.
- Cons: Two blocks per card for fragments that rerun on their own. Users must learn that the
  outer block doesn't cover fragment-only reruns.

**Option B: `@st.fragment(loading="skeleton")`, sized from a bounded parent**

The fragment's container becomes a loading block on every run of the fragment, including
its own reruns. On a first load, the skeleton fills a parent with a bounded height, such as
`st.card(height=...)` or `st.container(height=...)`, and falls back to the minimum element
height elsewhere. In a bounded parent, one parameter replaces both blocks:

```python
@st.fragment(parallel=True, run_every="15s", loading="skeleton")
def live_orders():
    st.bar_chart(load_live_orders(), height="stretch")


with st.card("Live orders", height=400):
    live_orders()
```

For a parallel fragment, the main script sends the skeleton when it dispatches the
fragment, so it's part of the first paint even while the worker waits for a free thread.

- Pros: One construct per card in a bounded parent. `@st.cache_data(show_spinner=...)` sets
  the precedent for loading UI on a decorator.
- Cons: A new parameter that mostly pays off in bounded parents, which dashboards rarely
  use until `st.card` ships. In an unbounded parent, it still needs the block around the
  call for its size.

**Option C: `loading="skeleton"` as prototyped**

As option B, but the first-load skeleton always has the minimum element height. Draft
[#17838](https://github.com/streamlit/streamlit/pull/17838) implements this option.

- Cons: Saves only the inner block. A card still needs the block around the call for its
  size, so it ends up with two constructs, as with option A, plus a new parameter. The
  [demo dashboard](#prototype) needed both on the one card that used it.

**Option D: Let parallel fragments fill a placeholder created outside them**
(`ph = st.skeleton(); card(ph)`)

- Cons: Weakens the "no outside containers" rule that keeps parallel writes race-free.

With every option, the first visible element of the fragment ends the skeleton, so a cheap
element drawn first, such as a title, ends it early. Card headers belong in the main
script, and `st.card` draws them from its parameters.

### 2. Parallel fragments start after the layout is sent

**Option A: Default for full-app runs** ✅ PREFERRED

On a full-app run, parallel fragments are held while the script body runs. They start once
the body has finished and its messages have been sent to the browser, after a bounded wait
of at most 100ms. A rerun or stop requested during that wait starts none of them. Fragment
reruns and nested parallel fragments start immediately, as today. The `parallel` docstring
only promises that fragments *may* run concurrently with the rest of the script, so this
stays within the contract.

Prototype measurements with two CPU-bound loaders: the layout, footer, and both skeletons
reached the browser in **~100ms** instead of 750–850ms, and the cards finished 70–300ms
later than with an immediate start. For I/O-bound loaders, the cost is the duration of the
script body after the dispatch, which is milliseconds in a layout-first script.

- Pros: "Layout first" holds regardless of GIL-heavy work. Simple mental model: "parallel
  fragments run after the script".
- Cons: Behavior change. Slow work placed in the main script *after* the fragment calls now
  delays the fragments instead of overlapping with them (mitigation: document "put slow
  work in fragments"). A variant starts workers at "body finished or N ms after dispatch,
  whichever comes first", which bounds that delay but weakens the guarantee.

**Option B: Opt-in**, via a config option such as `runner.parallelFragmentStart =
"after_script" | "immediate"` or a new `parallel` value

- Pros: No behavior change.
- Cons: The bad behavior stays the default, and users can't easily tell that their loaders
  are CPU-bound.

**Option C: No change**

Document the GIL caveat and recommend I/O-bound loaders in parallel fragments.

### Behavior

| Situation                               | Behavior                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| First page load                         | The layout and skeletons reach the browser before any parallel fragment starts (change 2). Each fragment's first visible element replaces its skeleton in place |
| Full-app rerun                          | As shipped: content updates in place, and a slow rerun shows the skeleton over the old content after 0.5s                                 |
| The fragment's own rerun, fast          | Content updates in place, with no skeleton                                                                                                |
| The fragment's own rerun, slow          | The old content stays mounted, and the skeleton covers it after 0.5s (option A's inner block, or the parameter of option B or C)        |
| The fragment draws nothing, or raises   | Its skeleton clears when the run ends. An exception renders in the fragment's container as usual                                          |
| Rerun or stop during the change 2 wait  | None of the held fragments start                                                                                                          |

- **Spinners:** Inside any of these skeletons, the default cache spinner is hidden, and
  spinner text labels the skeleton, as shipped in #17920.
- **Cost:** Change 2 adds a wait of at most 100ms per full-app run that dispatches parallel
  fragments. Apps without parallel fragments pay nothing.
- **Compatibility:** Change 2 changes when parallel fragments start. AppTest and the agent
  API treat loading blocks as plain containers, so options B and C need no changes there.
- **Accessibility:** The skeletons reuse the shipped overlay, which marks covered content
  `aria-busy`.

### Interplay with `st.card`

The [`st.card` proposal](https://github.com/streamlit/streamlit/blob/923a80f855791d3cb420589687d631c46e39e309/specs/2026-08-23-st-card/product-spec.md)
fits this model:

- **The header is cheap by construction.** `label`, `caption`, `help`, and `icon` are card
  parameters drawn by the main script, so the fragment's first element is the expensive
  one.
- **The body has a known size.** `st.card(height=...)`, or `height="stretch"` in rows and
  `st.grid`, bounds the body, which is what option B needs to size its skeleton.

Required alignment with the card spec: it omits a body to which no elements are added. A
body holding only a pending loading block or fragment container must count as content.
Otherwise the card renders header-only first and grows when the body arrives.

## Prototype

Draft PR [#17838](https://github.com/streamlit/streamlit/pull/17838) implements option C of
change 1 and option A of change 2, on top of #17924 and #17920. A
[BI dashboard demo](https://github.com/streamlit/feature-demos/tree/main/layout-first-loading)
runs on it with simulated warehouse queries. It has 11 card bodies, each a parallel fragment
behind a skeleton, with cached loaders and explicit spinner texts. Sidebar controls switch to
a plain sequential script and to queries that hold the GIL.

- **First load:** the layout and all 11 skeletons appeared in the first paint, and every
  card had loaded about 2s later. Each card had the same height in its skeleton, loading,
  and loaded states.
- **Cached rerun:** no overlay appeared, and the keyed dataframe kept its row selection.
- **Cache miss with GIL-holding queries:** the overlays appeared after ~0.65s, labeled with
  each query's spinner text, and every card had updated after ~4.1s. The sequential script,
  with I/O-bound queries, updated its first card after 8.3s and hadn't finished after 14s.

Findings:

- Every card body needed the block around the call for its first-load size, including the
  one card with `loading="skeleton"`.
- On develop, an inner `with st.skeleton()` covers a fragment's own reruns just as
  `loading="skeleton"` does (see [What happens today](#what-happens-today)). That is why
  option A is preferred.
- A skeleton must be as tall as its content, or the first load shifts. Reruns keep the old
  content's size, so they never shift. For content without a `height` parameter, authors
  measure the height by hand: the demo hardcodes 184px for a bordered `st.metric` with a
  delta and a sparkline, and 34px for a caption below a table. `height="stretch"` in a
  bounded parent avoids the measurement.

## Alternatives considered

- **Card-level loading** (`st.card(..., loading=...)`): discoverable for dashboards, but it
  ties loading UI to one visual container. Skeletons and fragments cover cards and every
  other container.
- **Element-level loading state** (for example `st.line_chart(None, loading=True)`): sizes
  each skeleton perfectly and never changes element type, but needs a parameter on every
  element and doesn't cover multi-element bodies.
- **Deferred values** (`st.line_chart(st.defer(load, region))`, computed after the script):
  hides execution order behind values and doesn't fit widgets that return values.
- **Async scripts or process-based workers:** remove the GIL contention at the root, but are
  far larger architectural changes. Free-threaded Python would make change 2 matter less,
  not obsolete it.

## Rollout

| Step    | Change                                                                          | Kind                                         |
| ------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| Shipped | Keep the previous content under skeletons (#17924)                              | Bug fix                                      |
| Shipped | `with st.skeleton()` fills its slot, and spinners label it (#17920)             | Behavior change, product approved            |
| Next    | Change 2: parallel fragments start after the layout is sent                     | Behavior change of parallel fragment timing  |
| Next    | Change 1: docs for option A, or the `st.fragment` parameter for option B or C   | Docs, or a new parameter                     |

Change 2 doesn't depend on the change 1 decision, so it can ship first. #17946 updates the
embedded skill for the shipped pattern, and its `dashboard-metrics` template already uses
option A's inner block for cards with their own controls.

## Out of scope

- Batching several messages per websocket frame to cut GIL hand-offs while CPU-bound work
  runs. This speeds up message delivery for every app, not just dashboards; see the
  [tech spec](./tech-spec.md#follow-ups).
- Measuring skeleton heights automatically. Authors pass heights by hand, and a wrong
  height only shifts the first load.
- Skeleton shapes, `lines`, and animation options (already listed as future work in the
  [`st.skeleton` spec](../2026-05-13-st-skeleton/product-spec.md)).

## Open decisions

1. Fragment skeleton (change 1): option A, B, or C? For B or C, the name:
   `loading="skeleton"`, an enum that can grow ($16 Prefer Enums Over Booleans), or
   `show_skeleton=True`.
2. Parallel start (change 2): the default (option A) or opt-in (option B)? With the "or N
   ms" variant? The prototype implements option A without the variant, and the demo didn't
   need it.

## Checklist

| Item                       | ✅ or comment                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Works on SiS, Cloud, etc?  | ✅ Script-runner timing only; change 2 helps most on small hosts                                                    |
| No breaking API changes    | ⚠️ Change 2 changes when parallel fragments start; options B and C add an optional `st.fragment` parameter          |
| No new dependencies        | ✅                                                                                                                  |
| Metrics collected          | ✅ Existing `fragment` metrics, plus the new parameter for options B and C                                          |
| Any security/legal impact? | ✅ No                                                                                                               |
| Any docs changes needed?   | ✅ The `st.fragment` docstring (`parallel` timing, and the parameter for options B and C), the loading-patterns guide, and the embedded skill |
