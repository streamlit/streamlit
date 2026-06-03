# Outside Container Button Crash Diagnosis

## Executive Summary

The crash occurs when a fragment writes multiple elements (button + text) to an outside container. **The root cause is a backend bug**: the `RunningCursor` for the outside container is not being reset during fragment reruns. This causes the cursor index to accumulate (0→2→4→...) instead of resetting to 0, resulting in deltas with invalid paths being sent to the frontend.

## Root Cause Confirmation (Logging Evidence)

Debug logging in `delta_generator.py` confirms the cursor accumulation:

```
# Initial full run - cursor starts at 0:
CURSOR_DEBUG: delta_type=button, delta_path=[0, 2, 0], cursor.index=0
CURSOR_DEBUG: delta_type=markdown, delta_path=[0, 2, 1], cursor.index=1

# First fragment rerun - cursor NOT reset, continues from 2:
CURSOR_DEBUG: delta_type=button, delta_path=[0, 2, 2], cursor.index=2   <-- SHOULD BE 0!
CURSOR_DEBUG: delta_type=markdown, delta_path=[0, 2, 3], cursor.index=3 <-- SHOULD BE 1!

# Second fragment rerun - cursor still not reset, continues from 4:
CURSOR_DEBUG: delta_type=button, delta_path=[0, 2, 4], cursor.index=4   <-- SHOULD BE 0!
CURSOR_DEBUG: delta_type=markdown, delta_path=[0, 2, 5], cursor.index=5 <-- SHOULD BE 1!
```

The frontend only has 2 children at `[0, 2]`, so when the backend tries to write at index 4, it throws: `Bad delta path index 4 (should be between [0, 2])`.

## Reproduction Steps

1. Create a Streamlit app with the following pattern:
```python
import streamlit as st

if "counter" not in st.session_state:
    st.session_state.counter = 0

counter_container = st.container()

@st.fragment
def counter_fragment():
    if counter_container.button("Increment", key="btn"):
        st.session_state.counter += 1
    counter_container.write(f"Counter: {st.session_state.counter}")

counter_fragment()
st.write("App loaded successfully")
```

2. Run with `make debug` or `streamlit run`
3. Click the "Increment" button once - works fine
4. Click the button a second time - app hangs/crashes

**Error observed in browser console:**
```
Bad delta path index 4 (should be between [0, 2])
Cannot send rerun backMessage when disconnected from server.
```

## Variation Test Results

| Variation | Description | Result |
|-----------|-------------|--------|
| Working | Button only outside, text inside fragment | PASS |
| Working | Button only outside WITH conditional | PASS |
| **Failing** | **Button + text outside WITH conditional** | **CRASH** |
| To test | Text only outside (no button) | Likely PASS |
| To test | Button + text outside NO conditional | Likely PASS |
| To test | Text before button outside | Unknown |
| To test | No-op conditional | Unknown |

The key difference between working and failing patterns is:
- **Working**: Fragment writes a single element (button only) to outside container
- **Failing**: Fragment writes MULTIPLE elements (button AND text) to outside container

## Root Cause Analysis

### The Problem (Backend Cursor Not Reset)

The crash is caused by a **backend bug in cursor management** for outside containers during fragment reruns.

When a fragment is defined, the following are snapshotted (`lib/streamlit/runtime/fragment.py:368-369`):
```python
cursors_snapshot = deepcopy(ctx.cursors)
dg_stack_snapshot = deepcopy(context_dg_stack.get())
```

On fragment rerun, these snapshots are restored (`fragment.py:393-394`):
```python
ctx.cursors = deepcopy(cursors_snapshot)
context_dg_stack.set(deepcopy(dg_stack_snapshot))
```

**The bug**: An `st.container()` created outside the fragment has its own `RunningCursor` stored in `counter_container._cursor`. This cursor is:
- **NOT** part of `ctx.cursors` (which only contains root containers like main/sidebar)
- **NOT** on the `dg_stack` (since it's not used in a `with` block at definition time)

Therefore, when the fragment reruns, `counter_container._cursor` **retains its state from the previous run**, causing its index to accumulate instead of reset.

### Detailed Flow

**Initial full run:**
1. `counter_container = st.container()` creates a container with cursor at index 0
2. Fragment runs, writes button at index 0, cursor advances to 1
3. Fragment writes text at index 1, cursor advances to 2
4. Run completes, cursor.index = 2

**Fragment rerun (after button click):**
1. `ctx.cursors` and `dg_stack` are restored from snapshots
2. **BUT** `counter_container._cursor` is NOT restored (not in snapshots)
3. `counter_container._cursor.index` is still 2 from previous run!
4. Fragment writes button at index 2 (wrong - should be 0)
5. Fragment writes text at index 3 (wrong - should be 1)
6. Frontend receives deltas with paths `[..., 2]` and `[..., 3]`
7. But frontend only has 2 children (from previous run's indices 0 and 1)
8. **Error:** `Bad delta path index 4 (should be between [0, 2])`

### Why This Affects Outside Containers Specifically

For elements INSIDE the fragment's own block, the fragment block itself is re-created on each run via `with st.container()` at `fragment.py:421`, so path indices are always relative to a fresh block. But for OUTSIDE containers:
- The `DeltaGenerator` object persists in Python (captured by fragment closure)
- Its cursor is NOT part of the snapshots that get restored
- The cursor index accumulates across fragment reruns

### Why Single Element Sometimes Works

When only a button is written to the outside container:
- First run: button at index 0, cursor advances to 1
- Second run: button at index 1 (wrong, but still valid since children.length=1, and index 1 is allowed for insertion)
- Third run: button at index 2, which may fail depending on timing

The crash happens faster with multiple elements because the cursor advances more per run.

## Code Locations

### Frontend (where error is thrown)

`frontend/lib/src/render-tree/visitors/SetNodeByDeltaPathVisitor.ts:106-109`:
```typescript
if (currentIndex < 0 || currentIndex > node.children.length) {
  throw new Error(
    `Bad delta path index ${currentIndex} (should be between [0, ${node.children.length}])`
  )
}
```

### Frontend (where stale nodes are cleared)

`frontend/lib/src/render-tree/visitors/ClearStaleNodeVisitor.ts:125-151`:
```typescript
visitElementNode(node: ElementNode): AppNode | undefined {
  if (this.isFragmentRun) {
    // During a fragment run, we clear stale elements that belong to the
    // running fragment(s) but were not updated in this script run.
    if (
      node.fragmentId &&
      node.scriptRunId !== this.currentScriptRunId &&
      (this.fragmentIdOfBlock ||
        this.fragmentIdsThisRun.includes(node.fragmentId))
    ) {
      return undefined  // <-- Element is cleared here
    }
    return node
  }
  // ...
}
```

### Backend (fragment delta handling)

`lib/streamlit/runtime/fragment.py`:
- Fragment execution preserves delta path context via `dg_stack_snapshot`
- Delta paths are computed at fragment definition time, not rerun time

## Proposed Fix

### Option 1: Reset Outside Container Cursors on Fragment Rerun (Recommended)

The fix is to track DeltaGenerators used for outside container writes and reset their cursors on fragment rerun.

**Implementation approach:**

In `lib/streamlit/runtime/fragment.py`, when the fragment is defined, we need to also capture references to any containers that might be written to from outside. Then, on fragment rerun, reset those containers' cursors as well.

**Possible approaches:**

**A. Track and reset at fragment definition/rerun:**
```python
# At fragment definition, capture outside containers' cursors
outside_dg_cursors = {}  # Will be populated during first run

# On fragment rerun, reset all tracked outside container cursors
for dg_id, cursor_snapshot in outside_dg_cursors.items():
    dg = get_dg_by_id(dg_id)
    if dg and dg._cursor:
        dg._cursor.index = cursor_snapshot.index
```

**B. Reset cursor on first write to outside container:**
```python
# In DeltaGenerator._enqueue, detect outside container writes during fragment runs
# and reset the cursor if this is the first write this fragment run
if ctx.fragment_ids_this_run and is_outside_container(dg):
    if not dg._cursor_reset_this_run:
        dg._cursor.index = 0  # Or restore from snapshot
        dg._cursor_reset_this_run = True
```

**C. Include outside container cursors in the snapshot:**
```python
# Extend the snapshot mechanism to include cursors for any container
# that will be written to by the fragment
# This is more complex as it requires knowing which containers will be used
```

**Files to modify:**
- `lib/streamlit/runtime/fragment.py` - Track and reset outside container cursors
- `lib/streamlit/delta_generator.py` - Possibly add tracking for outside container first write

### Option 2: Wrap Outside Container Writes in a Virtual Block

Instead of writing directly to the outside container, have the fragment create a virtual block within it that gets replaced on each fragment rerun.

**Pros:** Clean separation, no cursor management needed
**Cons:** Changes the tree structure, may affect existing apps

### Option 3: Frontend-Side Fix (Not Recommended)

Have the frontend handle the mismatch by replacing at the correct index based on element key/ID rather than delta path.

**Pros:** Defensive, handles all cases
**Cons:** Masks backend bugs, complex frontend changes

## Recommended Fix: Option 1A or 1B

The cleanest fix is to **reset the outside container's cursor on fragment rerun**. 

**Option 1B (reset on first write)** is likely simplest because:
1. It doesn't require knowing all containers at definition time
2. It handles dynamic container usage (containers selected at runtime)
3. It's localized to the `_enqueue` method

**Key changes:**
1. Add a per-fragment-run flag to track which outside containers have been reset
2. On first write to an outside container during a fragment run, reset its cursor to 0
3. Clear the tracking flag when the fragment run completes

This ensures:
- Outside container cursors start fresh on each fragment rerun
- Delta paths are always valid relative to the current state
- No complex snapshot management needed for arbitrary containers

## Historical Context: Why This Bug Exists

### Git History Analysis

The outside container writes feature was enabled in commit `295149c196` (June 2026). The frontend stale clearing logic was updated to handle fragment elements in outside containers.

However, the **backend cursor management** was not updated to account for this case. The existing snapshot/restore mechanism in `fragment.py` only handles:
- `ctx.cursors` - Root container cursors (main, sidebar)
- `dg_stack` - The stack of active DeltaGenerators (for `with` blocks)

It does NOT handle cursors for arbitrary `DeltaGenerator` objects that are:
- Created outside the fragment
- Captured by the fragment closure
- Written to during fragment execution

This is an oversight in the original implementation of outside container writes.

### Why The Bug Wasn't Caught Earlier

1. **Single-element writes appeared to work**: With only one element (e.g., just a button), the cursor starts at 0, writes at 0, advances to 1. On rerun, it writes at 1 instead of 0, but this is often still valid (insert at end). It takes multiple reruns to accumulate an invalid index.

2. **Counter test was removed**: A test with the failing pattern existed but was removed because it "timed out in CI" - this was actually the bug manifesting!

3. **No cursor state verification**: Tests didn't verify that delta paths were correct across fragment reruns.

### Related Patterns in Codebase

The fragment.py already implements cursor snapshotting for `ctx.cursors` and `dg_stack`. The fix should extend this pattern to also snapshot and restore cursors for outside containers that the fragment writes to.

## Test Cases to Add

1. Button + text to outside container, rapid clicking
2. Multiple widgets (button, text_input, selectbox) to outside container
3. Nested outside containers with fragments
4. Concurrent fragment reruns affecting same outside container
5. **NEW**: Overlapping fragment reruns (trigger second click before first scriptFinished)
