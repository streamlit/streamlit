---
author: lukasmasuch
created: 2026-07-19
---

# Keep displaced keyed elements mounted during reruns

## Summary

When a rerun inserts output above an element, the frontend overwrites that element's
delta path before the element itself is re-emitted one slot later. React unmounts it and
then mounts a fresh copy, even though its element ID never changed. This spec keeps such
a displaced, prior-run element mounted next to the block's `children`, hidden unless it
holds focus. The same element arriving later in the run reclaims it, and the existing
successful-run cleanup unmounts it if it never arrives. Delta-path addressing,
progressive rendering, and the post-cleanup tree stay exactly as they are today. The
change is frontend-only, with no protobuf, backend, or public API change.

## Problem

### How the tree is built during a rerun

The backend `RunningCursor` assigns positional delta paths as the script runs. The
frontend applies each delta immediately to the previous run's tree through
`SetNodeByDeltaPathVisitor`, which overwrites the node at that path. Nodes the new run
has not reached yet stay visible as stale, and `clearStaleNodes` removes the unreached
ones only after a successful full or fragment run.

`RenderNodeVisitor` keys each child by its element ID (or `Block.id`) when present, and
by its sibling index otherwise. React keeps a component only while its key is present
in every consecutive commit under the same parent. Take this script:

```python
if st.toggle("Show notice"):
    st.info("Notice")
    expensive_computation()
st.text_input("Name", key="name")
```

The notice's delta overwrites the text input at index 1, so React unmounts the text
input. When the input's delta arrives at index 2 with the same element ID, React can only
mount a new instance. Widget values and `WidgetStateManager.elementStates` restore some
state after the remount. They cannot restore an iframe document, component-local React
state, an in-progress edit, focus, or a selection.

### What users lose today

Measured on `develop` with a probe app and Playwright (DOM node identity tracked across
the rerun):

| Scenario | Today |
|---|---|
| Notice inserted above a keyed `text_input` and `data_editor`, with work in between | Both remount |
| The same, with no explicit delay between deltas | `text_input` survives in one React batch; `data_editor` still remounts, because serializing its Arrow payload is enough time for a commit |
| Notice inserted above a declared v1 custom component | Iframe reloads |
| Fragment rerun inserts a notice above a focused `text_input` while the user types | Focus and the uncommitted text are lost |
| Notice inserted above `st.columns` containing a keyed widget | Widget remounts (the whole column block is overwritten) |

The problem doesn't depend on the artificial sleeps in our E2E apps: any element whose
backend work lets the browser commit before it is re-emitted is affected. It belongs to
the same positional-shift family as
[#8239](https://github.com/streamlit/streamlit/issues/8239) and
[#6257](https://github.com/streamlit/streamlit/issues/6257). Keyed tabs, expanders, and
popovers now restore their selected state after a remount, but the general leaf lifecycle
problem remains. Containers losing state without a key is tracked in
[#14492](https://github.com/streamlit/streamlit/issues/14492).

### Behavior that already works and must not regress

- **Same-position updates and moves earlier.** The incoming node keeps its React key, and
  first-wins dedup in `RenderNodeVisitor` suppresses the stale copy further down.
- **Same-run replacement.** `st.empty()`, `st.write_stream`, and other locked-cursor
  writes overwrite the same path within one run immediately.
- **Transient elements.** `TransientNode` anchors and replacement rules for spinners stay
  untouched.
- **Progressive rendering and stale cleanup.** Output appears delta by delta. Successful
  full and fragment runs remove only the stale nodes in their scope, and early reruns keep
  them.
- **Block child inheritance.** `AppRoot.addBlock` inherits the children of a same-typed
  block at the same path.
- **Agent snapshots.** `merge_deltas` mirrors the frontend's placement rules, so placement
  must not change.

### The unavoidable trade-off

When a prior-run element is overwritten, the frontend can't know whether the same ID will
come back later in the run. Keeping it mounted for that window means delaying the unmount
of elements that are really gone until the run outcome is known. The proposal therefore
keeps the window invisible: a retained element leaves the layout exactly when it does
today, and it is unmounted at the existing cleanup boundary.

## Goals and non-goals

Goals:

- An eligible element that shifts later within the same parent, because output was
  inserted above it, keeps its component instance. React doesn't move its DOM node, so
  iframes don't reload (exceptions under [Known limitations](#known-limitations)).
- A focused element that gets displaced keeps focus and uncommitted input.
- `children` is identical to today after every delta and every cleanup.
- Visible layout during a run is identical to today, except that a focused displaced
  element stays visible.

Non-goals for this phase:

- Moving an element across parents, root containers, or pages. React keys are scoped to
  the parent.
- Retaining blocks, including keyed blocks, or leaves inside a block that shifts. See
  [Known limitations](#known-limitations).
- Elements without a generated `$$ID-` element ID.
- Any public API or protocol change.

## Proposal

### 1. Retained elements live beside `children`

`BlockNode` gets one immutable, non-positional field:

```typescript
interface RetainedElement {
  readonly node: ElementNode // the displaced prior-run node
  readonly id: string // its element ID
  readonly before: number // renders immediately before children[before], or at the end
}

class BlockNode {
  readonly children: AppNode[] // unchanged, still the only delta-addressable list
  readonly retained: readonly RetainedElement[] // ordered by `before`
}
```

`retained` never takes part in delta-path traversal, `isEmpty`, child counts, divider
colors, `ElementsSetVisitor`, or `getActiveIds`. It is empty in steady state and
non-empty only between a displacement and the end of a successful run.

An element is **retainable** if it is an `ElementNode` with a generated element ID,
`hasOneShotEffect` is unset, and its type isn't on a short denylist:

- `toast`, because its lifetime is owned by the toast queue and `ClearStaleNodeVisitor`
  never removes it.
- `audio` and `video`, because playback would keep going while the element is hidden.
- `cameraInput` and `audioInput`, because capture devices would stay active.

Retention applies only when the occupant comes from a **prior run**
(`occupant.scriptRunId !== currentRunId`). That keeps same-run locked-cursor replacement
immediate and guarantees that no current-run node can outlive cleanup.

### 2. Updating retention on a direct write

Only the block whose direct child is written updates `retained`. Ancestors rebuilt along
the delta path copy it unchanged. When node `N` is written at index `j`, replacing
occupant `O` (which may be `undefined` for an append):

1. **Reclaim.** If `N` has an element ID that matches a retained entry, remove that
   entry. `N` takes over its React key, so React keeps the instance, and rule 3 then
   places `N` in front of the remaining entries at this slot.
2. **Same key, no change.** If `O` exists and `N` has the same React key as `O` (the same
   element or block ID, or both unkeyed and therefore keyed by the same index), React
   updates the instance in place, and every retained entry stays where it renders.
3. **New key at this slot.** Otherwise `N` is a fresh insertion. Entries anchored at `j`
   move to `j + 1`, keeping their order, so `N` renders in front of them. If `O` is
   retainable, from a prior run, and has an ID different from `N`'s, `O` joins them at
   `j + 1`, after the moved entries and before any entries already anchored at `j + 1`.
   Otherwise `O` is dropped exactly as today.

Writes whose target or occupant is a `TransientNode` skip these rules. The rare transient
*insertion* path shifts later children by one, so entries anchored after `j` shift by one
too.

Anchors use canonical indices, which never shift during a run (positional overwrite only
replaces or appends). Run boundaries therefore need no bookkeeping: an interrupted run
leaves `retained` in exactly the order it renders, and the next run continues from there.

Two insertions above `W`, with `Z` keyed too:

```text
previous run             React: [A, W, Z]
at 0: A' replaces A      same key, nothing moves                 React: [A', W, Z]
at 1: X1 replaces W      children [A', X1, Z]   retained [W@2]       React: [A', X1, W~, Z]
at 2: X2 replaces Z      children [A', X1, X2]  retained [W@3, Z@3]  React: [A', X1, X2, W~, Z~]
at 3: W' appended        reclaims W             retained [Z@4]       React: [A', X1, X2, W', Z~]
at 4: Z' appended        reclaims Z             retained []          React: [A', X1, X2, W', Z']
```

`W@2` means `W` renders right before `children[2]`, and `~` marks a hidden retained copy.
React only ever inserts `X1` and `X2` in front of `W`; it never moves `W` or `Z`.

### 3. Rendering

`RenderNodeVisitor.collectReactElements` walks `k = 0..children.length`. At each `k` it
first renders the retained entries anchored there (or past the end), then `children[k]`.
A retained entry:

- is keyed by its element ID and never advances the positional index, so canonical
  unkeyed siblings keep their keys;
- goes through the existing first-wins dedup. Usually a current-run copy can't exist,
  because the write that would create one reclaims the entry. The exception is an element
  that moved earlier: its stale copy further down can be displaced and retained after the
  current copy was written. That copy always renders behind the current one, so dedup
  ignores it. A displaced copy whose ID is already retained isn't added again, so there
  is at most one entry per ID; and
- renders through the normal `ElementNodeRenderer` subtree with an `isRetained` flag. The
  flag must reach `ElementContainer` without changing the subtree's shape, for example
  through a context provider that every element renders, because toggling the shape would
  remount the subtree.

When `retained` is empty, the visitor runs exactly as today. The projection is a pure
function of the `BlockNode`, so `ChildRenderer`'s memoization on `node` still holds.

### 4. Parking: hidden unless focused

`ElementContainer` applies stale styling and `&:not(:focus-within) { display: none }`
to a retained element.

- `display: none` removes the element from layout (no flex gap), from the accessibility
  tree, from the focus order, and from pointer input, while keeping the DOM subtree and
  any iframe document alive. Visible layout therefore matches today's overwrite, and
  `aria-hidden` and `inert` aren't needed.
- The `:focus-within` exception matters because hiding a focused control is not neutral.
  A browser probe showed that Chromium and Firefox fire `blur` and `focusout`, and
  `TextInput` commits a dirty value on blur, which would request a rerun in the middle of
  a run. WebKit fires nothing and leaves focus on the now-invisible field. With the
  exception, a focused retained element stays visible and faded in
  its previous place, interactive like any stale element today, until it is reclaimed or
  the user moves focus away.

### 5. Lifecycle

| Event | Retained entries |
|---|---|
| Successful full run | All removed by `clearStaleNodes` before `removeInactiveWidgetState`, so widget state cleanup keeps its current boundary |
| Successful fragment run | `ClearStaleNodeVisitor` applies its element rule to each entry with the same visitor it uses for that block's children, so only entries the canonical rule would remove go |
| `FINISHED_EARLY_FOR_RERUN`, compile error | Kept, like canonical stale nodes, so the next run can reclaim them |
| Canonical children removed (stale sweep, transient clear) | Re-anchored: `before` becomes the number of surviving children that preceded the old anchor |
| Same-type `addBlock` child inheritance | Inherited together with `children`, including the dialog identity guard |
| Page filtering (`FilterMainScriptElementsVisitor`) | Dropped. There is no retention across pages, and dropping avoids holding entrypoint elements whose widget state the page change already cleans up |
| Parent replaced by a different block type, or the app tree reset | Gone with the block |

The retained set is bounded by the distinct eligible IDs displaced since the last
successful run in scope. Updating it costs O(retained) per direct write, which is usually
zero work, and rendering adds O(retained) to the existing O(children) pass.

### Known limitations

- **Leaves inside a shifted block still remount.** If the insertion above lands at the
  block's level (for example above `st.columns`), the block is overwritten and its whole
  subtree goes with it. Unkeyed blocks have no identity to reclaim by. Keyed blocks
  (`st.container(key=)`, keyed tabs and expanders) could be retained with the same
  mechanism. That needs reclaim-aware child inheritance (inherit from the retained block,
  not the positional occupant) and hiding rules for transparent, portal, and tab blocks,
  and is left to a follow-up phase.
- **Unkeyed overwrites after a displacement.** A second inserted unkeyed element (for
  example an `st.info` overwriting a trailing `st.markdown`) reuses that sibling's index
  key. React then treats it as the old node, which rendered after the retained element,
  and moves the retained element's DOM node once. Component state survives, but an iframe
  (only legacy v1 custom components) reloads and focus drops. Including the element type
  in positional keys avoided this in the prototype, but it changes the key of every
  unkeyed element, so it's left out.
- **Reorders.** Keyed siblings that change order still cause React DOM moves, as they do
  today.

## Validation

A throwaway prototype of this design (about 300 added lines in `render-tree/` and
`Block/`, half of them in one new helper module) was run against the probe app in
Chromium, Firefox, and WebKit:

| Scenario | `develop` | Prototype |
|---|---|---|
| One or two notices inserted above a keyed `text_input` and `data_editor` | Remount | Same DOM node; hidden while displaced |
| One notice inserted above a v1 custom component | Iframe reloads | Same iframe document |
| Two notices above a v1 custom component, the second overwriting trailing markdown | Iframe reloads | Iframe reloads, component instance kept (known limitation) |
| Fragment rerun inserts above a focused `text_input` | Focus and typed text lost | Focus and typed text kept |
| `number_input` replaces a `text_input` (genuine removal) | Replaced immediately | Hidden immediately, unmounted at cleanup |
| Insert above `st.columns` | Remount | Remount (known limitation) |

A screenshot taken mid-run, while the text input was retained, matched the `develop`
screenshot. Layout and content were the same; the only differences were 1,171 pixels of
canvas anti-aliasing inside the data editor, none more than 4 of 255 gray levels. The 464
existing `render-tree/` and `Block/` unit tests passed.

A simulation of one block (React's keyed placement rule, a commit after every delta,
20,000 random insertion and deletion sequences, half with an interrupted run) compared
the ordering rule against the previous revision of this spec, which used a run-scoped
frontier with a retention band:

| Model | Remounted IDs | DOM moves of surviving IDs | Sequences with any move |
|---|---|---|---|
| Today | 47,069 | 186 | — |
| Previous revision (frontier band) | 0 | 9,562 | 2,649 |
| This proposal | 0 | 4,785 | 1,274 |

These are keyed-only sequences. Without interruptions, both retention models produce zero
moves. The previous revision reset its frontier when a new run started and re-anchored
the band at the old displacement indices, which moves retained nodes after an interrupted
run. This proposal's remaining moves all occur where the interrupted run emitted elements
in a different order than the run after it. An extra rule for elements that move earlier
removes about 60% of those, but it needs a sibling scan for every displacement, so it
isn't proposed. With unkeyed elements mixed in, every model also shows moves caused by
positional keys (see [Known limitations](#known-limitations)).

## Testing plan

- **Canonical equivalence (unit).** Apply seeded random delta sequences (successful and
  interrupted runs, locked-cursor rewrites, keyed and unkeyed elements) and compare
  `children` with a plain positional-overwrite model after every delta and cleanup.
  Assert the retention invariants: at most one entry per ID, never a current-run node,
  anchors sorted. Fragment cleanup, block inheritance, page filtering, and transient
  writes get targeted cases.
- **Render (unit).** Retained entries don't change the keys of canonical siblings. A
  reclaim updates props on the same instance. Genuine removal unmounts exactly once at
  cleanup. One and two insertions produce no unmount and no DOM move of the retained
  wrapper (count unmounts *and* check node identity, since a DOM move reloads an iframe
  without unmounting anything).
- **E2E.** One focused app covers an insertion above a widget and a data editor (same DOM
  node, hidden while displaced, no duplicate), a focused input displaced by its own rerun
  (focus kept), a replaced widget (hidden, then removed), and value restoration after a
  real remount inside `st.columns`. It runs on all three browsers, because focus behavior
  differs in WebKit.
- **Existing remount tests.** The "Create some elements to unmount component" apps keep
  passing. For retainable types (charts, dataframes, data editor, pills, feedback,
  segmented control) they now check that state survives the shift through retention.
  Audio, video, and audio input are on the denylist, so their apps still cover state
  restoration after a real remount.
- **Manual.** A kitchen-sink app with about 25 element types, spinners, `st.empty`, keyed
  and unkeyed blocks, a form, and a fragment, driven through insertions and rapidly
  interrupted reruns in all three browsers: no visible duplicates, no retained elements
  left after a run, and no new console errors.

## Rollout

Ship in one PR, with no runtime flag and no cohorts. Retention never changes placement,
the denylist covers the types known to have autonomous effects, and the equivalence tests
guard delta behavior. If one element type misbehaves while hidden, add it to the
denylist; reverting the PR restores today's behavior. Update the architecture skill's
`frontend.md` and `element-identity.md` in the same PR.

## Alternatives considered

- **Run-scoped frontier and retention band** (previous revision of this spec). It renders
  the band after the current run's highest written index and resets that index when a new
  run starts. That needs per-block run IDs, a monotonic-write check, per-anchor ordering
  counters, and a render that depends on `ScriptRunContext`, and it still misorders
  retained nodes after an interrupted run (see [Validation](#validation)). Anchoring
  entries before a canonical index and moving them only on a key change at that slot gives
  the same order within a run with less state.
- **Splice displaced nodes into `children`**
  ([PR #12122](https://github.com/streamlit/streamlit/pull/12122)). This changes
  protocol-addressed positions, breaks positional block inheritance after the splice,
  retains same-run replacements, and does an O(n) suffix scan per delta. Rejected.
- **Always hide retained elements.** This blurs focused controls. In Chromium and Firefox
  that commits a dirty `text_input` and requests a mid-run rerun; in WebKit focus stays in
  an invisible field. Replaced by the `:focus-within` exception.
- **Always show retained elements as stale.** This preserves focus without the CSS
  exception, but any ID change (an unkeyed widget with a dynamic label, or swapping one
  widget for another) shows the old widget as a faded duplicate until the run ends.
  Rejected as the default.
- **Cache removed keys in `ChildRenderer` state.** Release would be simple ("when the run
  ends"), but the cache would have to infer writes by diffing children across batched
  renders, it would keep lifecycle state outside the immutable tree, and it couldn't be
  unit-tested without React. Rejected in favor of an explicit tree field.
- **Buffer deltas, or delay destructive overwrites.** This breaks progressive rendering,
  and a short delay misses exactly the slow cases above. Rejected.
- **Restore state after every remount.** This is complementary: it can't restore iframe
  documents, component-local state, or focus.
- **A backend manifest or keyed-diff protocol.** The backend doesn't know whether an
  element will be emitted later either, so a manifest needs buffering, and a keyed diff
  needs previous-tree state on the server plus protocol, fragment, and message-cache
  changes. Out of proportion for this fix.

## Open questions

- Charts with size observers (Vega, Plotly, ECharts, deck.gl) see a zero size while
  hidden. ECharts already latches its last positive size. The E2E matrix should confirm
  that each one redraws at the right size on reclaim rather than going on the denylist.
