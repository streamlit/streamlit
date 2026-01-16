# Fragments Writing to Outside Containers - Investigation Report

## Executive Summary

This document investigates the feasibility of allowing Streamlit fragments to write widgets to containers outside their own delta path. Currently, this is explicitly disallowed (since PR #8756) due to widget duplication bugs. This investigation analyzes the root causes and explores potential solutions.

## Background

### What is a Fragment?

A Streamlit fragment (`@st.fragment`) is a decorated function that can independently re-run without triggering a full app rerun. Fragments are useful for:
- Reducing latency for interactive widgets
- Isolating expensive computations
- Creating real-time updating sections

### The Problem

When a fragment writes widgets to containers outside its own scope, those widgets get duplicated on each fragment rerun instead of being replaced:

```python
import streamlit as st

B = st.container()  # Container created OUTSIDE fragment

@st.fragment
def my_fragment():
    B.button("Test")  # Widget written to OUTSIDE container

my_fragment()
st.button("Full Rerun")
```

**Expected behavior:** Clicking "Test" should trigger a fragment rerun and the button should remain as a single button.

**Actual behavior:** Each click on "Test" adds another identical button to container B.

### Current Solution (PR #8756)

The current solution is to simply disallow this pattern. The `check_fragment_path_policy()` function in `lib/streamlit/elements/lib/policies.py:129-161` raises a `StreamlitFragmentWidgetsNotAllowedOutsideError` when a widget attempts to write to a delta path that doesn't start with the fragment's delta path.

---

## Technical Analysis

### How Fragments Work

#### 1. Fragment Registration (Decoration Time)

When `@st.fragment` is applied to a function (`lib/streamlit/runtime/fragment.py:136-276`):

1. **Snapshot Capture** (lines 168-169):
   ```python
   cursors_snapshot = deepcopy(ctx.cursors)
   dg_stack_snapshot = deepcopy(context_dg_stack.get())
   ```
   - `ctx.cursors`: Dictionary mapping root containers to `RunningCursor` objects
   - `context_dg_stack`: Stack of active DeltaGenerators (containers you're "inside" via `with`)

2. **Fragment ID Generation** (lines 170-172):
   ```python
   fragment_id = calc_md5(
       f"{func.__module__}.{get_object_name(func)}{dg_stack[-1]._get_delta_path_str()}{additional_hash_info}"
   )
   ```

3. **Wrapped Function Creation**: A closure that captures the snapshots and fragment ID

#### 2. Fragment Execution (Rerun Time)

When a fragment reruns (`lib/streamlit/runtime/fragment.py:178-258`):

1. **State Restoration** (lines 189-194):
   ```python
   if ctx.fragment_ids_this_run:
       ctx.cursors = deepcopy(cursors_snapshot)
       context_dg_stack.set(deepcopy(dg_stack_snapshot))
   ```

2. **Fragment Context Setup** (lines 206-207, 221-235):
   - Sets `ctx.current_fragment_id`
   - Creates a container wrapper (`with st.container()`)
   - Sets `ctx.current_fragment_delta_path`

3. **Function Execution**: The user's fragment function runs

4. **Cleanup** (lines 255-257): Restores previous context

### How Delta Paths Work

Delta paths are arrays of integers that locate elements in the app tree:
- `[0]` = Main container root
- `[0, 2]` = Third child of main container
- `[0, 2, 1]` = Second child of a nested container that's the third child of main

The `RunningCursor` class (`lib/streamlit/cursor.py:191-250`) tracks the current index and auto-increments when `get_locked_cursor()` is called:
```python
def get_locked_cursor(self, **props: Any) -> LockedCursor:
    locked_cursor = LockedCursor(...)
    self._index += 1  # <-- Auto-increment
    return locked_cursor
```

### How Frontend Handles Fragment Reruns

The frontend (`frontend/lib/src/render-tree/`) manages the app tree using:

1. **AppRoot** (`AppRoot.ts`): Root of the element tree
2. **BlockNode** (`BlockNode.ts`): Container nodes with children
3. **ElementNode** (`ElementNode.ts`): Leaf nodes (widgets, text, etc.)

Each node tracks:
- `scriptRunId`: Identifies which run created the node
- `fragmentId`: Identifies which fragment created the node (if any)

#### Stale Node Clearing (`ClearStaleNodeVisitor.ts:40-168`)

After a script run finishes, stale nodes are cleared:

1. **Full App Run**: All nodes with `scriptRunId !== currentScriptRunId` are removed
2. **Fragment Run**: Only nodes whose **parent block's** `fragmentId` is in `fragmentIdsThisRun` AND have stale `scriptRunId` are removed

The key insight is in `visitBlockNode()` (lines 84-94):
```typescript
// This block is modified by the current run, so we indicate this to our children
if (
  node.fragmentId &&
  this.fragmentIdsThisRun.includes(node.fragmentId) &&
  node.scriptRunId === this.currentScriptRunId
) {
  clearStaleNodeVisitor = new ClearStaleNodeVisitor(
    this.currentScriptRunId,
    this.fragmentIdsThisRun,
    node.fragmentId  // Pass fragmentId to children
  )
}
```

---

## Root Cause Analysis

### The Core Issue: Cursor State Not Restored for Outside Containers

When a fragment writes to an outside container (e.g., `B.button("Test")`):

1. **Container B is a separate DeltaGenerator** captured by closure, NOT part of `ctx.cursors` or `dg_stack`
2. **B's cursor is NOT restored** on fragment rerun
3. **Each fragment rerun increments B's cursor**, placing the widget at a NEW delta path
4. **Frontend doesn't clear old widgets** because B's block doesn't have the fragment's `fragmentId`

#### Visual Timeline

```
Initial Full Run:
1. B = st.container()           → B created at [0, 0], B._cursor.index = 0
2. @st.fragment decorator       → Snapshot: cursors={main: idx=1}, dg_stack=[main]
3. fragment() runs              → Fragment container at [0, 1]
4. B.button("Test") inside      → Button at [0, 0, 0], B._cursor.index = 1

Fragment Rerun #1:
1. Restore cursors snapshot     → main cursor reset, BUT B still has index=1
2. Fragment container re-sent   → [0, 1] replaced
3. B.button("Test")            → Button at [0, 0, 1] (NEW position!)
4. Old button at [0, 0, 0]     → NOT cleared (B not a fragment block)
   Result: 2 buttons visible

Fragment Rerun #2:
1. B._cursor.index = 2
2. Button at [0, 0, 2]
3. Old buttons NOT cleared
   Result: 3 buttons visible
```

### Why Widget IDs Don't Cause DuplicateWidgetID Error

Widget ID tracking (`ctx.widget_ids_this_run`) is reset at the start of each script run. Since the widget ID is computed deterministically (based on type, key, parameters, etc.), each fragment rerun registers the same widget ID - but into a freshly cleared set.

The backend sees one widget; the frontend sees multiple elements.

---

## Potential Solutions

### Solution 1: Element-Level Fragment Clearing (Recommended)

**Concept**: Clear stale elements based on the element's own `fragmentId`, not the parent block's.

**Changes Required**:

1. **Frontend (`ClearStaleNodeVisitor.ts`)**:
   Modify `visitElementNode()` to check the element's `fragmentId`:
   ```typescript
   visitElementNode(node: ElementNode): AppNode | undefined {
     if (this.isFragmentRun) {
       // Clear if element's fragmentId matches current fragment and is stale
       if (
         node.fragmentId &&
         this.fragmentIdsThisRun.includes(node.fragmentId) &&
         node.scriptRunId !== this.currentScriptRunId
       ) {
         return undefined  // Clear this element
       }
       // Preserve if not related to current fragment
       return node
     }
     return node.scriptRunId === this.currentScriptRunId ? node : undefined
   }
   ```

2. **Backend**: Remove the restriction in `check_fragment_path_policy()`

**Pros**:
- Clean conceptual model: "elements belong to their creating fragment"
- Minimal backend changes
- Works with existing fragment ID tagging

**Cons**:
- Elements from multiple fragments could be interleaved in a container
- May cause visual "jumping" if elements are cleared/added in different positions
- Needs thorough testing for edge cases

**Risk Level**: Medium - Changes core clearing algorithm

---

### Solution 2: Reset Outside Container Cursors

**Concept**: Track which outside containers are written to during fragment execution, and reset their cursors on fragment rerun.

**Changes Required**:

1. **Backend (`fragment.py`)**:
   - Track outside container writes during fragment execution
   - Before fragment rerun, reset those containers' cursors to their snapshot positions

2. **Backend (DeltaGenerator)**:
   - Add mechanism to track when a DG is written to from a fragment
   - Store cursor state per fragment

**Pros**:
- Elements are placed at consistent positions
- Frontend replacement logic works naturally
- No frontend changes needed

**Cons**:
- Complex tracking of which containers are "touched"
- Requires storing per-fragment cursor states
- May interfere with normal container usage outside fragments

**Risk Level**: High - Complex state management

---

### Solution 3: Stable Delta Paths via Hash

**Concept**: When writing to outside containers from fragments, use a stable delta path computed from a hash instead of the auto-incrementing cursor.

**Changes Required**:

1. **Backend (DeltaGenerator/_enqueue)**:
   - Detect when writing to outside container from fragment
   - Use hash-based index instead of cursor index
   - e.g., `index = hash(widget_id) % RESERVED_RANGE`

**Pros**:
- Same widget always goes to same position
- Natural replacement on frontend
- No stale clearing changes needed

**Cons**:
- Hash collisions could cause issues
- Reserved index ranges are fragile
- Mixes two paradigms (sequential vs hash-based)

**Risk Level**: High - Fundamental change to delta path semantics

---

### Solution 4: Explicit Clear Before Fragment Rerun

**Concept**: Before executing a fragment rerun, send explicit "clear" messages for all elements the fragment previously wrote to outside containers.

**Changes Required**:

1. **Backend (fragment.py)**:
   - Track elements written to outside containers (delta paths + fragment ID)
   - On fragment rerun, emit clear/remove messages for those elements

2. **Frontend**:
   - Handle new "clear element at path" message type
   - Or: use a special "fragment clear" message

**Pros**:
- Explicit behavior, easy to understand
- Works with existing frontend tree structure
- Can be implemented incrementally

**Cons**:
- Extra network traffic
- Requires tracking what was written where
- Adds complexity to fragment rerun protocol

**Risk Level**: Medium - New message type, but isolated changes

---

### Solution 5: Frontend-Side Fragment Element Tracking

**Concept**: The frontend tracks which elements were created by which fragment, and proactively clears them at the start of a fragment rerun.

**Changes Required**:

1. **Frontend (App.tsx / AppRoot.ts)**:
   - Maintain a map: `fragmentId → Set<deltaPath>`
   - When NewSession arrives for fragment run, clear all elements in that map
   - Update map as elements are added

**Pros**:
- Frontend has full control
- No backend protocol changes
- Can be optimized for performance

**Cons**:
- Duplicates some backend knowledge on frontend
- Map needs to stay in sync
- Memory overhead for tracking

**Risk Level**: Medium - New frontend state management

---

### Solution 6: Controlled Opt-In API (Conservative)

**Concept**: Allow the feature with explicit opt-in, making users aware of the implications.

**Changes Required**:

1. **Backend**: Add parameter to allow outside writes
   ```python
   @st.fragment(allow_outside_writes=True)
   def my_fragment():
       B.button("Test")
   ```

2. **Backend**: Implement one of the above solutions, gated by this flag

3. **Documentation**: Clearly explain behavior and limitations

**Pros**:
- Backward compatible
- Users explicitly opt-in
- Can iterate on behavior over time

**Cons**:
- Adds API surface
- May confuse users about when to use it
- Still requires implementing a solution

**Risk Level**: Low (for opt-in) + Medium/High (for underlying solution)

---

## Recommendation

### Short-Term: Solution 1 (Element-Level Fragment Clearing)

This is the cleanest conceptual model and requires the fewest changes. The key insight is that elements already carry their `fragmentId` - we just need to use it for clearing decisions.

**Implementation Steps**:

1. Modify `ClearStaleNodeVisitor.visitElementNode()` to check element's `fragmentId`
2. Add comprehensive tests for:
   - Fragment writing to outside container
   - Multiple fragments writing to same container
   - Nested fragments
   - Mixed widget/non-widget elements
3. Remove restriction in `check_fragment_path_policy()` (or make it a warning)
4. Update documentation

### Long-Term Considerations

1. **Visual Stability**: Consider adding a mechanism to maintain element order in outside containers
2. **Performance**: Profile impact of element-level clearing on large apps
3. **Edge Cases**: Document behavior when:
   - Fragment is removed from app
   - Multiple fragments write to same container
   - Fragment writes to sidebar vs main

---

## Implementation Checklist

- [ ] Update `ClearStaleNodeVisitor.visitElementNode()` in frontend
- [ ] Add/update tests in `ClearStaleNodeVisitor.test.ts`
- [ ] Update `check_fragment_path_policy()` in backend
- [ ] Add E2E tests for outside container writes
- [ ] Update fragment documentation
- [ ] Consider adding opt-in flag for gradual rollout

---

## Appendix A: Key File Locations

| Component | File Path |
|-----------|-----------|
| Fragment decorator | `lib/streamlit/runtime/fragment.py:136-276` |
| Fragment path policy | `lib/streamlit/elements/lib/policies.py:129-161` |
| Cursor system | `lib/streamlit/cursor.py` |
| DeltaGenerator | `lib/streamlit/delta_generator.py` |
| Script run context | `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py` |
| Frontend stale clearing | `frontend/lib/src/render-tree/visitors/ClearStaleNodeVisitor.ts` |
| Frontend element node | `frontend/lib/src/render-tree/ElementNode.ts` |
| Frontend block node | `frontend/lib/src/render-tree/BlockNode.ts` |
| Frontend app root | `frontend/lib/src/render-tree/AppRoot.ts` |

## Appendix B: Related Issues/PRs

- PR #8756: "Don't allow writing widgets outside the fragment" (original restriction)
- Original spec document describing the restriction rationale

## Appendix C: Test Scenarios

1. **Basic Outside Write**
   ```python
   B = st.container()
   @st.fragment
   def frag():
       B.button("Click me")
   frag()
   ```

2. **Multiple Outside Containers**
   ```python
   A = st.container()
   B = st.container()
   @st.fragment
   def frag():
       A.write("In A")
       B.button("In B")
   frag()
   ```

3. **Nested Fragments**
   ```python
   outer = st.container()
   @st.fragment
   def outer_frag():
       inner = st.container()
       @st.fragment
       def inner_frag():
           outer.button("To outer")
       inner_frag()
   outer_frag()
   ```

4. **Fragment Removed on Full Rerun**
   ```python
   B = st.container()
   if st.checkbox("Show fragment"):
       @st.fragment
       def frag():
           B.button("Click")
       frag()
   ```
