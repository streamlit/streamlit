---
author: lukasmasuch
created: 2026-10-29
---

# Layout-first loading: technical design

Companion to the [product spec](./product-spec.md). This document explains why today's
patterns fail at the delta-path level, records the measurements, and describes how each of
the five changes works.

## Context

Three mechanisms decide what the user sees during a rerun:

- **Stale nodes.** Each run rewrites the element tree path by path. A node from the previous
  run stays in place, faded by CSS after 0.5s (`STALE_TRANSITION_PARAMS`), until a delta
  replaces it or `ClearStaleNodeVisitor` removes it when the run finishes.
- **Transients.** A `new_transient` delta wraps the node at its path in a `TransientNode`,
  with that node as the *anchor*. `RenderNodeVisitor.visitTransientNode` renders the
  transient elements *before* the anchor and never hides it. Transients don't use up a
  delta-path index. `st.spinner`, cache spinners, and `with st.skeleton()` all use them.
- **React identity.** `RenderNodeVisitor` keys each child by its element ID, or by its index
  when it has none. When the element type at a key changes, `ElementNodeRenderer` renders a
  different component, and the old one is unmounted.

Today's delta paths for a card body (`F` is the fragment's container):

```
with st.skeleton(): ...; st.chart()        ph = st.skeleton(); ph.chart()
F                                          F
├── F/0  empty  ◄─ transient skeleton      └── F/0  skeleton → chart
│                  renders before it                (type change at one key:
└── F/1  chart  ◄─ previous run's chart,             remount unless both deltas
                   visible until replaced            share a flush and render batch)
```

In context-manager mode, `__enter__` replaces the skeleton with an `empty` at `F/0` and
anchors the transient there. The content goes to `F/1`, so on a cache miss the transient
skeleton and the stale chart at `F/1` are both visible. In standalone mode the skeleton
and the chart share `F/0`. They are only merged when both reach the `ForwardMsgQueue`
within one 5ms flush (`MESSAGE_FLUSH_INTERVAL_SECS`), which a cache hit that unpickles a
large result or builds a figure easily misses.

## Measurements

The setup is a two-card dashboard, with each card a `@st.fragment(parallel=True)` running a
cached 2s loader and rendering a 220px chart, plus optional cheap elements after the cards.
A Playwright script sampled the DOM every 40ms, and a DOM marker on each chart detected
remounts. A `ForwardMsgQueue.on_before_enqueue_msg` hook recorded enqueue times in memory.
Everything ran under `make debug` with Python 3.13 (GIL enabled) on macOS. The scripts are
not committed (`work-tmp/debug/skeleton_dash/`).

> Measurement pitfall: a first version of the tracer wrote each message to a file on the
> event-loop thread, which put the footer at ~2.1s. Every GIL release on that thread gets
> amplified while CPU-bound threads run (see the microbenchmark below), so the hook buffers
> in memory.

**Cache-miss rerun, I/O-bound loader** (card body; `*` = same DOM node as before the rerun):

| Pattern              | 0–0.5s           | 0.5s–2.1s                                   | End             |
| -------------------- | ---------------- | ------------------------------------------- | --------------- |
| `with st.skeleton()` | stale chart\*    | skeleton 220px **+** stale chart\* 220px    | chart\*         |
| `with slot.skeleton()` | stale chart\*  | skeleton **+** stale chart\*; ~70ms skeleton **+** fresh chart | chart\* |
| standalone           | skeleton (immediately) | skeleton                              | chart (remounted) |
| prototype (change 1) | stale chart\*    | overlay over stale chart\* at 220px         | chart\*         |

**Cached rerun with 50ms of work on the hit:** standalone flashed the skeleton for ~130ms
and remounted the chart. The prototype never made the overlay visible and kept the chart and
dataframe nodes.

**Parallel fragments with CPU-bound loaders** (two pure-Python loaders, 40 cheap elements
after the cards). Each column shows when the browser first had that content from the run:

| Variant                                                               | Footer   | Skeletons     | Cards done |
| --------------------------------------------------------------------- | -------- | ------------- | ---------- |
| Today (skeleton inside the fragment body)                             | ~750ms   | ~190–230ms    | ~2.15s     |
| Deferred start only                                                   | ~810ms   | ~850ms        | ~2.12s     |
| Deferred start + flush gate (50ms) + main-thread placeholder          | ~100ms   | ~100ms        | ~2.2–2.4s  |

The script thread reached the footer after ~10ms in every variant, so the delay is
delivery. The event loop handles every enqueue, and `Runtime._loop_coroutine` sends each
message as its own websocket frame followed by `await asyncio.sleep(0)`. Each of those
steps releases the GIL and has to wait to get it back from the busy workers. A standalone
microbenchmark of 60 `call_soon_threadsafe` posts made while N pure-Python threads ran took
8ms with 0 threads, 0.8s with 1, 1.4s with 2, and 2.06s with 4. Deferring the start alone
doesn't help when the skeleton is inside the fragment body, because the body also runs
late.

## Design

### Change 1: the rule for element skeletons (frontend only)

**Visible content** means an `ElementNode` whose type is not `skeleton` or `empty`, or a
`BlockNode` that contains one. Transients, such as spinners, are never children, so they
can't count.

A rule in `AppRoot.applyDelta` for `newElement` decides what happens to the slot. It applies
when the incoming element is a skeleton and the node at the path, after unwrapping a
transient anchor, holds visible content from a different `scriptRunId`.

In that case the old node stays in the tree with the skeleton attached as
`pendingSkeleton`. The prototype used a new readonly field on the node; a `TransientNode`
with an overlay mode is the alternative if reviewers prefer to keep it in the transient
family. It keeps the old node's `scriptRunId`, so its stale state and keys don't change.
Otherwise the skeleton replaces the node exactly as today.

- **Rendering.** `ElementContainer`, and the block container for block anchors, draws the
  overlay as an absolutely positioned `::after` with `inset: 0`. It is covered by
  `opacity: 0`, and a CSS animation fades it in after 500ms. The grace period lives in the
  browser, so no backend timer is involved and it can't be starved. The overlay covers the
  anchor's own box, so its size matches the content exactly. `STALE_STYLES` is skipped while
  the overlay is pending, so the overlay itself isn't faded. The pulse animation and
  `prefers-reduced-motion` handling match `Skeleton`.
- **Replacement.** Any later delta at the path replaces the node as usual. New content with
  the same key and type reconciles in place, which is what preserves state.
- **End of run.** In `ClearStaleNodeVisitor.visitElementNode` (and the block equivalent), a
  node whose `pendingSkeleton` belongs to the current run collapses to the skeleton. This
  keeps "a standalone skeleton persists until replaced". Fragment-run rules apply unchanged.
- **Interaction and accessibility.** The visible overlay catches pointer events. The
  container gets `aria-busy="true"` while a skeleton is pending, and the overlay is
  `aria-hidden`. Moving keyboard focus out of covered widgets needs `inert` once the overlay
  is visible, set from an `animationstart` handler. Fullscreen elements skip the overlay.

### Loading blocks: one mechanism for changes 2 and 3

`with st.skeleton()` slots and fragment containers both become ordinary vertical containers
(`flex_container`) with a new `loading` field. Reusing the container type, rather than
adding a block type, keeps both layout-identical to `st.container()`. `Transparent` can't
be used because it renders no DOM node to draw the overlay on.

```proto
// Block.proto
optional Loading loading = 18;

message Loading {
  // Skeleton size while the block has nothing to keep (first load).
  optional streamlit.HeightConfig skeleton_height = 1;
}
```

On the frontend, a `BlockNode` from the current run with `loading` set is **pending** until
fresh visible content lands anywhere beneath it:

- `SetNodeByDeltaPathVisitor` already rebuilds every node on the path to a new element. When
  the element is visible content, it marks the pending loading blocks on that path as
  resolved. This costs no extra traversal, which matters because delta-tree updates are a
  performance hot path.
- While pending, a block with no previous-run children shows the skeleton inline, right
  away, at `skeleton_height` (or `"stretch"` in a bounded parent). A block that has
  previous-run children shows them with the change 1 overlay after the 500ms grace period.
  `AppRoot.addBlock` already inherits children for the same block type, which keeps those
  children mounted.
- A block stops being pending when it resolves, when it is re-sent without `loading`, or
  when the run ends, at which point `ClearStaleNodeVisitor` drops `loading` from
  current-run blocks.

### Change 2: `with st.skeleton()`

- `SkeletonPlaceholder.__enter__` replaces the call-time skeleton at slot `S` with
  `add_block(S, flex_container + loading{skeleton_height})`. It pushes that block's
  DeltaGenerator onto the context stack, the way `with st.container()` does, and stores the
  block's `_block_delta_path`.
- `__exit__` pops the block. If nothing was written into it (its cursor is still at index
  0), it re-sends the block without `loading`, at the stored path, the way `st.status`
  re-sends its block. That clears the skeleton for `with st.skeleton(): data = load()`
  blocks that write elsewhere. Otherwise there is nothing to send, because the first
  visible element has already resolved the block, or will. The exception path also
  re-sends without `loading`.
- **Composition (change 3 option B).** A parallel fragment called inside the block
  advances its cursor (the pre-allocated fragment container), so `__exit__` doesn't clear.
  The empty fragment container is not visible content, so the skeleton stays until the
  worker draws its first element. No message from the worker is needed.
- **Sequencing on reruns.** The call-time skeleton lands on the previous run's block, and
  change 1 keeps that block. The loading re-send then inherits the previous children, so the
  previous run's chart stays mounted throughout.
- **Integration.** AppTest and the agent API treat the block as a plain container. The
  `loading` field is presentation only.

### Change 3: fragment-level skeleton

`_fragment(..., loading="skeleton")` sets `Block.loading` on the container the fragment
renders into. Every run passes through one of two places that create that container:

- The wrapper's `st.container()` creates it for inline runs and fragment-only reruns.
- `_dispatch_parallel_fragment` pre-allocates it on the script thread for parallel full-app
  runs. The skeleton is therefore part of the main script's first flush, even when the
  worker is deferred (change 4) or queued behind `runner.parallelMaxWorkers`.

A fragment rerun re-sends its container at the same path with `loading`. The container
keeps its children, which show with the grace-period overlay until the first fresh visible
element. The frontend does all clearing, so nothing crosses threads. The prototype's
main-thread skeleton in the pre-allocated container approximates this for full-app runs.

### Change 4: start parallel fragments after the layout is sent

- `ParallelFragmentCoordinator.submit(..., defer=True)` is used for dispatches from the
  script thread during a full-app run. Deferred work counts toward `_outstanding` but is
  held in a list.
- `join()` first waits on a flush gate, then submits the held work, then runs the existing
  join loop. The gate is a `threading.Event` that `AppSession.on_flushed_messages_sent()`
  sets once every message enqueued before `join()` was called has been sent. A
  `_FLUSH_GATE_TIMEOUT_SECS` of about 0.1 bounds the wait, which also covers sessions
  without a client (AppTest, bare mode). `yield_check()` keeps running during the wait so
  that rerun and stop requests still preempt.
- Dispatches from workers (nested parallel fragments) and fragment reruns submit
  immediately, as today.
- `drain()` drops never-started work and adjusts `_outstanding`.

The "or N ms after dispatch" variant would add a timer per coordinator that flushes the
held list early.

### Change 5: spinners inside a skeleton

The `with st.skeleton()` body and a fragment body with `loading` both set a `ContextVar`,
`active_skeleton_slot`, for their duration. A worker's fragment body sets it itself, so
parallel runs are covered as well.

- **Auto-generated text.** In `CachedFunc.__call__`, a `show_spinner=True` miss while
  `active_skeleton_slot` is set produces no spinner. The skeleton is the loading indicator.
- **Explicit text.** For `show_spinner="..."` and `st.spinner("...")`, the `Spinner` proto
  gets a new `skeleton_label` flag. The spinner is still a transient at the current cursor.
  `RenderNodeVisitor` lifts flagged spinner transients found under a pending loading block
  and passes them to the block renderer, which centers them on the skeleton. Once the block
  resolves, a still-running flagged spinner renders inline, as today. This also lands the
  skeleton label listed as future work in the `st.skeleton` spec.

## Prototype

About 100 lines, not committed: `work-tmp/debug/skeleton_dash/prototype.patch`.

| Piece                                                                                      | Approximates                     |
| ------------------------------------------------------------------------------------------ | -------------------------------- |
| `ElementNode.pendingSkeleton`, the `AppRoot` rule, the `ClearStaleNodeVisitor` collapse, and a delayed `::after` overlay in `ElementContainer` | Change 1 for element anchors |
| Deferred submit in `ParallelFragmentCoordinator`, with a fixed 50ms sleep as the flush gate | Change 4                         |
| A `st.skeleton()` written into the pre-allocated fragment container on the script thread before the worker's cursor copy | Change 3 option A on full-app runs |

It validated:

- Cached reruns never show the overlay and keep chart and dataframe nodes.
- Cache misses overlay at the content's exact size, and the content then updates in place.
- On a cold page load, the cheap layout and all skeletons appear in the first paint, with
  no layout shift, under CPU-bound loaders.

It did not validate block anchors, loading blocks and their resolve-on-first-content
marking, fragment-only reruns, spinner labels, or the real flush gate.

## Risks and edge cases

- **The first element ends the skeleton.** A cheap element drawn first inside a `with`
  block or fragment, such as a caption or title, ends the skeleton before the expensive
  part arrives. Guidance: keep headers outside, which `st.card` does with its parameters,
  or draw the expensive element first.
- **Loading blocks are one flex item.** Inside a horizontal container, the children of a
  `with st.skeleton()` slot stack vertically, as they would in `st.container()`. Document
  this.
- **Remounts from identity changes.** Content that changes identity still remounts, for
  example an unkeyed dataframe whose ID includes its data. This is unchanged and
  documented.
- **Change 4 regressions.** Apps with slow main-script work after the fragment calls lose
  that overlap. Extend the parallel-fragment perf benchmarks to cover the time to the last
  fragment.
- **Overlay stacking.** Elements with their own portals or toolbars (dataframe, charts)
  render above `cacheSpinner` z-index layers. Verify the overlay's z-index against
  `theme.zIndices`.
- **Empty `st.card` bodies.** The card spec's "empty body is omitted" check must count a
  pending loading block as content.

## Test plan

- **Frontend unit:**
  - The `AppRoot` skeleton-over-stale rule, including excluded types and same-run
    skeletons.
  - Loading blocks resolve on the first visible descendant, but not on skeletons, empties,
    or transients.
  - Inline versus overlay rendering, and clearing on re-send or at the end of the run.
  - Node identity is kept on replacement.
  - `aria-busy` is set and the overlay is `aria-hidden`.
  - Flagged spinner transients render as skeleton labels.
- **Python unit:**
  - `with st.skeleton()` enter and exit messages and paths: written, not written, the
    exception path, and a parallel fragment inside.
  - `loading` is set on the fragment container for inline runs, fragment reruns, and
    pre-allocated parallel containers.
  - Spinner suppression and labeling via `active_skeleton_slot`, on the script thread and
    in workers.
  - Coordinator deferral, the flush-gate timeout, and `drain()` dropping deferred work.
- **E2E:** a dashboard app checked by bounding box and DOM identity:
  - Skeletons reserve their final height on a cold load.
  - No visible skeleton and the same chart node on a cached rerun.
  - On a miss, the overlay appears after the grace period over the same box, and a keyed
    dataframe keeps its scroll position.
  - A fragment-only rerun with `loading="skeleton"` shows the overlay on a miss.
- **Typing and AppTest:** the new `st.fragment` parameter is covered in the typing tests,
  and loading blocks parse as plain containers.

## Follow-ups

- **Batch message delivery.** Sending several ForwardMsgs per websocket frame, or dropping
  the per-message `asyncio.sleep(0)`, cuts GIL hand-offs while CPU-bound work runs. It
  benefits every app, including single-threaded scripts with pure-Python hot loops.
- **Frontend spinner delay.** Move `st.spinner`'s 0.5s delay to the frontend as well. Its
  backend timer is starved the same way.
- **Card header loading indicator.** Show a card body's loading state in the `st.card`
  header (`icon="spinner"`).
