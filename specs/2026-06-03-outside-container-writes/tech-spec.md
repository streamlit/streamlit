---
author: sfc-gh-lwilby-1
created: 2026-06-03
---

# Outside Container Writes for Fragments

## Summary

Enable `@st.fragment` functions to reliably write elements to containers declared outside
the fragment's scope — for example, a parent-scoped `st.container()` or `st.sidebar`
entered via `with`. Today this is blocked to prevent crashes from stale cursor state. The
core technical problem to address in order to allow this is that the outside container's
`RunningCursor` accumulates across fragment reruns instead of resetting. This spec proposes
implicit wrapper containers that isolate each fragment's outside writes into a stable,
independently-resettable block.

## Problem

Fragments can reference containers created outside their scope:

```python
outside = st.container()

@st.fragment
def my_fragment():
    outside.button("Click me")
    outside.write("Status: ok")
```

This is blocked today to prevent crashes from stale `RunningCursor` state. Without the
block, a fragment rerun would produce:

```
Bad delta path index 4 (should be between [0, 2])
```

### Root cause

`RunningCursor` tracks the next child index inside a container. The fragment rerun
mechanism in `fragment.py` snapshots and restores `ctx.cursors` (root container cursors
for MAIN/SIDEBAR) and `context_dg_stack` (the active DeltaGenerator stack). But an
`st.container()` created outside the fragment stores its cursor on
`DeltaGenerator._provided_cursor` — it is neither in `ctx.cursors` (only root containers
are) nor in the `dg_stack` snapshot (the container isn't inside a `with` block at fragment
definition time). So on fragment rerun, the outside container's cursor retains its
accumulated index from prior runs (0 → 2 → 4 → ...), producing delta paths that exceed
the frontend tree's child count.

### Why simple cursor reset won't work

We cannot just track and reset all cursors that a fragment touches:

1. **Discovery timing**: The snapshot is taken at fragment *definition* time, but which
   containers the fragment writes to isn't known until *execution* time.
2. **Interleaving**: Multiple writers (fragments + main script) sharing a container make
   positional indices unstable when one writer changes its element count.
3. **Non-contiguous writes**: Fragment A at index 1, main script at index 2, Fragment B at
   index 3 — resetting A's cursor on rerun would overwrite other elements if A changes
   its element count.

## Proposal

### Implicit wrapper containers

When a fragment writes to an outside container, automatically interpose an implicit
`BlockNode` between the outside container and the fragment's elements. Each
(fragment\_id, outside\_container) pair gets exactly one wrapper. The wrapper's
`RunningCursor` resets to 0 on each fragment rerun.

**Tree structure with multiple fragments and main script:**

```
outside_container
  ├── "Header" (main script, index 0)
  ├── [fragment_a_wrapper] (index 1, stable across reruns)
  │     ├── button
  │     └── text
  ├── [fragment_b_wrapper] (index 2, stable across reruns)
  │     └── chart
  └── "Footer" (main script, index 3)
```

Each wrapper occupies exactly one slot in the parent container, allocated during the
initial full app run and never moved. On fragment rerun, only the wrapper's internal
cursor resets. This solves all three problems: the cursor always starts at 0, fragments
are isolated from each other, and main-script elements are unaffected.

### Detection of outside container writes

In `DeltaGenerator._enqueue` and `_block`, after resolving `dg = self._active_dg`, check
whether the target cursor is outside the current fragment's delta path using the existing
`_is_inside_fragment_path` helper:

```python
def _is_outside_container_write(dg: DeltaGenerator) -> bool:
    ts = ThreadState.get()
    if not ts.fragment_id or not ts.delta_path:
        return False

    # Root-container DGs (st.sidebar, st._main) have their cursors managed
    # by ctx.cursors, which is already snapshot/restored by wrapped_fragment().
    # These must not be wrapped — doing so would conflict with the existing
    # cursor restore mechanism.
    if dg._is_top_level:
        return False

    cursor_path = tuple(dg._cursor.delta_path) if dg._cursor else ()
    if _is_inside_fragment_path(cursor_path, ts.delta_path):
        return False

    # The DG is outside the fragment's delta path, but it may already be
    # inside a wrapper belonging to this fragment (e.g. a nested container
    # created via outer.container() that was redirected through the wrapper).
    # Walk the DG's ancestor chain and check against wrapper DG ids (the
    # registry *values*), not the outside container ids (part of the keys).
    wrapper_dg_ids = {
        wrapper._id
        for wrapper in fragment_storage.outside_wrapper_values_for(ts.fragment_id)
    }
    for ancestor in dg._ancestors:
        if ancestor._id in wrapper_dg_ids:
            return False  # already inside this fragment's wrapper

    return True
```

The ancestor walk is scoped to the **current fragment's** wrapper registry. This is
important for nested fragments: if frag\_b writes to a container inside frag\_a's wrapper,
frag\_a's wrapper is not in frag\_b's registry, so frag\_b correctly gets its own wrapper.

When detected, redirect the write through a wrapper:

```python
if ctx and _is_outside_container_write(dg):
    dg = _get_or_create_outside_wrapper(dg, ts.fragment_id)
```

### Wrapper registry

`FragmentStorage` already manages per-fragment state with the right lifecycle (persists
across fragment reruns, cleared on full app reruns via `clear()`). Add a wrapper registry
to it:

```python
# On MemoryFragmentStorage:
_outside_wrappers: dict[tuple[str, str], DeltaGenerator]
```

Keyed by `(fragment_id, dg._id)` where `dg` is the outside container. On a full app
rerun, all wrappers are cleared unconditionally — the main script recreates outside
containers as new DG objects, so old wrapper entries are stale. New wrappers are created
as fragments re-execute. On the frontend, `ClearStaleNodeVisitor` garbage-collects the
old wrapper `BlockNode`s because they aren't re-emitted with the current `scriptRunId`.

### Proto: new `Transparent` block type

Add a general-purpose transparent block type to `Block.proto`:

```protobuf
message Block {
  oneof type {
    // ... existing types ...
    Transparent transparent = 17;
  }

  message Transparent {
    // A layout-transparent wrapper block with no visual treatment (no
    // padding, border, or gap). Renders as a plain unstyled div. Useful
    // whenever the backend needs to group elements into a single tree
    // node without affecting the user-visible layout.
  }
}
```

The frontend renders a `Transparent` block as an unstyled div — identical to how it
renders an untyped block today, but with an explicit type to match on. This block type
is reusable for any future case that needs an invisible grouping node.

### Wrapper creation and retrieval

`_get_or_create_outside_wrapper` returns a cached wrapper if one exists, or creates a new
one by emitting a `Transparent` block on the outside container. The creation must bypass
the outside-write detection path (e.g., call a lower-level block-emission helper or store
the wrapper in the registry before the call) to avoid re-triggering the check and recursing
infinitely. The wrapper's cursor type
is inherited from the outside container: if the container uses a `LockedCursor` (e.g.
`st.empty()`), the wrapper gets a `LockedCursor(index=0)` to preserve replace semantics;
otherwise it gets a `RunningCursor` for normal append behavior. The creation delta path and
block proto are stored on the wrapper for re-emission during reruns.

The wrapper is created whenever the outside container's creating scope executes — on the
initial full app run, on subsequent full app reruns, or during a parent fragment rerun that
recreates the container. The outside container's `RunningCursor` is only advanced at
wrapper creation time. On standalone fragment reruns the cached wrapper is returned
directly, bypassing the outside container's cursor entirely. This is what avoids
reintroducing the same stale-cursor problem the wrapper is designed to solve.

**Restriction: no new outside writes during standalone fragment reruns.** If a fragment
attempts to write to an outside container during a standalone rerun (`ts.fragment_id in
ctx.fragment_ids_this_run`) and no cached wrapper exists, we raise
`StreamlitAPIException`. See the "Dynamic container selection" behavior decision below for
the full rationale and workaround pattern.

### Cursor reset on fragment rerun

In `wrapped_fragment()` after the existing snapshot restore, reset all wrappers belonging
to this fragment:

```python
def _reset_outside_wrappers(fragment_storage: FragmentStorage, fragment_id: str) -> None:
    for key, wrapper in fragment_storage.outside_wrappers_for(fragment_id):
        # Re-emit the wrapper's add_block delta so the frontend updates its
        # scriptRunId — without this, ClearStaleNodeVisitor would GC the wrapper.
        enqueue_add_block(wrapper._creation_delta_path, wrapper._block_proto)

        if wrapper._cursor.is_locked:
            continue  # LockedCursor (st.empty wrappers) — always at index 0, no reset needed
        wrapper._cursor._index = 0
        wrapper._cursor._transient_index = None
        wrapper._cursor._transient_elements = SparseList()
```

Re-emission applies to all wrappers (including `LockedCursor` ones) — only the cursor
reset is skipped for locked cursors. The cursor reset enumerates all `RunningCursor`
mutable fields to mirror `RunningCursor.__init__`. The `_root_container` and `_parent_path`
fields are immutable after creation and do not need resetting.

This function is called in `wrapped_fragment()` after the existing snapshot restore,
before the fragment body executes. Re-emitting first ensures the frontend sees the wrapper
block before any child elements arrive in the same forward message batch.

### Interaction with `parallel=True`

Outside container writes are already blocked for parallel workers during the initial page
load (existing check in `DeltaGenerator._enqueue`). This proposal only affects sequential
fragment reruns, where a single fragment runs at a time. No additional synchronization is
needed. If parallel outside writes are enabled in the future, the wrapper registry would
need a lock.

### Edge cases

**Multiple fragments → same container.** Each fragment gets its own wrapper at a distinct
index. Wrappers are created in execution order during the initial full app run. Each
fragment only resets its own wrapper's cursor.

**Nested containers.** A fragment calling `outer.container()` triggers `_block` on the
outside container, which is redirected through the wrapper. The returned DG is a child of
the wrapper. Subsequent writes to this nested DG are recognized as already inside the
current fragment's wrapper via the ancestor walk in `_is_outside_container_write`, so they
pass through without creating additional wrappers.

**`st.empty()` as outside container.** `st.empty()` uses a `LockedCursor` that always
points to the same position. The wrapper occupies the empty's single slot. To preserve
`empty()`'s replace semantics, the wrapper inherits the cursor type from its parent
container: when the outside container's cursor `is_locked` (as with `st.empty()`), the
wrapper is created with a `LockedCursor(index=0)` instead of a `RunningCursor`. This
means every write inside the wrapper replaces the previous one, matching `st.empty()`'s
documented "single-element container" contract. On fragment rerun, there is nothing to
reset — a `LockedCursor` always points to index 0.

**Full app rerun.** Clears `_outside_wrappers` entirely. All wrappers are
recreated fresh because the main script re-executes and creates new outside containers
with fresh cursors.

## Behavior Decisions

### Dynamic container selection

A fragment cannot conditionally start writing to an outside container during a standalone
fragment rerun. The fragment must write something to the outside container during the
initial script run (or any run where the container's creating scope executes) so its wrapper
is established. The content written can vary freely across reruns — only the wrapper
creation requires the outside container's cursor to be fresh.

Wrappers are keyed by container identity (`dg._id`). On subsequent standalone reruns, the
fragment can choose which established wrappers to populate — unused wrappers have their
stale children cleared by `ClearStaleNodeVisitor` and remain invisible via
`allow_empty=True`. Attempting to write to an outside container whose wrapper was never
established will raise `StreamlitAPIException`. To conditionally populate a slot, use a
placeholder:

```python
outside = st.container()

@st.fragment
def my_fragment():
    placeholder = outside.empty()       # claims the slot on every run
    if st.button("Show detail"):
        placeholder.write("Detail...")  # fills it during fragment rerun
```

### Widget interactions trigger the writing fragment's rerun

Widgets written to outside containers from inside a fragment will trigger a fragment rerun
on interaction — not a full app rerun, even though the widget visually appears outside the
fragment's scope. This is consistent with standard fragment behavior: `enqueue_message`
stamps every delta with `ThreadState.fragment_id`, and the frontend sends this ID back with
the rerun request. The wrapper does not change this; `fragment_id` stamping is based on
which thread is executing, not on the delta path. Widget identity and stale cleanup are
also unaffected — widget IDs do not include `delta_path`.

## Alternatives Considered

**Option 1: Implicit wrapper containers** ✅ PREFERRED
- Pros: Clean isolation per fragment, no cursor bookkeeping, frontend-transparent,
  `parallel=True` compatible
- Cons: Extra DOM div per (fragment, container) pair — invisible and layout-transparent

**Option 2: Track fragment start indices on `RunningCursor`**
Maintain `_fragment_start_indices: dict[str, int]` on each cursor and reset to the stored
start index on rerun.
- Pros: No extra DOM nodes
- Cons: Doesn't solve interleaving, requires knowing element count in advance, incompatible
  with `parallel=True`

**Option 3: Disallow interleaving**
Error if multiple sources write to the same outside container.
- Pros: Simple
- Cons: Overly restrictive — blocks valid patterns (header + fragment content + footer)

**Option 4: Slot-based / key-based placement**
Use named keys instead of positional indices to identify element positions.
- Pros: Eliminates positional problems entirely
- Cons: Major overhaul of the delta protocol and frontend tree; disproportionate scope

**Option 5: Lazy cursor reset on first write**
Track which containers a fragment previously wrote to, and reset those cursors on first
write during rerun.
- Pros: No extra DOM nodes
- Cons: Same interleaving problem as Option 2; fragile if the main script changes between
  reruns
