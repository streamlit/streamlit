# Investigation: Plotly Chart Selection Issues

This document summarizes an investigation into multiple GitHub issues related to `st.plotly_chart` selection functionality.

## Issues Investigated

1. **Issue #9001**: Treemap charts don't emit selection events
2. **Issue #8760**: Heatmap/imshow charts don't emit selection events
3. **Issue #8766**: Subplot integration issues with selection (visual bugs with hovermode)
4. **Issue #8933**: Sankey diagrams don't emit selection events

## Root Cause Analysis

### Current Implementation

Streamlit's `plotly_chart` selection feature uses Plotly's `onSelected` event handler (`plotly_selected` in Plotly.js terms):

```tsx
// PlotlyChart.tsx line 472
onSelected={isSelectionActivated ? handleSelectionCallback : () => {}}
```

This event only fires when:
1. Box selection (`dragmode="select"`)
2. Lasso selection (`dragmode="lasso"`)
3. Point click when `clickmode="event+select"`

### Problem: Chart Type Limitations

**`plotly_selected` is designed for cartesian (2D) charts with x/y axes.** Chart types that don't use traditional x/y coordinate systems do NOT emit `plotly_selected` events.

## Event Support Testing Results

Through debugging with `onClick` handler and console.log, I discovered the actual event support:

| Chart Type | `plotly_selected` | `plotly_click` | `onHover` | Visual Behavior |
|------------|-------------------|----------------|-----------|-----------------|
| Scatter    | ✅ Works          | ✅ Works       | ✅ Works  | True selection (highlight persists) |
| Line       | ✅ Works          | ✅ Works       | ✅ Works  | True selection (highlight persists) |
| Bar        | ✅ Works          | ✅ Works       | ✅ Works  | True selection (highlight persists) |
| Histogram  | ✅ Works          | ✅ Works       | ✅ Works  | True selection (highlight persists) |
| **Treemap** | ❌ No            | ✅ Works       | ✅ Works  | Drill-down (persists until changed) |
| **Sunburst** | ❌ No           | ✅ Works       | ✅ Works  | Drill-down (persists until changed) |
| **Heatmap/imshow** | ❌ No    | ❌ No          | ✅ Works  | No click events at all |
| **Sankey** | ❌ No             | ❌ No          | ✅ Works  | No click events at all |

## Implementation: Treemap & Sunburst Support

Since treemap/sunburst drill-down state **persists until the user changes it**, we added support via the existing selection mechanism.

### Changes Made

**1. `frontend/lib/src/components/elements/PlotlyChart/utils.ts`** - Added `handleClickEvent` function:

```typescript
export function handleClickEvent(
  event: Readonly<Plotly.PlotMouseEvent>,
  widgetMgr: WidgetStateManager,
  element: PlotlyChartProto,
  fragmentId: string | undefined
): void {
  if (!event?.points?.length) return;

  const point = event.points[0] as any;

  // Check if this is a hierarchical chart click (treemap/sunburst)
  if (point.id === undefined || point.parent === undefined) {
    return;  // Not a treemap/sunburst click
  }

  const selectionState: PlotlyWidgetState = {
    selection: {
      points: [keysToSnakeCase({
        label: point.label,
        id: point.id,
        parent: point.parent,
        value: point.value,
        currentPath: point.currentPath,
        percentRoot: point.percentRoot,
        percentEntry: point.percentEntry,
        percentParent: point.percentParent,
        pointNumber: point.pointNumber,
        curveNumber: point.curveNumber,
      })],
      point_indices: notNullOrUndefined(point.pointNumber) ? [point.pointNumber] : [],
      box: [],
      lasso: [],
    },
  };

  // Send to backend via existing widget state mechanism
  widgetMgr.setStringValue(element, JSON.stringify(selectionState), { fromUi: true }, fragmentId);
}
```

**2. `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx`** - Added onClick handler:

```typescript
// New callback for click events
const handleClickCallback = useCallback(
  (event: Readonly<Plotly.PlotMouseEvent>): void => {
    handleClickEvent(event, widgetMgr, element, fragmentId)
  },
  [element.id, widgetMgr, fragmentId]
)

// Added to Plot component
<Plot
  ...
  onClick={isSelectionActivated ? handleClickCallback : undefined}
  ...
/>
```

### Selection Data Returned

When clicking on a treemap/sunburst segment, the selection state includes:

```python
{
    "selection": {
        "points": [{
            "label": "China",
            "id": "Asia/China",
            "parent": "Asia",
            "value": 1318683096,
            "current_path": "/Asia/",
            "percent_root": 0.21,
            "percent_parent": 0.35,
            "point_number": 25,
            "curve_number": 0
        }],
        "point_indices": [25],
        "box": [],
        "lasso": []
    }
}
```

### Verification

- ✅ Frontend lint passes
- ✅ Frontend type check passes
- ✅ All 53 PlotlyChart unit tests pass (6 new tests for `handleClickEvent`)
- ✅ E2E tests pass for treemap and sunburst selection
- ✅ Existing E2E tests still pass

## Summary of Issue Status

| Issue | Chart Type | Status | Notes |
|-------|------------|--------|-------|
| #9001 | Treemap | **Fixed** | Selection via `onClick` handler |
| (similar) | Sunburst | **Fixed** | Selection via `onClick` handler |
| #8760 | Heatmap | **Cannot fix** | No click events (Plotly.js limitation) |
| #8933 | Sankey | **Cannot fix** | No click events (Plotly.js limitation) |
| #8766 | Subplots | **Not addressed** | Complex Plotly.js limitation |

## Files Modified

- `frontend/lib/src/components/elements/PlotlyChart/utils.ts` - Added `handleClickEvent` function
- `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx` - Added onClick handler and callback
- `frontend/lib/src/components/elements/PlotlyChart/utils.test.ts` - Added 6 unit tests for `handleClickEvent`
- `e2e_playwright/st_plotly_chart_select.py` - Added treemap and sunburst charts for testing
- `e2e_playwright/st_plotly_chart_select_test.py` - Added 2 E2E tests for treemap/sunburst selection
