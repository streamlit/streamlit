# Outside Container Button Crash Diagnosis

## Executive Summary

The crash occurs when a fragment writes multiple elements to an outside container. **The root cause is a backend bug**: the `RunningCursor` for the outside container is not being reset during fragment reruns. This causes the cursor index to accumulate (0→2→4→...) instead of resetting, resulting in deltas with invalid paths being sent to the frontend.

The underlying design issue is that the current snapshot/restore mechanism cannot handle outside containers because we don't know which containers a fragment will write to until it executes. A more robust solution requires the cursor itself to track fragment-specific state, or wrapping fragment writes in an implicit container.

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

## Root Cause Analysis

### How Cursors Work

A `RunningCursor` tracks the next index to write at within a container. Each write advances the index:

```python
container = st.container()  # cursor.index = 0
container.write("A")        # writes at index 0, cursor.index → 1
container.write("B")        # writes at index 1, cursor.index → 2
```

### What Gets Snapshotted for Fragments

When a fragment is defined (`fragment.py:368-369`):
```python
cursors_snapshot = deepcopy(ctx.cursors)           # Root container cursors only
dg_stack_snapshot = deepcopy(context_dg_stack.get())  # Active DG stack
```

**`ctx.cursors`** only contains cursors for root containers (MAIN, SIDEBAR).

**`dg_stack`** only contains DeltaGenerators you're currently inside via `with` blocks.

### Why Outside Containers Aren't Reset

An `st.container()` created outside the fragment has its own `_cursor` attribute, but:
- It's **NOT** in `ctx.cursors` (only root containers are there)
- It's **NOT** in `dg_stack` (not inside a `with` block at definition time)

So when the fragment reruns and restores snapshots, `counter_container._cursor` is untouched - it still has the accumulated index from previous runs.

### Why We Can't Simply Snapshot Outside Containers

The snapshot is taken at fragment **definition** time, but we don't know which containers the fragment will write to until it **executes**. The fragment body hasn't run yet when the snapshot is taken.

### The Interleaving Problem

A more complex scenario arises when multiple sources write to the same container:

```python
outside_container = st.container()
outside_container.write("Header")      # Main script, index 0

@st.fragment
def fragment_a():
    outside_container.write("From A")  # index 1

@st.fragment
def fragment_b():
    if condition:
        outside_container.write("From B")  # index 2 (conditional)

fragment_a()
fragment_b()
outside_container.write("Footer")      # Main script, index 3
```

If Fragment A reruns and writes **two** elements instead of one, it would overwrite Fragment B's slot. If Fragment B writes nothing, should Footer shift up? Positional indices become unstable with interleaved writes from multiple sources that can change element count.

## Proposed Fix Options

### Option 1: Implicit Container Wrapper (Recommended)

Wrap each fragment's writes to an outside container in an implicit `st.container()`, similar to how fragments wrap their own internal content.

**Current behavior (direct children):**
```
outside_container
  ├── button (from fragment)
  └── text (from fragment)
```

**Proposed behavior (wrapped):**
```
outside_container
  └── [implicit fragment wrapper]
        ├── button (from fragment)
        └── text (from fragment)
```

**Advantages:**
1. **Consistent with fragment internals**: Fragments already wrap their own content in `st.container()` (`fragment.py:420-423`)
2. **Multiple fragments work cleanly**: Each fragment gets its own wrapper, no interleaving issues
3. **Cursor management is simple**: The wrapper has its own cursor that starts fresh each time
4. **Order is stable**: Wrapper created on first write, reused on reruns

**Example with multiple fragments:**
```
outside_container
  ├── "Header" (direct from main)
  ├── [fragment_a wrapper]
  │     └── content from A
  ├── [fragment_b wrapper]
  │     └── content from B
  └── "Footer" (direct from main)
```

**Potential concerns:**

1. **Extra DOM element**: Adds a wrapper div. Could use `display: contents` CSS to make it layout-transparent, though this has edge cases (pseudo-elements don't render, can't apply transforms/positioning to the wrapper itself).

2. **Styling differences**: The wrapper becomes a single flex/grid item if the parent uses flexbox/grid. Users can nest their own layout containers inside if needed.

3. **Mental model**: User writes `outside_container.button()`, might expect direct child. However, this is consistent with how fragment content is already wrapped.

**Since outside container writes is a new feature, we're defining the behavior, not breaking existing apps.**

### Option 2: Cursor Tracks Fragment Start Indices

Have the cursor itself track where each fragment started writing, and reset to that position on fragment rerun.

```python
class RunningCursor:
    def __init__(self):
        self._index = 0
        self._fragment_start_indices = {}  # {fragment_id: start_index}
    
    def get_index_for_fragment(self, fragment_id: str | None) -> int:
        if fragment_id is None:
            return self._index  # Main run
        
        if fragment_id not in self._fragment_start_indices:
            # First time this fragment writes here
            self._fragment_start_indices[fragment_id] = self._index
        else:
            # Fragment rerun - reset to start position
            self._index = self._fragment_start_indices[fragment_id]
        
        return self._index
```

**Advantages:**
- No extra DOM elements
- Cursor is source of truth

**Disadvantages:**
- Doesn't solve the interleaving problem (Fragment A expanding would still overwrite Fragment B's slots)
- More complex state management
- Need to handle cleanup when fragments are removed/redefined

### Option 3: Disallow Interleaving

Error if a fragment writes to the same outside container as another fragment or the main script writes between fragment writes.

**Advantages:**
- Simple to implement
- Forces clean patterns

**Disadvantages:**
- Restrictive for users
- May not match user expectations

### Option 4: Slot-Based Placement

Instead of positional indices, use named slots or keys to identify element positions.

**Advantages:**
- Positions are stable regardless of element count changes
- Very flexible

**Disadvantages:**
- Major architectural change
- Changes the delta protocol

## Recommended Fix: Option 1 (Implicit Container Wrapper)

The implicit container wrapper is recommended because:

1. **Solves interleaving cleanly**: Each fragment's writes are grouped, no overlap
2. **Consistent pattern**: Matches how fragments already wrap their internal content  
3. **Simple implementation**: Create a container on first outside write, reuse on reruns
4. **No breaking changes**: This is a new feature, so we define the behavior
5. **Users can manage layout**: If users need specific layout, they can nest containers inside the fragment's writes

**Implementation approach:**

1. When a fragment first writes to an outside container, create an implicit wrapper container inside it
2. Store a mapping of `{(fragment_id, outside_container_id): wrapper_container}`
3. On fragment rerun, look up and reuse the existing wrapper
4. All fragment writes to that outside container go through the wrapper
5. The wrapper has its own cursor that's managed normally (fresh on creation, advances on writes)

**Files to modify:**
- `lib/streamlit/runtime/fragment.py` - Track wrapper containers per fragment
- `lib/streamlit/delta_generator.py` - Redirect outside container writes through wrapper

## Historical Context

### Why This Bug Exists

The outside container writes feature was enabled in commit `295149c196`. The frontend stale clearing logic was updated to handle fragment elements in outside containers, but the backend cursor management was not updated.

The existing snapshot/restore mechanism only handles:
- `ctx.cursors` - Root container cursors (main, sidebar)
- `dg_stack` - The stack of active DeltaGenerators (for `with` blocks)

It does not handle cursors for arbitrary containers created outside the fragment.

### Why The Bug Wasn't Caught Earlier

1. **Single-element writes appeared to work**: With one element, cursor goes 0→1→2. Index 1 and 2 are valid for insertion (append), so it takes multiple reruns to hit an invalid index.

2. **Counter test was removed**: A test with the failing pattern existed but was removed due to "CI timeouts" - this was actually the bug manifesting.

## Test Cases to Add

1. Button + text to outside container, multiple clicks
2. Multiple fragments writing to same outside container
3. Fragment writes interleaved with main script writes
4. Fragment that conditionally writes different numbers of elements
5. Nested outside containers with fragments
6. `with outside_container:` syntax from within a fragment
