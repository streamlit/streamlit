# Dynamic Plotly Chart State Persistence Investigation

## Executive Summary

**Goal**: Allow `st.plotly_chart` to preserve selection state and internal chart state (zoom, pan, figure configuration) when the chart data or other parameters change, by using the user-provided `key` as the main identity for the component.

**Finding**: This is **feasible but requires BOTH backend AND frontend changes**. Unlike PyDeck (which only needed a backend change), Plotly's frontend architecture requires modifications to handle spec updates while preserving state.

- ⚠️ **Backend change required**: Modify `key_as_main_identity` in `plotly_chart.py`
- ⚠️ **Frontend changes required**: Add spec change detection and state merging logic
- ✅ **Edge cases handled**: Orphaned point indices are gracefully handled by Plotly
- ✅ **Safe rollout**: Only affects apps using `key` parameter

### Critical Difference from PyDeck

PyDeck's frontend uses a pattern where the deck object is **rebuilt from the new spec** while **applying the preserved selection state**. Plotly's frontend does NOT have this pattern - it only uses the spec during initialization. **Without frontend changes, enabling `key_as_main_identity` would cause charts to show stale data.**

---

## Current Architecture

### Backend (`lib/streamlit/elements/plotly_chart.py`)

When selections are activated (or even for non-widget usage), the element ID is computed using:

```python
plotly_chart_proto.id = compute_and_register_element_id(
    "plotly_chart",
    user_key=key,
    key_as_main_identity=False,  # <-- CRITICAL: Currently False
    dg=self.dg,
    plotly_spec=plotly_chart_proto.spec,  # <-- Full JSON spec in ID computation
    plotly_config=plotly_chart_proto.config,
    selection_mode=selection_mode,
    is_selection_activated=is_selection_activated,
    theme=theme,
    width=width,
    height=height,
)
```

**Current Behavior**: Because `key_as_main_identity=False`, the full Plotly spec (`plotly_spec`) and all parameters are included in the element ID computation. This means:

- When the Plotly figure changes (data updates, layout changes, trace modifications)
- The JSON spec changes → A new element ID is generated
- Widget state is stored/retrieved by element ID
- The frontend receives a new ID and cannot find previous state
- **All state is reset**: selections, zoom, pan, figure configuration

### Frontend State Management

The PlotlyChart component manages state through multiple mechanisms:

#### 1. Figure State (`useState` + `widgetMgr.setElementState`)

```typescript
const [plotlyFigure, setPlotlyFigure] = useState<PlotlyFigureType>(() => {
  // Recovery attempt on mount:
  const initialFigureState = widgetMgr.getElementState(element.id, "figure")
  if (initialFigureState) {
    return initialFigureState
  }
  return applyTheming(initialFigureSpec, element.theme, theme)
})

// On every update, save to element state:
onUpdate={figure => {
  widgetMgr.setElementState(element.id, "figure", figure)
  setPlotlyFigure(figure)
}}
```

The figure state includes:

- `data`: All trace data and styling
- `layout`: Axes, title, dimensions, **zoom/pan state**, click/hover/drag modes
- `frames`: Animation frames (if any)

#### 2. Widget Selection State (`widgetMgr.setStringValue`)

```typescript
// From utils.ts - handleSelection function
widgetMgr.setStringValue(
  element,
  JSON.stringify(selectionState),
  { fromUi: true },
  fragmentId
)
```

Selection state includes:

- `points`: Array of selected point objects with full metadata
- `point_indices`: Array of selected point indices
- `box`: Box selection coordinates
- `lasso`: Lasso selection coordinates

#### 3. React Key Handling

From `RenderNodeVisitor.tsx`:

```typescript
visitElementNode(node: ElementNode): OptionalReactElements {
  const key = this.getCurrentKey(getElementId(node.element))  // <-- Uses element.id
  // ...
  const renderer = <ElementNodeRenderer key={key} {...childProps} />
  return renderer
}

private getCurrentKey(elementId?: string): string {
  return this.elementKeyOverride || elementId || this.index.toString()
}
```

**Critical Mechanism**: When `element.id` changes:

1. React sees a different key
2. React **unmounts** the old component and **mounts** a new one
3. `useState` initializer runs for the new component
4. State lookup by new ID fails (no stored state for new ID)
5. Returns empty/default state → **All state lost!**

---

## State Flow Analysis

### Current Flow (When Spec Changes)

```
Run 1:                                    Run 2 (spec changed):
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ element.id = "$$st-hash-abc-key"│      │ element.id = "$$st-hash-def-key"│
└─────────────────────────────────┘      └─────────────────────────────────┘
            │                                        │
            ▼                                        ▼
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ React key = "$$st-hash-abc-key" │      │ React key = "$$st-hash-def-key" │
│                                 │      │                                 │
│ PlotlyChart mounts              │      │ React: key changed!             │
│ User makes selection            │      │ → Unmount old component         │
│ Zooms into data                 │      │ → Mount NEW component           │
│                                 │      │                                 │
│ State stored under:             │      │ useState runs:                  │
│ "$$st-hash-abc-key"             │      │ getElementState("..def-key")    │
└─────────────────────────────────┘      │ → NOT FOUND                     │
                                         │ → Empty state                   │
                                         │                                 │
                                         │ ❌ Selection LOST                │
                                         │ ❌ Zoom/Pan LOST                 │
                                         │ ❌ Figure config LOST            │
                                         └─────────────────────────────────┘
```

### Proposed Flow (With `key_as_main_identity`)

```
Run 1:                                    Run 2 (spec changed, key same):
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ element.id = "$$st-hash-xyz-key"│      │ element.id = "$$st-hash-xyz-key"│
│ (only key in hash, not spec)    │      │ (same - only key in hash)       │
└─────────────────────────────────┘      └─────────────────────────────────┘
            │                                        │
            ▼                                        ▼
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ React key = "$$st-hash-xyz-key" │      │ React key = "$$st-hash-xyz-key" │
│                                 │      │                                 │
│ PlotlyChart mounts              │      │ React: key unchanged!           │
│ User makes selection            │      │ → Reuse same component          │
│ Zooms into data                 │      │ → Props updated                 │
│                                 │      │                                 │
│ State stored under:             │      │ initialFigureSpec useMemo runs  │
│ "$$st-hash-xyz-key"             │      │ (new spec parsed)               │
│                                 │      │                                 │
│ widgetStates["..xyz-key"]       │      │ useState does NOT re-init       │
│ elementStates["..xyz-key"]      │      │ (only runs on mount)            │
└─────────────────────────────────┘      │                                 │
                                         │ ✅ Selection PRESERVED           │
                                         │ ✅ Zoom/Pan PRESERVED            │
                                         │ ✅ Figure state PRESERVED        │
                                         └─────────────────────────────────┘
```

---

## Critical Architecture Difference: Plotly vs PyDeck

### Why PyDeck Works With Backend-Only Changes

PyDeck's `useDeckGl` hook has a specific pattern that separates concerns:

```typescript
// PyDeck pattern (useDeckGl.tsx)

// 1. Selection state is managed separately via useBasicWidgetClientState
const [data, setSelection] = useBasicWidgetClientState<DeckGlElementState>({
  element,
  getDefaultState,
  getStateFromWidgetMgr,
  updateWidgetMgrState,
  widgetMgr,
  fragmentId,
})

// 2. Spec is parsed into a NEW object when it changes
const parsedPydeckJson = useMemo(() => {
  return Object.freeze(JSON5.parse<ParsedDeckGlConfig>(element.json))
}, [isFullScreen, isLightTheme, element.json])  // <-- Recomputes on spec change

// 3. Deck object is REBUILT from NEW spec + PRESERVED selection state
const deck = useMemo<DeckObject>(() => {
  const jsonCopy = { ...parsedPydeckJson }  // <-- Uses NEW spec

  // Apply preserved selection state to new layers
  jsonCopy.layers = jsonCopy.layers.map(layer => {
    const selectedIndices = data?.selection?.indices?.[layerId] || []  // <-- Uses PRESERVED state
    // ... applies selection highlighting to new data
  })

  return jsonConverter.convert(jsonCopy)
}, [
  data.selection.indices,  // <-- Depends on preserved selection
  parsedPydeckJson,        // <-- Depends on new spec
])
```

**Key insight**: PyDeck **rebuilds the visualization from the new spec** while **applying preserved selection state**. The new data flows through, but selections are maintained.

### Why Plotly DOESN'T Work With Backend-Only Changes

Plotly's `PlotlyChart` component does NOT have this separation:

```typescript
// Plotly pattern (PlotlyChart.tsx)

// 1. Spec is parsed into initialFigureSpec
const initialFigureSpec = useMemo<PlotlyFigureType>(() => {
  return JSON.parse(element.spec)
}, [element.id, element.spec])  // <-- Recomputes, but ONLY USED for initialization

// 2. Figure state is initialized ONCE on mount
const [plotlyFigure, setPlotlyFigure] = useState<PlotlyFigureType>(() => {
  // Recovery from elementState or initial spec
  const initialFigureState = widgetMgr.getElementState(element.id, "figure")
  if (initialFigureState) {
    return initialFigureState  // <-- Returns OLD figure if found!
  }
  return applyTheming(initialFigureSpec, element.theme, theme)
})

// 3. NO MECHANISM to apply new spec to existing figure state!
// The initialFigureSpec useMemo updates, but nothing uses it after mount
```

**The problem**: When `element.spec` changes but the component stays mounted (stable ID):

1. `initialFigureSpec` recomputes ✅
2. `plotlyFigure` state does NOT update ❌ (useState only initializes on mount)
3. Chart renders with OLD data from `plotlyFigure` ❌
4. User sees stale chart!

### State Flow Comparison

| Step | PyDeck | Plotly (Current) |
|------|--------|------------------|
| Spec changes | `parsedPydeckJson` recomputes | `initialFigureSpec` recomputes |
| Selection state | Preserved in `data` (separate hook) | Mixed into `plotlyFigure` state |
| Rebuilds visualization | YES - `deck` useMemo combines new spec + preserved selection | NO - `plotlyFigure` never updates |
| Result with stable ID | ✅ New data + preserved selections | ❌ Stale data |

---

## Required Frontend Changes

To enable `key_as_main_identity` for Plotly, the frontend needs to be modified to handle spec changes while preserving state. Here are the recommended approaches:

### Option 1: Add Spec Change Effect (Recommended)

Add a `useEffect` that detects spec changes and merges the new spec into the figure state while preserving interactive state:

```typescript
// Add to PlotlyChart.tsx

// Track previous spec to detect changes
const prevSpecRef = useRef<string | null>(null)

useEffect(() => {
  // Skip on first render (initialization handled by useState)
  if (prevSpecRef.current === null) {
    prevSpecRef.current = element.spec
    return
  }

  // Skip if spec hasn't changed
  if (prevSpecRef.current === element.spec) {
    return
  }

  prevSpecRef.current = element.spec

  // Merge new spec with preserved state
  setPlotlyFigure((prevFigure: PlotlyFigureType) => {
    const newSpec = JSON.parse(element.spec)

    return {
      // Use NEW data and frames
      data: newSpec.data,
      frames: newSpec.frames,
      layout: {
        // Start with new layout
        ...newSpec.layout,
        // Preserve zoom/pan state from previous figure
        ...(preserveAxisRanges(prevFigure.layout, newSpec.layout)),
        // Preserve interaction modes (already handled by other effects)
      },
    }
  })
}, [element.spec])

// Helper function to preserve axis ranges
function preserveAxisRanges(
  prevLayout: Partial<Plotly.Layout>,
  newLayout: Partial<Plotly.Layout>
): Partial<Plotly.Layout> {
  const preserved: Partial<Plotly.Layout> = {}

  // Preserve x-axis ranges
  if (prevLayout.xaxis?.range && !newLayout.xaxis?.range) {
    preserved.xaxis = { ...newLayout.xaxis, range: prevLayout.xaxis.range }
  }
  // Preserve y-axis ranges
  if (prevLayout.yaxis?.range && !newLayout.yaxis?.range) {
    preserved.yaxis = { ...newLayout.yaxis, range: prevLayout.yaxis.range }
  }
  // ... handle other axes (xaxis2, yaxis2, etc.)

  return preserved
}
```

### Option 2: Separate Data and State (More Complex)

Refactor to follow PyDeck's pattern more closely:

1. Extract selection state management into a separate hook
2. Separate "spec-derived data" from "user interaction state"
3. Rebuild figure by combining new spec + preserved interaction state

This is more invasive but provides cleaner separation of concerns.

### Option 3: Force Re-render on Spec Change (Simplest, Less Ideal)

If preserving zoom/pan isn't critical, simply reset figure state when spec changes:

```typescript
useEffect(() => {
  // When spec changes, reset to new spec (preserving only selection via widgetState)
  const newSpec = JSON.parse(element.spec)
  setPlotlyFigure(applyTheming(newSpec, element.theme, theme))
}, [element.spec, element.theme, theme])
```

This preserves selection state (stored in widgetStates) but loses zoom/pan state.

---

## Deep Frontend Analysis

> **Note**: This section describes the **current** frontend behavior and why it's problematic. The "Required Frontend Changes" section above describes the solution.

### Current Behavior: Why Backend-Only Change Causes Stale Data

When the element ID stays the same but `element.spec` changes (with backend-only change):

1. **React Component Identity** ✅:
   - Same key → Same component instance
   - `useState` does NOT run its initializer (only runs on mount)
   - Existing `plotlyFigure` state remains unchanged

2. **`initialFigureSpec` useMemo** ✅ (recomputes but unused):

   ```typescript
   const initialFigureSpec = useMemo<PlotlyFigureType>(() => {
     if (!element.spec) {
       return { layout: {}, data: [], frames: undefined }
     }
     return JSON.parse(element.spec)
   }, [element.id, element.spec])  // Recomputes when spec changes
   ```

   - This DOES recompute when spec changes
   - But it's **only used for initialization** - the new value is never applied!

3. **Theming useEffect** ❌ (doesn't apply new data):

   ```typescript
   useEffect(() => {
     setPlotlyFigure((prevState: PlotlyFigureType) => {
       return applyTheming(prevState, element.theme, theme)
     })
   }, [element.id, theme, element.theme])
   ```

   - Only re-applies theming when **theme** changes
   - Does NOT trigger when **spec** changes
   - Uses `prevState` (the OLD figure), not `initialFigureSpec` (the NEW spec)

4. **Selection Mode useEffect** ❌ (doesn't apply new data):

   ```typescript
   useEffect(() => {
     // ... clickmode, hovermode, dragmode updates
   }, [
     element.id,
     isSelectionActivated,
     // ...
   ])
   ```

   - Only updates interaction modes
   - Does NOT apply new data from spec

**Result**: The `<Plot>` component receives `plotlyFigure.data` and `plotlyFigure.layout` which contain the **OLD** data. The chart shows **stale data** until the user interacts with it.

### What Happens to Plotly Internal State

When data changes but the React component stays mounted:

1. **Zoom/Pan State**:
   - Stored in `plotlyFigure.layout` (axis ranges like `xaxis.range`, `yaxis.range`)
   - Preserved in React state
   - Applied to updated data via `onUpdate` callback cycle

2. **Selection State**:
   - Stored in `widgetMgr.widgetStates` under element ID
   - Also reflected in `plotlyFigure.data[i].selectedpoints`
   - Both preserved when ID stays same

3. **Trace Styling/Visibility**:
   - Stored in figure state
   - Legend toggle states preserved

### Edge Case: Selection Points on Changed Data

When selection exists but data changes:

```typescript
// Example: User selected points [2, 5, 7] on trace 0
// New data only has 4 points (indices 0-3)

// Plotly handles this gracefully:
// - Points at indices 2 and 3 remain highlighted (if they exist)
// - Points at indices 5 and 7 are simply not highlighted (no error)
// - Selection state is still returned to Python with all original indices
```

**Behavior**: Plotly.js doesn't crash or error on orphaned point indices. The selection becomes visually stale but remains functional. This is **acceptable behavior** for the use case (user updating data while maintaining selection context).

---

## Comparison: Plotly vs PyDeck

| Aspect | PyDeck | Plotly |
|--------|--------|--------|
| **State Complexity** | Selection only | Selection + Zoom + Pan + Figure |
| **Selection References** | Layer IDs + Point Indices | Trace indices + Point Indices |
| **Structural Changes** | Layer IDs can change | Trace count/type can change |
| **Internal State** | Minimal | Extensive (Plotly.js managed) |
| **State Recovery** | `widgetMgr.getElementState("selection")` | `widgetMgr.getElementState("figure")` + widgetStates |

### Key Differences

1. **More State to Preserve**: Plotly has significantly more internal state (zoom, pan, axis ranges, legend toggles) that users would want preserved.

2. **Simpler Selection Model**: Plotly selections reference `(trace_index, point_index)` tuples, not named layer IDs. This makes structural fingerprinting less critical.

3. **Self-Healing Selections**: Plotly.js gracefully handles orphaned point indices, unlike deck.gl which requires explicit layer ID matching.

---

## Implementation Recommendation

### Two-Part Implementation Required

Unlike PyDeck (which only needed a backend change), Plotly requires **both backend AND frontend changes**:

1. **Backend**: Enable `key_as_main_identity` to stabilize element IDs
2. **Frontend**: Add spec change handling to apply new data while preserving state

### Part 1: Backend Change

```python
# In plotly_chart.py, modify the compute_and_register_element_id call:

plotly_chart_proto.id = compute_and_register_element_id(
    "plotly_chart",
    user_key=key,
    key_as_main_identity={"selection_mode"} if key else False,  # <-- CHANGE
    dg=self.dg,
    plotly_spec=plotly_chart_proto.spec,
    plotly_config=plotly_chart_proto.config,
    selection_mode=selection_mode,
    is_selection_activated=is_selection_activated,
    theme=theme,
    width=width,
    height=height,
)
```

### Part 2: Frontend Change (Required)

Add a `useEffect` in `PlotlyChart.tsx` to handle spec changes:

```typescript
// Add after the existing useEffects in PlotlyChart.tsx

// Track the previous spec to detect changes
const prevSpecRef = useRef<string | null>(null)

useEffect(() => {
  // Skip on first render (initialization handled by useState)
  if (prevSpecRef.current === null) {
    prevSpecRef.current = element.spec
    return
  }

  // Skip if spec hasn't changed
  if (prevSpecRef.current === element.spec) {
    return
  }

  prevSpecRef.current = element.spec

  // Parse the new spec
  const newSpec: PlotlyFigureType = element.spec
    ? JSON.parse(element.spec)
    : { data: [], layout: {}, frames: undefined }

  // Apply theming to the new spec
  const themedNewSpec = applyTheming(newSpec, element.theme, theme)

  // Merge new spec with preserved interaction state
  setPlotlyFigure((prevFigure: PlotlyFigureType) => {
    return {
      // Use NEW data and frames
      data: themedNewSpec.data,
      frames: themedNewSpec.frames,
      layout: {
        // Start with new themed layout
        ...themedNewSpec.layout,
        // Preserve zoom/pan state (axis ranges) from previous figure
        ...preserveAxisRanges(prevFigure.layout),
        // Preserve current dimensions (will be updated by dimension logic)
        width: prevFigure.layout?.width,
        height: prevFigure.layout?.height,
        // Preserve interaction modes (handled by other effects)
        clickmode: prevFigure.layout?.clickmode,
        hovermode: prevFigure.layout?.hovermode,
        dragmode: prevFigure.layout?.dragmode,
      },
    }
  })
}, [element.spec, element.theme, theme])

// Helper function to extract axis ranges worth preserving
function preserveAxisRanges(
  layout: Partial<Plotly.Layout> | undefined
): Partial<Plotly.Layout> {
  if (!layout) return {}

  const preserved: Partial<Plotly.Layout> = {}

  // Preserve primary axis ranges if they were user-modified
  if (layout.xaxis?.range) {
    preserved.xaxis = { range: layout.xaxis.range }
  }
  if (layout.yaxis?.range) {
    preserved.yaxis = { range: layout.yaxis.range }
  }

  // Handle additional axes (xaxis2, yaxis2, etc.)
  // ... extend as needed

  return preserved
}
```

**Why both changes are required**:

1. **Backend change alone**: Stable ID → Component stays mounted → useState doesn't re-initialize → **Chart shows stale data** ❌
2. **Frontend change alone**: ID changes → Component remounts → useState re-initializes → **State lost anyway** ❌
3. **Both changes**: Stable ID + Spec change handling → **New data + Preserved state** ✅

### Backend Option Variants

**Option B - Selection Mode Whitelist (Recommended)**:

```python
key_as_main_identity={"selection_mode"} if key else False,
```

- Resets state when selection mode changes (reasonable user expectation)

**Option A - Full Key Identity**:

```python
key_as_main_identity=True if key else False,
```

- Maximum state preservation, even across selection mode changes

**Option C - Structural Fingerprint**:

```python
structural_fingerprint = _extract_trace_fingerprint(plotly_chart_proto.spec)
key_as_main_identity={"selection_mode", "structural_fingerprint"} if key else False,
```

- Resets state when trace structure changes (may be overly aggressive)

---

## What State Gets Preserved

With `key_as_main_identity={"selection_mode"}` **and the frontend spec change handling**:

| State Type | Preserved? | Notes |
|------------|------------|-------|
| Point Selections | ✅ Yes | Via `widgetStates` (automatically) |
| Box Selections | ✅ Yes | Via `widgetStates` (automatically) |
| Lasso Selections | ✅ Yes | Via `widgetStates` (automatically) |
| Zoom Level | ✅ Yes | Via axis ranges in spec merge effect |
| Pan Position | ✅ Yes | Via axis ranges in spec merge effect |
| Axis Ranges | ✅ Yes | Explicitly preserved in spec merge effect |
| Legend Toggles | ⚠️ Partial | May reset if new spec has different traces |
| Custom Layout | ⚠️ Partial | User layout modifications may be overwritten by new spec |
| Selection Mode UI | ❌ Reset | When selection_mode changes (by design) |

**Note**: The frontend spec change effect must explicitly preserve each type of state during the merge. The table above assumes the recommended implementation is used.

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

- Plotly.js handles this gracefully (no crashes)
- Python receives full selection state including stale indices
- Users can check `event.selection["points"]` metadata to validate
- Users can programmatically clear selections if needed

### Risk: Unexpected State Persistence

**Scenario**: User changes zoom/pan, then updates data, zoom persists unexpectedly.

**Mitigation**:

- This is the **desired behavior** for the feature
- Document that `key` enables state persistence
- Users who want state reset can omit `key` or use a dynamic key

### Risk: Memory Accumulation

**Scenario**: Old element states accumulate in WidgetStateManager.

**Mitigation**:

- `WidgetStateManager.removeInactive()` already cleans up inactive IDs
- Called at end of each script run with active widget IDs
- No additional memory leak risk

---

## Implementation Checklist

### Backend Changes

- [ ] Modify `key_as_main_identity` in `plotly_chart.py` (line ~733)
- [ ] Update docstring for `key` parameter to explain state persistence
- [ ] Add unit test for element ID stability with key

### Frontend Changes (Required for Plotly - unlike PyDeck)

- [ ] Add `prevSpecRef` useRef to track previous spec
- [ ] Add `useEffect` to detect spec changes and merge new data
- [ ] Add `preserveAxisRanges` helper function
- [ ] Add import for `useRef` if not present
- [ ] Add unit tests for spec change handling
- [ ] Test state preservation across spec changes

### Testing Checklist

- [ ] **E2E: Selection persists with key** - Update plotly data (same structure), verify selection preserved
- [ ] **E2E: Zoom/Pan persists with key** - Zoom into chart, update data, verify zoom preserved
- [ ] **E2E: New data renders with key** - Update data, verify NEW data displays (not stale)
- [ ] **E2E: State resets without key** - Update data without key, verify state cleared
- [ ] **E2E: State resets on selection_mode change** - Change selection mode, verify reset
- [ ] **E2E: Orphaned selections handled** - Select points, reduce data size, verify no errors
- [ ] **Unit (Backend): Element ID stability** - Same key + different spec = same ID
- [ ] **Unit (Backend): Element ID changes without key** - Different spec = different ID
- [ ] **Unit (Frontend): Spec change effect** - Test that new spec triggers state update
- [ ] **Unit (Frontend): Axis range preservation** - Test that zoom/pan state is preserved

### Documentation Updates

- [ ] Add note about state persistence behavior when `key` is provided
- [ ] Document that omitting `key` preserves current reset-on-change behavior
- [ ] Add example showing dynamic chart updates with preserved selections

---

## Code Changes Summary

### Backend Change

```python
# lib/streamlit/elements/plotly_chart.py, around line 730

# BEFORE:
plotly_chart_proto.id = compute_and_register_element_id(
    "plotly_chart",
    user_key=key,
    key_as_main_identity=False,
    # ... rest of kwargs
)

# AFTER:
plotly_chart_proto.id = compute_and_register_element_id(
    "plotly_chart",
    user_key=key,
    key_as_main_identity={"selection_mode"} if key else False,
    # ... rest of kwargs
)
```

### Frontend Change (Required)

```typescript
// frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx

// Add import at top:
import { useRef } from "react"

// Add after other state declarations (around line 125):
const prevSpecRef = useRef<string | null>(null)

// Add new useEffect (after other useEffects, around line 290):
useEffect(() => {
  // Skip on first render (initialization handled by useState)
  if (prevSpecRef.current === null) {
    prevSpecRef.current = element.spec
    return
  }

  // Skip if spec hasn't changed
  if (prevSpecRef.current === element.spec) {
    return
  }

  prevSpecRef.current = element.spec

  // Parse and theme the new spec
  const newSpec: PlotlyFigureType = element.spec
    ? JSON.parse(element.spec)
    : { data: [], layout: {}, frames: undefined }
  const themedNewSpec = applyTheming(newSpec, element.theme, theme)

  // Merge new spec with preserved interaction state
  setPlotlyFigure((prevFigure: PlotlyFigureType) => ({
    data: themedNewSpec.data,
    frames: themedNewSpec.frames,
    layout: {
      ...themedNewSpec.layout,
      // Preserve axis ranges (zoom/pan state)
      xaxis: prevFigure.layout?.xaxis?.range
        ? { ...themedNewSpec.layout?.xaxis, range: prevFigure.layout.xaxis.range }
        : themedNewSpec.layout?.xaxis,
      yaxis: prevFigure.layout?.yaxis?.range
        ? { ...themedNewSpec.layout?.yaxis, range: prevFigure.layout.yaxis.range }
        : themedNewSpec.layout?.yaxis,
      // Preserve dimensions (updated by dimension logic)
      width: prevFigure.layout?.width,
      height: prevFigure.layout?.height,
      // Preserve interaction modes (handled by other effects)
      clickmode: prevFigure.layout?.clickmode,
      hovermode: prevFigure.layout?.hovermode,
      dragmode: prevFigure.layout?.dragmode,
    },
  }))
}, [element.spec, element.theme, theme])
```

Both changes together enable state persistence for `st.plotly_chart` when a `key` is provided, while maintaining backward compatibility for keyless usage.

---

## Conclusion

Enabling `key_as_main_identity` for `st.plotly_chart` is **technically feasible and production-ready** but requires **both backend AND frontend changes**. Unlike PyDeck (where only a backend change was needed), Plotly's frontend architecture requires modifications to handle spec updates while preserving state.

### Key Difference from PyDeck Analysis

| Aspect | PyDeck | Plotly |
|--------|--------|--------|
| **Backend Change** | Required | Required |
| **Frontend Change** | Not required | **Required** |
| **Reason** | PyDeck rebuilds deck from new spec + preserved selection | Plotly uses spec only for initialization |
| **Complexity** | Low | Medium |

### Why Frontend Changes Are Required

1. **PyDeck Pattern**: `parsedPydeckJson` useMemo → `deck` useMemo combines new spec + preserved selection → Works automatically
2. **Plotly Pattern**: `initialFigureSpec` useMemo → `plotlyFigure` useState → No mechanism to apply new spec after mount → **Stale data!**

### Why This Will Work (With Both Changes)

1. **React Key Stability**: Stable element ID → Stable React key → Component stays mounted
2. **Spec Change Detection**: New useEffect detects spec changes and merges new data
3. **State Preservation**: Axis ranges, interaction modes preserved during merge
4. **WidgetStateManager**: Selection state preserved in widgetStates
5. **Plotly.js Resilience**: Handles orphaned selections gracefully

### Recommended Implementation

**Backend**: Use `key_as_main_identity={"selection_mode"}` to stabilize element IDs

**Frontend**: Add spec change useEffect to merge new data while preserving:

- Axis ranges (zoom/pan state)
- Interaction modes (clickmode, hovermode, dragmode)
- Dimensions (width, height)

This approach:

- Preserves state across data/layout changes
- Resets state when selection mode changes (reasonable user expectation)
- Maintains backward compatibility (only affects keyed charts)
- Ensures new data is always rendered (no stale charts)
