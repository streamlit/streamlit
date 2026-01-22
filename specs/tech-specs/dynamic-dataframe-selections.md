# Dynamic Dataframe Selection State Persistence Investigation

## Executive Summary

**Goal**: Allow `st.dataframe` with selections enabled to preserve selection state (row, column, and cell selections) when the dataframe data or other parameters change, by using the user-provided `key` as the main identity for the component.

**Finding**: This is **feasible with a backend-only change**. After deep analysis of both backend and frontend code:

- ✅ **Backend change only**: Modify `key_as_main_identity` in `arrow.py`
- ✅ **No frontend changes needed**: Existing architecture handles state restoration correctly
- ⚠️ **Edge cases require consideration**: Orphaned selection indices need documentation
- ✅ **Safe rollout**: Only affects apps using `key` parameter with selections

### Critical Difference from Other Chart Widgets

Unlike Plotly (which requires both backend AND frontend changes), the DataFrame component's frontend architecture already supports preserving state across data changes, similar to Vega-Lite:

| Aspect | DataFrame | Vega-Lite | Plotly |
|--------|-----------|-----------|--------|
| **Backend Change** | ✅ Required | ✅ Required | ✅ Required |
| **Frontend Change** | ❌ Not needed | ❌ Not needed | ⚠️ Required |
| **State Storage** | `widgetMgr.widgetStates` | `widgetMgr.elementStates` + `widgetStates` | `useState` (problematic) |
| **State Restoration** | `loadInitialSelectionState` on mount | `vegaView.setState()` | No mechanism |
| **Complexity** | Low | Low | Medium |

---

## Current Architecture

### Backend (`lib/streamlit/elements/arrow.py`)

When selections are activated, the element ID is computed using:

```python
proto.id = compute_and_register_element_id(
    "dataframe",
    user_key=key,
    key_as_main_identity=False,  # <-- CRITICAL: Currently False
    dg=self.dg,
    data=proto.data,              # <-- Full data bytes in ID computation
    width=width,
    height=height,
    use_container_width=use_container_width,
    column_order=proto.column_order,
    column_config=proto.columns,
    selection_mode=selection_mode,
    is_selection_activated=is_selection_activated,
    row_height=row_height,
    placeholder=placeholder,
)
```

**Current Behavior**: Because `key_as_main_identity=False`, the full dataframe data (`proto.data`) and all parameters are included in the element ID computation. This means:

- When the dataframe changes (data updates, column config changes)
- The element ID changes → A new element ID is generated
- Widget state is stored/retrieved by element ID
- The frontend receives a new ID and cannot find previous state
- **All selection state is reset**: row selections, column selections, cell selections

### Frontend Architecture Overview

The DataFrame frontend consists of several key hooks:

```
DataFrame.tsx
    │
    ├── useWidgetState.ts       (editing state + selection state sync)
    │       │
    │       ├── loadInitialSelectionState()  - Restores state on mount
    │       └── createSyncSelectionState()   - Syncs state to widget manager
    │
    ├── useSelectionHandler.ts  (grid selection UI state)
    │       │
    │       ├── gridSelection useState    - UI selection state
    │       └── processSelectionChange()  - Processes grid selections
    │
    ├── useColumnLoader.ts      (column configuration)
    ├── useColumnSort.ts        (column sorting + index mapping)
    └── useDataLoader.ts        (data loading from Arrow)
```

---

## Deep Frontend Analysis

### Component: `DataFrame.tsx`

The main component orchestrates data loading, selection handling, and state management:

```typescript
function DataFrame({
  element,
  data,
  disabled,
  widgetMgr,
  fragmentId,
  ...
}: Readonly<DataFrameProps>): ReactElement {
  // 1. Widget state management (editing + selection state sync)
  const {
    editingState,
    numRows,
    createSyncSelectionState,
    loadInitialSelectionState,
    ...
  } = useWidgetState({
    element,
    widgetMgr,
    fragmentId,
    originalNumRows,
    originalColumns,
  })

  // 2. Column sorting (provides getOriginalIndex for selection mapping)
  const { columns, sortColumn, getOriginalIndex, getCellContent } =
    useColumnSort(originalNumRows, originalColumns, getOriginalCellContent)

  // 3. Create sync callback with sorted columns
  const innerSyncSelectionState = useMemo(
    () => createSyncSelectionState(columns, getOriginalIndex),
    [createSyncSelectionState, columns, getOriginalIndex]
  )

  // 4. Selection handling (UI state)
  const {
    gridSelection,
    processSelectionChange,
    clearSelection,
    ...
  } = useSelectionHandler(
    element,
    isEmptyTable,
    disabled,
    columns,
    syncSelectionState  // <-- Debounced version of innerSyncSelectionState
  )

  // 5. Load initial selection state on mount
  useEffect(
    () => {
      const initialSelection = loadInitialSelectionState({
        columns,
        isRowSelectionActivated,
        isColumnSelectionActivated,
        isCellSelectionActivated,
        isMultiCellSelectionActivated,
      })

      if (initialSelection) {
        processSelectionChange(initialSelection)  // <-- RESTORES SELECTION
      }
    },
    []  // Only runs on mount
  )
  ...
}
```

**Key Insight**: The `loadInitialSelectionState` function runs on component mount and restores selection state from the widget manager. This is the mechanism that enables state persistence.

### Hook: `useSelectionHandler.ts`

This hook manages the UI-level selection state:

```typescript
function useSelectionHandler(
  element: ArrowProto,
  isEmptyTable: boolean,
  isDisabled: boolean,
  columns: BaseColumn[],
  syncSelectionState: (
    newSelection: GridSelection,
    syncCellSelections: boolean
  ) => void
): SelectionHandlerReturn {
  // Selection state stored in useState - initialized empty
  const [gridSelection, setGridSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
    current: undefined,
  })

  // Process selection changes and sync to widget manager
  const processSelectionChange = useCallback(
    (newSelection: GridSelection) => {
      // ... validation and cleanup logic ...
      setGridSelection(updatedSelection)

      if (syncSelection) {
        // Sync to widget manager (backend)
        syncSelectionState(updatedSelection, isCellSelectionActivated)
      }
    },
    [/* deps */]
  )

  return {
    gridSelection,
    processSelectionChange,
    clearSelection,
    // ... other selection state flags
  }
}
```

**Important**: The `gridSelection` useState is initialized empty, but `processSelectionChange` can be called with a restored selection from `loadInitialSelectionState`.

### Hook: `useWidgetState.ts`

This hook manages widget state syncing and provides state restoration:

```typescript
function useWidgetState({
  element,
  widgetMgr,
  fragmentId,
  originalNumRows,
  originalColumns,
}: UseWidgetStateParams): UseWidgetStateReturn {

  /**
   * Creates a function to sync selection state with the widget manager.
   */
  const createSyncSelectionState = useCallback(
    (
      columns: BaseColumn[],
      getOriginalIndex: (row: number) => number
    ): ((newSelection: GridSelection, syncCellSelections: boolean) => void) => {
      return (newSelection: GridSelection, syncCellSelections: boolean) => {
        // Build selection state structure
        const selectionState: DataframeState = {
          selection: {
            rows: newSelection.rows.toArray().map(row => getOriginalIndex(row)),
            columns: newSelection.columns.toArray().map(columnIdx => getColumnName(columns[columnIdx])),
            cells: [] as CellPosition[],
          },
        }

        // Sync to widget manager
        widgetMgr.setStringValue(
          { id: element.id, formId: element.formId },
          JSON.stringify(selectionState),
          { fromUi: true },
          fragmentId
        )
      }
    },
    [element.id, element.formId, widgetMgr, fragmentId]
  )

  /**
   * Loads initial selection state from the widget manager.
   * This is called during component initialization to restore
   * any previously saved selection state.
   */
  const loadInitialSelectionState = useCallback(
    ({
      columns,
      isRowSelectionActivated,
      isColumnSelectionActivated,
      isCellSelectionActivated,
      isMultiCellSelectionActivated,
    }): GridSelection | undefined => {
      // Try to get stored state from widget manager
      const initialWidgetValue = widgetMgr.getStringValue({
        id: element.id,
        formId: element.formId,
      } as WidgetInfo)

      if (!initialWidgetValue) {
        return undefined
      }

      // Parse and reconstruct GridSelection from stored state
      const selectionState: DataframeState = JSON.parse(initialWidgetValue)

      let rowSelection = CompactSelection.empty()
      let columnSelection = CompactSelection.empty()
      let cellSelection: [number, number] | undefined = undefined

      selectionState.selection?.rows?.forEach(row => {
        rowSelection = rowSelection.add(row)
      })

      selectionState.selection?.columns?.forEach(column => {
        columnSelection = columnSelection.add(columnNames.indexOf(column))
      })

      // ... cell selection reconstruction ...

      return {
        rows: rowSelection,
        columns: columnSelection,
        current: cellSelection ? /* ... */ : undefined,
      }
    },
    [widgetMgr, element.id, element.formId]
  )

  return {
    createSyncSelectionState,
    loadInitialSelectionState,
    // ... other utilities
  }
}
```

### React Key Assignment

From `ElementNodeRenderer.tsx`:

```typescript
case "arrowDataFrame": {
  const arrowProto = node.element.arrowDataFrame as ArrowProto
  widgetProps.disabled = widgetProps.disabled || arrowProto.disabled
  return (
    <ArrowDataFrame
      // Arrow dataframe can be used as a widget (data_editor) or
      // an element (dataframe). We only want to set the key in case of
      // it being used as a widget. For the non-widget usage, the id will
      // be undefined.
      key={arrowProto.id || undefined}  // <-- React key from element ID
      element={arrowProto}
      data={node.quiverElement}
      {...widgetProps}
    />
  )
}
```

**Critical Mechanism**: When `element.id` changes:

1. React sees a different key
2. React **unmounts** the old component and **mounts** a new one
3. `loadInitialSelectionState` runs but finds no stored state (new ID)
4. **All selections are lost!**

---

## State Flow Analysis

### Current Flow (When Data Changes)

```
Run 1:                                    Run 2 (data changed):
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ element.id = "$$st-hash-abc-key"    │   │ element.id = "$$st-hash-def-key"    │
│ (includes data hash)                 │   │ (NEW hash due to data change)       │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
            │                                         │
            ▼                                         ▼
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ React key = "$$st-hash-abc-key"     │   │ React key = "$$st-hash-def-key"     │
│                                     │   │                                     │
│ Component mounts                    │   │ React: key changed!                 │
│ loadInitialSelectionState() runs    │   │ → Unmount old component             │
│ → No stored state found             │   │ → Mount NEW component               │
│                                     │   │                                     │
│ User selects rows [0, 2, 5]         │   │ loadInitialSelectionState() runs    │
│                                     │   │ widgetMgr.getStringValue("..def-key")│
│ syncSelectionState() called         │   │ → NOT FOUND (different ID!)         │
│ widgetStates["..abc-key"] = {...}   │   │                                     │
│                                     │   │ ❌ Selection LOST                    │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
```

### Proposed Flow (With `key_as_main_identity`)

```
Run 1:                                    Run 2 (data changed, key same):
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ element.id = "$$st-hash-xyz-key"    │   │ element.id = "$$st-hash-xyz-key"    │
│ (only key in hash, not data)        │   │ (SAME - only key in hash)           │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
            │                                         │
            ▼                                         ▼
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ React key = "$$st-hash-xyz-key"     │   │ React key = "$$st-hash-xyz-key"     │
│                                     │   │                                     │
│ Component mounts                    │   │ React: key unchanged!               │
│ loadInitialSelectionState() runs    │   │ → Reuse same component              │
│ → No stored state found (first run) │   │ → Props updated (new data)          │
│                                     │   │                                     │
│ User selects rows [0, 2, 5]         │   │ gridSelection useState unchanged    │
│                                     │   │ Selection [0, 2, 5] still active    │
│ syncSelectionState() called         │   │                                     │
│ widgetStates["..xyz-key"] = {...}   │   │ New data renders in grid            │
│                                     │   │                                     │
└─────────────────────────────────────┘   │ ✅ Selection PRESERVED               │
                                          │ (but may reference different rows)   │
                                          └─────────────────────────────────────┘
```

---

## Why No Frontend Changes Are Needed

### Key Architectural Difference: DataFrame vs Plotly

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

**DataFrame's Solution**:

```typescript
// DataFrame separates data from selection state
// Data comes from props (element.data) - always fresh
// Selection state is in useState but synced to widgetMgr

// useWidgetState creates sync callback
const innerSyncSelectionState = createSyncSelectionState(columns, getOriginalIndex)

// useSelectionHandler manages UI state
const [gridSelection, setGridSelection] = useState<GridSelection>({...})

// When data changes but component stays mounted:
// 1. data prop updates → Grid renders NEW data ✅
// 2. gridSelection useState remains unchanged ✅
// 3. Selected row indices point to (potentially different) rows in new data
```

### The Key Separation

DataFrame cleanly separates:

1. **Data** → Comes from `element.data` prop (always current)
2. **Selection State** → Stored in `gridSelection` useState + synced to widgetMgr
3. **Grid Rendering** → Combines fresh data + current selection state

When data changes with a stable ID:

- **New data displays correctly** (from props, not state)
- **Selection state persists** (in useState, synced to widgetMgr)
- **Selection indices may become stale** (acceptable edge case - see below)

---

## Edge Cases and Handling

### Edge Case 1: Orphaned Row Selection Indices

**Scenario**: User selects rows [2, 5, 7], then data updates to only have 4 rows.

**Behavior**:

- Row 2 remains selected and highlighted (if it exists)
- Rows 5 and 7 are in selection state but don't exist in grid
- Grid silently ignores out-of-bounds indices
- Python receives selection `{"rows": [2, 5, 7]}` which may include stale indices

**glide-data-grid handles this gracefully**:

```typescript
// CompactSelection.toArray() returns all indices
// Grid only highlights indices that exist in the data
// No crashes or errors for out-of-bounds indices
```

**This is acceptable behavior** - similar to how PyDeck and Vega-Lite handle it.

### Edge Case 2: Column Selection with Column Changes

**Scenario**: User selects columns ["col_a", "col_b"], then data changes column names.

**Behavior**:

- Selection state stores column **names** (not indices)
- `loadInitialSelectionState` uses `columnNames.indexOf(column)` to map names to indices
- If column name no longer exists, `indexOf` returns `-1`
- Selection for that column is effectively lost

**This is reasonable behavior** - columns should logically match their names.

### Edge Case 3: Cell Selection with Data Structure Changes

**Scenario**: User selects cells [(0, "col_a"), (2, "col_b")], data changes dimensions.

**Behavior**:

- Cell selections are stored as `(row_index, column_name)` tuples
- If row index is out of bounds or column doesn't exist, selection becomes stale
- No crashes - grid simply doesn't highlight non-existent cells

### Edge Case 4: Sorting State

**Note**: Column sorting is handled separately via `useColumnSort`:

- Sorting state is **internal** to the component (not persisted)
- When data changes, sorting may need to be re-applied
- Selection indices are mapped through `getOriginalIndex` to maintain consistency

**Current behavior**: Sorting state resets when component remounts (ID change). With stable ID, sorting persists but may become invalid if data structure changes.

### Edge Case 5: Column Reordering

**Scenario**: User reorders columns, then data updates.

**Behavior**:

- Column order is stored in `columnOrder` state
- Synced from `element.columnOrder` via useEffect
- If new data has different columns, order may become partially invalid
- Component gracefully handles missing columns in order

---

## Comparison: DataFrame vs PyDeck vs Vega-Lite vs Plotly

| Aspect | DataFrame | PyDeck | Vega-Lite | Plotly |
|--------|-----------|--------|-----------|--------|
| **Backend Change** | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| **Frontend Change** | ❌ Not needed | ❌ Not needed | ❌ Not needed | ⚠️ Required |
| **Selection Storage** | `widgetMgr.widgetStates` | `useBasicWidgetClientState` | `widgetMgr.elementStates` + `widgetStates` | `useState` (problematic) |
| **Data Source** | Props (element.data) | Props (element.json) | Props (element.spec) | State (plotlyFigure) |
| **State Restoration** | `loadInitialSelectionState` on mount | State from hook | `vegaView.setState()` | No mechanism |
| **Complexity** | Low | Low | Low | Medium |

### Why DataFrame is Similar to Vega-Lite and PyDeck

All three follow the "data from props, state persisted externally" pattern:

**DataFrame**:

```typescript
// Data from props (always fresh)
const data = props.data  // Quiver data from proto

// Selection synced to widget manager
widgetMgr.setStringValue(element.id, JSON.stringify(selectionState), ...)

// On mount, restore from widget manager
const initialSelection = loadInitialSelectionState({...})
```

**PyDeck**:

```typescript
// Data from props (always fresh)
const parsedPydeckJson = useMemo(() => JSON5.parse(element.json), [element.json])

// Selection in external hook
const [data, setSelection] = useBasicWidgetClientState({...})

// Deck rebuilt with new spec + preserved selection
const deck = useMemo(() => {
  const jsonCopy = { ...parsedPydeckJson }
  // Apply preserved selection state
  return jsonConverter.convert(jsonCopy)
}, [parsedPydeckJson, data.selection.indices])
```

**Vega-Lite**:

```typescript
// Data from props (always fresh)
const element = useVegaElementPreprocessor(inputElement, ...)

// View recreated when spec changes
useLayoutEffect(() => {
  createView(containerRef, spec)  // Creates NEW view with NEW spec
}, [spec])

// Selection restored from widget manager
const maybeConfigureSelections = useCallback((vegaView: VegaView) => {
  const viewState = widgetMgr.getElementState(chartId, "viewState")
  return vegaView.setState(viewState)  // RESTORES selections
}, [chartId])
```

---

## Implementation Recommendation

### Backend Change (Required)

```python
# In arrow.py, modify the compute_and_register_element_id call (~line 771):

# BEFORE:
proto.id = compute_and_register_element_id(
    "dataframe",
    user_key=key,
    key_as_main_identity=False,  # <-- Currently False
    dg=self.dg,
    data=proto.data,
    width=width,
    height=height,
    use_container_width=use_container_width,
    column_order=proto.column_order,
    column_config=proto.columns,
    selection_mode=selection_mode,
    is_selection_activated=is_selection_activated,
    row_height=row_height,
    placeholder=placeholder,
)

# AFTER:
proto.id = compute_and_register_element_id(
    "dataframe",
    user_key=key,
    key_as_main_identity={"selection_mode"} if key else False,  # <-- CHANGE
    dg=self.dg,
    data=proto.data,
    width=width,
    height=height,
    use_container_width=use_container_width,
    column_order=proto.column_order,
    column_config=proto.columns,
    selection_mode=selection_mode,
    is_selection_activated=is_selection_activated,
    row_height=row_height,
    placeholder=placeholder,
)
```

### Backend Option Variants

**Option A - Selection Mode Whitelist (Recommended)**:

```python
key_as_main_identity={"selection_mode"} if key else False,
```

- Resets state when selection mode changes (reasonable user expectation)
- Preserves state across data/column_config/row_height changes

**Option B - Full Key Identity**:

```python
key_as_main_identity=True if key else False,
```

- Maximum state preservation, even across selection mode changes
- Simpler but may surprise users when selection_mode changes

**Option C - Empty Set (Most Permissive)**:

```python
key_as_main_identity=set() if key else False,
```

- Only key and active_script_hash in ID computation
- Preserves state across ALL parameter changes including selection_mode

### Frontend Changes (NOT Required)

The existing frontend architecture already supports this pattern:

1. ✅ Data comes from props (`element.data`) - always current
2. ✅ Selection state in useState + synced to `widgetMgr.widgetStates`
3. ✅ `loadInitialSelectionState` restores selection on mount (though not needed with stable ID)
4. ✅ glide-data-grid handles orphaned indices gracefully

**No changes needed** because:

- When ID stays stable, component stays mounted
- `gridSelection` useState persists across prop changes
- New data is rendered correctly (from props, not state)
- Selection state syncing continues to work

---

## What State Gets Preserved

With `key_as_main_identity={"selection_mode"}`:

| State Type | Preserved? | Notes |
|------------|------------|-------|
| Row Selections | ✅ Yes | Via `gridSelection` useState + widgetMgr sync |
| Column Selections | ✅ Yes | Via `gridSelection` useState + widgetMgr sync |
| Cell Selections | ✅ Yes | Via `gridSelection` useState + widgetMgr sync |
| Column Sorting | ⚠️ Partial | Sorting state resets, but preserves if component stays mounted |
| Column Reorder | ✅ Yes | Via `columnOrder` state (synced from element) |
| Column Pinning | ✅ Yes | Via `columnConfigMapping` state |
| Editing State | ⚠️ Separate | `data_editor` uses different state management |
| Scroll Position | ❌ No | Not persisted (internal to grid) |
| Selection Mode | ❌ Resets | By design - included in whitelist |

---

## Risks & Mitigations

### Risk: Breaking Existing Apps

**Scenario**: Apps that rely on selection being reset when data changes.

**Mitigation**:

- Only change behavior when `key` is provided
- Without `key`, behavior remains unchanged (full data in ID)
- Document the change clearly in release notes

### Risk: Stale Row Selections

**Scenario**: User selects rows [2, 5, 7], then data updates to have different content in those rows.

**Mitigation**:

- This is the **desired behavior** for the feature
- Document that selections reference row **indices**, not row content
- Python receives selection indices which may point to different rows
- Users can validate selection data in their callback
- Users can programmatically clear selections if needed

### Risk: Out-of-Bounds Selections

**Scenario**: User selects rows [5, 7], then data shrinks to 4 rows.

**Mitigation**:

- glide-data-grid handles this gracefully (no crashes)
- Out-of-bounds indices simply aren't highlighted
- Python receives all indices (including stale ones)
- Document that users should handle potential out-of-bounds indices

### Risk: Column Name Changes

**Scenario**: User selects column "col_a", data changes column name to "col_b".

**Mitigation**:

- Selection uses column names, not indices
- If column name changes, selection for that column is lost
- This is reasonable behavior - columns should be identified by name
- Document that column selections depend on column names

### Risk: Memory Accumulation

**Scenario**: Old widget states accumulate in WidgetStateManager.

**Mitigation**:

- `WidgetStateManager.removeInactive()` already cleans up inactive IDs
- Called at end of each script run with active widget IDs
- No additional memory leak risk

---

## Implementation Checklist

### Backend Changes

- [ ] Modify `key_as_main_identity` in `arrow.py` (line ~774)
  - [ ] **Option A**: `{"selection_mode"}` - minimal, preserves across all data changes
  - [ ] **Option B** (recommended): `{"selection_mode", "num_rows"}` - resets on row count change
- [ ] If Option B: Add `num_rows` to kwargs in `compute_and_register_element_id`
- [ ] Update docstring for `key` parameter to explain state persistence
- [ ] Add unit test for element ID stability with key

### Frontend Changes (NOT Required for MVP)

- ✅ No changes needed - existing architecture handles this
- [ ] **Future**: Consider Option 3 (frontend cleanup) based on user feedback

### Testing Checklist

**Basic Functionality:**
- [ ] **E2E: Row selection persists with key** - Update data (same structure), verify row selection preserved
- [ ] **E2E: Column selection persists with key** - Update data, verify column selection preserved
- [ ] **E2E: Cell selection persists with key** - Update data, verify cell selection preserved
- [ ] **E2E: New data renders with key** - Update data, verify NEW data displays (not stale)
- [ ] **E2E: State resets without key** - Update data without key, verify selection cleared
- [ ] **E2E: State resets on selection_mode change** - Change selection mode, verify reset

**Edge Cases:**
- [ ] **E2E: Orphaned row indices handled** - Select rows, reduce data size, verify no errors
- [ ] **E2E: Column name changes handled** - Select columns, change column names, verify graceful handling
- [ ] **E2E: Row count change (Option B)** - Select rows, change row count, verify selection resets

**Unit Tests:**
- [ ] **Unit (Backend): Element ID stability** - Same key + different data = same ID
- [ ] **Unit (Backend): Element ID changes without key** - Different data = different ID
- [ ] **Unit (Backend): Element ID changes on row count (Option B)** - Same key + different row count = different ID

### Documentation Updates

- [ ] Add note about state persistence behavior when `key` is provided
- [ ] Document that omitting `key` preserves current reset-on-change behavior
- [ ] Add example showing dynamic dataframe updates with preserved selections
- [ ] Document edge cases (orphaned indices, column name changes)
- [ ] If Option B: Document that selections reset when row count changes

---

## Code Changes Summary

### Backend Change

```python
# lib/streamlit/elements/arrow.py, around line 771

# BEFORE:
proto.id = compute_and_register_element_id(
    "dataframe",
    user_key=key,
    key_as_main_identity=False,
    dg=self.dg,
    data=proto.data,
    width=width,
    height=height,
    use_container_width=use_container_width,
    column_order=proto.column_order,
    column_config=proto.columns,
    selection_mode=selection_mode,
    is_selection_activated=is_selection_activated,
    row_height=row_height,
    placeholder=placeholder,
)

# AFTER (Option A - Minimal):
proto.id = compute_and_register_element_id(
    "dataframe",
    user_key=key,
    key_as_main_identity={"selection_mode"} if key else False,
    dg=self.dg,
    data=proto.data,
    width=width,
    height=height,
    use_container_width=use_container_width,
    column_order=proto.column_order,
    column_config=proto.columns,
    selection_mode=selection_mode,
    is_selection_activated=is_selection_activated,
    row_height=row_height,
    placeholder=placeholder,
)

# AFTER (Option B - With Row Count, Recommended):
proto.id = compute_and_register_element_id(
    "dataframe",
    user_key=key,
    key_as_main_identity={"selection_mode", "num_rows"} if key else False,
    dg=self.dg,
    data=proto.data,
    width=width,
    height=height,
    use_container_width=use_container_width,
    column_order=proto.column_order,
    column_config=proto.columns,
    selection_mode=selection_mode,
    is_selection_activated=is_selection_activated,
    row_height=row_height,
    placeholder=placeholder,
    num_rows=originalNumRows,  # Add this for Option B
)
```

**Note for Option B:** The `num_rows` value should be computed from the data dimensions:
```python
# Compute num_rows before the compute_and_register_element_id call
originalNumRows = dataDimensions.numDataRows  # or data_df.shape[0]
```

### Frontend Change (NOT Required)

No changes needed. The existing architecture:

1. `DataFrame.tsx` - Receives data from props (always fresh)
2. `useSelectionHandler` - Manages selection state in useState
3. `useWidgetState.createSyncSelectionState` - Syncs selection to widget manager
4. `useWidgetState.loadInitialSelectionState` - Restores selection on mount
5. glide-data-grid - Handles orphaned indices gracefully

This is the same pattern used by Vega-Lite and PyDeck, which also required only backend changes.

---

## Edge Case Handling Options

The basic implementation preserves selections across data changes, but this can lead to edge cases where selection indices become invalid (e.g., selecting row 10 when new data only has 5 rows). Here we analyze different approaches to handle these edge cases.

### Option 1: Include Structural Fingerprint in ID (Backend-Only)

Add structural metadata to the ID whitelist so state resets when structure changes but persists when only data values change:

```python
# In arrow.py
key_as_main_identity={"selection_mode", "num_rows", "column_names"} if key else False,

# Where these would be computed:
num_rows = data_df.shape[0]
column_names = tuple(data_df.columns.tolist())
```

**Variant - Row Count Only:**
```python
# More permissive - only reset when row count changes
key_as_main_identity={"selection_mode", "num_rows"} if key else False,
```

| Pros | Cons |
|------|------|
| Backend-only change (no frontend work) | Too aggressive - adding/removing one row resets ALL selections |
| Simple and predictable | Can't partially preserve valid selections |
| Covers the main edge cases automatically | Column renaming also triggers full reset (if included) |

**Complexity**: Low
**ROI**: Medium - covers 80% of edge cases but may frustrate users who add one row

---

### Option 2: Backend Validation (Like number_input)

Similar to `number_input.py` which validates and resets values when they fall outside new bounds:

```python
# Reference: number_input.py lines 635-651
current_value = widget_state.value
value_needs_reset = False

if current_value is not None and (
    (number_input_proto.has_min and current_value < number_input_proto.min)
    or (number_input_proto.has_max and current_value > number_input_proto.max)
):
    value_needs_reset = True
    current_value = value  # Reset to default

    if key is not None:
        get_session_state().reset_state_value(key, current_value)

if value_needs_reset or widget_state.value_changed:
    number_input_proto.value = current_value
    number_input_proto.set_value = True  # <-- Tells frontend to update
```

**Attempted Implementation for DataFrame:**

```python
# In arrow.py, after getting widget_state
if is_selection_activated and widget_state.value:
    selection = widget_state.value.get("selection", {})
    rows = selection.get("rows", [])
    cols = selection.get("columns", [])

    num_rows = data_df.shape[0]
    column_names = set(data_df.columns.tolist())

    # Check for invalid selections
    valid_rows = [r for r in rows if r < num_rows]
    valid_cols = [c for c in cols if c in column_names]

    if len(valid_rows) != len(rows) or len(valid_cols) != len(cols):
        # Need to reset state somehow...
        # But there's no set_value mechanism for dataframe!
```

**Challenge**: The dataframe proto doesn't have a `set_value` field like number_input. The frontend manages selection state locally via `useState`.

**Potential Workaround - Add Proto Field:**

```protobuf
// In Arrow.proto
message Arrow {
  // ... existing fields ...
  bool reset_selection = 20;  // New field to tell frontend to clear selection
}
```

Then in frontend:

```typescript
// In DataFrame.tsx or useWidgetState
useEffect(() => {
  if (element.resetSelection) {
    clearSelection()
  }
}, [element.resetSelection])
```

| Pros | Cons |
|------|------|
| Fine-grained control | Requires proto change + frontend change |
| Can partially preserve valid selections | More complex implementation |
| Similar pattern to existing widgets | May not be worth it for MVP |

**Complexity**: Medium-High
**ROI**: Uncertain - significant work for nuanced improvement

---

### Option 3: Frontend-Side Cleanup (Cleanest UX)

The frontend automatically cleans up invalid selections when data structure changes:

```typescript
// Add to DataFrame.tsx after selection handler setup
useEffect(() => {
  // Clean up orphaned row selections
  if (gridSelection.rows.length > 0) {
    const validRows = gridSelection.rows.toArray().filter(row => row < numRows)
    if (validRows.length !== gridSelection.rows.length) {
      const cleanedSelection: GridSelection = {
        ...gridSelection,
        rows: validRows.length > 0
          ? CompactSelection.from(validRows)
          : CompactSelection.empty(),
      }
      processSelectionChange(cleanedSelection)
    }
  }

  // Clean up orphaned column selections
  if (gridSelection.columns.length > 0) {
    const columnNames = columns.map(c => c.name)
    const validCols = gridSelection.columns.toArray().filter(idx => {
      const col = columns[idx]
      return col && columnNames.includes(col.name)
    })
    if (validCols.length !== gridSelection.columns.length) {
      const cleanedSelection: GridSelection = {
        ...gridSelection,
        columns: validCols.length > 0
          ? CompactSelection.from(validCols)
          : CompactSelection.empty(),
      }
      processSelectionChange(cleanedSelection)
    }
  }
}, [numRows, columns])  // Trigger when structure changes
```

| Pros | Cons |
|------|------|
| Clean UX - users see valid selections only | Silently modifies user selections (could be surprising) |
| Preserves partial selections (keeps valid, removes invalid) | Requires frontend changes |
| No backend changes needed | Adds complexity to an already complex component |

**Complexity**: Medium
**ROI**: Good - provides clean UX but adds frontend complexity

---

### Option 4: Do Nothing + Document (MVP Approach)

Accept orphaned selections as expected behavior and document it clearly:

**Documentation addition:**
> When using `key` with selections, selection indices persist across data changes. If your data shrinks (fewer rows) or columns are renamed, the selection state may contain stale references. These stale references don't cause errors—the grid ignores out-of-bounds indices—but your callback will receive the full selection state including stale indices. Handle this by validating selection indices against your current data.

**Example for users:**
```python
event = st.dataframe(df, key="my_df", on_select="rerun", selection_mode="multi-row")

# Validate selections against current data
valid_rows = [r for r in event.selection["rows"] if r < len(df)]
selected_data = df.iloc[valid_rows]
```

| Pros | Cons |
|------|------|
| Zero complexity | May confuse some users |
| Users have full control | Requires good documentation |
| No additional code to maintain | Shifts burden to users |

**Complexity**: Zero
**ROI**: Acceptable for MVP if documented well

---

### Recommendation Summary

| Option | Complexity | ROI | Recommended For |
|--------|------------|-----|-----------------|
| **Option 1** (num_rows in ID) | Low | Medium | Quick win, covers main case |
| **Option 2** (Backend validation) | High | Uncertain | Skip for now |
| **Option 3** (Frontend cleanup) | Medium | Good | Future enhancement |
| **Option 4** (Document only) | Zero | Acceptable | MVP if time-constrained |

**Recommended MVP Approach:**

**Option 1 (variant) + Option 4**: Include `num_rows` in the whitelist to handle the most common edge case (orphaned row indices), and document the remaining edge cases (column renames):

```python
key_as_main_identity={"selection_mode", "num_rows"} if key else False,

# Where num_rows is computed:
num_rows = dataDimensions.numDataRows  # or len(data_df)
```

This:
- Resets selections when row count changes (covers orphaned row indices)
- Preserves selections when only data VALUES change (main use case)
- Column renames still cause stale references, but that's rarer and arguably correct behavior
- Low complexity, no frontend changes

**Future Enhancement**: Consider Option 3 (frontend cleanup) based on user feedback.

---

## Selection State in Element State (Alternative Storage)

Currently, selection state is stored in `widgetStates` (synced with backend). An alternative would be to also store in `elementStates` (frontend-only) like Vega-Lite does:

```typescript
// Store selection in both places for better persistence
widgetMgr.setElementState(element.id, "selection", selectionState)
widgetMgr.setStringValue(element, JSON.stringify(selectionState), ...)
```

**Trade-off**: More complexity for marginal benefit. Current approach works well.

---

## Conclusion

Enabling `key_as_main_identity` for `st.dataframe` with selections is **technically feasible with a backend-only change**. The existing frontend architecture already supports the required pattern of receiving fresh data from props while maintaining selection state in React state.

### Key Findings

1. **Backend Change Required**: Set `key_as_main_identity={"selection_mode"} if key else False` (or include `num_rows` for edge case handling)
2. **Frontend Change NOT Required**: Data comes from props, selection state in useState
3. **Similar to Vega-Lite and PyDeck**: All use "data from props, state persisted externally" pattern
4. **Different from Plotly**: Plotly stores data in state, requiring frontend changes
5. **Edge Cases Exist**: Orphaned indices and column renames need consideration

### Why This Will Work

1. **React Key Stability**: Stable element ID → Stable React key → Component stays mounted
2. **Data from Props**: `element.data` always contains current data
3. **Selection in State**: `gridSelection` useState persists across prop changes
4. **Graceful Degradation**: glide-data-grid handles orphaned indices without crashes
5. **Widget Manager Sync**: Selection state synced for backend access

### Recommended Implementation

**MVP Option A - Minimal (selection_mode only):**
```python
key_as_main_identity={"selection_mode"} if key else False
```
- Simplest implementation
- Preserves selections across ALL data changes
- Edge cases (orphaned indices) handled by documentation

**MVP Option B - With Row Count (Recommended):**
```python
key_as_main_identity={"selection_mode", "num_rows"} if key else False
```
- Slightly more complex
- Resets selections when row count changes (handles orphaned row indices)
- Preserves selections when only data values change (main use case)

**Future Enhancement:**
- Consider frontend cleanup (Option 3) based on user feedback

This approach:

- Preserves selection state across data/column config changes
- Resets state when selection mode changes (user expectation)
- Optionally resets when row count changes (if `num_rows` included)
- Maintains backward compatibility (only affects keyed dataframes with selections)
- Leverages existing frontend architecture (no additional complexity)
