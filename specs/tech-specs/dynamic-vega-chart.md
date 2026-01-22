# Dynamic Vega-Lite/Altair Chart State Persistence Investigation

## Executive Summary

**Goal**: Allow `st.altair_chart` and `st.vega_lite_chart` to preserve selection state (and internal chart state like zoom/pan) when the chart data or other parameters change, by using the user-provided `key` as the main identity for the component.

**Finding**: This is **feasible with a backend-only change**. After deep analysis of both backend and frontend code:

- ✅ **Backend change only**: Modify `key_as_main_identity` in `vega_charts.py`
- ✅ **No frontend changes needed**: Existing architecture handles this correctly
- ✅ **Edge cases handled**: Orphaned selection indices are gracefully handled by Vega
- ✅ **Safe rollout**: Only affects apps using `key` parameter

### Critical Difference from Plotly

Unlike Plotly (which requires both backend AND frontend changes), Vega-Lite's frontend architecture already supports preserving state across spec changes. The key difference:

| Aspect | Vega-Lite | Plotly |
|--------|-----------|--------|
| **View Creation** | Creates new view on each spec change via `useLayoutEffect` | Uses `useState` initializer (only runs on mount) |
| **State Restoration** | `vegaView.setState(viewState)` called after view creation | No mechanism to apply new spec after mount |
| **State Storage** | `widgetMgr.elementStates` (persists across view recreation) | `plotlyFigure` useState (doesn't update on spec change) |
| **Complexity** | Backend-only change | Backend + Frontend changes required |

---

## Current Architecture

### Backend (`lib/streamlit/elements/vega_charts.py`)

When selections are activated, the element ID is computed using:

```python
vega_lite_proto.id = compute_and_register_element_id(
    "arrow_vega_lite_chart",
    user_key=key,
    key_as_main_identity=False,  # <-- CRITICAL: Currently False
    dg=self.dg,
    vega_lite_spec=vega_lite_proto.spec,  # <-- Full JSON spec in ID computation
    vega_lite_data=vega_lite_proto.data.data,
    named_datasets=[dataset.name for dataset in vega_lite_proto.datasets],
    theme=theme,
    use_container_width=use_container_width,
    selection_mode=parsed_selection_modes,
)
```

**Current Behavior**: Because `key_as_main_identity=False`, the full Vega-Lite spec, data, and parameters are included in the element ID computation. This means:

- When the Altair/Vega-Lite chart changes (data updates, layout changes, mark modifications)
- The JSON spec or data changes → A new element ID is generated
- Widget state is stored/retrieved by element ID
- The frontend receives a new ID and cannot find previous state
- **All state is reset**: selections, zoom, pan, etc.

### Frontend Architecture Overview

The Vega-Lite frontend consists of several key components:

```
ArrowVegaLiteChart.tsx
    │
    ├── useVegaElementPreprocessor.ts  (spec preprocessing, theming)
    │
    ├── useVegaEmbed.ts                (view lifecycle: create, update, finalize)
    │       │
    │       └── useVegaLiteSelections.ts  (selection event handling & state restoration)
    │
    └── arrowUtils.ts                  (data transformation utilities)
```

---

## Deep Frontend Analysis

### Component: `ArrowVegaLiteChart.tsx`

The main component orchestrates spec preprocessing and view lifecycle:

```typescript
const ArrowVegaLiteChart: FC<Props> = ({ element: inputElement, ... }) => {
  // 1. Preprocess the element (theming, sizing, selection prep)
  const element = useVegaElementPreprocessor(
    inputElement,
    chartContainerWidth,
    chartContainerHeight,
    useStretchWidth,
    useStretchHeight
  )

  // 2. Get view lifecycle functions
  const { createView, updateView, finalizeView } = useVegaEmbed(
    element,
    widgetMgr,
    fragmentId
  )

  const { data, datasets, spec } = element

  // 3. Create view when spec changes (or on mount)
  useLayoutEffect(() => {
    if (containerRef.current !== null) {
      createView(containerRef, spec)  // <-- Recreates view with new spec
    }
    return finalizeView  // <-- Cleanup: destroys old view
  }, [createView, finalizeView, spec, fullScreenWidth, fullScreenHeight, showData, containerRef])

  // 4. Update data without recreating view
  useEffect(() => {
    void updateView(data, datasets)  // <-- Only updates data in existing view
  }, [data, datasets])
}
```

**Key Insight**: The `spec` change triggers view recreation via `useLayoutEffect`, while `data`/`datasets` changes only update the existing view via `useEffect`.

### Hook: `useVegaEmbed.ts`

This hook manages the Vega view lifecycle:

```typescript
export function useVegaEmbed(
  inputElement: VegaLiteChartElement,
  widgetMgr: WidgetStateManager,
  fragmentId?: string
): UseVegaEmbedOutput {
  const vegaViewRef = useRef<VegaView | null>(null)
  const vegaFinalizerRef = useRef<(() => void) | null>(null)

  // Setup selection handling
  const { maybeConfigureSelections, onFormCleared } = useVegaLiteSelections(
    inputElement,
    widgetMgr,
    fragmentId
  )

  const createView = useCallback(async (containerRef, spec) => {
    // 1. Finalize (destroy) previous view
    finalizeView()

    // 2. Create new view with vega-embed
    const { view, finalize } = await embed(containerRef.current, spec, options)

    // 3. Configure selections AND RESTORE PREVIOUS STATE
    vegaViewRef.current = maybeConfigureSelections(view)  // <-- STATE RESTORATION HERE

    vegaFinalizerRef.current = finalize

    // 4. Insert initial data
    // ...

    await vegaViewRef.current.runAsync()
    return vegaViewRef.current
  }, [finalizeView, maybeConfigureSelections])

  const updateView = useCallback(async (inputData, inputDatasets) => {
    // Only updates data in existing view, doesn't recreate
    // ...
  }, [updateData, isCreatingView])

  return { createView, updateView, finalizeView }
}
```

### Hook: `useVegaLiteSelections.ts`

This is the **critical hook** for state persistence:

```typescript
export const useVegaLiteSelections = (
  element: VegaLiteChartElement,
  widgetMgr: WidgetStateManager,
  fragmentId?: string
): UseVegaLiteSelectionsOutput => {
  const { id: chartId, formId, selectionMode } = element

  const maybeConfigureSelections = useCallback((vegaView: VegaView): VegaView => {
    // 1. Add signal listeners for selection events
    selectionMode.forEach(param => {
      vegaView.addSignalListener(param, debounce(DEBOUNCE_TIME_MS, (name, value) => {
        // Extract view state for restoration later
        const viewState = vegaView.getState({
          data: (nameArg) => selectionMode.some(mode => `${mode}_store` === nameArg),
          recurse: false,
        })

        // Store viewState in elementStates (frontend-only storage)
        if (notNullOrUndefined(viewState)) {
          widgetMgr.setElementState(chartId, "viewState", viewState)  // <-- STORES STATE
        }

        // Also store selection in widgetStates (synced with backend)
        widgetMgr.setStringValue(widgetInfo, JSON.stringify(updatedSelections), ...)
      }))
    })

    // 2. CRITICAL: Try to restore previous state
    const viewState = widgetMgr.getElementState(chartId, "viewState")  // <-- RETRIEVES STATE
    if (notNullOrUndefined(viewState)) {
      try {
        return vegaView.setState(viewState)  // <-- RESTORES STATE
      } catch (e) {
        LOG.warn("Failed to restore view state", e)
      }
    }

    return vegaView
  }, [chartId, selectionMode, widgetMgr, formId, fragmentId])

  return { maybeConfigureSelections, onFormCleared }
}
```

---

## State Flow Analysis

### Current Flow (When Spec Changes)

```
Run 1:                                    Run 2 (spec changed):
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ element.id = "$$st-hash-abc-key"    │   │ element.id = "$$st-hash-def-key"    │
│ (includes spec hash)                 │   │ (NEW hash due to spec change)       │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
            │                                         │
            ▼                                         ▼
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ React key = "$$st-hash-abc-key"     │   │ React key = "$$st-hash-def-key"     │
│                                     │   │                                     │
│ Component mounts                    │   │ React: key changed!                 │
│ createView() runs                   │   │ → Unmount old component             │
│ User makes selection                │   │ → Mount NEW component               │
│                                     │   │                                     │
│ viewState stored under:             │   │ createView() runs                   │
│ chartId = "$$st-hash-abc-key"       │   │ maybeConfigureSelections:           │
│                                     │   │   getElementState("..def-key")      │
│ widgetStates["..abc-key"]           │   │   → NOT FOUND (different ID!)       │
│ elementStates["..abc-key"]          │   │                                     │
└─────────────────────────────────────┘   │ ❌ Selection LOST                    │
                                          │ ❌ Zoom/Pan LOST                     │
                                          └─────────────────────────────────────┘
```

### Proposed Flow (With `key_as_main_identity`)

```
Run 1:                                    Run 2 (spec changed, key same):
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ element.id = "$$st-hash-xyz-key"    │   │ element.id = "$$st-hash-xyz-key"    │
│ (only key in hash, not spec)        │   │ (SAME - only key in hash)           │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
            │                                         │
            ▼                                         ▼
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ React key = "$$st-hash-xyz-key"     │   │ React key = "$$st-hash-xyz-key"     │
│                                     │   │                                     │
│ Component mounts                    │   │ React: key unchanged!               │
│ createView() runs                   │   │ → Reuse same component              │
│ User makes selection                │   │ → Props updated (new spec)          │
│ User zooms in                       │   │                                     │
│                                     │   │ element.spec changed                │
│ viewState stored under:             │   │ → useLayoutEffect triggered         │
│ chartId = "$$st-hash-xyz-key"       │   │ → createView() runs with NEW spec   │
│                                     │   │                                     │
│ widgetStates["..xyz-key"]           │   │ maybeConfigureSelections:           │
│ elementStates["..xyz-key"]          │   │   getElementState("..xyz-key")      │
└─────────────────────────────────────┘   │   → FOUND! Previous viewState       │
                                          │   vegaView.setState(viewState)      │
                                          │                                     │
                                          │ ✅ Selection RESTORED                │
                                          │ ✅ Zoom/Pan RESTORED                 │
                                          └─────────────────────────────────────┘
```

---

## Why No Frontend Changes Are Needed

### Key Architectural Difference: Vega-Lite vs Plotly

**Plotly's Problem**:

```typescript
// Plotly uses useState for figure state - only initializes on mount
const [plotlyFigure, setPlotlyFigure] = useState<PlotlyFigureType>(() => {
  const initialFigureState = widgetMgr.getElementState(element.id, "figure")
  return initialFigureState || applyTheming(initialFigureSpec, ...)
})
// When spec changes but component stays mounted:
// - useState initializer DOESN'T re-run
// - plotlyFigure still contains OLD data
// - Chart shows STALE data!
```

**Vega-Lite's Solution**:

```typescript
// Vega-Lite recreates the view on each spec change
useLayoutEffect(() => {
  createView(containerRef, spec)  // Creates NEW view with NEW spec
  return finalizeView
}, [spec, ...])  // <-- Triggered by spec change

// Inside createView:
const { view } = await embed(container, spec)  // NEW view with NEW data
vegaViewRef.current = maybeConfigureSelections(view)  // RESTORE state to new view

// Inside maybeConfigureSelections:
const viewState = widgetMgr.getElementState(chartId, "viewState")  // <-- Same chartId
return vegaView.setState(viewState)  // <-- RESTORE previous selections/zoom
```

### The Magic: Separation of Spec and State

Vega-Lite's architecture cleanly separates:

1. **Spec + Data** → Determines what the chart shows (marks, encodings, data points)
2. **View State** → Determines user interaction state (selections, zoom, pan)

When the spec changes:

- A **new Vega view** is created with the new spec
- The **previous view state** (selections) is applied via `vegaView.setState()`
- This is exactly the pattern PyDeck uses!

### View State Structure

The view state saved and restored contains only selection-related data:

```typescript
const viewState = vegaView.getState({
  data: (nameArg) => {
    // Only save selection stores (e.g., "point_selection_store", "interval_selection_store")
    return selectionMode.some(mode => `${mode}_store` === nameArg)
  },
  recurse: false,  // Don't include subcontext data
})
```

This means:

- Chart data is NOT stored in viewState
- Only selection indices/ranges are stored
- New spec provides new data, restored state provides selections

---

## Edge Cases and Handling

### Edge Case 1: Orphaned Selection Indices

**Scenario**: User selects points [2, 5, 7], then data updates to only have 4 points.

**Behavior**: Vega-Lite handles this gracefully:

- Points at indices 2 and 3 may remain highlighted (if they exist)
- Points at indices 5 and 7 simply don't exist - no visual highlighting
- Selection state is still returned to Python with all original indices
- No crashes or errors

This matches PyDeck's behavior and is acceptable for the use case.

### Edge Case 2: Selection Parameter Names Change

**Scenario**: Chart changes from `selection_point("sel1")` to `selection_point("sel2")`.

**Behavior**:

- `viewState` stores data under `sel1_store`
- New chart expects `sel2_store`
- `vegaView.setState()` won't find matching store
- Selection effectively resets (correct behavior for structural change)

### Edge Case 3: Zoom/Pan State

**What's Preserved**:

- View state includes signal values for pan/zoom when using Vega's built-in interactions
- Restored via `vegaView.setState()`

**Limitation**:

- Axis range changes specified in the spec itself override restored zoom
- User zoom is preserved, but explicit spec-defined ranges take precedence

### Edge Case 4: Full Screen Mode

The fullscreen toggle already benefits from this architecture:

- When entering/exiting fullscreen, the component doesn't remount
- `createView` is called due to dimension changes
- Selection state is restored via the same mechanism

---

## Comparison: Vega-Lite vs PyDeck vs Plotly

| Aspect | PyDeck | Vega-Lite | Plotly |
|--------|--------|-----------|--------|
| **Backend Change** | ✅ Required | ✅ Required | ✅ Required |
| **Frontend Change** | ❌ Not needed | ❌ Not needed | ⚠️ Required |
| **State Storage** | `useBasicWidgetClientState` | `widgetMgr.elementStates` | `useState` (problematic) |
| **View Rebuild** | `deck` useMemo combines new spec + state | `createView` + `setState()` | No rebuild mechanism |
| **Complexity** | Low | Low | Medium |

### Why PyDeck and Vega-Lite Work Similarly

Both follow the "rebuild visualization with preserved state" pattern:

**PyDeck**:

```typescript
const deck = useMemo<DeckObject>(() => {
  const jsonCopy = { ...parsedPydeckJson }  // NEW spec
  // Apply preserved selection state to new layers
  const selectedIndices = data?.selection?.indices?.[layerId] || []  // PRESERVED state
  // ...
}, [data.selection.indices, parsedPydeckJson])
```

**Vega-Lite**:

```typescript
// In createView:
const { view } = await embed(container, spec)  // NEW spec
vegaView.setState(viewState)  // PRESERVED state
```

**Plotly** (problematic):

```typescript
// No equivalent mechanism - useState only initializes on mount
const [plotlyFigure] = useState(() => initialSpec)  // Never updates!
```

---

## Implementation Recommendation

### Backend Change (Required)

```python
# In vega_charts.py, modify the compute_and_register_element_id call (~line 2404):

# BEFORE:
vega_lite_proto.id = compute_and_register_element_id(
    "arrow_vega_lite_chart",
    user_key=key,
    key_as_main_identity=False,  # <-- Currently False
    dg=self.dg,
    vega_lite_spec=vega_lite_proto.spec,
    vega_lite_data=vega_lite_proto.data.data,
    named_datasets=[dataset.name for dataset in vega_lite_proto.datasets],
    theme=theme,
    use_container_width=use_container_width,
    selection_mode=parsed_selection_modes,
)

# AFTER:
vega_lite_proto.id = compute_and_register_element_id(
    "arrow_vega_lite_chart",
    user_key=key,
    key_as_main_identity={"selection_mode"} if key else False,  # <-- CHANGE
    dg=self.dg,
    vega_lite_spec=vega_lite_proto.spec,
    vega_lite_data=vega_lite_proto.data.data,
    named_datasets=[dataset.name for dataset in vega_lite_proto.datasets],
    theme=theme,
    use_container_width=use_container_width,
    selection_mode=parsed_selection_modes,
)
```

### Backend Option Variants

**Option A - Selection Mode Whitelist (Recommended)**:

```python
key_as_main_identity={"selection_mode"} if key else False,
```

- Resets state when selection mode changes (reasonable user expectation)
- Preserves state across data/spec/theme changes

**Option B - Full Key Identity**:

```python
key_as_main_identity=True if key else False,
```

- Maximum state preservation, even across selection mode changes
- Simpler but may surprise users when selection_mode changes

### Frontend Changes (NOT Required)

The existing frontend architecture already supports this pattern:

1. ✅ `useVegaEmbed` recreates view on spec change
2. ✅ `useVegaLiteSelections.maybeConfigureSelections` restores state
3. ✅ State is stored by `chartId` (element.id) which stays stable
4. ✅ `vegaView.setState()` properly restores Vega selection state

---

## What State Gets Preserved

With `key_as_main_identity={"selection_mode"}`:

| State Type | Preserved? | Notes |
|------------|------------|-------|
| Point Selections | ✅ Yes | Via `viewState` restoration |
| Interval Selections | ✅ Yes | Via `viewState` restoration |
| Zoom Level | ✅ Yes | Stored in Vega signals, restored via `setState` |
| Pan Position | ✅ Yes | Stored in Vega signals, restored via `setState` |
| Selection Widget State | ✅ Yes | Via `widgetMgr.widgetStates` (synced with Python) |
| Selection View State | ✅ Yes | Via `widgetMgr.elementStates` (frontend-only) |
| Legend Toggle | ⚠️ Partial | May reset if legend structure changes |
| Selection Mode | ❌ Resets | By design - included in whitelist |

---

## Risks & Mitigations

### Risk: Breaking Existing Apps

**Scenario**: Apps that rely on state being reset when data changes.

**Mitigation**:

- Only change behavior when `key` is provided
- Without `key`, behavior remains unchanged (full spec in ID)
- Document the change clearly in release notes

### Risk: Stale Selections

**Scenario**: User updates data, old selections reference non-existent points.

**Mitigation**:

- Vega-Lite handles this gracefully (no crashes)
- Python receives full selection state including stale indices
- Users can programmatically clear selections if needed
- Document that selections may become visually stale with data changes

### Risk: Memory Accumulation

**Scenario**: Old element states accumulate in WidgetStateManager.

**Mitigation**:

- `WidgetStateManager.removeInactive()` already cleans up inactive IDs
- Called at end of each script run with active widget IDs
- No additional memory leak risk

### Risk: Unexpected State Persistence

**Scenario**: User changes data, zoom persists unexpectedly.

**Mitigation**:

- This is the **desired behavior** for the feature
- Document that `key` enables state persistence
- Users who want state reset can omit `key` or use a dynamic key

---

## Implementation Checklist

### Backend Changes

- [ ] Modify `key_as_main_identity` in `vega_charts.py` (_vega_lite_chart method, ~line 2404)
- [ ] Update docstring for `key` parameter to explain state persistence
- [ ] Add unit test for element ID stability with key

### Frontend Changes (NOT Required)

- ✅ No changes needed - existing architecture handles this

### Testing Checklist

- [ ] **E2E: Selection persists with key** - Update data (same structure), verify selection preserved
- [ ] **E2E: Zoom/Pan persists with key** - Zoom into chart, update data, verify zoom preserved
- [ ] **E2E: New data renders with key** - Update data, verify NEW data displays (not stale)
- [ ] **E2E: State resets without key** - Update data without key, verify state cleared
- [ ] **E2E: State resets on selection_mode change** - Change selection mode, verify reset
- [ ] **E2E: Orphaned selections handled** - Select points, reduce data size, verify no errors
- [ ] **Unit (Backend): Element ID stability** - Same key + different spec = same ID
- [ ] **Unit (Backend): Element ID changes without key** - Different spec = different ID

### Documentation Updates

- [ ] Add note about state persistence behavior when `key` is provided
- [ ] Document that omitting `key` preserves current reset-on-change behavior
- [ ] Add example showing dynamic chart updates with preserved selections

---

## Code Changes Summary

### Backend Change

```python
# lib/streamlit/elements/vega_charts.py, around line 2404

# BEFORE:
vega_lite_proto.id = compute_and_register_element_id(
    "arrow_vega_lite_chart",
    user_key=key,
    key_as_main_identity=False,
    # ... rest of kwargs
)

# AFTER:
vega_lite_proto.id = compute_and_register_element_id(
    "arrow_vega_lite_chart",
    user_key=key,
    key_as_main_identity={"selection_mode"} if key else False,
    # ... rest of kwargs
)
```

### Frontend Change (NOT Required)

No changes needed. The existing architecture:

1. `useVegaEmbed.createView()` - Creates new Vega view when spec changes
2. `useVegaLiteSelections.maybeConfigureSelections()` - Restores state from `widgetMgr.getElementState(chartId, "viewState")`
3. State storage keyed by `chartId` (element.id) - Persists when ID is stable

This is the same pattern used by PyDeck, which also required only a backend change.

---

## Conclusion

Enabling `key_as_main_identity` for `st.altair_chart` and `st.vega_lite_chart` is **technically feasible with a backend-only change**. The existing frontend architecture already supports the required pattern of rebuilding the visualization while restoring preserved state.

### Key Findings

1. **Backend Change Required**: Set `key_as_main_identity={"selection_mode"} if key else False`
2. **Frontend Change NOT Required**: Vega-Lite's `createView` + `setState` pattern already handles this
3. **Similar to PyDeck**: Both use "rebuild with preserved state" pattern
4. **Different from Plotly**: Plotly requires frontend changes due to `useState` architecture

### Why This Will Work

1. **React Key Stability**: Stable element ID → Stable React key → Component stays mounted
2. **View Recreation**: `useLayoutEffect` triggers `createView` when spec changes
3. **State Restoration**: `maybeConfigureSelections` calls `vegaView.setState(viewState)`
4. **State Storage**: `widgetMgr.elementStates[chartId]` persists across view recreations
5. **Vega.js Resilience**: Handles orphaned selections gracefully

### Recommended Implementation

**Backend**: Use `key_as_main_identity={"selection_mode"}` to stabilize element IDs while allowing state reset when selection parameters change.

This approach:

- Preserves state across data/spec/theme changes
- Resets state when selection mode changes (user expectation)
- Maintains backward compatibility (only affects keyed charts)
- Leverages existing frontend architecture (no additional complexity)
