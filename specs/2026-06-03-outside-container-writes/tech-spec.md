---
author: sfc-gh-lwilby-1
created: 2026-06-03
---

# Outside Container Writes for Fragments

## Summary

Enable `@st.fragment` functions to reliably write elements to containers declared outside
the fragment's scope — for example, a parent-scoped `st.container()`, or a root container
such as `st.sidebar` / `st.bottom`. Today this is only **partially restricted**, and the
paths that aren't restricted are buggy:

- Writing a **widget** to an outside container raises
  `StreamlitFragmentWidgetsNotAllowedOutsideError`.
- Writing **directly to `st.sidebar`** from a fragment raises `StreamlitAPIException`.
- Everything else is **allowed today but buggy**: non-widget elements written to a
  captured `st.container()`, and any write to `st.bottom`, are unguarded and hit the
  failure modes below. The widget and sidebar restrictions exist precisely because these
  same modes are most easily triggered there.

The failure modes are **two distinct problems**:

1. **Cursor accumulation** — the outside container's `RunningCursor` accumulates across
   fragment reruns instead of resetting (0 → 2 → 4 → …), producing delta paths that exceed
   the frontend tree's child count. This affects **non-root containers** (e.g. a captured
   `st.container()`); root containers do **not** accumulate, because their cursors live in
   `ctx.cursors`, which `wrapped_fragment()` already snapshots and restores.
2. **Interleaving / overwrite** — when a fragment shares an outside container with other
   content (the main script or another fragment) and its element count changes across
   reruns, the fragment overwrites whatever is positioned after it. This affects **any**
   shared outside container: a captured `st.container()` (header → fragment → footer) just
   as much as a root a fragment writes to directly (`st.sidebar`, `st.bottom`). A cursor
   reset does not prevent it; only positional isolation does.

This spec proposes implicit wrapper containers that isolate each fragment's outside writes
into a stable, independently-resettable block. The wrapper solves accumulation (its cursor
always starts at 0) and interleaving (it occupies one fixed slot, so the fragment's element
count can vary without touching its neighbors). Notably, this means `st.sidebar` and
`st.bottom` need wrappers even though they don't accumulate — purely to keep a fragment
writing directly to them from overwriting trailing main-script content.

## Problem

Fragments can reference containers created outside their scope:

```python
outside = st.container()

@st.fragment
def my_fragment():
    outside.button("Click me")
    outside.write("Status: ok")
```

Only part of this is restricted today: the `outside.button(...)` widget write raises
`StreamlitFragmentWidgetsNotAllowedOutsideError`, but the `outside.write(...)` element
write is allowed — there is no guard for non-widget writes to a captured `st.container()`.
That unguarded path is buggy: on fragment rerun it produces stale `RunningCursor` state and
crashes with:

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
    # Walk the DG's ancestor chain against this fragment's wrapper DG ids and
    # skip it if already wrapped — otherwise we'd nest a second wrapper and
    # produce bad delta paths on rerun.
    wrapper_dg_ids = {
        wrapper._id
        for wrapper in fragment_storage.outside_wrapper_values_for(ts.fragment_id)
    }
    for ancestor in dg._ancestors:
        if ancestor._id in wrapper_dg_ids:
            return False  # already inside this fragment's wrapper

    return True
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

Concretely, when a fragment writes directly to a root that also holds main-script content —
a header before the fragment call and a footer after it — the wrapper takes one stable slot
between them:

```
st.sidebar
  ├── "Header"          (main script, index 0)
  ├── [fragment_wrapper] (index 1, stable slot)
  │     └── …fragment content, count varies across reruns…
  └── "Footer"          (main script, index 2)
```

The fragment's element count can grow or shrink freely inside the wrapper without ever
touching the footer's slot (`st.bottom`, e.g. `st.chat_input()`, behaves identically).
Without the wrapper, a fragment that grew from 3 → 5 elements would overwrite the footer —
the interleaving/overwrite failure mode from the Summary.

#### Ancestor walk to detect existing wrapper

A fragment can write to a container nested inside an outside container — e.g. it calls
`outer.container()` and writes to the returned DG. That first call is redirected through the
fragment's wrapper, so the nested DG lives *inside* the wrapper, but its cursor path is still
outside the fragment's own delta path. The plain path check would therefore flag every
subsequent write to it as a fresh outside-container write — re-wrapping already-wrapped
content and producing spurious extra wrappers (and bad delta paths) on rerun.

To prevent this, before wrapping we walk `dg`'s ancestor chain and skip the write if any
ancestor is already one of this fragment's wrappers. That requires a way to look up the
fragment's existing wrappers, which is what the wrapper registry provides.

**Wrapper registry.** `FragmentStorage` already manages per-fragment state with the right
lifecycle (persists across fragment reruns, cleared on full app reruns via `clear()`). Add a
wrapper registry to it:

```python
# On MemoryFragmentStorage:
_outside_wrappers: dict[tuple[str, str], OutsideWrapper]
# OutsideWrapper bundles the wrapper DeltaGenerator with creating_fragment_id —
# the fragment whose scope created the outside container (None for the main script).
```

Keyed by `(fragment_id, dg._id)` where `dg` is the outside container. Because the key
includes `fragment_id`, the ancestor walk only checks the current fragment's wrappers. This
matters for nested fragments: if frag\_b writes to a container inside frag\_a's wrapper,
frag\_a's wrapper is not in frag\_b's slice of the registry, so frag\_b correctly gets its
own wrapper.

Each entry also records the **creating fragment** of the outside container — the fragment
whose body ran `st.container()`, or `None` for a main-script container — captured by stamping
the container DG at creation from `ThreadState.fragment_id` (set because `wrapped_fragment()`
runs the body under `with ThreadState.scoped(fragment_id=...)`). This is distinct from the
key's `fragment_id`, which identifies the fragment that *writes* through the wrapper.

**Lifecycle.** An entry is valid only while both its outside container and its writing
fragment are live. Three events evict entries; afterward the relevant scope re-establishes its
wrappers as it re-executes:

- **Full app rerun:** `clear()` empties the whole registry. The existing
  `MemoryFragmentStorage.clear()` clears only the fragment maps today, so it must be extended
  to also flush `_outside_wrappers` — otherwise main-script and stable-`_id` root wrappers
  (`st.sidebar`, `st.bottom`) would survive into the next run with an already-advanced cursor.
- **Fragment rerun of `X`:** before `X`'s body runs, evict entries whose
  `creating_fragment_id == X` — the containers `X` is about to rebuild.
- **Fragment `X` removed:** when `X` is dropped from storage (`clear_stale_descendants` after
  a parent rerun, or `delete`), evict entries *written by* `X` (the key's first element). A
  removed nested fragment's wrapper for a stable-`_id` root is not covered by the
  creating-fragment eviction (the root's creating fragment is `None`); without this step,
  re-adding `X` on a later fragment-only rerun would reuse that stale wrapper. Both `clear()`
  and `clear_stale_descendants` route through `MemoryFragmentStorage._remove`, so the eviction
  lives there as the single chokepoint for all removals.

Keying the rerun eviction on the *creating* rather than writing fragment means a fragment that
writes to an ancestor's container keeps its wrapper across its own standalone reruns and drops
it only when the ancestor reruns.

On the frontend, `ClearStaleNodeVisitor` garbage-collects old wrapper `BlockNode`s that
aren't re-emitted with the current `scriptRunId`. The design doesn't depend on the outside
container being a fresh DG object: a captured `st.container()` returns a new DG while the root
singletons (`st.sidebar`, `st.bottom`) keep a stable `_id` — either way the entry is cleared
when its creating scope reruns and the wrapper is rebuilt.

### Wrapper creation and retrieval

When a write needs a wrapper, redirect it through one:

```python
if ctx and _needs_outside_wrapper(dg):
    dg = _get_or_create_outside_wrapper(dg, ts.fragment_id)
```

`_get_or_create_outside_wrapper` returns the fragment's cached wrapper for the outside
container, or, if none exists yet, emits a new `Transparent` block on the container and
caches it. Emitting that block must not itself re-trigger outside-write detection, or it
would recurse; how that re-entrancy is avoided is an implementation detail, out of scope
here.

A wrapper is only *created* while the container's `RunningCursor` is fresh — at the start of
a full run — because placing it advances that cursor exactly once; doing so on a standalone
fragment rerun, when the cursor is already at its accumulated position, would reintroduce the
stale-cursor problem the wrapper exists to solve. So wrappers are created on full runs and
merely reused on standalone reruns, which bypass the container's cursor entirely. For a
captured `st.container()` that fresh moment is when its *creating scope* runs (in the main
script or a parent fragment); root containers (`st.sidebar`, `st.bottom`) have no creating
scope, but their cursor is reset each full run via `ctx.cursors`, so the trigger is simply
the fragment's first write to the root during a full run. A fragment therefore cannot start
writing to a brand-new outside container on a standalone rerun (see "Dynamic container
selection" below).

The wrapper inherits its cursor type from the outside container: when the container's cursor
is locked (as with `st.empty()`), the wrapper gets a `LockedCursor(index=0)` to preserve
replace semantics; otherwise a `RunningCursor` for normal append behavior. Its creation
delta path and block proto are stored on the wrapper for re-emission on rerun.

#### Proto: new `Transparent` block type

The wrapper is emitted as a new general-purpose transparent block type added to
`Block.proto`:

```protobuf
message Block {
  oneof type {
    // ... existing types ...
    Transparent transparent = 17;
  }

  message Transparent {
    // A layout-transparent wrapper block with no visual treatment (no
    // padding, border, or gap). Renders as a plain unstyled grouping with no
    // DOM node of its own. Used to group elements into a single tree node
    // without affecting the user-visible layout.
  }
}
```

The `Transparent` block reserves a slot in the Streamlit element tree (a `BlockNode`) for
the backend's cursor bookkeeping, but has no DOM footprint: the frontend renders its
children directly (via a `ChildRenderer` React fragment) rather than wrapping them in a
container element, so they become direct flex items of the parent and inherit its layout
context (direction, width, gap). This block type is reusable for any future case that needs
an invisible grouping node in the tree.

### Cursor reset on fragment rerun

In `wrapped_fragment()`, after the existing snapshot restore and before the fragment body
executes, do two things. First, **evict** the registry entries this run will invalidate —
those whose container is created by this fragment's scope (see the registry lifecycle above):

```python
def _evict_outside_wrappers(fragment_storage: FragmentStorage, fragment_id: str) -> None:
    # Containers this fragment creates are about to be rebuilt; drop their wrappers.
    for key in fragment_storage.outside_wrapper_keys_created_by(fragment_id):
        del fragment_storage._outside_wrappers[key]
```

Then **reset** the wrappers this fragment writes through — re-emitting each and resetting its
cursor so reused wrappers survive `ClearStaleNodeVisitor` and start at index 0:

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

Eviction runs first, so the reset only re-emits wrappers whose containers are still live.
Re-emitting before the body also ensures the frontend sees each reused wrapper block before
its child elements arrive in the same forward message batch.

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

**`EVENT` root does not need a wrapper.** `st.toast` and dialogs route to the `EVENT` root,
which `_needs_outside_wrapper` excludes by design. The delta-level collision exists
mechanically, but it causes no user-visible loss: toasts are one-shot effects (the frontend
forces fresh payloads / re-fire and auto-dismiss rather than reusing element payloads), and
dialogs are modal singletons with no variable-count positional interleaving. Wrapping it
would serve no purpose and could interfere with one-shot rendering.

## Behavior Decisions

### Dynamic container selection

A fragment cannot conditionally start writing to an outside container during a standalone
fragment rerun. The fragment must write something to the outside container during the
initial script run (or any run where the container's creating scope executes) so its wrapper
is established. The content written can vary freely across reruns — only the wrapper
creation requires the outside container's cursor to be fresh.

Wrappers are keyed by container identity (`dg._id`) and persist across the fragment's
standalone reruns (see the registry lifecycle above). On subsequent standalone reruns, the
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

Also cover the **registry eviction lifecycle** when a parent fragment recreates an outside
container:

- **Parent-fragment recreation.** A parent fragment `P` creates `c = st.container()`; a
  nested (or otherwise cross-scope) fragment `F` writes directly to `c`. Drive a standalone
  rerun of `P` (which rebuilds `c` as a new DG) and assert (a) the registry holds no orphaned
  entry for the old container — exactly one wrapper for `(F, c)`, keyed to the rebuilt `c`,
  and (b) no stale/duplicate wrapper is re-emitted to the frontend (no stray node, no
  out-of-bounds delta-path error). Then drive a standalone rerun of `F` (which does not
  rebuild `c`) and assert its wrapper is reused rather than recreated, and its content resets
  correctly.

## Alternatives Considered

**Option 1: Implicit wrapper containers** ✅ PREFERRED
- Pros: Clean isolation per fragment, no cursor bookkeeping, frontend-transparent,
  `parallel=True` compatible
- Cons: Extra tree node per (fragment, container) pair — invisible and layout-transparent
  (no DOM footprint)

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
