---
author: cursor-agent
created: 2026-06-03
---

# Outside Container Writes: Cursor Management for Fragment Reruns

## Summary

When an `@st.fragment` function writes multiple elements to a container declared outside
its scope, the `RunningCursor` for that container accumulates across fragment reruns
instead of resetting. This produces invalid delta paths that crash the frontend. This spec
designs a solution using implicit wrapper containers that isolate each fragment's writes
into a stable, independently-resettable block.

## Problem

### Symptom

A fragment writing two or more elements to an outside container crashes on the second
fragment rerun with:

```
Bad delta path index 4 (should be between [0, 2])
```

### Root Cause

`RunningCursor` instances track the next child index inside a container. The fragment
rerun mechanism (`lib/streamlit/runtime/fragment.py:388-394`) snapshots and restores only:

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
4. **Minimal complexity**: The solution must not require per-fragment snapshots of
   arbitrary cursor trees or complex bookkeeping that's fragile to maintain.
5. **`parallel=True` compatible**: The approach must work safely when multiple fragments
   execute concurrently on different threads (future feature).
6. **Frontend transparency**: Minimal or zero changes to the frontend render tree logic.

## Proposal: Implicit Wrapper Containers

### Core Idea

When a fragment writes to an outside container, automatically interpose an implicit
`BlockNode` (container) between the outside container and the fragment's elements. Each
(fragment_id, outside_container) pair gets exactly one wrapper. The wrapper has its own
`RunningCursor` that starts at 0 on each fragment rerun (because the wrapper is created
fresh each time or its cursor is trivially resettable).

### Tree Structure

**Before (current broken behavior):**
```
outside_container [cursor: 0 → 2 → 4 → ...]
  ├── button (fragment, index 0)
  └── text   (fragment, index 1)
```

**After (with implicit wrapper):**
```
outside_container [cursor: managed by main script, advances once per fragment]
  └── [implicit_wrapper] [cursor: 0 → always resets to 0 on fragment rerun]
        ├── button (fragment, index 0)
        └── text   (fragment, index 1)
```

**With multiple fragments:**
```
outside_container
  ├── "Header" (main script, index 0)
  ├── [fragment_a_wrapper] (index 1, locked)
  │     ├── element_from_a_0
  │     └── element_from_a_1
  ├── [fragment_b_wrapper] (index 2, locked)
  │     └── element_from_b_0
  └── "Footer" (main script, index 3)
```

Each wrapper occupies exactly one slot in the parent container. The slot is allocated
during the initial full app run and never moves. On fragment rerun, only the wrapper's
internal cursor resets.

### Detailed Design

#### 1. Wrapper Registry

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

#### 2. Detection of Outside Container Writes

In `DeltaGenerator._enqueue` and `DeltaGenerator._block`, after resolving `dg = self._active_dg`,
detect whether this is a fragment writing to an outside container:

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

#### 3. Wrapper Creation / Retrieval

When an outside container write is detected, redirect through the wrapper:

```python
# In lib/streamlit/delta_generator.py

def _get_or_create_outside_wrapper(
    dg: DeltaGenerator,
    fragment_id: str,
) -> DeltaGenerator:
    """Get or create an implicit wrapper container for this fragment's writes
    to the given outside container."""
    ctx = get_script_run_ctx()
    if ctx is None:
        return dg  # Defensive fallback
    
    wrapper_key = (fragment_id, dg._id)
    
    if wrapper_key in ctx._fragment_outside_wrappers:
        wrapper = ctx._fragment_outside_wrappers[wrapper_key]
        return wrapper
    
    # Create a new implicit wrapper block inside the outside container.
    # This advances dg's cursor by one slot (the wrapper occupies one slot).
    block_proto = Block_pb2.Block()
    # Mark as a fragment wrapper for frontend identification
    block_proto.allow_empty = True
    
    wrapper = dg._block(block_proto)
    ctx._fragment_outside_wrappers[wrapper_key] = wrapper
    
    return wrapper
```

#### 4. Cursor Reset on Fragment Rerun

When a fragment reruns, the wrapper's cursor must reset to 0. This happens in
`wrapped_fragment()` inside `fragment.py`, after the snapshot restore:

```python
# In lib/streamlit/runtime/fragment.py, inside wrapped_fragment()

def wrapped_fragment() -> Any:
    ctx = get_script_run_ctx()
    ...
    
    if ctx.fragment_ids_this_run:
        # Existing snapshot restore
        ctx.cursors = deepcopy(cursors_snapshot)
        context_dg_stack.set(deepcopy(dg_stack_snapshot))
        
        # Reset outside container wrappers for this fragment
        _reset_outside_wrappers(ctx, fragment_id)
    
    ...
```

The reset function:

```python
# In lib/streamlit/runtime/fragment.py

def _reset_outside_wrappers(ctx: ScriptRunContext, fragment_id: str) -> None:
    """Reset the cursors of all implicit wrappers belonging to this fragment."""
    for key, wrapper in ctx._fragment_outside_wrappers.items():
        if key[0] == fragment_id and wrapper._cursor is not None:
            wrapper._cursor._index = 0
            wrapper._cursor._transient_index = None
            wrapper._cursor._transient_elements = SparseList()
```

#### 5. Integration into `_enqueue` and `_block`

Modify `_enqueue` and `_block` to redirect outside writes through the wrapper:

```python
# In _enqueue, after `dg = self._active_dg`:

if ctx:
    ts = ThreadState.get()
    if ts.fragment_id and _is_outside_container_write(dg):
        dg = _get_or_create_outside_wrapper(dg, ts.fragment_id)

# In _block, same pattern after `dg = self._active_dg`:

if ctx:
    ts = ThreadState.get()
    if ts.fragment_id and _is_outside_container_write(dg):
        dg = _get_or_create_outside_wrapper(dg, ts.fragment_id)
```

#### 6. Fragment ID Stamping on Wrapper Block

The wrapper block's `add_block` delta message must carry the fragment's `fragment_id` so
the frontend can correctly attribute it for stale clearing. This is already handled by
the existing `_enqueue_message` logic in `script_run_context.py:475-477` which stamps
`msg.delta.fragment_id = ts.fragment_id` for any delta sent while `ts.fragment_id` is set.

#### 7. Frontend Changes

**No changes required to `ClearStaleNodeVisitor.ts`.**

The existing logic already handles this correctly:

- The wrapper `BlockNode` receives the fragment's `fragment_id` and the current
  `scriptRunId` when created/re-emitted.
- On fragment rerun, the wrapper block is re-emitted (via the `_block` call that
  `_get_or_create_outside_wrapper` makes), so its `scriptRunId` is updated.
- `ClearStaleNodeVisitor` sees the wrapper's `fragmentId` matches a running fragment,
  its `scriptRunId` matches current run, so it propagates `fragmentIdOfBlock` to children.
- Children inside the wrapper that weren't re-emitted (stale) are cleared.
- Children outside the wrapper (other fragments, main script elements) are untouched.

**No changes required to `SetNodeByDeltaPathVisitor.ts`.**

Delta paths are valid because the wrapper has its own index space starting at 0.

### Handling the Wrapper Re-emission on Rerun

On fragment rerun, the wrapper must be **re-emitted** as a block delta so the frontend
knows it belongs to the current script run. The `_get_or_create_outside_wrapper` function
returns the cached wrapper DG, but its block was only emitted during the initial run.

To handle this, on fragment rerun we must re-emit the wrapper's `add_block` delta:

```python
def _reset_outside_wrappers(ctx: ScriptRunContext, fragment_id: str) -> None:
    """Reset cursors and re-emit wrapper blocks for this fragment's outside
    container wrappers."""
    for key, wrapper in ctx._fragment_outside_wrappers.items():
        if key[0] != fragment_id:
            continue
        if wrapper._cursor is None:
            continue
        
        # Reset the wrapper's internal cursor
        wrapper._cursor._index = 0
        wrapper._cursor._transient_index = None
        wrapper._cursor._transient_elements = SparseList()
        
        # Re-emit the wrapper's add_block message so the frontend updates
        # its scriptRunId (prevents stale clearing of the wrapper itself)
        msg = ForwardMsg()
        parent_dg_cursor = wrapper._parent._cursor if wrapper._parent else None
        if parent_dg_cursor:
            # The wrapper's delta path in the parent is its locked cursor position
            msg.metadata.delta_path[:] = wrapper._cursor.delta_path[:-1]
            # Actually we need the path that was used when the block was created.
            # Store it on the wrapper at creation time.
            msg.metadata.delta_path[:] = wrapper._creation_delta_path
            msg.delta.add_block.CopyFrom(Block_pb2.Block(allow_empty=True))
            _enqueue_message(msg)
```

A cleaner approach: store the creation delta path on the wrapper DG at creation time:

```python
def _get_or_create_outside_wrapper(dg, fragment_id):
    ...
    wrapper = dg._block(block_proto)
    # Store the delta path used to create this wrapper for re-emission
    wrapper._creation_delta_path = list(
        make_delta_path(dg._root_container, dg._cursor.parent_path, dg._cursor.index - 1)
    )
    # Note: index - 1 because _block already incremented the parent cursor
    ...
```

Wait — actually, the wrapper's `LockedCursor` already knows its position. Let me
reconsider.

When `_block` is called, it:
1. Records `msg.metadata.delta_path[:] = dg._cursor.delta_path` (the parent's current
   cursor position)
2. Creates a `RunningCursor` for the new block
3. Calls `dg._cursor.get_locked_cursor()` to advance the parent

The delta path used for the `add_block` message is `[root_container, *parent_path, index]`
where index is the slot the wrapper occupies in the outside container. This is effectively
the wrapper's address minus the last component.

For re-emission, we need to send a new `add_block` at the same delta path. The wrapper
DG's cursor has `root_container` and `parent_path` which together give us the wrapper's
delta path: `[root_container, *parent_path[:-1], parent_path[-1]]`. Actually, the wrapper's
`parent_path` IS `(*outside_container.parent_path, outside_container.index)`, and the
wrapper itself is at a specific index in that parent. We need the *parent* delta path.

Simpler approach: store the raw delta path bytes at wrapper creation time.

```python
# At creation:
wrapper._wrapper_delta_path = list(msg.metadata.delta_path)  # before _block returns
```

Actually, the cleanest solution is:

```python
def _get_or_create_outside_wrapper(dg, fragment_id):
    ...
    # Capture the delta path that will be used for the add_block message
    creation_delta_path = list(dg._cursor.delta_path)
    
    wrapper = dg._block(block_proto)
    wrapper._wrapper_delta_path = creation_delta_path
    ctx._fragment_outside_wrappers[wrapper_key] = wrapper
    return wrapper
```

Then on rerun:

```python
def _reset_outside_wrappers(ctx, fragment_id):
    for key, wrapper in ctx._fragment_outside_wrappers.items():
        if key[0] != fragment_id:
            continue
        if wrapper._cursor is None:
            continue
        
        wrapper._cursor._index = 0
        wrapper._cursor._transient_index = None
        wrapper._cursor._transient_elements = SparseList()
        
        # Re-emit the add_block at the original delta path
        msg = ForwardMsg()
        msg.metadata.delta_path[:] = wrapper._wrapper_delta_path
        msg.delta.add_block.CopyFrom(Block_pb2.Block(allow_empty=True))
        _enqueue_message(msg)
```

## Edge Cases

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

Tree:
```
outside (3 children during initial run: 2 wrappers if no direct writes, or mixed)
  ├── [wrapper for frag_a] (index 0)
  │     ├── A1
  │     └── A2
  └── [wrapper for frag_b] (index 1)
        └── B1
```

Wrappers are created in execution order during the initial full app run. Each fragment
only resets its own wrapper's cursor. No interleaving possible.

### Nested containers (outside container contains another container)

```python
outer = st.container()

@st.fragment
def my_frag():
    inner = outer.container()  # Creates a container inside the wrapper
    inner.write("nested")
```

This works naturally. The `outer.container()` call triggers `_block` on `outer`. The
outside-container detection sees this is outside the fragment path, so it redirects to
the wrapper. The `inner` container is created *inside* the wrapper, and its cursor is
local to it. No special handling needed.

### Fragment writing to containers at different nesting levels

```python
level_0 = st.container()
level_1 = level_0.container()  # created by main script

@st.fragment
def my_frag():
    level_0.write("at level 0")  # → wrapper in level_0
    level_1.write("at level 1")  # → wrapper in level_1
```

Each (fragment_id, container_id) pair gets its own wrapper. The fragment has two
wrappers: one in `level_0` and one in `level_1`. Both are reset independently on
fragment rerun.

### `st.empty()` used as an outside container

`st.empty()` returns a DeltaGenerator with a `LockedCursor` (not a `RunningCursor`).
Writes to an empty replace its content rather than appending.

```python
placeholder = st.empty()

@st.fragment
def my_frag():
    placeholder.write("hello")  # Replaces content
```

For `st.empty()`, the cursor is a `LockedCursor` that always points to the same position.
The `_is_outside_container_write` check will detect it's outside the fragment scope.
However, `st.empty()` semantics are "replace, don't append" — only one element can exist
there. The wrapper approach still works: a wrapper is created inside the empty's slot,
and writes go into it. Since `empty()` only supports a single child, the wrapper
effectively contains one element that gets replaced each time.

**Important**: If the user calls `placeholder.empty()` to clear it, that's a replace
operation on the `LockedCursor` — it replaces the wrapper. On next fragment rerun, the
wrapper is gone. The implementation must handle this by checking if the cached wrapper is
still valid (its parent cursor position still exists). If not, create a new wrapper.

Practically, since `empty()` replaces content, the wrapper is a single child slot
regardless. The cursor inside the wrapper advances from 0 to 1, which is fine because
the frontend sees it as a new block each time (via the re-emission mechanism).

### Interaction with `st.rerun()` (full app scope)

A full app rerun clears `ctx._fragment_outside_wrappers` entirely (as part of
`ctx.on_script_start()`). All wrappers are recreated fresh. This is correct because a
full rerun re-executes the main script which recreates outside containers with fresh
cursors.

### Interaction with `st.rerun()` (fragment scope)

A fragment-scoped rerun only re-executes that fragment. The wrapper for that fragment is
already in `ctx._fragment_outside_wrappers`. The cursor is reset to 0, the wrapper's
`add_block` is re-emitted, and the fragment's elements are written at indices 0..N-1
inside the wrapper. This is correct.

### Interaction with `parallel=True` fragments

With `parallel=True`, fragments execute concurrently on separate threads. Currently,
outside container writes are **blocked** for parallel fragments during initial page load
(see `_enqueue` check at `delta_generator.py:508-526`). They are only allowed during
sequential fragment reruns.

The wrapper approach is safe for `parallel=True` because:

1. **Initial run**: Wrappers are created during the sequential initial run (where
   `parallel=True` fragments still execute sequentially for outside writes, or the
   outside write is blocked).
2. **Fragment rerun**: Only one fragment reruns at a time (fragment reruns are sequential).
   The wrapper reset + re-emission + writes all happen on a single thread.
3. **Future multi-fragment parallel rerun**: If we ever support multiple fragments
   rerunning in parallel, each fragment has its own wrapper (distinct keys in the
   registry). No two threads write to the same wrapper simultaneously, so no race
   condition exists.

The registry (`ctx._fragment_outside_wrappers`) may need a lock if parallel fragments
are allowed to create wrappers concurrently. For now, since outside writes are blocked
during parallel initial runs, this is not needed.

### Dynamic container selection (container chosen at runtime)

```python
containers = [st.container(), st.container()]

@st.fragment
def my_frag():
    idx = 0 if st.session_state.get("toggle") else 1
    containers[idx].write("dynamic")
```

This works because wrappers are keyed by `(fragment_id, container_dg_id)`. Each container
has a stable `_id`. If the fragment writes to `containers[0]` on one run and
`containers[1]` on another:

- Run 1: wrapper created in `containers[0]`, nothing in `containers[1]`
- Run 2 (rerun): wrapper in `containers[0]` is reset (cursor → 0) and re-emitted, but
  no elements are written inside it → stale clearing removes old children. A new wrapper
  is created in `containers[1]`.

The stale wrapper in `containers[0]` becomes empty (its children are cleared as stale
since they weren't re-emitted). The `allow_empty=True` on the block proto means the
empty wrapper div persists but is invisible. This is acceptable behavior.

**Optimization (optional)**: If a wrapper has no writes during a fragment rerun, don't
re-emit it. Then the frontend clears the entire wrapper as stale. This requires tracking
"was this wrapper used this run" which adds complexity. For MVP, always re-emit all
wrappers belonging to the fragment and let stale clearing handle unused children.

## Alternatives Considered

### Option 2: Cursor Tracks Fragment Start Indices

Have `RunningCursor` maintain a `_fragment_start_indices: dict[str, int]` mapping. On
fragment rerun, reset cursor to the stored start index.

**Rejected because:**
- Does not solve interleaving (Fragment A expanding overwrites Fragment B's slots)
- Requires Fragment A to know exactly how many slots it will use in advance
- Complex lifecycle management (what happens when fragments are removed/added?)
- Incompatible with `parallel=True` (shared mutable cursor state)

### Option 3: Disallow Interleaving

Error if multiple sources write to the same outside container.

**Rejected because:**
- Overly restrictive for valid use cases (header + fragment + footer pattern)
- Users would need complex workarounds for simple patterns

### Option 4: Slot-Based / Key-Based Placement

Use named keys instead of positional indices to identify element positions.

**Rejected because:**
- Major architectural overhaul of the delta protocol
- Changes fundamental frontend tree structure
- Disproportionate scope for this bug fix

### Option 5: Reset Cursor on First Write (Lazy Reset)

Track which containers a fragment wrote to previously. On fragment rerun, reset those
cursors to their starting position on first write.

**Rejected because:**
- Still doesn't solve interleaving (same fundamental issue as Option 2)
- Requires tracking "what index did the fragment start at" per container
- Fragile if the main script changes between reruns (indices shift)

## Test Plan

### E2E Tests (Playwright)

Located at `e2e_playwright/st_fragment_outside_container_test.py`:

1. **Basic: Button + text to outside container, multiple clicks**
   - Fragment writes `button` + `markdown` to an outside container
   - Click button 3 times, verify no crash and correct content after each click
   - Assert element count in the container stays constant (2 elements inside wrapper)

2. **Multiple fragments writing to same outside container**
   - Two fragments each write elements to the same container
   - Click buttons in each fragment, verify independence
   - Assert neither fragment's rerun affects the other's elements

3. **Interleaved: Main script + fragment writes to same container**
   - Main script writes header/footer, fragment writes in between
   - Fragment reruns, verify header/footer unchanged and fragment content updates

4. **Conditional writes: Fragment changes element count**
   - Fragment conditionally writes 1 or 3 elements based on state
   - Toggle state, verify elements appear/disappear correctly without crashes

5. **Nested containers from fragment**
   - Fragment creates a nested container inside an outside container
   - Writes to the nested container, reruns, verify correct behavior

6. **`with outside_container:` syntax from within a fragment**
   - Use context manager syntax for outside writes
   - Verify equivalent behavior to method-call syntax

### Unit Tests (pytest)

Located at `lib/tests/streamlit/runtime/fragment_outside_writes_test.py`:

1. **`_is_outside_container_write` correctly identifies outside vs inside writes**
   - Fragment path set, cursor inside → returns False
   - Fragment path set, cursor outside → returns True
   - No fragment → returns False

2. **`_get_or_create_outside_wrapper` creates wrapper on first call, reuses on second**
   - First call creates block and returns new DG
   - Second call with same key returns cached DG
   - Different fragment_id creates separate wrapper

3. **`_reset_outside_wrappers` resets cursor and re-emits block**
   - After reset, wrapper cursor index is 0
   - ForwardMsg with add_block is enqueued at correct delta path

4. **Wrapper registry cleared on full app run**
   - Verify `on_script_start` clears `_fragment_outside_wrappers`

5. **Multiple wrappers for one fragment writing to multiple containers**
   - One fragment, two outside containers → two wrappers with distinct keys

### Frontend Unit Tests (Vitest)

The existing `ClearStaleNodeVisitor.test.ts` should already cover the fragment stale
clearing behavior since the wrapper is just a standard `BlockNode` with a `fragmentId`.
Add a specific test case:

1. **Wrapper block with fragmentId clears stale children on fragment rerun**
   - Block has fragmentId matching running fragment
   - Children from previous run (different scriptRunId) are cleared
   - New children are preserved

## Migration / Breaking Changes

**No breaking changes.** This fix applies to a new feature (outside container writes from
fragments) that is currently broken. The implicit wrapper is an implementation detail:

- Users write `outside_container.button("Click")` — the API is unchanged
- The wrapper adds one extra DOM div in the tree. It uses `allow_empty=True` and has no
  visual styling, so it's layout-transparent in standard container contexts
- Existing apps that don't use outside container writes from fragments are completely
  unaffected (the detection gate `_is_outside_container_write` returns False immediately)

## Out of Scope

- **Wrapper styling/CSS**: The wrapper div is intentionally unstyled. If users need
  specific layout (e.g., `st.columns` inside an outside container), they can create
  explicit containers inside the fragment's writes.
- **Garbage collection of unused wrappers**: If a fragment stops writing to a container,
  the wrapper persists (empty) until full app rerun. This is acceptable for MVP.
- **`st.empty()` advanced interactions**: The `placeholder.empty()` + re-creation pattern
  works but the stale wrapper persists until cleared. Edge case to revisit if user reports
  arise.

## Implementation Checklist

Files to modify:

1. `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`
   - Add `_fragment_outside_wrappers` dict to `ScriptRunContext`
   - Clear it in `on_script_start()`

2. `lib/streamlit/delta_generator.py`
   - Add `_is_outside_container_write()` helper function
   - Add `_get_or_create_outside_wrapper()` function
   - Modify `_enqueue()` to redirect outside writes through wrapper
   - Modify `_block()` to redirect outside writes through wrapper

3. `lib/streamlit/runtime/fragment.py`
   - Add `_reset_outside_wrappers()` function
   - Call it in `wrapped_fragment()` during fragment rerun (after snapshot restore)

4. `e2e_playwright/st_fragment_outside_container_test.py` — new E2E test file
5. `e2e_playwright/st_fragment_outside_container.py` — new E2E app file
6. `lib/tests/streamlit/runtime/fragment_outside_writes_test.py` — new unit test file
