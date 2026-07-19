---
author: lukasmasuch
created: 2026-07-19
---

# Position-neutral retention for stable render-tree elements

## Summary

During a rerun, the frontend applies every delta immediately to the tree from the
previous run. If new output shifts a stable element to a later delta path, an earlier
delta can overwrite and unmount that element before its own delta arrives. React then
mounts a fresh component even though the backend-generated element ID did not change.

This spec proposes a frontend-only, position-neutral retention mechanism. When a
prior-run, stable-ID `ElementNode` is displaced under an unchanged parent block, the
frontend keeps it mounted in a non-positional sidecar until the current run either emits
the same ID or finishes successfully. Retained elements are hidden and inert, and are
rendered in a stable-order retention band after the current-run prefix and before the
untouched prior-run suffix. This keeps the retained DOM node physically in place while
new output is inserted before it. The delta-addressable `children` arrays, visible
progressive rendering, same-run replacement semantics, and post-cleanup tree remain
equivalent to today. No backend, protobuf, or user-facing API changes are required.

The first implementation is intentionally limited to an audited allowlist of stable-ID
leaf elements moving within the same rendered parent. It does not retain blocks,
transient nodes, identity-less elements, or elements moving across parents or pages.

## Problem

### How the tree is built during a rerun

The backend `RunningCursor` assigns positional delta paths as the script executes. For
example, `[0, 2]` addresses the third child of the main container. Each `ForwardMsg`
contains one mutation, and `AppRoot.applyDelta` immediately applies it through
`SetNodeByDeltaPathVisitor`. The visitor overwrites the node at the addressed path.

The previous run's nodes remain in the frontend tree while the new run executes. Nodes
not updated by the new `scriptRunId` are styled as stale and are removed by
`clearStaleNodes` only after a successful full or fragment run. Early reruns and compile
errors deliberately skip that sweep.

React identity is decided later in `RenderNodeVisitor`:

- An `ElementNode` uses its generated element ID as its React key when present,
  otherwise its sibling index.
- A `BlockNode` uses `Block.id` when present, otherwise its sibling index.
- A key preserves a component only while that key exists in every consecutive React
  commit under the same parent list.

The key is stable, but the positional overwrite can temporarily remove it:

```python
import time

import streamlit as st

if st.checkbox("Show notice"):
    time.sleep(1)
    st.info("Notice")

st.text_input("Name", key="name")
```

Suppose the previous main block contains:

```text
index 0: checkbox
index 1: text_input(id=name)
```

The next run emits the checkbox at index 0, then the notice at index 1. The notice
overwrites the text input, so React unmounts it. The text-input delta later arrives at
index 2 with the same generated ID, but React can only mount a new instance at that
point.

Backend widget state and `WidgetStateManager.elementStates` can reconstruct selected
state after a remount. They cannot preserve the component instance itself, including an
iframe document, arbitrary component-local React state, editor history, browser-managed
selection, an in-progress operation, or mount/unmount side effects. Existing E2E apps
intentionally sleep between inserted deltas to force this remount and verify state
reconstruction; restoration is not the same as avoiding the lifecycle break.

This is the same positional-shift family described in
[#8239](https://github.com/streamlit/streamlit/issues/8239) and
[#6257](https://github.com/streamlit/streamlit/issues/6257). Keyed tabs, expanders, and
popovers now restore selected frontend state after a remount, but the general leaf
lifecycle problem remains.

### Behavior that already works and must not regress

- **Same-position updates:** The current delta replaces the previous node with the same
  React key, so the component stays mounted.
- **Moving earlier:** The current-run copy is emitted before the old copy is overwritten.
  `RenderNodeVisitor` renders the first ID and suppresses the later stale duplicate, so
  React already preserves the keyed component instance. React may still physically move
  its host DOM subtree, so this does not guarantee iframe/focus preservation.
- **Same-run replacement:** `st.empty()`, `st.write_stream`, and other
  `DeltaGenerator`-handle updates use a locked cursor to overwrite the same path within
  one run. Replacement must remain immediate; the replaced node must not be retained.
- **Transient elements:** `TransientNode` uses an anchor and specialized insertion and
  replacement behavior for spinners and status UI. Retention must not reinterpret it.
- **Progressive rendering:** New output appears delta by delta. Long-running scripts must
  not wait until `scriptFinished` to display output.
- **Stale cleanup:** Successful full and fragment runs remove only the stale nodes in
  their scope. Early reruns preserve them to avoid flicker.
- **Positional block inheritance:** `AppRoot.addBlock` can inherit the children of a
  same-typed block at the same path. Even where that heuristic is imperfect, leaf
  retention must not change which block a later delta path reaches.

### The unavoidable timing tradeoff

When a prior-run element is overwritten, the frontend cannot know whether the same ID
will appear later or has been permanently removed. Preventing an unmount in the first
case necessarily delays the lifecycle cleanup in the second case until the run outcome
is known. Without buffering the run or adding protocol foreknowledge, no implementation
can preserve both immediate unmount timing and uninterrupted identity.

The safety objective is therefore narrower: preserve visible layout, interaction,
positional addressing, and cleanup semantics while delaying only the internal unmount of
eligible elements. The retained component is hidden and inert during that uncertainty
window and is unmounted at the existing successful-run boundary if it is not reclaimed.

## Evaluation of the prototypes

### PR #12122

[PR #12122](https://github.com/streamlit/streamlit/pull/12122) demonstrates the key
insight: if the old element ID remains in the same React sibling list until the new copy
arrives, React can preserve the component. Its final prototype inserts the incoming node
into the positional `children` array and removes a matching ID found later.

That mechanism is not safe to merge:

- Preservation-only splices change the array addressed by future delta paths.
- It is not gated to prior-run occupants, so same-run locked-cursor replacement can leave
  a current-run node behind that stale cleanup will never remove.
- Correctness depends on later deltas arriving in an order that repairs the artificial
  offset. Interrupted runs and fragment paths can retain the wrong structure.
- A not-yet-re-emitted following block can be overwritten after an earlier splice,
  destroying the children that `addBlock` would otherwise inherit.
- Genuine replacement can leave a visible stale ghost until run completion.
- A suffix scan per delta can produce O(n²) work for a large sibling list.
- The prototype predates the visitor-based tree, `TransientNode`, current fragment
  cleanup, and stable `Block.id` handling.

### Alternative displaced-node draft

The alternative draft contributed several requirements that this combined proposal
adopts:

- keep displaced nodes outside `children`;
- retain only prior-run nodes, preserving same-run replacement;
- use the existing full/fragment cleanup lifecycle;
- explicitly carry sidecar state through page filtering and interrupted runs; and
- defer keyed-block retention to a separately tested phase.

Follow-up review identified a correctness problem in an earlier version of this combined
spec: appending a retained key after all canonical children can make React physically move
its existing DOM node. React 18 commits keyed placements through `insertBefore` and
`appendChild`; those operations detach and reinsert an existing node. That can reload a
descendant iframe, reset animation/fullscreen state, and blur focus even though the React
component did not unmount. The browser platform added `moveBefore()` specifically to
avoid this state loss, but React 18 does not use that primitive. See
[Chrome's state-preserving move explanation](https://developer.chrome.com/blog/movebefore-api).

A local React 18/Chromium probe confirmed the distinction:

- `[A, W, Z] -> [A, X, Z, W]` reloaded the iframe inside `W` and cleared focus;
- `[A, W, Z] -> [A, X, W, Z]` inserted only `X` and preserved iframe and focus state; and
- hiding an order-preserved `W` kept the iframe document but intentionally cleared focus.

The correction is to preserve the retained nodes' DOM order while assigning fallback
indices from canonical children only. The draft's exact “render after the displaced slot”
rule handles one insertion, but not several: after two insertions it would produce
`[A, X1, W, X2, Z]` instead of `[A, X1, X2, W, Z]`. This spec instead uses the
stable-order retention band described below. It inserts a growing current-run prefix
before the retained prior-run sequence without moving that sequence.

The retained band remains hidden by default. Rendering it visibly would preserve focus,
but an overwritten element currently disappears from layout. A visible, interactive copy
would add a stale ghost for genuine removals and allow logically absent UI to send events.
That is a product-visible trade-off, not a consequence required for DOM-state retention.
It can be evaluated later as an internal policy for selected focused controls.

The draft's proposed transient-anchor matching, cross-page preservation, and payload
reuse are also excluded from the initial phase. They increase the correctness surface
without being required to prove leaf retention.

## Goals

- Prevent the currently broken unmount when an eligible stable-ID leaf shifts later
  within one unchanged rendered parent during a full or fragment rerun.
- Avoid physically moving that leaf's host DOM subtree for insertion-driven shifts, so a
  retained iframe or other browser-managed descendant does not reset independently of
  React component identity.
- Preserve the existing no-unmount behavior when that leaf shifts earlier or is updated
  at the same path.
- Keep `children[index]` equal to the node addressed by the backend delta path after every
  message, including during interrupted runs.
- Keep visible progressive rendering, layout, accessibility, and interaction equivalent
  to the current positional-overwrite behavior.
- Preserve same-run locked-cursor replacement, transient handling, fragment scoping,
  page filtering, block child inheritance, and widget-state cleanup.
- Reuse current element IDs and lifecycle metadata without a new public API or protocol
  field.
- Make the mechanism bounded, observable, and disableable during rollout.

## Non-goals

- Keeping an element mounted after a successful affected run in which its ID is absent.
- Retaining elements without a generated `$$ID-...` element ID.
- Preserving an element across a different React parent, root container, page, or active
  script hash. React keys are parent-scoped.
- Retaining `BlockNode`s in the initial phase. Existing keyed block IDs are promising but
  block wrappers, portals, and child inheritance require separate design work.
- Retaining or drilling through `TransientNode`s.
- Preserving browser focus while an element is logically absent. Making a parked subtree
  inert can blur a focused control even though it avoids unmounting it.
- Keeping media playback or other autonomous side effects running while an element is
  logically absent. Side-effectful types are excluded until a safe parking policy exists.
- Changing widget identity, session-state cleanup, `persist_state`, or user-facing APIs.

## Design invariants

1. **Canonical paths remain positional.** Only `BlockNode.children` participates in
   get/set-by-delta-path traversal.
2. **Canonical evolution is unchanged.** If retention metadata is stripped, `children`
   after every delta and successful cleanup is the same as on the current implementation.
3. **Element IDs are logical identity.** Retention never matches on labels, hashes, user
   key text, element order, or block type alone.
4. **Identity is parent-scoped.** A retained element can be reclaimed only in the same
   rendered child list and for the same active script.
5. **Only prior-run nodes are displaced.** A node whose `scriptRunId` equals the incoming
   run is replaced exactly as today.
6. **At most one rendered instance exists for a stable identity under one parent.** A
   current-run canonical node wins over stale canonical or retained candidates.
7. **Parking has no visible footprint.** It adds no flex item, stale ghost,
   accessibility node, focus target, or event source.
8. **Retained DOM order is stable.** Current-run output is inserted before the retained
   prior-run band; retained nodes are not moved behind untouched following siblings.
9. **Transient behavior is unchanged.** If the target occupant or incoming mutation is a
   `TransientNode`, the current visitor logic runs without retention.
10. **Successful cleanup is authoritative.** Unclaimed retained elements are unmounted in
   the same full/fragment scope used for canonical stale-node cleanup.
11. **Early reruns do not finalize absence.** Retained candidates survive
    `FINISHED_EARLY_FOR_RERUN`, matching current stale-node lifetime.

## Proposal

### Stable leaf identity and eligibility

Define an internal identity only for eligible leaf nodes:

```typescript
type StableLeafIdentity = string

function getStableLeafIdentity(
  node: AppNode
): StableLeafIdentity | undefined {
  if (!(node instanceof ElementNode) || node.element.hasOneShotEffect) {
    return undefined
  }

  const id = getElementId(node.element)
  return id ? `${node.element.type}:${id}` : undefined
}
```

The React key remains the generated element ID; the element type prefix is used by the
retention map to make renderer compatibility explicit. Generated IDs already encode the
active script in backend identity, but reclaim also verifies `activeScriptHash` directly.

The initial implementation must use an explicit allowlist. A type is eligible only after
verifying that:

- it always renders through the same `ElementNodeRenderer` and `ElementContainer` subtree;
- its outer wrapper can be removed from layout without unmounting its descendants;
- user and component events can be disabled while parked;
- it has no one-shot effect or autonomous side effect that must stop immediately; and
- it updates correctly when the retained node is replaced by a current-run payload.

Begin with built-in, controlled widgets whose interaction handlers can be gated. Add
data editors/charts and V1/V2 custom components only after targeted lifecycle and message
tests. Exclude at minimum `empty`, balloons/snow, audio/video, and any identified element
that bypasses the normal container or cannot be made inert. `st.components.v1.iframe`
does not currently have a generated element ID and is therefore out of scope regardless
of allowlist policy.

### A non-positional retention sidecar

Extend `BlockNode` with immutable retention metadata:

```typescript
interface RetainedElement {
  readonly identity: StableLeafIdentity
  readonly node: ElementNode
  readonly anchorIndex: number
  readonly orderWithinAnchor: number
  readonly displacedDuringRunId: string
}

interface ElementRetentionState {
  readonly byIdentity: ReadonlyMap<StableLeafIdentity, RetainedElement>
  readonly nextPrependOrderByAnchor: ReadonlyMap<number, number>
  readonly frontierRunId?: string
  readonly currentRunFrontier: number
}

class BlockNode {
  readonly children: AppNode[]
  readonly elementRetention: ElementRetentionState
}
```

`elementRetention` is render and lifecycle metadata, not a fifth kind of child. The
identity map provides O(1) revival. `anchorIndex` and `orderWithinAnchor` preserve prior
rendered order. When a canonical occupant is displaced at an index that already has
retained entries, assign the next decreasing order at that anchor because the canonical
occupant rendered before those entries. The frontier records the highest direct child
index populated monotonically by the current run.

The retention state is excluded from:

- delta-path traversal and child indices;
- canonical `isEmpty` and layout calculations;
- normal element collection and active-ID calculation;
- block child counts and divider-order calculations; and
- normal debug output, except an opt-in retention diagnostic.

Every immutable ancestor rebuild must copy its existing sidecar. When `AppRoot.addBlock`
performs its existing same-path/same-type child inheritance, it must carry the inherited
block's retention metadata under the same compatibility condition. This is not block
retention; it prevents an early-rerun block refresh from discarding leaf candidates that
the inherited children still reference.

Retention must not make a block render when its canonical state would take the current
empty-block return path. If a parent becomes empty, changes to an incompatible block
renderer, or otherwise stops producing the same `ChildRenderer`, discard its sidecar and
accept the unmount. Changing `isEmpty`, `allowEmpty`, or block layout to keep a candidate
alive would violate the visible-behavior invariant.

### Applying a delta at a child slot

Retention reconciliation happens only at the target parent, after existing transient
semantics have determined that the operation is a normal replacement:

```text
old = parent.children[index]
incoming = node addressed by this delta
currentRunId = incoming.scriptRunId

1. Run/frontier bookkeeping
   If currentRunId differs from frontierRunId, reset currentRunFrontier to -1 without
   dropping retained entries. For a normal direct-child delta, advance the frontier to
   index after verifying that direct child writes are contiguous/monotonic for this
   parent. A same-run locked-cursor write below the frontier leaves it unchanged.

2. Revival
   If incoming is an eligible ElementNode and elementRetention contains the same
   identity, remove that retained entry in this same immutable tree update.

3. Displacement
   If old is an eligible ElementNode,
      old.scriptRunId != currentRunId,
      old.activeScriptHash == incoming.activeScriptHash,
      and old.identity != incoming.identity,
   store old by identity with the next prepend order anchored at index.

4. Canonical replacement
   Set children[index] = incoming using exactly the current visitor behavior.
```

The incoming node can be an element or block; inserting any normal sibling above a
stable leaf can displace it. If either the target operation or existing occupant is
handled through `TransientNode`, skip the retention steps completely.

Only the base parent whose direct child is being replaced advances a frontier. Rebuilding
ancestors while applying a deeper path must not imply that their direct sibling prefix was
emitted in the current run. Fragment output therefore tracks the frontier inside its
actual output block rather than on every ancestor in the delta path.

The `activeScriptHash` displacement check is intentionally conservative rather than
strictly necessary for valid generated IDs. It prevents retention from broadening
multipage behavior in the first phase and can be relaxed later with dedicated page tests.

If a direct-write sequence violates the monotonic-prefix assumption, keep canonical
replacement behavior and do not create new retention entries for that parent/run. This
defensive fallback is preferable to guessing a DOM order. Existing entries can still be
swept safely because they never affect delta paths.

The sidecar contains at most one candidate per identity. Across repeated early reruns,
if a newer canonical node with an already-retained identity is displaced, replace the
stored payload with that newer node while keeping the same React key. A current-run
canonical occurrence always owns the visible representation.

The `scriptRunId` gate is critical. It ensures that two writes through the same locked
cursor in one run remain an immediate replacement and that no current-run node survives
successful stale cleanup accidentally.

### React render projection

`RenderNodeVisitor` renders a projection without mutating `children` or the sidecar:

1. Scan canonical children and choose the preferred canonical node for every stable ID.
   A node from the current `scriptRunId` wins over a stale duplicate. Two current-run
   nodes with one ID are a defensive-log/assert condition.
2. Compute the effective frontier. It is `currentRunFrontier` only when
   `frontierRunId` equals the current `ScriptRunContext.scriptRunId`; otherwise it is
   `-1`. This reconstructs the prior projection before the first direct-child delta of a
   new or superseding run.
3. Render canonical children from index 0 through the effective frontier in delta-path
   order. These form the current-run prefix.
4. Render the unclaimed retained entries anchored at or before the effective frontier,
   ordered by `anchorIndex` and `orderWithinAnchor`. This is the hidden retention band.
5. Render the untouched canonical suffix. After each suffix child, render any retained
   entries still anchored at that index. This reproduces the previous projection when a
   new run has not yet reached that slot.
6. Render any defensive out-of-range retained entries last.

Every canonical child advances the visitor's fallback index exactly as today, including
a canonical duplicate that is suppressed. A sidecar-rendered node never advances that
index because it always has a generated-ID key. Canonical identity-less siblings
therefore keep their current React keys even though stable retained elements are
interleaved in the projected array.

The frontier is what makes the projection work for more than one insertion. New
current-run nodes extend the prefix and are inserted before the stable-order retained
band. Returning stable nodes are normally reclaimed from the front of that band, while
untouched prior-run nodes remain after it.

For one inserted element, with both prior leaves identified:

```text
previous render: [A, W(id=w), Z]

delta path 1 -> X:
  canonical: [A, X, Z]
  frontier:  1
  retained:  [W(id=w, anchor=1)]
  React:     [A, X, W(id=w, hidden), Z]

delta path 2 -> W'(id=w):
  canonical: [A, X, W']
  frontier:  2
  retained:  [Z(anchor=2)]
  React:     [A, X, W', Z(hidden)]

delta path 3 -> Z':
  canonical: [A, X, W', Z']
  frontier:  3
  retained:  []
  React:     [A, X, W', Z']
```

React sees `ElementNodeRenderer key=w` in consecutive commits under the same
`ChildRenderer`. More importantly, its host DOM node remains between the newly inserted
prefix and `Z` throughout; React inserts `X` before it instead of moving it after `Z`.

With two inserted nodes, the projections are `[A, X1, W, Z]`, then
`[A, X1, X2, W, Z]`. Rendering `W` permanently after anchor 1 would instead produce
`[A, X1, W, X2, Z]` and force a later keyed reorder. The growing prefix plus retention
band avoids that move.

Moving earlier continues to use the current duplicate pattern: the current-run canonical
node at the earlier index wins over the stale copy at the later index. The preferred-node
prepass makes this rule explicit instead of relying on “first duplicate wins.” Arbitrary
reordering of already-mounted siblings can still require physical DOM moves; the initial
guarantee is insertion-driven movement later while relative prior-run order is preserved.

### Parking without a stale ghost

Add `isRetained` through the existing `ElementNodeRenderer` subtree without changing
component types when it toggles. `ElementContainer` applies the parked state to its
existing outer DOM node:

- `display: none` or the HTML `hidden` behavior, so it contributes no layout or flex gap;
- `aria-hidden="true"` and inert/non-focusable behavior; and
- an internal parked context that gates event and back-message handlers.

Do not render the element with ordinary stale opacity. An overwritten element currently
leaves visible layout immediately, so a visible faded side copy would be a regression.

Order preservation and visibility are separate decisions. The retention band prevents
React from moving the host DOM subtree; the parked style prevents that subtree from
affecting the UI. In the local Chromium probe, applying `display: none` without moving
the wrapper preserved the iframe document, while moving the wrapper reloaded it. Hiding
did blur the focused input, which is why focus remains an explicit non-goal for this
phase.

Built-in controls must not process user or synthetic input while parked. For custom
components, registry messages from a parked iframe must not update widget state, trigger
a rerun, resize visible layout, or report a value. On reclaim, the existing render path
sends the latest payload and re-enables messages. This preserves the iframe document
without treating logically absent UI as active.

`display: none` preserves the DOM subtree but some complex components react to zero size
or visibility changes. The allowlist and rollout cohorts are required because avoiding
unmount does not by itself guarantee that every component tolerates parking.

A future visible-stale policy could preserve focus and IME state for selected text-entry
controls by leaving the order-preserved wrapper visible. It must not be enabled merely as
an implementation shortcut: reviewers first need to accept its extra stale layout and
interaction window for runs where the element never returns.

### Successful, early, and failed runs

For `FINISHED_SUCCESSFULLY`:

1. Run the canonical `ClearStaleNodeVisitor` behavior exactly as today.
2. Drop every unclaimed retained element in the full-run tree.
3. Commit the cleaned `AppRoot`.
4. Call `removeInactiveWidgetState` from canonical active IDs.

For `FINISHED_FRAGMENT_RUN_SUCCESSFULLY`, visit retained entries with the same
`fragmentIdsThisRun`, enclosing-fragment context, and `scriptRunId` decisions as
`ClearStaleNodeVisitor`. Drop candidates only from a fragment subtree affected by that
run. Retained entries owned by the main script or another fragment remain untouched.

For `FINISHED_EARLY_FOR_RERUN`, do not sweep retention. The superseding run may reclaim
the ID. The identity-keyed map prevents the same element from accumulating repeatedly.

Compile errors keep the current partially applied tree, as they do today. A parked leaf
stays hidden until a later successful affected run reclaims or removes it. Session reset,
disconnect teardown, and full app-tree replacement discard all retention maps.

Retained elements are excluded from `ElementsSetVisitor` and `getActiveIds`. In the normal
successful path, the retention sweep and canonical stale sweep commit before
`removeInactiveWidgetState`, so state cleanup keeps its current boundary. Code paths that
call active-ID cleanup outside successful script completion must first filter or discard
retention, as page changes already do for canonical nodes.

### Multipage filtering

`FilterMainScriptElementsVisitor` must apply its active-script rule to retention metadata
as well as canonical children. A candidate cannot be reclaimed by an element with a
different `activeScriptHash`, even if malformed or legacy data produces the same raw ID.

Cross-page preservation is not part of this phase. Common-entrypoint elements may remain
mounted only when the existing page-filtering lifecycle leaves the same parent and script
identity intact; the retention feature must not create a new exception. Multipage
navigation is tested as a non-regression and cleanup case, not advertised as new behavior.

### Blocks and child inheritance

The first phase never moves a `BlockNode` into the sidecar, even if it has a stable
`Block.id`. A shifted keyed block can therefore still remount. The current same-path,
same-type `addBlock` child inheritance rule also remains unchanged, including the dialog
identity guard.

The alternative draft correctly identifies a broader hazard: when blocks shift, a new
same-typed block can temporarily inherit a sibling's old children. Fixing that safely is
larger than leaf retention. Keyed-block retention must separately define:

- block-ID and block-type compatibility;
- sidecar-aware child inheritance from the same ID rather than the target position;
- hiding semantics for transparent blocks, tabs, dialogs/portals, forms, and flex
  containers; and
- descendant reclaim behavior when the ancestor itself moves.

That work should be a second phase with its own spec amendment and tests. It must not be
smuggled into the leaf implementation.

### Payload reuse

`AppRoot.applyDelta` currently reuses an old protobuf payload only when the node at the
target path has the same `elementHash`, type, and no one-shot effect. A shifted element
usually misses that optimization because a different node occupies its new path.

Looking up a matching retained identity and hash could restore the optimization, but it
is not required for mount preservation. Defer it until after correctness lands; adding it
to the first phase would couple tree reconciliation to payload-cache behavior and make
one-shot auditing harder.

### Complexity and memory

Per-parent identity maps make identity lookup, displacement, and revival O(1), excluding
ordinary immutable-map copying. Rendering adds one O(children + retained log retained)
prepass if retained entries are sorted by `(anchorIndex, orderWithinAnchor)` on demand.
An ordered persistent structure or cached sorted view can reduce that to
O(children + retained), but is not required for the first implementation. Either option
avoids scanning the canonical suffix inside every tree mutation as PR #12122 does.

The retained set is bounded by the distinct eligible IDs displaced since the last
successful affected cleanup. It is cleared by successful full/fragment cleanup, page
filtering, session reset, and disconnect teardown. Development assertions must detect
duplicate identities, retention under a different active script, and unexpectedly long
retention across repeated interrupted runs.

## Behavior matrix

| Scenario | Proposed result |
|---|---|
| Eligible stable leaf moves later because output is inserted above | Stable-order hidden parking keeps its component and host DOM subtree in place; the later delta reclaims it |
| Stable leaf moves earlier under the same parent | Existing current-first duplicate reconciliation remains mounted |
| Existing keyed siblings arbitrarily reorder | React component identity can survive, but physical DOM moves may reset iframe/focus state; not guaranteed in phase 1 |
| Eligible leaf is overwritten and absent at successful finish | It leaves visible layout immediately, stays mounted but inert internally, then unmounts at cleanup |
| Prior-run trailing leaf is never overwritten | Existing visible stale treatment until cleanup; no sidecar involved |
| Same ID updates at the same path | Existing keyed in-place update; no parking |
| Different ID replaces the same path | Old eligible node can park, but identities never share React state |
| Same-run locked cursor overwrites a path | Existing immediate replacement; no parking |
| Element has no generated ID or is not allowlisted | Existing positional behavior |
| Element moves to another parent/root | Existing remount behavior |
| Parent block moves or changes render branch | Existing behavior; no leaf-retention guarantee |
| Delta uses `TransientNode` | Existing anchor/insertion/replacement behavior only |
| Full run finishes early for another rerun | Candidate remains bounded and available to the superseding run |
| Owning full/fragment run succeeds without the ID | Candidate is removed in that cleanup scope |
| Unrelated fragment reruns | Candidate and canonical nodes remain untouched |
| Page or active script changes | Candidate is filtered; no new cross-page retention |
| One-shot, media, or autonomous effect element | Excluded unless a future audited parking policy makes it safe |
| Focused eligible control is hidden while parked | Component stays mounted but focus/IME may end; visible-focus preservation is deferred |

## Testing plan

### Canonical-tree equivalence tests

Build a differential test helper that applies the same delta sequence to the current
replacement algorithm and the retention algorithm, strips retention metadata, and
compares canonical trees after every message. Cover and generate sequences involving:

- insertions and removals before stable and unkeyed leaves;
- move-later, move-earlier, and multi-element reorder;
- same-run locked-cursor overwrites;
- incoming elements and blocks displacing stable leaves;
- transient insertion, anchor replacement, and transient cleanup;
- interrupted runs followed by full or fragment runs;
- fragment-scoped cleanup and unrelated parallel fragments;
- page filtering, session reset, and compile-error recovery; and
- same-typed block child inheritance.

Assert canonical delta-path lookup, child counts, `isEmpty`, and post-success active IDs
are identical to the baseline. Assert each parent sidecar has at most one entry per
identity and never holds current-run or wrong-script nodes.

### Render-tree and React lifecycle tests

Add focused `RenderNodeVisitor` and component tests that verify:

- a current-run canonical duplicate wins regardless of its index;
- one and several insertions grow the canonical prefix before a stable-order retained
  band;
- a superseding run resets the frontier and initially reconstructs the previous
  canonical-plus-retained projection without moving retained host nodes;
- a non-monotonic direct-child write takes the documented no-new-retention fallback;
- retained nodes do not advance the visitor index, so fallback keys for canonical
  unkeyed siblings remain unchanged;
- exactly one React child exists for each stable identity;
- an insertion-driven move later produces one initial mount, no intermediate unmount,
  and no host DOM placement/move operation for the retained wrapper;
- moving earlier and arbitrary reorder keep their existing React-key behavior without a
  new iframe/focus guarantee;
- parking adds no flex item, layout gap, accessibility node, or interaction target;
- reclaim updates props on the same component instance;
- permanent removal unmounts exactly once at successful cleanup;
- a different ID mounts a distinct instance;
- sidecar state survives compatible block inheritance and early reruns; and
- moving across a parent still remounts, documenting the phase boundary.

For custom-component eligibility, store a random token inside the iframe document and
verify `contentWindow` and the token survive delayed same-parent movement. Verify that
value, height, and ready messages while parked cannot update state or visible layout and
that the latest render payload is delivered on reclaim.

Add a focused React regression test with following keyed siblings. It must fail for
`[A, W, Z] -> [A, X, Z, W]` and pass for the retention-band projection
`[A, W, Z] -> [A, X, W, Z]`. Counting React unmounts alone is insufficient because a
React placement can reload an iframe without unmounting its component.

### E2E coverage

Reuse the existing “Create some elements to unmount component” pattern, including sleeps
that force the browser to commit intermediate deltas. Add or extend focused coverage for:

- one built-in controlled widget from the first allowlist cohort;
- data editor/chart lifecycle before those cohorts are enabled;
- declared V1 and V2 custom components before their cohort is enabled;
- same-run `st.empty` replacement and streaming output;
- spinner/transient interaction;
- successful permanent removal and interrupted-run recovery;
- full and fragment reruns, including an unrelated fragment;
- page navigation as a cleanup/non-retention case; and
- visual snapshots during parking proving no stale ghost or flex gap appears.

Focus loss is recorded but is not a pass criterion for the first phase. Component mount
counts, DOM/iframe identity, local state, and absence of parked events are the lifecycle
criteria.

Several existing E2E apps deliberately create elements “to unmount component” and then
assert state restoration. Once retention covers those element types, the tests could pass
without exercising restoration at all. Keep restoration coverage by running the scenario
with the internal retention kill switch disabled or by forcing a genuine remount across a
different parent. Retention-enabled coverage and remount-restoration coverage test
different guarantees and both must remain.

Run the focused frontend unit and E2E files through repository `make` targets, then run
the full existing frontend, `st_empty`, transient, fragment, multipage, custom-component,
chart, media, and widget suites. The implementation should update the architecture
skill's frontend and element-identity references with the sidecar and same-parent limit.

## Rollout and observability

Land the infrastructure behind an internal frontend kill switch, with no Python API or
protobuf field. Enable audited element cohorts separately:

1. built-in controlled widgets;
2. data editors and charts after resize/visibility testing; and
3. custom components after parked-message gating is verified.

Keep media and one-shot effects disabled unless a later design can suspend their effects
without unmounting them. This cohort strategy constrains the intentional lifecycle
change while canonical-tree equivalence protects existing delta behavior.

In development and pre-release builds, record:

- retained, reclaimed, and cleanup counts by element type;
- maximum retained count per parent and app;
- retention duration and number of interrupted runs survived;
- duplicate current-run identities; and
- parked interaction or custom-component message attempts.

Do not emit user data, element labels, keys, or payloads. Exercise all cohorts across
Chromium, Firefox, and WebKit before enabling them by default. The kill switch must allow
retention to be disabled without changing the canonical tree or requiring a server
restart.

## Alternatives considered

### Splice identified nodes into canonical `children`

This is the PR #12122 approach. It is compact and proves the React-key concept, but it
changes protocol-addressed positions, mishandles same-run replacement without additional
gating, exposes stale ghosts, and becomes fragile across interrupted and fragment runs.
Rejected.

### Render visible displaced nodes after their former slot

This preserves focus for a single insertion and resembles ordinary stale-node styling.
Sidecar nodes can avoid changing fallback keys by not incrementing the canonical visitor
index, which is adopted by this proposal. However, a fixed former-slot anchor produces
the wrong order after several insertions, and visible parking changes replacement layout,
leaves logically absent controls interactive, and adds a stale ghost for genuine removal.
The stable-order retention band fixes the multi-insertion ordering while hidden parking
keeps visible behavior unchanged. Visible parking remains a possible reviewed policy for
selected focus-sensitive controls rather than the phase-1 default.

### Keep recently removed nodes only in `ChildRenderer` state

A React-local cache could observe removed keys and render them until run completion. It
would duplicate lifecycle state outside the immutable app tree and would need a second
implementation of fragment, page, session, and cleanup ownership. The sidecar keeps
those decisions in the existing tree lifecycle. Rejected.

### Buffer the run and commit the final tree once

React could reconcile old and final keyed lists cleanly, but long-running scripts,
placeholders, errors, and status output would no longer render progressively. Small
animation-frame batches reduce only very short absence windows. Rejected.

### Restore state after every remount

This remains useful for widget values and serializable element state. It cannot reproduce
arbitrary DOM, React, iframe, media, or in-flight browser state, and every element needs
bespoke serialization. Complementary, not sufficient.

### Add a backend manifest or keyed-diff protocol

A run manifest or move operation could remove some frontend ambiguity, but the backend
does not know the final executed tree until the script reaches each branch. A complete
manifest requires buffering; a keyed diff requires previous-tree state, new protocol
semantics, fragment/page awareness, and message-cache changes. It may be a principled
long-term direction but is unnecessary for the scoped frontend fix.

### Retain stable blocks immediately

This could preserve entire keyed subtrees and fix some wrong-sibling inheritance cases.
Transparent blocks, flex layouts, tabs, dialogs, popovers, and forms do not share one
safe wrapper or parent structure. Deferring block retention gives leaf retention a clear,
testable correctness boundary.

## Approval conditions and open questions

The sidecar, prior-run gate, canonical equivalence, hidden stable-order retention band,
and leaf-only first phase are required design decisions. Before implementation is enabled
for an element cohort, resolve and document:

- the exact allowlist and evidence that each type keeps one renderer subtree while parked;
- whether `hidden` or an explicit `display: none` style behaves more consistently across
  supported browsers;
- how each eligible component gates callbacks, uploads, and back messages while parked;
- whether size-sensitive components need a reclaim-time resize notification; and
- the maximum retention duration/count that triggers a development warning or defensive
  cleanup.

If one parking policy is not safe for a component category, keep the sidecar and
reconciliation design but leave that category disabled or give it an audited internal
policy. Do not fall back to mutating positional `children`.
