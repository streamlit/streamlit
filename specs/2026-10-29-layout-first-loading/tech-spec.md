---
author: lukasmasuch
created: 2026-10-29
---

# Layout-first loading: technical design

Companion to the [product spec](./product-spec.md). It covers the two remaining fragment
changes. The skeleton mechanisms they build on shipped in #17924 and #17920.

## Context

What shipped:

- **Loading blocks.** `with st.skeleton()` turns its slot into a vertical `flex_container`
  with `Block.loading` (field 20). The frontend treats a loading block from the current run
  as pending until visible content from that run lands beneath it (`getLoadingBlockState`).
  During a fragment run, only the loading blocks of the running fragments wait
  (`fragmentIdsThisRun`). A pending block with previous-run children keeps them mounted and
  covers them after 500ms. A block without them shows its skeleton inline.
- **Skeleton slots.** `ThreadState.in_skeleton_slot` is set inside the block. A cache miss
  there hides the default spinner, and spinner text gets `Spinner.skeleton_label`, which the
  block shows as its label. `ThreadState.scoped()` keeps the flag, and a parallel worker
  copies the dispatching thread's context, so a fragment called inside the block inherits
  it on full-app runs.
- **Composition.** The pre-allocated container of a parallel fragment advances the block's
  cursor, so `__exit__` doesn't clear the skeleton. The empty container isn't visible
  content, so the skeleton stays until the worker draws.

How fragments run:

- A full-app run calls the fragment in place. For `parallel=True`,
  `_dispatch_parallel_fragment` pre-allocates the fragment's container on the script thread
  and submits the body to `ParallelFragmentCoordinator`, which starts it right away on a
  worker thread.
- A fragment-only rerun (`run_every`, or a widget inside the fragment) runs only the body,
  inside the container that the `_fragment` wrapper creates with `st.container()`. A block
  around the call isn't re-entered.

## Measurements

**Fragment-only reruns on develop.** A test app has one bordered card with
`with st.skeleton(height=200)` around a fragment call, and a button inside the fragment
that makes its next rerun take 2s. A Playwright script tagged the chart's DOM node, clicked
the button, and sampled the card every 50ms under `make debug`:

| Variant                                              | Overlay                          | Chart node |
| ---------------------------------------------------- | -------------------------------- | ---------- |
| The same block in the main script (control)          | After ~0.64s                     | Kept       |
| Block around the call only, parallel fragment        | None; the chart fades as stale   | Kept       |
| Plus an inner `with st.skeleton()`, parallel         | After ~0.63s                     | Kept       |
| Plus an inner `with st.skeleton()`, not parallel     | After ~0.64s                     | Kept       |

**Parallel fragments with CPU-bound loaders.** The setup is a two-card dashboard. Each card
is a `@st.fragment(parallel=True)` running a cached 2s pure-Python loader and rendering a
220px chart, followed by 40 cheap elements. A `ForwardMsgQueue.on_before_enqueue_msg` hook
recorded enqueue times in memory, and a Playwright script sampled the DOM every 40ms. Both
ran under `make debug` with Python 3.13 (GIL enabled) on macOS. Each column shows when the
browser first had that content from the run:

| Variant                                                               | Footer   | Skeletons     | Cards done |
| --------------------------------------------------------------------- | -------- | ------------- | ---------- |
| Immediate start (skeleton inside the fragment body)                   | ~750ms   | ~190–230ms    | ~2.15s     |
| Deferred start only                                                   | ~810ms   | ~850ms        | ~2.12s     |
| Deferred start + flush gate + skeleton sent by the script thread      | ~100ms   | ~100ms        | ~2.2–2.4s  |

The script thread reached the footer after ~10ms in every variant, so the delay is
delivery. The event loop handles every enqueue, and `Runtime._loop_coroutine` sends each
message as its own websocket frame followed by `await asyncio.sleep(0)`. Each of those
steps releases the GIL and has to wait to get it back from the busy workers. A standalone
microbenchmark of 60 `call_soon_threadsafe` posts made while N pure-Python threads ran took
8ms with 0 threads, 0.8s with 1, 1.4s with 2, and 2.06s with 4. Deferring the start alone
doesn't help when the skeleton is inside the fragment body, because the body also runs
late.

> Measurement pitfall: a first version of the tracer wrote each message to a file on the
> event-loop thread, which put the footer at ~2.1s. Every GIL release on that thread gets
> amplified while CPU-bound threads run, so the hook buffers in memory.

## Design

### Change 1: fragment skeleton (options B and C)

- `_fragment(..., show_skeleton=True)` creates the fragment's container with
  `open_loading_block()` instead of `st.container()`. Both places that create the container
  do this:
  - The wrapper, for inline runs and fragment-only reruns.
  - `_dispatch_parallel_fragment`, on the script thread, for parallel full-app runs. The
    skeleton is part of the main script's first flush, even while the worker is held
    (change 2) or waits for a free thread.
- The body runs with `in_skeleton_slot=True`, so its spinners label the skeleton.
- A fragment rerun re-sends its container at the same path with `loading`. `AppRoot.addBlock`
  keeps the children for the same block type, so they stay mounted under the overlay until
  the first fresh visible element. The frontend does all clearing, so nothing crosses
  threads.
- **Option B sizing.** The container leaves `Loading.skeleton_height` unset. The frontend
  sizes an unset skeleton to fill its parent when the parent has a definite height, using
  the check that `height="stretch"` blocks already make, and to the minimum element height
  otherwise. Option C always uses the minimum element height.

### Change 2: start parallel fragments after the layout is sent

- `ParallelFragmentCoordinator.submit(..., defer=True)` is used for dispatches from the
  script thread during a full-app run. Deferred work counts toward `_outstanding` but is
  held in a list.
- `join()` first waits on a flush gate, then submits the held work, then runs the existing
  join loop. `AppSession` keeps `threading.Event` waiters that `on_flushed_messages_sent()`
  releases once the browser queue is empty and the last flush has been sent. The Runtime
  empties the queue before it sends the messages one per event-loop turn, so an empty queue
  alone doesn't mean "sent". `ScriptRunContext.wait_for_flush` passes the wait to the
  coordinator.
- `_FLUSH_GATE_TIMEOUT_SECS = 0.1` bounds the wait, which also covers sessions without a
  client (AppTest, bare mode).
- A rerun or stop requested during the wait starts none of the held work. `drain()` drops
  it and adjusts `_outstanding`.
- Dispatches from workers (nested parallel fragments) and fragment reruns submit
  immediately, as today.

The "or N ms after dispatch" variant would add a timer per coordinator that submits the
held list early.

## Prototype

Draft PR [#17838](https://github.com/streamlit/streamlit/pull/17838) implements option C of
change 1, spelled `loading="skeleton"`, and change 2 as designed above, on top of #17924
and #17920. Its results are in the [product spec](./product-spec.md#prototype).

It also stops a delayed `st.spinner` message from raising `StopException` tracebacks when
its run has already stopped, which stopped parallel fragment runs triggered. That bug
predates this work and can be fixed separately.

## Risks and edge cases

- **The first element ends the skeleton.** A cheap element drawn first inside a fragment,
  such as a caption or title, ends the skeleton before the expensive part arrives.
  Guidance: keep headers in the main script, which `st.card` does with its parameters, or
  draw the expensive element first.
- **Change 2 regressions.** Apps with slow main-script work after the fragment calls lose
  that overlap. Extend the parallel-fragment perf benchmarks to cover the time to the last
  fragment.
- **Option B in an unbounded parent.** The skeleton falls back to the minimum element
  height, so the first load shifts. Document the block around the call for that case.
- **Queued workers with option A.** The inner block only appears once the worker starts.
  The block around the call covers the fragment until then.
- **Empty `st.card` bodies.** The card spec's "empty body is omitted" check must count a
  pending loading block as content.

## Test plan

- **Python unit:**
  - Options B and C: `Block.loading` on the container for inline runs, fragment reruns,
    and the pre-allocated parallel container, and `in_skeleton_slot` in the body.
  - Coordinator deferral, the flush gate and its timeout, a rerun during the wait, and
    `drain()` dropping held work.
  - The `AppSession` flush waiter, including a waiter added while a flush is being sent.
- **Frontend unit (option B):** an unset fragment skeleton fills a parent with a definite
  height and falls back to the minimum element height otherwise.
- **E2E:**
  - A slow fragment-only rerun covers the old content after the grace period and keeps
    the element mounted, with option A's inner block or the new parameter.
  - `st_fragment_parallel` keeps passing.
- **Perf:** the parallel-fragment benchmarks measure the time to the first paint and to the
  last fragment under CPU-bound loaders.
- **Typing and AppTest:** the new `st.fragment` parameter of options B and C is covered in
  the typing tests, and its container parses as a plain container.

## Follow-ups

- **Batch message delivery.** Sending several ForwardMsgs per websocket frame, or dropping
  the per-message `asyncio.sleep(0)`, cuts GIL hand-offs while CPU-bound work runs. It
  benefits every app, including single-threaded scripts with pure-Python hot loops.
- **Frontend spinner delay.** Move `st.spinner`'s 0.5s delay to the frontend. Its backend
  timer is starved the same way.
- **Card header loading indicator.** Show a card body's loading state in the `st.card`
  header (`icon="spinner"`).
