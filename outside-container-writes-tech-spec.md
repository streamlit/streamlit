---
author: cursor-agent
created: 2026-06-03
---

# Outside Container Writes: Cursor Management for Fragment Reruns

## Summary

When an `@st.fragment` function writes multiple elements to a container declared outside
its scope, the `RunningCursor` for that container accumulates across fragment reruns
instead of resetting. This produces invalid delta paths that crash the frontend. This spec
designs a solution that interposes an implicit wrapper between the outside container and the
fragment's elements. The wrapper isolates each fragment's writes into a stable,
independently-resettable block — but it is a new **transparent block type** that exists only
in the AppNode/BlockNode tree and emits **no DOM box** on the frontend. The fragment's
elements therefore render as inline children of the outside container, one fewer nesting
level than a styled container.

## Problem

### Symptom

A fragment writing two or more elements to an outside container crashes on the second
fragment rerun with:

```
Bad delta path index 4 (should be between [0, 2])
```

### Root Cause

`RunningCursor` instances track the next child index inside a container. The fragment
rerun mechanism (`lib/streamlit/runtime/fragment.py:389-394`) snapshots and restores only:

- `ctx.cursors` — root container cursors (MAIN, SIDEBAR)
- `context_dg_stack` — the stack of active DeltaGenerators (for `with` blocks)

An `st.container()` created *outside* the fragment has its own `_cursor` attribute stored
on the `DeltaGenerator` object. This cursor is:

- **NOT** in `ctx.cursors` (only root containers)
- **NOT** in `dg_stack` (not inside a `with` block during fragment definition)

Therefore, on fragment rerun, `outside_container._cursor` retains its accumulated index
from prior runs (e.g., 0 → 2 → 4 → ...), producing delta paths that exceed the frontend
tree's child count.

### Why Simple Reset Is Insufficient

We cannot simply track and reset all cursors that a fragment touches because:

1. **Discovery timing**: The snapshot is taken at fragment *definition* time, but which
   containers the fragment writes to isn't known until *execution* time.
2. **Interleaving**: Multiple fragments (or the main script + fragments) may write to the
   same container. Positional indices become unstable when one source changes its element
   count.
3. **Non-contiguous writes**: Fragment A writes at index 1, main script writes at index 2,
   Fragment B writes at index 3. Resetting Fragment A's cursor to 1 on rerun would
   overwrite the main script's element at index 2 if A now writes two elements.

## Design Goals

1. **Correctness**: A fragment writing N elements to an outside container must always
   produce delta paths [0..N-1] relative to its slot in that container, regardless of
   how many times the fragment reruns.
2. **Isolation**: Multiple fragments writing to the same outside container must not
   interfere with each other's index space.
3. **No regression**: Elements written inside the fragment's own scope must continue to
   work exactly as before.
4. **No layout impact**: The fix must not introduce a visible box or an extra flex item
   in the outside container. Outside-write content should sit in the container exactly as
   if the fragment had written to it directly (see issue #13024 for the layout problems an
   extra styled container introduces).
5. **Minimal complexity**: The solution must not require per-fragment snapshots of
   arbitrary cursor trees or complex bookkeeping that's fragile to maintain.
6. **`parallel=True` compatible**: The approach must work safely when multiple fragments
   execute concurrently on different threads.
7. **Frontend transparency**: Minimal changes to the frontend render tree logic — ideally
   only a single new branch in the block renderer, with the tree-walking visitors
   untouched.

## Two Trees: Why a Logical Block Without a DOM Box Works

Streamlit maintains two related trees:

1. The **AppNode/BlockNode tree** on both backend and frontend. It is addressed by delta
   paths (`SetNodeByDeltaPathVisitor` resolves each path component by **index**) and
   garbage-collected by `scriptRunId`/`fragmentId` (`ClearStaleNodeVisitor`,
   `isElementStale`).
2. The **React VDOM** produced from tree (1) by `RenderNodeVisitor` +
   `BlockNodeRenderer`.

The cursor-isolation job needs a node in tree (1): a real `BlockNode` with its own
`RunningCursor`, a stable `id`, and a `fragmentId`. It does **not** need a DOM box in tree
(2). So the wrapper can be a logical block that renders nothing.

This is supported by several existing facts about the codebase:

- **Stale clearing already works element-level.** `isElementStale`
  (`frontend/lib/src/components/core/Block/utils.ts:43-70`) keys on each node's own
  `fragmentId` + `scriptRunId`. A transparent wrapper carries the fragment's `fragmentId`
  and is re-emitted (so its `scriptRunId` advances) on each fragment rerun, so cleanup of
  its subtree is unchanged.
- **React keying is unchanged.** `RenderNodeVisitor.visitBlockNode`
  (`frontend/lib/src/components/core/Block/RenderNodeVisitor.tsx:86-91`) keys block nodes
  by `node.deltaBlock?.id`, so the transparent block still reconciles in place across
  fragment reruns (no remount of its subtree).
- **Delta paths resolve by index.** `SetNodeByDeltaPathVisitor` walks children by index
  and is block-type-agnostic; the transparent block occupies one index slot like any
  other block, so it is unaffected.
- **Precedent exists.** `BlockNodeRenderer` already returns `<></>` for empty
  non-`allow_empty` blocks (`Block.tsx:267-269`), proving a block can render zero DOM.

## Proposal: Transparent Wrapper Block

### Core Idea

When a fragment writes to an outside container, automatically interpose an implicit
wrapper `BlockNode` between the outside container and the fragment's elements. Each
`(fragment_id, outside_container)` pair gets exactly one wrapper. The wrapper has its own
`RunningCursor` that resets to 0 on each fragment rerun, so the fragment's writes always
land at indices [0..N-1] inside it.

The wrapper is a **transparent block**: it occupies one slot in the AppNode tree (giving
us cursor isolation) but the frontend renders its children directly inside a React
Fragment, with **no** `ContainerContentsWrapper` / `FlexBoxContainer`
(`StyledFlexContainerBlock`) / `StyledLayoutWrapper`. The result is that the fragment's
elements appear as inline children of the outside container in the DOM — one fewer nesting
level than a styled container, and with no flex item of its own.

### Tree Structure

The `[implicit_wrapper]` node stays in the AppNode/BlockNode tree, but emits no DOM box.

**Before (current broken behavior):**

```
outside_container [cursor: 0 → 2 → 4 → ...]
  ├── button (fragment, index 0)
  └── text   (fragment, index 1)
```

**After — AppNode/BlockNode tree (backend + frontend):**

```
outside_container [cursor: managed by main script, advances once per fragment]
  └── [implicit_wrapper · transparent] [cursor: always resets to 0 on fragment rerun]
        ├── button (fragment, index 0)
        └── text   (fragment, index 1)
```

**After — DOM (React VDOM):** the transparent wrapper emits no box, so the fragment's
elements become inline children of the outside container's box:

```
<outside_container box>
  <button />   <!-- from fragment -->
  <text />     <!-- from fragment -->
</outside_container box>
```

i.e. the DOM looks exactly as if the fragment had written to the outside container
directly — there is no `data-testid="stLayoutWrapper"` and no extra `stVerticalBlock`
around the fragment's outside-write content.

**With multiple fragments (AppNode tree):**

```
outside_container
  ├── "Header" (main script, index 0)
  ├── [fragment_a_wrapper · transparent] (index 1, locked)
  │     ├── element_from_a_0
  │     └── element_from_a_1
  ├── [fragment_b_wrapper · transparent] (index 2, locked)
  │     └── element_from_b_0
  └── "Footer" (main script, index 3)
```

Each wrapper occupies exactly one slot in the parent container. The slot is allocated
during the initial full app run and never moves. On fragment rerun, only the wrapper's
internal cursor resets. Because each wrapper is transparent, the DOM shows `Header`,
`a_0`, `a_1`, `b_0`, `Footer` as direct children of the outside container.

## Detailed Design

### 1. New block type

We need a way to mark a `Block` as transparent so the frontend can skip its DOM box.

**Option A — `bool transparent` flag** ✅ PREFERRED

```proto
// proto/streamlit/proto/Block.proto
message Block {
  oneof type { ... }

  bool allow_empty = 8;
  optional string id = 12;
  ...
  optional bool autoscroll = 16;
  // When true, this block contributes a node to the element tree (for cursor
  // isolation and stale clearing) but renders no DOM box on the frontend.
  bool transparent = 17;   // Next ID: 18
}
```

- Pros: Smallest possible change — one scalar field, no new message, no change to the
  `type` oneof. A transparent block still carries `id`, `allow_empty`, and (if ever
  needed) the existing layout fields, so it composes with everything that already keys off
  `Block`. The frontend branch is a single `if (node.deltaBlock.transparent)`.
- Cons: The flag is orthogonal to the `type` oneof, so a transparent block technically
  has no `type`. That is fine for our use (the wrapper has no layout semantics), and the
  block renderer already tolerates type-less blocks.

**Option B — dedicated `Block.Structural` message in the `type` oneof**

```proto
message Block {
  oneof type {
    ...
    FlexContainer flex_container = 13;
    Structural structural = 17;
  }
  message Structural {}
}
```

- Pros: Models "this is a structural-only block" as a first-class type; `node.deltaBlock.type === "structural"` reads cleanly.
- Cons: Larger change — a new (empty) message and a new oneof case to thread through the
  proto, the TS `BlockNode` type checks, and every place that switches on block type.
  More surface for little benefit, since the behavior is a single boolean ("don't render a
  box").

**Decision: Option A (`bool transparent = 17;`).** It is the smaller change and the
behavior we need is binary. Adding the field requires recompiling protobufs (`make
protobuf`); it is purely additive and backward-compatible (defaults to `false`).

### 2. Wrapper Registry

Add a mapping to `ScriptRunContext` that tracks wrapper DeltaGenerators:

```python
# In lib/streamlit/runtime/scriptrunner_utils/script_run_context.py
@dataclass
class ScriptRunContext:
    ...
    # Maps (fragment_id, outside_container_id) -> wrapper DeltaGenerator
    _fragment_outside_wrappers: dict[tuple[str, str], DeltaGenerator] = field(
        default_factory=dict
    )
```

The key is `(fragment_id, dg._id)` where `dg` is the outside container being written to.
The value is the wrapper `DeltaGenerator` whose cursor manages the fragment's writes.

This registry persists across fragment reruns within a session (it lives on `ctx`, not on
the snapshot). It is cleared on full app reruns (when `ctx.on_script_start()` is called).

### 3. Detection of Outside Container Writes

In `DeltaGenerator._enqueue` and `DeltaGenerator._block`, after resolving `dg =
self._active_dg`, detect whether this is a fragment writing to an outside container:

```python
# In lib/streamlit/delta_generator.py, inside _enqueue and _block

def _is_outside_container_write(dg: DeltaGenerator) -> bool:
    """Check if dg is outside the current fragment's scope."""
    ts = ThreadState.get()
    fragment_id = ts.fragment_id
    if not fragment_id:
        return False

    fragment_path = ts.delta_path
    if not fragment_path:
        return False

    cursor_path = tuple(dg._cursor.delta_path) if dg._cursor else ()
    return not _is_inside_fragment_path(cursor_path, fragment_path)
```

This reuses the existing `_is_inside_fragment_path` helper already present in the
codebase.

### 4. Wrapper Creation / Retrieval

When an outside container write is detected, redirect through the wrapper. The wrapper is
created as a transparent block and we **snapshot its initial cursor** at creation time so
we can restore it on fragment rerun (mirroring how `fragment.py` snapshots `ctx.cursors` /
`dg_stack`):

```python
# In lib/streamlit/delta_generator.py
from copy import deepcopy

def _get_or_create_outside_wrapper(
    dg: DeltaGenerator,
    fragment_id: str,
) -> DeltaGenerator:
    """Get or create an implicit transparent wrapper for this fragment's writes
    to the given outside container."""
    ctx = get_script_run_ctx()
    if ctx is None:  # pragma: no cover - defensive
        return dg

    wrapper_key = (fragment_id, dg._id)

    if wrapper_key in ctx._fragment_outside_wrappers:
        return ctx._fragment_outside_wrappers[wrapper_key]

    # Create a new transparent wrapper block inside the outside container.
    # This advances dg's cursor by one slot (the wrapper occupies one slot).
    block_proto = Block_pb2.Block()
    block_proto.transparent = True
    block_proto.allow_empty = True

    wrapper = dg._block(block_proto)
    # Snapshot the wrapper's freshly-initialized cursor (index 0) and the delta
    # path used to emit its add_block, so we can restore + re-emit on rerun
    # without hand-mutating private cursor fields.
    wrapper._outside_wrapper_cursor_snapshot = deepcopy(wrapper._cursor)
    wrapper._outside_wrapper_delta_path = list(dg._cursor.delta_path)
    ctx._fragment_outside_wrappers[wrapper_key] = wrapper

    return wrapper
```

### 5. Cursor Restore + Re-emission on Fragment Rerun

When a fragment reruns, each of its wrappers must (a) reset its internal cursor to 0 and
(b) be re-emitted as a block delta so the frontend stamps the wrapper with the current
`scriptRunId` (otherwise `ClearStaleNodeVisitor` would treat the wrapper itself as stale).

We **restore the snapshot** rather than poking `_index` / `_transient_index` /
`_transient_elements`, mirroring `fragment.py`'s `ctx.cursors = deepcopy(cursors_snapshot)`:

```python
# In lib/streamlit/runtime/fragment.py, inside wrapped_fragment()
if ctx.fragment_ids_this_run:
    ctx.cursors = deepcopy(cursors_snapshot)
    context_dg_stack.set(deepcopy(dg_stack_snapshot))
    _reset_outside_wrappers(ctx, fragment_id)   # NEW


def _reset_outside_wrappers(ctx: ScriptRunContext, fragment_id: str) -> None:
    """Restore cursors and re-emit transparent wrapper blocks for this
    fragment's outside-container wrappers."""
    for key, wrapper in ctx._fragment_outside_wrappers.items():
        if key[0] != fragment_id:
            continue

        # Restore the snapshotted cursor (back to index 0), instead of mutating
        # private cursor fields.
        wrapper._cursor = deepcopy(wrapper._outside_wrapper_cursor_snapshot)

        # Re-emit the wrapper's add_block so the frontend updates its scriptRunId
        # and keeps the (transparent) wrapper alive across the rerun.
        msg = ForwardMsg()
        msg.metadata.delta_path[:] = wrapper._outside_wrapper_delta_path
        msg.delta.add_block.CopyFrom(
            Block_pb2.Block(transparent=True, allow_empty=True)
        )
        _enqueue_message(msg)
```

### 6. Integration into `_enqueue` and `_block`

Modify `_enqueue` and `_block` to redirect outside writes through the wrapper:

```python
# In _enqueue and _block, after `dg = self._active_dg`:
if ctx:
    ts = ThreadState.get()
    if ts.fragment_id and _is_outside_container_write(dg):
        dg = _get_or_create_outside_wrapper(dg, ts.fragment_id)
```

### 7. Fragment ID Stamping on Wrapper Block

The wrapper block's `add_block` delta must carry the fragment's `fragment_id` so the
frontend can attribute it for stale clearing. This is already handled by the existing
`_enqueue_message` logic in `script_run_context.py` which stamps `msg.delta.fragment_id =
ts.fragment_id` for any delta sent while `ts.fragment_id` is set.

### 8. Frontend Changes

**`BlockNodeRenderer` (`frontend/lib/src/components/core/Block/Block.tsx`)** — add one
early branch for the transparent type. It returns the block's children directly inside a
React Fragment, skipping `ContainerContentsWrapper` / `FlexBoxContainer`
(`StyledFlexContainerBlock`) and `StyledLayoutWrapper`:

```tsx
// Near the top of BlockNodeRenderer, alongside the existing empty-block early return
// (Block.tsx:267-269).
if (node.deltaBlock.transparent) {
  // Transparent block: contribute no DOM box; render children inline.
  return <ChildRenderer {...props} node={node} />
}
```

`ChildRenderer` already returns `<>{elements}</>` (a React Fragment of the collected
child elements), so the transparent block adds no DOM node, no flex item, and no box
styling — the children render as if they were direct children of the outside container.

**No changes required to `RenderNodeVisitor.tsx`.** It is block-type-agnostic and keys
block nodes by `node.deltaBlock?.id` (line ~89), so the transparent wrapper reconciles in
place across reruns and its subtree is not remounted.

**No changes required to `ClearStaleNodeVisitor.ts`.** Stale clearing is element-level via
`isElementStale` (`utils.ts:43-70`), keyed on each node's own `fragmentId` + `scriptRunId`.
The wrapper carries the fragment's `fragmentId` and is re-emitted each fragment rerun (so
its `scriptRunId` is current), and its stale children are cleared exactly as before.

**`SetNodeByDeltaPathVisitor.ts` is unaffected.** It resolves each delta-path component by
**index** and does not inspect block type; the transparent block occupies one index slot
like any other block.

## Edge Cases

Each case is re-validated under the transparent block. The shorthand "wrapper" below means
a transparent wrapper block.

### Multiple fragments writing to the same outside container

Each fragment gets its own wrapper at a distinct index in the outside container:

```python
outside = st.container()

@st.fragment
def frag_a():
    outside.write("A1")  # → wrapper_a[0]
    outside.write("A2")  # → wrapper_a[1]

@st.fragment
def frag_b():
    outside.write("B1")  # → wrapper_b[0]
```

AppNode tree:

```
outside
  ├── [wrapper for frag_a · transparent] (index 0)
  │     ├── A1
  │     └── A2
  └── [wrapper for frag_b · transparent] (index 1)
        └── B1
```

Wrappers are created in execution order during the initial full app run. Each fragment
only restores its own wrapper's cursor. No interleaving possible. In the DOM the user sees
`A1`, `A2`, `B1` as direct children of `outside` (no wrapper boxes).

### Nested containers (outside container contains another container)

```python
outer = st.container()

@st.fragment
def my_frag():
    inner = outer.container()  # Creates a real container inside the wrapper
    inner.write("nested")
```

This works naturally. The `outer.container()` call triggers `_block` on `outer`; the
outside-container detection redirects it into the transparent wrapper, so `inner` is
created *inside* the wrapper. `inner` is a normal (styled) container and renders its own
box; only the transparent wrapper between `outer` and `inner` is box-less. No special
handling needed.

### Fragment writing to containers at different nesting levels

```python
level_0 = st.container()
level_1 = level_0.container()  # created by main script

@st.fragment
def my_frag():
    level_0.write("at level 0")  # → wrapper in level_0
    level_1.write("at level 1")  # → wrapper in level_1
```

Each `(fragment_id, container_id)` pair gets its own wrapper. The fragment has two
wrappers (one in `level_0`, one in `level_1`), each restored independently on rerun.

### `st.empty()` used as an outside container

`st.empty()` returns a DeltaGenerator with a `LockedCursor` (replace, don't append). A
single transparent wrapper is created in the empty's slot; the fragment's writes go inside
it and replace/append within the wrapper's own index space.

```python
placeholder = st.empty()

@st.fragment
def my_frag():
    placeholder.write("hello")  # Replaces content inside the wrapper
```

Because the wrapper is transparent, the user sees the written content directly in the
empty's position with no extra box. If the user calls `placeholder.empty()` to clear it,
that replaces the wrapper itself; on the next fragment rerun the cached wrapper's slot may
no longer be valid, so the implementation must fall back to creating a fresh wrapper
(detect that the cached wrapper's parent slot no longer resolves and recreate). This is the
one place where the registry entry can become stale; treat a missing/invalid slot as
"create a new wrapper".

### Full app rerun (`st.rerun()` full scope)

A full app rerun clears `ctx._fragment_outside_wrappers` entirely (as part of
`ctx.on_script_start()`). All wrappers are recreated fresh, including their cursor
snapshots. This is correct because a full rerun re-executes the main script and recreates
the outside containers with fresh cursors.

### Fragment rerun (`st.rerun()` fragment scope)

A fragment-scoped rerun re-executes only that fragment. Its wrappers are already in
`ctx._fragment_outside_wrappers`; each cursor is restored from its snapshot (back to index
0), the wrapper's `add_block` is re-emitted (transparent + `allow_empty`), and the
fragment's elements are written at indices [0..N-1] inside the wrapper. Correct.

### `parallel=True` fragments

With `parallel=True`, fragments execute concurrently on separate threads. The wrapper
approach is safe:

1. **Initial run**: Wrappers are created where outside writes are allowed; each fragment
   keys its wrapper by `(fragment_id, container_id)`.
2. **Fragment rerun**: Fragment reruns are sequential, so the restore + re-emit + writes
   happen on a single thread per fragment.
3. **Distinct keys**: Even under future concurrent reruns, each fragment owns a distinct
   wrapper key, so no two threads mutate the same wrapper.

**Pre-allocated parallel container.** `fragment.py` already pre-allocates the fragment's
own implicit `st.container()` for parallel workers via
`pre_allocated_container_fragment_id` (`fragment.py:413-415`, set at `:735`). When an
outside-write wrapper is pre-allocated on the parallel path, it must be allocated as a
**transparent** block too (same `transparent=True` proto), so the pre-allocated slot
matches what the worker later re-emits. The registry (`ctx._fragment_outside_wrappers`)
may need a lock only if parallel fragments are ever allowed to create wrappers
concurrently; not needed today.

### Dynamic container selection (container chosen at runtime)

```python
containers = [st.container(), st.container()]

@st.fragment
def my_frag():
    idx = 0 if st.session_state.get("toggle") else 1
    containers[idx].write("dynamic")
```

Wrappers are keyed by `(fragment_id, container_dg_id)`, and each container has a stable
`_id`. If the fragment writes to `containers[0]` on one run and `containers[1]` on the
next:

- Run 1: wrapper created in `containers[0]`.
- Run 2 (rerun): the `containers[0]` wrapper is restored + re-emitted but no children are
  written inside it → its stale children are cleared element-level. A new wrapper is
  created in `containers[1]`.

The emptied wrapper in `containers[0]` is transparent and `allow_empty=True`, so it
persists as a zero-DOM node (no empty box appears). Acceptable.

### Re-emission of the wrapper block on rerun

Covered by §5: on every fragment rerun we re-emit each of the fragment's wrapper blocks
(`add_block` with `transparent=True`) at the snapshotted delta path, advancing the
wrapper's `scriptRunId` so it is not cleared as stale. The transparent flag is part of the
re-emitted proto so the frontend keeps treating it as box-less.

## Accessibility

A React Fragment (`<>…</>`) adds **no DOM node** and therefore no accessibility node. For
this anonymous, role-less, unkeyed, unstyled wrapper there is **no accessibility impact**:
the fragment's elements appear in the same place in the accessibility tree and the same
tab/focus order as if written directly to the outside container.

**Constraint:** the transparent block must never carry `role`, `aria-*`, `tabindex`,
focus, or CSS-key box styling. It has no box, so there is nothing to attach these to, and
attaching them would require a real DOM element — defeating the purpose.

For a *future* variant that needs to be keyed or carry attributes (out of scope here),
`display: contents` on a real element is the alternative: it lets a wrapping element exist
in the DOM/a11y tree while removing its own box. Note that `display: contents` does **not**
establish a flex formatting context — children participate in the *parent's* flex layout,
which is exactly why it is unsuitable if the wrapper ever needs to define its own flex
context, and why we prefer the zero-DOM React Fragment for the cursor-isolation wrapper.

## Alternatives Considered

### Wrapper rendering approaches (rejected)

These are alternative ways to render the wrapper. All were rejected in favor of the
transparent (zero-DOM) block.

**Styled wrapper container** (the previous draft of this spec). Render the wrapper as a
normal container — a real DOM box via `StyledLayoutWrapper` + `StyledFlexContainerBlock`.

- Rejected: it adds a real DOM box and an extra nesting level/flex item inside the outside
  container, which is precisely the `st.fragment`-inside-container layout problem reported
  in issue #13024. Outside-write content would be visually boxed and offset differently
  from content written directly to the container.

**Content-width wrapper.** Render a real box but set it to content width
(`width="content"`) so it "hugs" its children instead of stretching.

- Rejected: it regresses the common case. `width="stretch"` children (charts, images,
  dataframes, metrics) would shrink to their minimum width inside a content-width wrapper.
  This is the same class of regression as the shipped 16px-width bug (PR #12807), and is
  exactly the caveat called out in PR #12848's content-width work. Most fragment content is
  full-width today, so this would be a broad, visible regression.

**Mirror the parent's flex props onto the wrapper.** Render a real box but copy the outside
container's flex properties (direction, gap, align, justify, width behavior) onto the
wrapper so it "blends in".

- Rejected: complex and leaky. The extra flex item still consumes space and participates
  in the parent's layout (see the maintainer's screenshot in #13024), so it cannot be made
  perfectly invisible. It is also a maintenance treadmill — every new layout prop added to
  containers must be re-mirrored onto the wrapper to keep parity.

### Cursor management approaches (rejected)

These concern *how* to keep delta paths valid, independent of how the wrapper renders.

**Cursor tracks fragment start indices.** Have `RunningCursor` maintain a
`_fragment_start_indices: dict[str, int]` and reset to the stored start index on rerun.

- Rejected: doesn't solve interleaving (Fragment A expanding overwrites Fragment B's
  slots), requires A to know its slot count in advance, has fragile lifecycle management
  (fragments added/removed), and is incompatible with `parallel=True` (shared mutable
  cursor state).

**Disallow interleaving.** Error if multiple sources write to the same outside container.

- Rejected: overly restrictive for valid patterns (header + fragment + footer).

**Slot-based / key-based placement.** Identify positions by named keys instead of
positional indices.

- Rejected: major architectural overhaul of the delta protocol and the frontend tree;
  disproportionate for this bug.

**Lazy reset on first write.** Track which containers a fragment wrote to and reset those
cursors on first write during rerun.

- Rejected: still doesn't solve interleaving and is fragile when the main script changes
  element counts between reruns.

## Test Plan

### Frontend Unit Tests (Vitest)

`frontend/lib/src/components/core/Block/Block.test.tsx` (or a co-located test):

1. **Transparent block renders children but no wrapper DOM.**
   - Render a `BlockNode` whose `deltaBlock.transparent === true` with a couple of child
     elements.
   - Assert the children are present/visible.
   - Assert **absence** of the wrapper DOM around them: no
     `data-testid="stLayoutWrapper"` and no `stVerticalBlock` box introduced by this
     block (anti-regression: the same children rendered under a normal container *do*
     produce that box).

`ClearStaleNodeVisitor.test.ts` (already covers fragment stale clearing; add a case):

2. **Transparent wrapper block with fragmentId clears stale children on fragment rerun.**
   - Wrapper has `fragmentId` matching a running fragment; children from a previous
     `scriptRunId` are cleared; re-emitted children are preserved.

### Python Unit Tests (pytest)

`lib/tests/streamlit/runtime/fragment_outside_writes_test.py`:

1. `_is_outside_container_write` correctly identifies inside vs outside writes (no fragment
   → False; cursor inside fragment path → False; cursor outside → True).
2. `_get_or_create_outside_wrapper` creates a transparent wrapper on first call (proto has
   `transparent=True`), reuses it on the second call, and creates separate wrappers per
   fragment_id and per container_id.
3. `_reset_outside_wrappers` restores the snapshotted cursor (index back to 0) and enqueues
   a re-emission `add_block` (with `transparent=True`) at the snapshotted delta path.
4. Wrapper registry is cleared on full app run (`on_script_start`).

### E2E Tests (Playwright)

`e2e_playwright/st_fragment_outside_container.py` + `_test.py` (the dedicated
outside-write app/test for this feature; extend it):

1. **Inline rendering, no extra box.** Fragment writes a button + markdown to an outside
   container. Assert the content appears **inline** in the outside container with no extra
   full-width container around it (assert no added `stLayoutWrapper` / `stVerticalBlock`
   wrapping the outside-write content; assert the elements are direct descendants of the
   outside container's box).
2. **Reruns don't duplicate or crash.** Click the button several times; assert no crash
   ("Bad delta path index …" does not appear) and the element count inside the container
   stays constant.
3. **Multiple fragments → same container** render independently and inline.
4. **Interleaved main-script + fragment writes** keep header/footer fixed while the
   fragment content updates.

### Snapshot baselines

Removing the wrapper's nesting level changes the DOM for any fragment snapshot baseline
that previously included a styled wrapper around outside-write content. **Any affected
fragment snapshot baselines must be re-generated** as part of implementation.

## Migration / Breaking Changes

**No breaking changes.** This fix targets a currently-broken feature (outside container
writes from fragments). The transparent wrapper is an implementation detail:

- Users write `outside_container.button("Click")` — the API is unchanged.
- The wrapper adds **no** DOM box and **no** extra flex item, so it is layout-transparent
  (improvement over a styled wrapper, which would add a box/nesting level).
- Apps that don't do outside-container writes from fragments are unaffected; the detection
  gate `_is_outside_container_write` returns `False` immediately.

## Out of Scope / Follow-up

- **Applying the transparent block to `st.fragment`'s own implicit container (the #13024
  redesign) is a follow-up, not part of this spec.** Today every fragment wraps its body in
  an implicit `st.container()` (`fragment.py:420-423`). Switching that container to the new
  transparent block would address #13024 (fragment-inside-container layout), but it is
  deliberately deferred because:
  - **Backward-compat.** Most fragments render full width today and rely on it (top-level
    live widgets, fragment-per-column / fragment-per-tab dashboards). A blanket change
    risks layout shifts and breaks CSS that targets the fragment's `stVerticalBlock`. The
    visible shift would mainly affect the relatively rare apps that put content-width or
    aligned containers around fragments.
  - **Parallel pre-allocation interaction.** It interacts with the
    `pre_allocated_container_fragment_id` path; that path would need to pre-allocate a
    transparent block, with its own validation.
  - **Low demand.** #13024 has ≈4 👍.

  This spec only introduces the transparent block type and uses it for the
  **outside-write wrapper**. Reusing it for the fragment's own container can come later.
- **Wrapper styling/CSS.** The transparent wrapper is intentionally box-less. Users who
  want layout inside an outside-write should create an explicit container in the fragment.
- **Garbage collection of unused wrappers.** A wrapper for a container a fragment stops
  writing to persists (empty, zero-DOM) until full app rerun. Acceptable.
- **`st.empty()` advanced interactions.** The `placeholder.empty()` + re-creation pattern
  works via the "recreate on invalid slot" fallback; revisit if user reports arise.

## Implementation Checklist

Files to modify:

1. `proto/streamlit/proto/Block.proto`
   - Add `bool transparent = 17;` to `Block` (bump `Next ID` to 18).
   - Run `make protobuf` to regenerate Python + TS protobufs.

2. `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`
   - Add `_fragment_outside_wrappers` dict to `ScriptRunContext`.
   - Clear it in `on_script_start()`.

3. `lib/streamlit/delta_generator.py`
   - Add `_is_outside_container_write()` and `_get_or_create_outside_wrapper()` (creates a
     `transparent=True` block; snapshots its initial cursor + delta path).
   - Redirect outside writes through the wrapper in `_enqueue()` and `_block()`.

4. `lib/streamlit/runtime/fragment.py`
   - Add `_reset_outside_wrappers()` (restore cursor from snapshot + re-emit transparent
     `add_block`); call it in `wrapped_fragment()` after the snapshot restore.
   - Ensure the parallel `pre_allocated_container_fragment_id` path allocates a transparent
     block for any pre-allocated outside-write wrapper.

5. `frontend/lib/src/components/core/Block/Block.tsx`
   - Add an early branch in `BlockNodeRenderer`: when `node.deltaBlock.transparent`, return
     `<ChildRenderer />` inside a React Fragment (skip `ContainerContentsWrapper` /
     `FlexBoxContainer` / `StyledLayoutWrapper`).

6. **No changes needed** to `RenderNodeVisitor.tsx`, `ClearStaleNodeVisitor.ts`, or
   `SetNodeByDeltaPathVisitor.ts` beyond the new type existing in the proto: they are
   block-type-agnostic (key by `deltaBlock.id`, clear stale element-level by
   `fragmentId`/`scriptRunId`, and resolve delta paths by index, respectively).

7. Tests:
   - `frontend/lib/src/components/core/Block/Block.test.tsx` — transparent block renders
     children with no wrapper DOM.
   - `lib/tests/streamlit/runtime/fragment_outside_writes_test.py` — detection, wrapper
     creation/reuse (transparent proto), cursor restore + re-emission, registry clearing.
   - `e2e_playwright/st_fragment_outside_container.py` / `_test.py` — inline rendering, no
     extra box, reruns don't duplicate/crash.
   - Re-generate any fragment snapshot baselines affected by the removed nesting level.
