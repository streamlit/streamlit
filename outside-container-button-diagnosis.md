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

The crash is caused by a **race condition** in the `handleScriptFinished` handler when multiple fragment reruns overlap:

1. **ScriptRunId State Race**: When `handleScriptFinished` is called, it reads `scriptRunId` and `fragmentIdsThisRun` from React state. However, if a NEW fragment run has started before the previous run's `scriptFinished` is processed, the state has already been updated to the NEW run's IDs.

2. **Incorrect Stale Clearing**: This causes `clearStaleNodes` to use the wrong `scriptRunId`, clearing elements from the CURRENT (just-completed) run as if they were stale.

### Detailed Flow (Rapid Click Scenario)

**Initial state (after first successful run):**
```
Outside Container:
  - Index 0: Button (fragmentId: "abc", scriptRunId: "run1")
  - Index 1: Text "Counter: 0" (fragmentId: "abc", scriptRunId: "run1")
```

**On rapid double-click:**

1. **Click 1** - triggers fragment rerun "run2":
   - State: `{scriptRunId: "run2", fragmentIdsThisRun: ["abc"]}`
   - Backend starts processing, sends deltas with scriptRunId "run2"
   
2. **Click 2** (before run2 completes) - triggers fragment rerun "run3":
   - NewSession message arrives with scriptRunId "run3"
   - State updated to: `{scriptRunId: "run3", fragmentIdsThisRun: ["abc"]}`
   
3. **Run2's scriptFinished** arrives:
   - `handleScriptFinished` is called
   - It reads from CURRENT state: `scriptRunId: "run3"` (WRONG!)
   - Calls `clearStaleNodes("run3", ["abc"])`

4. **Stale clearing with wrong ID**:
   - Elements from run2 have `scriptRunId: "run2"`
   - `ClearStaleNodeVisitor` checks: `element.scriptRunId !== "run3"` → TRUE
   - **Elements are incorrectly cleared as "stale"**

5. **Run3's deltas arrive**:
   - Backend computed paths assuming run2's elements exist
   - But the container is now empty or has fewer children
   - `SetNodeByDeltaPathVisitor` throws: `Bad delta path index 4 (should be between [0, 2])`

### Why This Affects Outside Containers Specifically

For elements INSIDE the fragment's own block, the fragment block itself is re-created on each run, so path indices are always relative to a fresh block. But for OUTSIDE containers:
- The container persists across runs
- Elements accumulate if not properly cleared
- Delta paths are computed relative to the existing container state
- Race conditions cause mismatches between expected and actual state

### Why Single Element Sometimes Works

When only a button is written to the outside container:
- Index 0 is always valid (can insert at empty container)
- Even with race condition, the single element can be applied
- However, this may still fail under different timing conditions

### Why Multiple Elements Fails

When button AND text are written:
- If race condition clears elements, container becomes empty
- Button delta at index 0 may succeed
- Text delta at index 1+ fails if container was cleared
- The specific index in the error depends on timing and tree structure

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

### Option 1: Capture scriptRunId at scriptFinished Receipt (Recommended)

The issue is that `handleScriptFinished` reads `scriptRunId` from state, but state may have been updated by a newer run. The fix is to capture the scriptRunId when `scriptFinished` is received, before calling setState.

**Implementation:**
```typescript
// In handleScriptFinished, capture the scriptRunId from the message or 
// track it per-run rather than reading from state
handleScriptFinished(status: ForwardMsg.ScriptFinishedStatus): void {
  // Use a scriptRunId that was captured when this run started,
  // not the current state's scriptRunId
  const finishedRunId = this.currentlyProcessingRunId; // tracked separately
  
  this.setState(
    ({ fragmentIdsThisRun, elements }) => ({
      elements: elements.clearStaleNodes(finishedRunId, fragmentIdsThisRun),
    }),
    // ...
  );
}
```

**Files to modify:**
- `frontend/app/src/App.tsx` - Track the scriptRunId per-run, use it in handleScriptFinished

### Option 2: Include scriptRunId in scriptFinished Message

Have the backend include the scriptRunId in the `scriptFinished` ForwardMsg, so the frontend knows exactly which run completed.

**Pros:** Explicit, no state tracking needed
**Cons:** Requires protobuf changes

### Option 3: Ignore scriptFinished for Stale Runs

If a newer run has started, ignore `scriptFinished` from older runs entirely (for stale clearing purposes). The newer run's `scriptFinished` will clean up correctly.

**Pros:** Simple logic
**Cons:** May leave stale elements longer than necessary

### Option 4: Graceful Path Recovery in SetNodeByDeltaPathVisitor

Instead of throwing on invalid index, attempt to recover by expanding the children array or replacing at the highest valid index.

**Pros:** Simple, defensive
**Cons:** May mask other bugs, could cause incorrect tree structure

## Recommended Fix: Option 1

The cleanest fix is to **track the scriptRunId per-run** and use that tracked ID in `handleScriptFinished` rather than reading from current state. This ensures each run's `scriptFinished` clears stale nodes using the correct scriptRunId.

**Key changes:**
1. In `handleNewSession`, track the scriptRunId that's starting
2. In `handleScriptFinished`, use the tracked ID (not `this.state.scriptRunId`)
3. Clear the tracked ID after processing

This ensures:
- Each scriptFinished uses the correct scriptRunId
- Race conditions between overlapping runs are handled correctly
- Stale elements are cleared at the right time with the right ID

## Historical Context: Why Stale Clearing Works This Way

### Git History Analysis

The current stale node clearing mechanism evolved through several commits:

1. **Convert clearStaleNodes to ClearStaleNodesVisitor (#12819)** - Nov 2025
   - Original implementation as a visitor pattern
   - Basic scriptRunId-based staleness detection

2. **Fix spinner clear_transient race condition during rapid reruns (#13849)** - Feb 2026
   - Fixed a similar timing issue with transient nodes (spinners)
   - Added logic to restore anchor when transient is cleared in current run
   - Shows awareness of race conditions but focused on transient nodes

3. **Allow fragments to write widgets to outside containers (commit 295149c196)** - Jun 2026
   - Changed `visitElementNode` to clear stale elements based on fragmentId
   - Enabled fragments to write to containers outside their scope
   - Introduced the `fragmentIdsThisRun.includes(node.fragmentId)` check

4. **Restore fragmentIdOfBlock check (commit 4953598643)** - Jun 2026
   - Added back `fragmentIdOfBlock` check for nested fragment handling
   - Combined with external container writes logic

### Why The Bug Wasn't Caught Earlier

1. **Single-element writes worked**: The original E2E test only wrote a button (not button + text) to the outside container, which happens to succeed even with race conditions.

2. **Counter test was removed**: A test with the failing pattern existed but was removed because it "timed out in CI" - this was actually the bug manifesting!

3. **No explicit scriptRunId tracking**: The code assumed `this.state.scriptRunId` would be stable during `handleScriptFinished`, but React's batched updates mean state can be stale.

4. **Race conditions are timing-dependent**: The bug only manifests under rapid clicking, which is hard to catch in typical manual testing.

### Related Patterns in Codebase

The structural sharing feature (`9f33e36cd9`) introduced `isNodeTouchedInRun` tracking to handle similar structural issues, but this was in a different branch/feature line and didn't address the scriptFinished race condition.

## Test Cases to Add

1. Button + text to outside container, rapid clicking
2. Multiple widgets (button, text_input, selectbox) to outside container
3. Nested outside containers with fragments
4. Concurrent fragment reruns affecting same outside container
5. **NEW**: Overlapping fragment reruns (trigger second click before first scriptFinished)
