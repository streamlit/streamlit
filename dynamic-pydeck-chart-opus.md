# Deep Dive: Preserving Selection State in `st.pydeck_chart` Using Key-Based Identity

## Executive Summary

This document analyzes how to allow `st.pydeck_chart` to preserve selection state when map data or view parameters change, using the user-provided `key` as the primary component identity. The analysis compares the current pydeck implementation with the established pattern used by vega charts, and proposes a minimal implementation approach.

**Key Finding:** The simplest fix is to change a single line in the backend from `key_as_main_identity=False` to `key_as_main_identity={"selection_mode"}`, matching the vega charts pattern. However, some frontend handling may be needed for edge cases where selections become "orphaned" after data changes.

---

## Current State Analysis

### How Element IDs Work in Streamlit

Element IDs are the core mechanism for maintaining widget state across reruns. The ID format is:
```
$$ID-{MD5_HASH}-{user_key}
```

**Source:** `lib/streamlit/elements/lib/utils.py:153-182`

The `compute_and_register_element_id()` function (lines 185-266) has a crucial parameter: `key_as_main_identity`. This controls what goes into the hash:

| `key_as_main_identity` value | Behavior when user provides a `key` |
|------------------------------|-------------------------------------|
| `False` | ALL kwargs included in hash (ID changes when any param changes) |
| `True` | NO kwargs included (only element type + key determine ID) |
| `{"param1", "param2"}` | ONLY specified kwargs included (other params ignored) |

### Current Pydeck Implementation

**File:** `lib/streamlit/elements/deck_gl_json_chart.py:556-565`

```python
pydeck_proto.id = compute_and_register_element_id(
    "deck_gl_json_chart",
    user_key=key,
    key_as_main_identity=False,  # <-- THE PROBLEM
    dg=self.dg,
    is_selection_activated=is_selection_activated,
    selection_mode=selection_mode,
    use_container_width=use_container_width,
    spec=spec,  # <-- Entire spec included in hash!
)
```

**Problem:** With `key_as_main_identity=False`, the entire `spec` (JSON representation of the PyDeck object) is included in the element ID hash. Any change to the map data, view state, or layer configuration causes the element ID to change, which loses all selection state.

### How Vega Charts Solve This

**File:** `lib/streamlit/elements/vega_charts.py:2404-2422`

```python
vega_lite_proto.id = compute_and_register_element_id(
    "arrow_vega_lite_chart",
    user_key=key,
    # There are some edge cases where selections can become orphaned when the data changes.
    # The frontend can handle this without errors, but it might be a nice enhancement
    # to automatically reset the backend & frontend selection state in this case.
    key_as_main_identity={"selection_mode"},  # <-- ONLY selection_mode affects ID
    dg=self.dg,
    vega_lite_spec=vega_lite_proto.spec,
    vega_lite_data=vega_lite_proto.data.data,
    named_datasets=[dataset.name for dataset in vega_lite_proto.datasets],
    theme=theme,
    use_container_width=use_container_width,
    selection_mode=parsed_selection_modes,
)
```

**Solution:** When a user provides a `key`, only `selection_mode` is included in the hash. This means:
- Changing chart data does NOT change the element ID
- Changing the spec does NOT change the element ID
- Selection state is preserved because the ID stays stable
- Only changing selection_mode would create a new element identity

### Other Widgets Using This Pattern

**DataFrame selection** (`lib/streamlit/elements/arrow.py`):
```python
key_as_main_identity={"selection_mode", "is_selection_activated"}
```

This confirms the pattern is well-established across multiple selection-enabled widgets.

---

## Why ID Changes Cause State Loss (Frontend Mechanism)

**Key insight from Codex analysis:**

The frontend uses `element.id` for two critical purposes:

1. **React component keying** - `RenderNodeVisitor` uses `getElementId` to derive React keys
2. **Widget state lookup** - `WidgetStateManager` stores/retrieves state by `element.id`

When the element ID changes:
1. React sees a different key → unmounts old component, mounts new one
2. New component calls `useBasicWidgetClientState` which initializes state on mount
3. Widget state lookup uses new ID → finds nothing → falls back to empty selection

**Result:** Selection always resets when the pydeck spec changes, even when a `key` is provided.

---

## Frontend State Management

### Vega Charts Frontend

**File:** `frontend/lib/src/components/elements/ArrowVegaLiteChart/useVegaLiteSelections.ts:58-153`

Vega charts use a two-tier state storage:

1. **Backend-synced state** (via `widgetMgr.setStringValue()`): Selection data sent to Python
2. **Frontend-only state** (via `widgetMgr.setElementState(chartId, "viewState", ...)`): Vega's internal view state for restoration

When the component remounts (same element ID):
```typescript
const viewState = widgetMgr.getElementState(chartId, "viewState")
if (notNullOrUndefined(viewState)) {
  try {
    return vegaView.setState(viewState)  // Restore selection
  } catch (e) {
    LOG.warn("Failed to restore view state", e)
  }
}
```

### Current Pydeck Frontend

**File:** `frontend/lib/src/components/elements/DeckGlJsonChart/useDeckGl.tsx:120-165`

Pydeck already has similar infrastructure:
- `getDefaultState()`: Retrieves initial state from `widgetMgr.getElementState(element.id, "selection")`
- `getStateFromWidgetMgr()`: Gets current state from backend-synced string value
- `updateWidgetMgrState()`: Sends state changes back

The frontend pattern is already similar to vega charts. The main issue is that the element ID keeps changing due to the backend computation.

---

## Proposed Solutions

### Option 1: Minimal Backend Change (Recommended First Step)

Change a single line in `deck_gl_json_chart.py`:

```python
# Before (line 559):
key_as_main_identity=False,

# After:
key_as_main_identity={"selection_mode"},
```

**Pros:**
- Single line change
- Follows established vega charts pattern
- Immediately enables state preservation for the common case

**Cons:**
- "Orphaned selections" problem: If user reduces data length, indices may point to non-existent objects
- No automatic reset when structural changes occur

### Option 2: Structural Fingerprint (PR #13543 Approach)

The PR introduces a `_extract_structural_fingerprint()` function that computes a stable identifier from:
- Layer IDs
- Data lengths per layer

This fingerprint is then used in the `key_as_main_identity` logic to detect structural changes.

**Pros:**
- Automatically resets selections when structure changes
- Safer user experience (no orphaned indices)

**Cons:**
- More complex implementation
- Requires backend logic to extract fingerprint from PyDeck spec
- May have edge cases with dynamic layer ordering

### Option 3: Frontend-Only State Preservation

Keep `key_as_main_identity=False` but implement frontend state caching keyed by user-provided key (if present).

**Pros:**
- No backend changes needed
- Frontend can manage its own identity

**Cons:**
- Non-standard pattern (differs from all other widgets)
- Doesn't integrate with session state properly
- State not preserved across page reloads

---

## Recommended Implementation Plan

### Phase 1: Minimal Backend Change

1. **Backend change** (`deck_gl_json_chart.py:559`):
   ```python
   key_as_main_identity={"selection_mode"},
   ```

2. **Test the behavior**:
   - Selection preserved when data updates
   - Selection preserved when view state changes
   - Selection cleared when selection_mode changes

### Phase 2: Frontend Selection Validation (Optional Enhancement)

Two low-effort tweaks could reduce confusing visuals with stale selections:

**Option A: Smarter dimming check** in `useDeckGl.tsx`:
- Modify `anyLayersHaveSelection` to only return true if there's at least one valid selected index for the current layer/data length
- This prevents dimming all objects when selection indices are out of range

**Option B: Layer-ID filtering**:
- If selection references a non-existent layer, drop those entries locally (without triggering rerun)
- Keep valid layer selections intact

Example implementation for Option A:

```typescript
// In useDeckGl.tsx or DeckGlJsonChart.tsx
useEffect(() => {
  if (!isSelectionModeActivated) return;

  // Get current layer IDs and data lengths from spec
  const layerInfo = extractLayerInfo(element.json);

  // Sanitize selection indices to remove orphans
  const sanitizedSelection = sanitizeSelection(data.selection, layerInfo);

  if (!isEqual(data.selection, sanitizedSelection)) {
    setSelection({ fromUi: false, value: { selection: sanitizedSelection } });
  }
}, [element.json]);
```

This approach:
- Filters out indices that exceed layer data length
- Removes selection entries for layers that no longer exist
- Updates both frontend and backend state

### Phase 3: Documentation Update

Update the `st.pydeck_chart` docstring to clarify behavior:

```python
key : str
    An optional string to use for giving this element a stable
    identity. If ``key`` is ``None`` (default), this element's identity
    will be determined based on the values of the other parameters.

    Additionally, if selections are activated and ``key`` is provided,
    Streamlit will register the key in Session State to store the
    selection state. The selection state is read-only.

    **Important:** When a key is provided, selection state is preserved
    across data updates. If you update the data and previously selected
    indices no longer exist, they will be automatically removed from
    the selection state.
```

---

## Edge Cases and Considerations

### 1. Orphaned Selection Indices

**Scenario:** User has index [5] selected. Data updates to have only 3 items.

**Vega charts behavior:** Frontend handles gracefully without errors (as noted in code comment at vega_charts.py:2407-2409)

**Pydeck behavior needed:** Should sanitize indices to remove values >= data length

### 2. Layer ID Changes

**Scenario:** User renames a layer or layers are reordered.

**Behavior:** Selection state keyed by old layer ID will be orphaned. New layer has no selection.

**Mitigation:** Document that layer IDs should remain stable when using key-based selection preservation.

### 3. Data Content Changes (Same Length)

**Scenario:** Data has 10 items, user selects index 5. Data updates with 10 different items.

**Behavior:** Selection index 5 is still valid, but `selection.objects` contains the old object data while the visual highlights the new object at index 5.

**Mitigation:** This is a known tradeoff; the index-based selection is correct for the new data, but stored object metadata may be stale. Users should use indices for logic, not objects.

### 4. Selection Mode Changes

**Scenario:** User changes from `"single-object"` to `"multi-object"`.

**Behavior:** Element ID will change (selection_mode is in the whitelist), causing selection reset. This is correct behavior.

### 5. Form Context

**Scenario:** Pydeck chart inside an `st.form()`.

**Current behavior:** Form ID is included in element ID when `key_as_main_identity=False`.

**With fix:** Form ID would be ignored when key is provided. This matches vega chart behavior and is likely correct (same form, same key = same identity).

---

## Code References

| Component | File | Lines |
|-----------|------|-------|
| Element ID computation | `lib/streamlit/elements/lib/utils.py` | 153-266 |
| Pydeck backend | `lib/streamlit/elements/deck_gl_json_chart.py` | 540-588 |
| Vega backend | `lib/streamlit/elements/vega_charts.py` | 2404-2442 |
| DataFrame backend | `lib/streamlit/elements/arrow.py` | (uses same pattern) |
| Pydeck frontend | `frontend/lib/src/components/elements/DeckGlJsonChart/useDeckGl.tsx` | 120-210 |
| Vega frontend | `frontend/lib/src/components/elements/ArrowVegaLiteChart/useVegaLiteSelections.ts` | 58-153 |
| Widget state manager | `frontend/lib/src/WidgetStateManager.ts` | 903-928 |

---

## Comparison: PR #13543 vs. Minimal Approach

| Aspect | PR #13543 (Fingerprint) | Minimal Approach |
|--------|------------------------|------------------|
| Backend complexity | New function + fingerprint logic | Single line change |
| Frontend changes | Selection sanitization hook | Optional sanitization |
| Automatic reset | Yes (when structure changes) | No (manual or frontend sanitization) |
| Pattern consistency | Custom pattern | Matches vega charts exactly |
| Risk of orphaned selections | Low | Medium (mitigated by frontend) |
| Testing complexity | Higher | Lower |

---

## Recommendation

**Start with the minimal approach** (Option 1) since it:
1. Follows the established vega charts pattern exactly
2. Requires only a single backend line change
3. Can be enhanced later with frontend sanitization if needed
4. Acknowledges that orphaned selections are already a known edge case (per vega charts comment)

The structural fingerprint approach from PR #13543 is a valid enhancement but introduces additional complexity. It could be considered as a future improvement after the minimal fix ships and user feedback is gathered.

---

## Test Plan for Minimal Approach

### Backend Unit Test (Critical)

**ID stability test:**
- Create two pydeck specs with the same `key` but different JSON content
- Call `compute_and_register_element_id()` for each with `key_as_main_identity={"selection_mode"}`
- Assert the generated IDs are identical when key is provided and selection_mode is unchanged
- Assert IDs differ when no key is provided (backward compatibility)

### Integration Tests

1. **Basic preservation test:**
   - Create pydeck chart with `key="my_map"` and `on_select="rerun"`
   - Select an object
   - Update data (same structure)
   - Verify selection preserved

2. **View state change test:**
   - Create pydeck chart with key
   - Select object
   - Change view state (zoom, pitch)
   - Verify selection preserved

3. **Selection mode change test:**
   - Create pydeck chart with key and `selection_mode="single-object"`
   - Select object
   - Change to `selection_mode="multi-object"`
   - Verify selection is reset (expected)

4. **No key test (backward compatibility):**
   - Create pydeck chart WITHOUT key
   - Select object
   - Update data
   - Verify selection is reset (expected, preserves backwards compatibility)

5. **Orphaned index test:**
   - Create pydeck with key, 10 items, select index 8
   - Update data to 5 items
   - Verify no errors, behavior is defined (either reset or sanitize)

### Frontend Test (Optional)

- Ensure selection state persists when `element.json` changes but `element.id` stays the same
- Test that stale selections don't cause visual glitches (if frontend polish is implemented)
