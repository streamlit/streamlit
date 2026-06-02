# Outside Container Button Crash Diagnosis

## Executive Summary

The crash occurs when a fragment writes multiple elements (button + text) to an outside container and uses the button's return value conditionally. On fragment rerun, the frontend clears stale elements from the outside container before receiving the new delta messages, causing delta path indices to become invalid.

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

### The Problem

The crash is caused by a **race condition** between two operations during fragment rerun:

1. **Stale node clearing**: When fragment rerun starts, `ClearStaleNodeVisitor` removes elements that belong to the running fragment from the render tree (including those in outside containers)
2. **Delta application**: The backend sends new delta messages with paths referencing the OLD tree structure

### Detailed Flow

**Initial state (before button click):**
```
Outside Container:
  - Index 0: Button (fragmentId: "abc")
  - Index 1: Text "Counter: 0" (fragmentId: "abc")
```

**On button click (fragment rerun):**

1. Frontend receives `ScriptRunning` message with `fragmentIdsThisRun: ["abc"]`
2. Frontend calls `clearStaleNodes("new-script-run-id", ["abc"])`
3. `ClearStaleNodeVisitor.visitElementNode()` checks:
   - Element has fragmentId "abc" ✓
   - fragmentId is in fragmentIdsThisRun ✓
   - scriptRunId differs from current run ✓
   - → **Element is cleared as stale**
4. Both button and text are removed from outside container

**Tree after clearing:**
```
Outside Container:
  - (empty, or only non-fragment elements)
```

5. Backend sends delta messages with paths like:
   - `[0, 0, 3, 0]` for button
   - `[0, 0, 3, 1]` for text (index 1)

6. `SetNodeByDeltaPathVisitor` tries to set node at index 1, but:
   - The container only has ~0-2 children now
   - Index 4 (or similar) is out of bounds
   - **Throws: `Bad delta path index 4 (should be between [0, 2])`**

### Why Single Element Works

When only a button is written to the outside container:
- The button delta arrives first with path index 0
- Even if cleared, index 0 can be re-created
- No index mismatch occurs

### Why Button + Text Fails

When button AND text are written:
- Text has a higher index (e.g., index 4)
- After clearing, the container has fewer children
- The text delta tries to insert at an invalid index

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

### Option 1: Defer Stale Node Clearing (Recommended)

Don't clear stale fragment elements from outside containers until AFTER all deltas for the current script run have been received and applied.

**Implementation:**
1. Track which elements are "potentially stale" during fragment rerun
2. Apply all incoming deltas first
3. After `scriptFinished` is received, clear elements that weren't re-emitted

**Files to modify:**
- `frontend/app/src/App.tsx` - Change timing of `clearStaleNodes()` call
- `frontend/lib/src/render-tree/AppRoot.ts` - May need new method for deferred clearing

### Option 2: Backend Path Recalculation

Have the backend compute delta paths based on what the frontend tree WILL look like after clearing, not what it looked like before.

**Pros:** More accurate paths
**Cons:** Requires backend to track frontend state, complex

### Option 3: Graceful Path Recovery in SetNodeByDeltaPathVisitor

Instead of throwing on invalid index, attempt to recover:
- If index is out of bounds, expand the children array
- Or skip the delta if the target doesn't exist

**Pros:** Simple fix
**Cons:** May mask other bugs, could cause incorrect tree structure

## Recommended Fix: Option 1

The cleanest fix is to **defer stale node clearing** until all deltas have been applied. This maintains the existing delta path calculation logic while ensuring the tree structure matches what the backend expects.

**Key changes:**
1. In `App.tsx`, when receiving `ScriptRunning` for a fragment run, DON'T immediately call `clearStaleNodes()`
2. Instead, save `fragmentIdsThisRun` for later use
3. When receiving `scriptFinished`, THEN call `clearStaleNodes()` with the saved fragment IDs

This ensures:
- Delta paths remain valid when deltas are applied
- Stale elements are still cleaned up after the run completes
- The final tree state is correct

## Test Cases to Add

1. Button + text to outside container, rapid clicking
2. Multiple widgets (button, text_input, selectbox) to outside container
3. Nested outside containers with fragments
4. Concurrent fragment reruns affecting same outside container
