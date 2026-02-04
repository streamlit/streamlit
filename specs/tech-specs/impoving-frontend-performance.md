# Improving Frontend Performance During Window Resizes

This document tracks performance investigations and optimizations for the Streamlit frontend, specifically during window resize operations.

## Baseline Measurements

**Test Configuration:**
- Dashboard: 15 Altair charts + 4 DataFrames + 11 Metrics with sparklines
- Viewport: 1400x900px
- Browser: Chromium (headless)

**Baseline Results (2026-02-04):**

| Phase | Duration | Notes |
|-------|----------|-------|
| Initial Load | 5339ms | 15 charts + 4 dataframes + 11 metrics |
| Standard Resize (5 steps) | 3348ms | ~670ms per step |
| Rapid Resize (21 steps) | 21498ms | ~1024ms per step |
| Extreme Resize (5 steps) | 5358ms | ~1072ms per step |
| Long Tasks | 0 | Good - no blocking detected |

**Detailed Resize Step Timings:**

| Step | Width | Time | Notes |
|------|-------|------|-------|
| 1 | 1200px | 208ms | Fast |
| 2 | 1000px | 976ms | Slow - possible recreation |
| 3 | 800px | 750ms | Slow |
| 4 | 1000px (back) | 1076ms | Slow |
| 5 | 1400px (original) | 337ms | Fast |

The variation (208ms vs 1076ms) suggests some resizes trigger expensive operations while others don't.

---

## Identified Issues

### Issue 1: Metric Component Chart Recreation (HIGH IMPACT)

**Location:** `frontend/lib/src/components/elements/Metric/Metric.tsx:307-338`

**Problem:** The Metric component recreates its Vega chart on every width change:

```typescript
// Line 261-262 - No debounce option
const { width: chartWidth, elementRef: chartContainerRef } =
    useCalculatedDimensions()  // Default debounceMs: 0

// Line 307-338 - Chart recreated when chartWidth changes
useEffect(() => {
  // ...
  void embed(chartRef.current, spec, {...})  // Full recreation
}, [chartData, color, theme, chartWidth, chartType, chartRef])
```

**Impact:**
- 11 metrics × full chart recreation per resize = significant overhead
- No debouncing means every ResizeObserver callback triggers recreation
- Unlike ArrowVegaLiteChart, doesn't use Vega's native resize API

**Potential Fix:**
1. Add debouncing: `useCalculatedDimensions([], { debounceMs: 50 })`
2. Use Vega's resize API instead of full recreation
3. Separate spec creation from dimension updates

### Issue 2: DataFrame Layout Effects Without Debouncing

**Location:** `frontend/lib/src/components/widgets/DataFrame/hooks/useTableSizer.ts`

**Problem:** Multiple `useLayoutEffect` hooks trigger on width/height changes:
- Line 246-255: Triggers on `availableWidth` change
- Line 258-263: Triggers on `initialWidth` change
- Line 267-278: Triggers on height changes

These cascade state updates during resize without debouncing.

**Impact:** 4 DataFrames × multiple layout effects = cascading updates

### Issue 3: Block Render Tree Traversal on Every Parent Re-render

**Location:** `frontend/lib/src/components/core/Block/Block.tsx` (`ChildRenderer`)

**Problem:** `RenderNodeVisitor.collectReactElements` and `assignDividerColor` run
on every `Block` render, even when the render tree data is unchanged. When window
resize triggers `AppView` re-renders (via `WindowDimensionsProvider`), the entire
tree is re-traversed, even though nodes and props are stable.

**Impact:** Large tree traversal work during resize, especially on dashboards with
many charts and widgets.

**Potential Fix:** Memoize `RenderNodeVisitor.collectReactElements` by props and
`assignDividerColor` by node/theme.

### Issue 4: Potential Spec Instability in Vega Charts

**Location:** `frontend/lib/src/components/elements/ArrowVegaLiteChart/ArrowVegaLiteChart.tsx`

**Observation:** The ArrowVegaLiteChart uses sophisticated optimization with `baseSpec` vs `spec` separation, but some resize widths still trigger slow paths (~750-1076ms vs ~200-340ms for fast paths).

**Hypothesis:** Crossing certain width thresholds may cause `baseSpec` changes (e.g., title limit recalculation, vconcat adjustments).

### Issue 5: Element/Block Renderers Re-render on Parent Updates

**Location:** `frontend/lib/src/components/core/Block/Block.tsx`, `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`

**Problem:** `BlockNodeRenderer` and `ElementNodeRenderer` are not memoized. When
their parents re-render (e.g., due to window resize or AppView updates), these
renderers re-run even when props are unchanged.

**Impact:** Extra render work during resize and initial render reconciliation.

**Potential Fix:** Wrap renderers with `React.memo` (context updates still flow).

### Review Notes: ButtonGroup / Flex Containers

**ButtonGroup:** Already wrapped in `memo` with `useMemo` for option elements and
`useCallback` for overrides. No resize-driven state updates observed.

**Flex containers:** `FlexContextProvider` already memoizes its context value;
primary resize costs came from render-tree traversal and renderer work (addressed).

---

## Optimization Experiments

### Experiment 1: Add Debouncing to Metric Component

**Change:** Add 50ms debounce to Metric's dimension observer

**File:** `frontend/lib/src/components/elements/Metric/Metric.tsx`

```typescript
// Before (line 261-262):
const { width: chartWidth, elementRef: chartContainerRef } =
    useCalculatedDimensions()

// After:
const { width: chartWidth, elementRef: chartContainerRef } =
    useCalculatedDimensions([], { debounceMs: 50 })
```

**Expected Impact:** Batch resize events for 11 metrics, reducing chart recreations

**Status:** APPLIED - MEASURED

---

### Experiment 2: Use Vega Resize API in Metric Component

**Change:** Store Vega view reference and use resize API instead of recreation

**Concept:**
```typescript
const viewRef = useRef<VegaView | null>(null)

// Create view once
useEffect(() => {
  if (chartData && chartRef.current && chartWidth > 0 && !viewRef.current) {
    const result = await embed(chartRef.current, spec, {...})
    viewRef.current = result.view
  }
}, [chartData, color, theme, chartType])

// Resize existing view
useEffect(() => {
  if (viewRef.current && chartWidth > 0) {
    viewRef.current.width(chartWidth).resize().runAsync()
  }
}, [chartWidth])
```

**Expected Impact:** ~10x faster resizes for metric charts (18ms vs 195ms per chart)

**Status:** APPLIED - MEASURED

---

### Experiment 3: Memoize Block Render Tree Traversal

**Change:** Memoize `RenderNodeVisitor.collectReactElements` and `assignDividerColor`
inside `ChildRenderer` to avoid re-traversing the render tree on resize when
props and nodes are unchanged.

**File:** `frontend/lib/src/components/core/Block/Block.tsx`

```typescript
const children = useMemo(() => {
  assignDividerColor(node, theme)
  return RenderNodeVisitor.collectReactElements({
    node,
    endpoints,
    widgetMgr,
    widgetsDisabled,
    uploadClient,
    disableFullscreenMode,
    componentRegistry,
  })
}, [node, theme, endpoints, widgetMgr, widgetsDisabled, uploadClient, disableFullscreenMode, componentRegistry])
```

**Expected Impact:** Reduce resize-time work by skipping full tree traversal on
parent re-renders (e.g., window resize updates).

**Status:** APPLIED - MEASURED

---

### Experiment 4: CSS Containment for Charts

**Change:** Add CSS `contain` property to isolate layout recalculations

**File:** `frontend/lib/src/components/elements/ArrowVegaLiteChart/styled-components.ts`

```typescript
export const StyledVegaLiteChartContainer = styled.div<{...}>`
  contain: layout style;  // Isolate from rest of document
  // ... existing styles
`
```

**Expected Impact:** Reduce layout thrashing during resize

**Status:** TESTED - REVERTED (regression)

---

### Experiment 5: Window Resize RAF Throttle (WindowDimensions)

**Change:** Throttle window resize updates to one per animation frame in
`useWindowDimensions`.

**File:** `frontend/lib/src/components/shared/WindowDimensions/useWindowDimensions.tsx`

**Expected Impact:** Reduce resize-triggered rerenders in AppView/Sidebar/Tooltips.

**Status:** TESTED - REVERTED (mixed results)

---

### Experiment 6: Debounce DataFrame Container Measurements

**Change:** Add 50ms debounce to `useCalculatedDimensions` in DataFrame.

**File:** `frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx`

**Expected Impact:** Reduce resize cascades from DataFrame size updates.

**Status:** TESTED - REVERTED (regression)

---

### Experiment 7: Memoize Block/Element Node Renderers

**Change:** Wrap `BlockNodeRenderer` and `ElementNodeRenderer` in `React.memo`.

**Files:** `frontend/lib/src/components/core/Block/Block.tsx`, `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`

**Expected Impact:** Reduce unnecessary renderer work on parent re-renders.

**Status:** APPLIED - MEASURED

---

## Test Results Log

### Test 1: Baseline (No Changes)
- **Date:** 2026-02-04
- **Results:** See "Baseline Measurements" above

### Test 2: Add Debouncing to Metric Component
- **Date:** 2026-02-04
- **Change:** Added `{ debounceMs: 50 }` to `useCalculatedDimensions` in Metric.tsx
- **File:** `frontend/lib/src/components/elements/Metric/Metric.tsx:261-262`

**Results:**

| Phase | Before | After | Improvement |
|-------|--------|-------|-------------|
| Initial Load | 5339ms | 6321ms | -18% (variance) |
| Standard Resize | 3348ms | 2489ms | **+26%** |
| Rapid Resize | 21498ms | 16075ms | **+25%** |
| Extreme Resize | 5358ms | 3545ms | **+34%** |
| Long Tasks | 0 | 0 | Same |

**Analysis:**
- Standard resize improved from ~670ms to ~498ms per step
- Rapid resize improved from ~1024ms to ~765ms per step
- The debounce successfully batches resize events for 11 metric charts
- Some variance in individual step times remains (742ms for 800px width vs 211ms for 1200px)

**Status:** APPLIED - All tests passing (48 Metric tests + 18 hook tests)

---

### Test 3: Baseline (Post-Metric Debounce, Pre-Block Memo)
- **Date:** 2026-02-04
- **Change:** None (baseline after Metric debounce landed)
- **Run:** `make debug work-tmp/complex_dashboard.py` + `measure_resize_performance.py`

**Results:**

| Phase | Result |
|-------|--------|
| Initial Load | 5023ms |
| Standard Resize | 2504ms |
| Rapid Resize | 12967ms |
| Extreme Resize | 3192ms |
| Long Tasks | 0 |

**Notes:** Initial load is likely influenced by cache/warm-start effects. Resize
durations are the primary comparison signal.

---

### Test 4: Memoize Block Render Tree Traversal
- **Date:** 2026-02-04
- **Change:** Memoize `RenderNodeVisitor.collectReactElements` in `ChildRenderer`
- **File:** `frontend/lib/src/components/core/Block/Block.tsx`

**Results:**

| Phase | Before | After | Improvement |
|-------|--------|-------|-------------|
| Standard Resize | 2504ms | 2256ms | **+10%** |
| Rapid Resize | 12967ms | 6524ms | **+50%** |
| Extreme Resize | 3192ms | 2996ms | **+6%** |
| Long Tasks | 0 | 0 | Same |

**Analysis:**
- Rapid resize time roughly halved, consistent with eliminating repeated tree traversal.
- Standard/extreme resizes improved modestly, likely limited by chart resizing work.

**Status:** APPLIED - MEASURED

---

### Test 5: WindowDimensions RAF Throttle (Reverted)
- **Date:** 2026-02-04
- **Change:** Throttle resize updates to one per animation frame
- **File:** `frontend/lib/src/components/shared/WindowDimensions/useWindowDimensions.tsx`

**Results:**

| Phase | Before | After | Delta |
|-------|--------|-------|-------|
| Standard Resize | 2256ms | 2178ms | -78ms |
| Rapid Resize | 6524ms | 7182ms | +658ms |
| Extreme Resize | 2996ms | 2492ms | -504ms |
| Long Tasks | 0 | 0 | Same |

**Analysis:**
- Mixed results (rapid resize regressed).
- Possible behavior risk on initial paint (one-frame delay), so reverted.

**Status:** REVERTED

---

### Test 6: DataFrame Dimension Debounce (Reverted)
- **Date:** 2026-02-04
- **Change:** `useCalculatedDimensions([], { debounceMs: 50 })` in DataFrame
- **File:** `frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx`

**Results:**

| Phase | Before | After | Delta |
|-------|--------|-------|-------|
| Standard Resize | 2178ms | 2466ms | +288ms |
| Rapid Resize | 7182ms | 9101ms | +1919ms |
| Extreme Resize | 2492ms | 2622ms | +130ms |
| Long Tasks | 0 | 0 | Same |

**Analysis:** Clear regression in resize performance; reverted.

**Status:** REVERTED

---

### Test 7: Memoize Block/Element Node Renderers
- **Date:** 2026-02-04
- **Change:** Wrap `BlockNodeRenderer` and `ElementNodeRenderer` in `React.memo`
- **Files:** `frontend/lib/src/components/core/Block/Block.tsx`, `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`

**Results:**

| Phase | Result |
|-------|--------|
| Initial Load | 2556ms |
| Standard Resize | 2361ms |
| Rapid Resize | 6183ms |
| Extreme Resize | 2434ms |
| Long Tasks | 0 |

**Analysis:**
- Rapid resize improved vs post-block-memo baseline (6524ms → 6183ms).
- Standard resize slightly worse, but extreme resize improved.
- Net positive for rapid resize; kept.

**Status:** APPLIED - MEASURED

---

### Test 8: CSS Containment for Vega Charts (Reverted)
- **Date:** 2026-02-04
- **Change:** Add `contain: layout style` to Vega chart container
- **File:** `frontend/lib/src/components/elements/ArrowVegaLiteChart/styled-components.ts`

**Results:**

| Phase | Result |
|-------|--------|
| Initial Load | 2611ms |
| Standard Resize | 2522ms |
| Rapid Resize | 6556ms |
| Extreme Resize | 2997ms |
| Long Tasks | 0 |

**Analysis:** Mixed/negative compared to the prior baseline (rapid resize slower),
so reverted to avoid risk.

**Status:** REVERTED

---

### Test 9: Metric Vega Resize API (Final)
- **Date:** 2026-02-04
- **Change:** Reuse Vega view and resize instead of re-embed per width change
- **File:** `frontend/lib/src/components/elements/Metric/Metric.tsx`

**Results:**

| Phase | Result (2 runs) |
|-------|-----------------|
| Initial Load | 2269ms / 2292ms |
| Standard Resize | 2157ms / 2171ms |
| Rapid Resize | 6610ms / 6320ms |
| Extreme Resize | 2359ms / 2354ms |
| Long Tasks | 0 / 0 |

**Analysis:** Results are in the same ballpark as the prior baseline; variance is visible
between runs. Further averaging is recommended for high-confidence deltas.

**Status:** APPLIED - MEASURED

---

## Larger Refactoring Suggestions (Not Implemented)

### Suggestion A: Shared Vega View Pool

Create a centralized pool of Vega views that can be resized together:

```typescript
// Concept: BatchResizeManager
class VegaViewManager {
  private views: Map<string, VegaView> = new Map()

  register(id: string, view: VegaView): void { ... }

  batchResize(width: number): Promise<void> {
    // Resize all views in single RAF
    return new Promise(resolve => {
      requestAnimationFrame(async () => {
        for (const view of this.views.values()) {
          view.width(width)
        }
        // Single resize/run for all
        await Promise.all([...this.views.values()].map(v => v.resize().runAsync()))
        resolve()
      })
    })
  }
}
```

### Suggestion B: Virtual Rendering for Many Charts

For dashboards with 10+ charts, implement virtualization:
- Only render charts in viewport
- Use placeholder divs for off-screen charts
- Render on scroll/viewport intersection

### Suggestion C: Debounce at Window Level

Instead of per-component debouncing, implement window-level resize batching:

```typescript
// WindowDimensionsProvider could batch all resize updates
const debouncedDimensions = useDebouncedValue(dimensions, 50)
```

---

## Summary

### Applied Optimizations

**1. Metric Component Debouncing (IMPLEMENTED)**
- File: `frontend/lib/src/components/elements/Metric/Metric.tsx`
- Change: Added `{ debounceMs: 50 }` to `useCalculatedDimensions`
- Impact: **25-34% improvement** in resize performance
- Tests: All passing (48 Metric tests + 18 hook tests)

**2. Block Render Tree Memoization (IMPLEMENTED)**
- File: `frontend/lib/src/components/core/Block/Block.tsx`
- Change: Memoize `RenderNodeVisitor.collectReactElements` and divider color assignment
- Impact: **~50% faster** rapid resize on the complex dashboard
- Tests: Local resize benchmark (see Test 4)

**3. Block/Element Renderer Memoization (IMPLEMENTED)**
- Files: `frontend/lib/src/components/core/Block/Block.tsx`, `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`
- Change: Wrap renderers with `React.memo`
- Impact: **~5% faster** rapid resize vs post-block-memo baseline
- Tests: Local resize benchmark (see Test 7)

**4. Metric Vega Resize API (IMPLEMENTED)**
- File: `frontend/lib/src/components/elements/Metric/Metric.tsx`
- Change: Reuse Vega view and call resize API on width changes
- Impact: Similar to baseline in 2 runs; benefits may require more samples to confirm
- Tests: Local resize benchmark (see Test 9)

### Remaining Quick Wins (Low Risk)
1. ~~Add debouncing to Metric component~~ ✓ DONE
2. Consider window-level resize batching (needs validation)

### Reverted Experiments
1. WindowDimensions RAF throttle (mixed results, potential behavior risk)
2. DataFrame debounce (clear resize regression)
3. CSS containment for Vega charts (regressed)

### Medium Effort (TO DO)
1. Review DataFrame resize handling (multiple useLayoutEffect triggers)

### Large Refactoring Suggestions
1. Shared Vega view management (batch resize all charts together)
2. Virtual rendering for dashboards with 10+ charts
3. Window-level resize batching (single debounce for all components)

### Performance Results Summary

| Metric | Post-Metric Debounce | Post-Block Memo | Post-Renderer Memo | Post-Metric Resize (avg 2 runs) |
|--------|----------------------|-----------------|--------------------|---------------------------------|
| Standard Resize (5 steps) | 2504ms | 2256ms | 2361ms | ~2164ms |
| Rapid Resize (21 steps) | 12967ms | 6524ms | 6183ms | ~6465ms |
| Extreme Resize (5 steps) | 3192ms | 2996ms | 2434ms | ~2356ms |

**Note:** Initial load timings vary with caching; resize metrics are the primary
comparison signal for these experiments.
