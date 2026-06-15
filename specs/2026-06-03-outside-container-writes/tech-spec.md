---
author: sfc-gh-lwilby-1
created: 2026-06-03
---

# Outside Container Writes for Fragments

## Summary

Enable `@st.fragment` functions to reliably write elements to containers declared outside
the fragment's scope — for example, a parent-scoped `st.container()`, or a root container
such as `st.sidebar` / `st.bottom` entered via `with`. Today this is blocked to prevent
crashes from stale cursor state.

There are **two distinct failure modes** behind the block, and they affect different kinds
of containers:

1. **Cursor accumulation** — affects **non-root containers** (e.g. a captured
   `st.container()`). The outside container's `RunningCursor` accumulates across fragment
   reruns instead of resetting (0 → 2 → 4 → …), producing delta paths that exceed the
   frontend tree's child count. Root containers do **not** have this problem: their cursors
   live in `ctx.cursors`, which `wrapped_fragment()` already snapshots and restores.
2. **Interleaving / overwrite** — affects **root containers a fragment writes to directly**
   (`st.sidebar`, `st.bottom`). A fragment that writes to such a root and changes its
   element count across reruns will overwrite non-fragment content positioned after it. A
   cursor reset does not prevent this; only positional isolation does.

This spec proposes implicit wrapper containers that isolate each fragment's outside writes
into a stable, independently-resettable block. The wrapper solves accumulation (the
wrapper's cursor always starts at 0) and interleaving (the wrapper occupies one fixed slot,
so the fragment's element count can vary without touching its neighbors). Consequently
`st.sidebar` and `st.bottom` still need wrappers — not because they accumulate, but because
a fragment writing directly to them would otherwise overwrite trailing main-script content.

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

### Detecting when a write needs a wrapper

In `DeltaGenerator._enqueue` and `_block`, after resolving `dg = self._active_dg`, use
`_needs_outside_wrapper` to decide whether the write must be redirected through a wrapper. A
write needs one when a fragment targets either a non-root container outside its own delta
path (detected via the existing `_is_inside_fragment_path` helper) or a `SIDEBAR`/`BOTTOM`
root directly:

```python
def _needs_outside_wrapper(dg: DeltaGenerator) -> bool:
    ts = ThreadState.get()
    if not ts.fragment_id or not ts.delta_path:
        return False

    if dg._is_top_level:
        # Only SIDEBAR and BOTTOM need a wrapper: a fragment writing directly to
        # one of these roots interleaves with main-script content, so when its
        # element count changes across reruns the wrapper keeps that content from
        # overwriting trailing neighbors.
        #   - MAIN never reaches here (a fragment can't write to it directly).
        #   - EVENT holds only one-shot toasts / singleton dialogs, which need no
        #     positional isolation.
        return dg._root_container in (RootContainer.SIDEBAR, RootContainer.BOTTOM)

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

When detected, redirect the write through a wrapper:

```python
if ctx and _needs_outside_wrapper(dg):
    dg = _get_or_create_outside_wrapper(dg, ts.fragment_id)
```

#### Writes to root containers

The `if dg._is_top_level:` branch handles writes to a root container. `dg._is_top_level`
(defined as `dg._provided_cursor is None`) is true for all four roots —
`RootContainer.MAIN=0`, `SIDEBAR=1`, `EVENT=2`, `BOTTOM=3` — and `dg._root_container` selects
which ones need wrapping. Only writes to the **bare root** DG reach this branch: the wrapper
itself and any `st.container()` opened on a root are non-top-level (they have a provided
cursor), so they fall through to the path check and ancestor walk below, where they're
recognized as already-inside. Repeated direct writes to the same root don't create duplicate
wrappers either, because `_get_or_create_outside_wrapper` is cache-keyed by
`(fragment_id, dg._id)` and a root's `_id` is stable across runs.

#### Wrapper registry

`FragmentStorage` already manages per-fragment state with the right lifecycle (persists
across fragment reruns, cleared on full app reruns via `clear()`). Add a wrapper registry
to it:

```python
# On MemoryFragmentStorage:
_outside_wrappers: dict[tuple[str, str], DeltaGenerator]
```

Keyed by `(fragment_id, dg._id)` where `dg` is the outside container. Because the key
includes `fragment_id`, the ancestor walk in `_needs_outside_wrapper` only checks the
current fragment's wrappers. This matters for nested fragments: if frag\_b writes to a
container inside frag\_a's wrapper, frag\_a's wrapper is not in frag\_b's slice of the
registry, so frag\_b correctly gets its own wrapper.

On a full app rerun, all wrappers are cleared unconditionally — for non-root containers the
main script recreates outside containers as new DG objects, so old wrapper entries are
stale. New wrappers are created as fragments re-execute. On the frontend, `ClearStaleNodeVisitor`
garbage-collects the old wrapper `BlockNode`s because they aren't re-emitted with the
current `scriptRunId`.

Note that root containers (`st.sidebar`, `st.bottom`) are singletons with a **stable**
`_id`, so unlike a captured `st.container()` they are *not* recreated as new DG objects on
a full rerun. Correctness does not depend on the DG being new: the unconditional `clear()`
drops the old entry regardless, the entry is recreated as the fragment re-executes, and the
root's `RunningCursor` is fresh at full-run start — so the wrapper is re-placed at the same
stable slot.

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
the outside-write detection path so that emitting the wrapper block does not itself
re-trigger the check and recurse infinitely. The exact bypass mechanism is left to the
implementation plan (it is out of scope here); note in particular that relying on the
ancestor walk to break the recursion does **not** generalize to root containers — a root's
wrapper is a *child* of the root, never an ancestor, so when the wrapper-creation block is
emitted on the bare root the ancestor walk finds nothing to match. The wrapper's cursor type
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

**Root containers have no creating scope.** `st.sidebar` and `st.bottom` are not created by
a statement in the main script, so there is no "creating scope" to hook into. Instead, for
these roots the wrapper is established on the initial full app run — and on any subsequent
full rerun — the first time the fragment writes to that root: the root's `RunningCursor`
advances exactly once to place the wrapper, then the wrapper is cached. The
"no new outside writes during standalone reruns" restriction below applies unchanged: the
fragment must have written to the root during a full run for its wrapper to exist.

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
current fragment's wrapper via the ancestor walk in `_needs_outside_wrapper`, so they
pass through without creating additional wrappers.

**`st.empty()` as outside container.** `st.empty()` uses a `LockedCursor` that always
points to the same position. The wrapper occupies the empty's single slot. To preserve
`empty()`'s replace semantics, the wrapper inherits the cursor type from its parent
container: when the outside container's cursor `is_locked` (as with `st.empty()`), the
wrapper is created with a `LockedCursor(index=0)` instead of a `RunningCursor`. This
means every write inside the wrapper replaces the previous one, matching `st.empty()`'s
documented "single-element container" contract. On fragment rerun, there is nothing to
reset — a `LockedCursor` always points to index 0.

**Root containers (`st.sidebar`, `st.bottom`).** A fragment writing directly to a root
that also holds main-script content gets a wrapper for positional isolation. Concretely,
with a header written to the root before the fragment call and a footer after it:

```
st.sidebar
  ├── "Header"          (main script, index 0)
  ├── [fragment_wrapper] (index 1, stable slot)
  │     └── …fragment content, count varies across reruns…
  └── "Footer"          (main script, index 2)
```

The fragment's element count can grow or shrink freely inside the wrapper without ever
touching the footer's slot. `st.bottom` (e.g. `st.chat_input()` routes there) behaves
identically. This is the interleaving/overwrite failure mode from the Summary; without the
wrapper, a fragment that grows from 3 → 5 elements would overwrite the footer.

**`EVENT` root is out of scope for wrapping.** `st.toast` and dialogs route to the `EVENT`
root, which `_needs_outside_wrapper` deliberately excludes. The delta-level collision
exists mechanically, but it causes no user-visible loss: toasts are one-shot effects (the
frontend forces fresh payloads / re-fire and auto-dismiss rather than reusing element
payloads), and dialogs are modal singletons with no variable-count positional interleaving.
A wrapper would be unnecessary here and could interfere with one-shot rendering.

**Full app rerun.** Clears `_outside_wrappers` entirely. For non-root containers, all
wrappers are recreated fresh because the main script re-executes and creates new outside
containers with fresh cursors. Root containers keep their stable `_id` across reruns, but
the unconditional `clear()` still drops and recreates their wrapper entries as the fragment
re-executes against a fresh root cursor (see "Wrapper registry"), so the wrapper lands at
the same stable slot.

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
also unaffected — widget IDs do not include `delta_path`. This applies equally to widgets a
fragment writes into a root container (e.g. `st.sidebar.button(...)`): interacting with
them triggers the writing fragment's rerun, since `fragment_id` stamping is
container-agnostic.

## Testing plan

Beyond the existing non-root `st.container()` coverage, add variable-element-count tests for
the root containers a fragment can write to directly:

- **SIDEBAR.** A fragment writes a non-fragment "header" to `st.sidebar`, then a fragment
  whose direct-sidebar element count varies across reruns (e.g. 3 → 5 → 2), then a
  non-fragment "footer" to the same sidebar after the fragment call. Drive real
  fragment-scoped reruns and assert:
  - (a) **shrink** (5 → 2) does not leave stale fragment elements behind, and
  - (b) **growth** (3 → 5) does not overwrite the trailing non-fragment footer — the footer
    stays at its stable slot once the wrapper fix lands.
- **BOTTOM.** Mirror the SIDEBAR test against `st.bottom` (e.g. via `st.chat_input()` and
  other bottom-routed writes), with non-fragment content before and after the fragment's
  bottom writes, asserting the same shrink/growth invariants.

These cases specifically guard the interleaving/overwrite failure mode; before the wrapper
fix, growth in the SIDEBAR/BOTTOM cases overwrites the trailing footer.

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
