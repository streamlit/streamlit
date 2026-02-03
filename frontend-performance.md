# Streamlit Frontend Performance Analysis

This document analyzes potential performance improvements in the Streamlit frontend codebase, identifying patterns that could cause unnecessary re-renders, slow operations, and areas with optimization potential.

## Executive Summary

| Category | Priority | Estimated Impact | Effort |
|----------|----------|------------------|--------|
| [Window Resize Debouncing](#1-window-resize-handling-not-debounced) | High | High | Low |
| [PlotlyChart Render-time State Update](#2-plotlychart-state-update-during-render) | High | Medium | Medium |
| [JSON Parsing in Render Paths](#3-json-parsing-in-render-functions) | Medium | Medium | Low |
| [Missing React.memo on Core Components](#4-missing-reactmemo-on-core-renderers) | Medium | Medium | Low |
| [GraphVizChart Resize Recreation](#5-graphvizchart-full-recreation-on-resize) | Medium | Medium | Medium |
| [Context Propagation Patterns](#6-context-change-cascading-re-renders) | Low | Low | Medium |
| [List Rendering Keys](#7-list-rendering-with-array-index-keys) | Low | Low | Low |

---

## Detailed Findings

### 1. Window Resize Handling Not Debounced

**File:** `frontend/lib/src/components/shared/WindowDimensions/useWindowDimensions.tsx:57-63`

**Issue:** The `useWindowDimensions` hook adds a window resize listener without debouncing, causing updates on every resize event (can be 60+ events per second during window drag).

```typescript
// Current implementation - no debouncing
useEffect(() => {
  window.addEventListener("resize", updateWindowDimensions)
  return () => {
    window.removeEventListener("resize", updateWindowDimensions)
  }
}, [updateWindowDimensions])
```

**Impact:**
- All components using this hook re-render on every resize frame
- Used by fullscreen components and layout calculations
- Can cause jank during window resizing

**Recommended Fix:**
Add debouncing similar to what was done for `useResizeObserver`:

```typescript
useEffect(() => {
  let timeoutId: ReturnType<typeof setTimeout>
  const debouncedUpdate = (): void => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(updateWindowDimensions, 100) // 100ms debounce
  }
  window.addEventListener("resize", debouncedUpdate)
  return () => {
    window.removeEventListener("resize", debouncedUpdate)
    clearTimeout(timeoutId)
  }
}, [updateWindowDimensions])
```

**Estimated Improvement:** Reduces resize-triggered renders by ~90% during window drag operations.

---

### 2. PlotlyChart State Update During Render

**File:** `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx:318-333`

**Issue:** `setPlotlyFigure` is called directly during render (not in useEffect), which can cause extra render cycles and potential infinite loops.

```typescript
// Current - state update during render
if (
  plotlyFigure.layout.height !== calculatedHeight ||
  plotlyFigure.layout.width !== calculatedWidth
) {
  setPlotlyFigure((prevFigure: PlotlyFigureType) => {
    return {
      ...prevFigure,
      layout: {
        ...prevFigure.layout,
        height: calculatedHeight,
        width: calculatedWidth,
      },
    }
  })
}
```

**Impact:**
- Triggers an additional render cycle every time dimensions change
- Can cause cascading updates when combined with resize observers
- React's strict mode will cause this to run twice

**Recommended Fix:**
Move dimension updates to a useEffect:

```typescript
useEffect(() => {
  if (
    plotlyFigure.layout.height !== calculatedHeight ||
    plotlyFigure.layout.width !== calculatedWidth
  ) {
    setPlotlyFigure((prevFigure: PlotlyFigureType) => ({
      ...prevFigure,
      layout: {
        ...prevFigure.layout,
        height: calculatedHeight,
        width: calculatedWidth,
      },
    }))
  }
}, [calculatedHeight, calculatedWidth])
```

**Estimated Improvement:** Eliminates duplicate render cycles on dimension changes.

---

### 2b. PlotlyChart Deep-Dive: Additional Performance Issues

**Files:** `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx`, `utils.ts`, `CustomTheme.tsx`

A deeper analysis of PlotlyChart reveals several additional performance optimization opportunities:

#### Issue 1: Not Using react-plotly.js's Built-in Resize Handler

**Location:** Component-wide

react-plotly.js provides a `useResizeHandler` prop that automatically handles window resize events by calling `Plotly.Plots.resize()` instead of re-rendering. This is significantly more efficient.

```typescript
// Current approach - manual state management for resize
// Causes full re-render on dimension changes

// Recommended approach - use built-in resize handler
<Plot
  // ... other props
  useResizeHandler={true}
  style={{ width: "100%", height: "100%" }}
  // Don't set layout.width/height - let Plotly handle it
/>
```

**Impact:** Could eliminate most resize-related re-renders entirely.

#### Issue 2: onUpdate Callback Triggers Re-renders on Every Plotly Interaction

**Location:** `PlotlyChart.tsx:493-497`

```typescript
onUpdate={figure => {
  widgetMgr.setElementState(element.id, "figure", figure)
  setPlotlyFigure(figure)  // <- Triggers React re-render
}}
```

Plotly calls `onUpdate` frequently during interactions (hover, zoom, pan, etc.). Each call to `setPlotlyFigure` triggers a React re-render, even for internal Plotly state changes.

**Recommended Fix:**
Only update state when necessary, or debounce the callback:

```typescript
const handleUpdate = useCallback((figure: PlotlyFigureType) => {
  widgetMgr.setElementState(element.id, "figure", figure)
  // Only update React state if we actually need to re-render
  // Plotly manages its own internal state
}, [widgetMgr, element.id])
```

**Impact:** Could reduce re-renders by 50-90% during chart interactions.

#### Issue 3: Expensive `applyTheming` Function

**Location:** `utils.ts:145-160`

```typescript
export function applyTheming(
  plotlyFigure: PlotlyFigureType,
  chartTheme: string,
  theme: EmotionTheme
): PlotlyFigureType {
  const spec = JSON.parse(
    replaceTemporaryColors(JSON.stringify(plotlyFigure), theme, chartTheme)
  )
  // ...
}
```

This function:
1. Stringifies the entire figure object
2. Does multiple `replaceAll` operations on the string
3. Parses it back to JSON

Called on theme changes, this is expensive for large charts.

**Recommended Fix:**
Perform color replacements directly on the object instead of via string manipulation, or cache the themed result:

```typescript
const themedFigure = useMemo(() => {
  return applyTheming(initialFigureSpec, element.theme, theme)
}, [initialFigureSpec, element.theme, theme])
```

#### Issue 4: plotlyConfig Recreated on Fullscreen Toggle

**Location:** `PlotlyChart.tsx:138-206`

The `plotlyConfig` useMemo includes `isFullScreen`, `expand`, and `collapse` as dependencies, causing config recreation on every fullscreen state change. The fullscreen button handlers create new function references.

```typescript
// Current - config changes when fullscreen toggles
const plotlyConfig = useMemo(() => {
  // ...
  config.modeBarButtonsToAdd = [{
    click: () => {
      if (isFullScreen && collapse) {  // <- closure over isFullScreen
        collapse()
      } else if (expand) {
        expand()
      }
    },
  }]
}, [isFullScreen, expand, collapse, ...])  // <- deps cause recreation
```

**Recommended Fix:**
Use refs for fullscreen state in the click handler:

```typescript
const isFullScreenRef = useRef(isFullScreen)
isFullScreenRef.current = isFullScreen

const plotlyConfig = useMemo(() => {
  // ...
  click: () => {
    if (isFullScreenRef.current && collapse) {
      collapse()
    } else if (expand) {
      expand()
    }
  }
}, [element.config, expand, collapse, ...])  // Remove isFullScreen dep
```

#### Issue 5: No Debouncing on Dimension Calculations

**Location:** `PlotlyChart.tsx:96-97`

```typescript
const { height: chartContainerHeight, elementRef: containerRef } =
  useCalculatedDimensions([], { fallbackValue: 0 })
```

Unlike VegaLiteChart which uses 50-100ms debounce, PlotlyChart uses default settings (no debounce).

**Recommended Fix:**
```typescript
const { height: chartContainerHeight, elementRef: containerRef } =
  useCalculatedDimensions([], { fallbackValue: 0, debounceMs: 50 })
```

#### Issue 6: Multiple setPlotlyFigure Calls Cause Cascade

The component has 6+ places that call `setPlotlyFigure`:
- Line 210: Theme change effect
- Line 263: Selection mode effect
- Line 323: Dimension change (during render!)
- Line 363: Selection reset timeout
- Line 438: Dragmode effect
- Line 496: onUpdate callback

Each call triggers a re-render, and some can trigger others in a cascade.

**Recommended Fix:**
Consider consolidating state updates using a reducer pattern or batching updates:

```typescript
const [plotlyState, dispatch] = useReducer(plotlyReducer, initialState)
// Single source of state updates, easier to batch and optimize
```

#### Summary: PlotlyChart Optimization Potential

| Issue | Current Impact | Fix Complexity | Potential Improvement |
|-------|---------------|----------------|----------------------|
| Missing useResizeHandler | High | Low | ~10x faster resize |
| onUpdate re-renders | Medium-High | Medium | 50-90% fewer interaction renders |
| applyTheming cost | Medium | Medium | Faster theme switches |
| Config recreation | Low-Medium | Low | Fewer fullscreen re-renders |
| No dimension debounce | Medium | Low | Smoother resize |
| State update cascade | Medium | High | Cleaner update flow |

**Recommended Implementation Order:**
1. Add `debounceMs: 50` to useCalculatedDimensions (5 min)
2. Move dimension state update to useEffect (15 min)
3. Remove `setPlotlyFigure` from onUpdate callback (30 min, needs testing)
4. Investigate useResizeHandler + autosize mode (2-4 hours, significant refactor)

---

### 3. JSON Parsing in Render Functions

**File:** `frontend/lib/src/components/elements/Json/Json.tsx:54-69`

**Issue:** JSON parsing happens directly in the render function without memoization, causing re-parsing on every render.

```typescript
// Current - parsing on every render
let bodyObject
try {
  bodyObject = JSON.parse(element.body)
} catch (e) {
  // ...
}
```

**Impact:**
- For large JSON objects, this can be expensive
- Re-parses the same JSON on every parent re-render
- Increases garbage collection pressure

**Recommended Fix:**
Wrap in useMemo:

```typescript
const bodyObject = useMemo(() => {
  try {
    return JSON.parse(element.body)
  } catch (e) {
    try {
      return JSON5.parse(element.body)
    } catch {
      return { error: e }
    }
  }
}, [element.body])
```

**Other JSON parsing locations that are properly memoized:**
- `PlotlyChart.tsx:102-114` - Uses useMemo (good)
- `PlotlyChart.tsx:138-206` - Uses useMemo (good)
- `ArrowVegaLiteChart.tsx` - Uses useMemo (good)

**Estimated Improvement:** Variable based on JSON size; eliminates redundant parsing.

---

### 4. Missing React.memo on Core Renderers

**File:** `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx:727-786`

**Issue:** `ElementNodeRenderer` and `BlockNodeRenderer` are not wrapped in `React.memo`, meaning they re-render whenever parent components update, even if their props haven't changed.

```typescript
// Current - no memoization
const ElementNodeRenderer = (
  props: ElementNodeRendererProps
): ReactElement => {
  // ... renders all elements
}
export default ElementNodeRenderer
```

**Impact:**
- Every element re-renders when ScriptRunContext changes
- Can cause cascading re-renders across the entire app tree
- Particularly impactful during script execution state changes

**Components that ARE properly memoized:**
- `DataFrame.tsx` - `memo(DataFrameWithFullscreen)` (good)
- `StreamlitMarkdown.tsx` - `memo(StreamlitMarkdown)` (good)
- `PlotlyChart.tsx` - `memo(PlotlyChartWithFullScreenWrapper)` (good)
- `DeckGlJsonChart.tsx` - `memo(DeckGlJsonChartWrapped)` (good)
- `ImageList.tsx` - `memo(ImageListWithFullScreen)` (good)
- `Json.tsx` - `memo(Json)` (good)

**Components that could benefit from memo:**
- `ElementNodeRenderer`
- `BlockNodeRenderer`
- `RawElementNodeRenderer`
- Various widget inner components

**Recommended Fix:**
```typescript
export default memo(ElementNodeRenderer)
```

**Note:** Need to ensure props are stable (using useCallback for callbacks, useMemo for objects).

**Estimated Improvement:** Could significantly reduce re-renders in apps with many elements.

---

### 5. GraphVizChart Full Recreation on Resize

**File:** `frontend/lib/src/components/elements/GraphVizChart/GraphVizChart.tsx:76-105`

**Issue:** Unlike the optimized VegaLiteChart, GraphVizChart recreates the entire chart on every dimension change.

```typescript
useEffect(() => {
  try {
    const graphvizInstance = graphviz(`#${chartId}`).zoom(false)
    // ... recreates entire chart
    graphvizInstance
      .fit(true)
      .scale(1)
      .engine(element.engine as Engine)
      .renderDot(element.spec)
  } catch (error) {
    LOG.error(error)
  }
}, [
  chartId,
  element.engine,
  element.spec,
  containerWidth,   // <- triggers on every resize
  containerHeight,  // <- triggers on every resize
  isFullScreen,
  heightConfig?.useStretch,
])
```

**Impact:**
- Full chart re-render on every dimension change
- Potentially expensive for complex graphs
- Similar to the pre-optimization VegaLiteChart behavior

**Recommended Fix:**
Apply similar optimization as VegaLiteChart:
1. Separate spec-based recreation from dimension updates
2. Use d3-graphviz's sizing methods for resize-only updates
3. Add debouncing to dimension calculations

**Estimated Improvement:** Similar to VegaLiteChart (~10x faster resize operations).

---

### 6. Context Change Cascading Re-renders

**Files:** Multiple context providers in `frontend/lib/src/components/core/`

**Issue:** Some contexts contain values that change frequently, potentially causing unnecessary re-renders of all consumers.

**Key Contexts:**
- `ScriptRunContext` - Changes on every script run state change
- `FlexContext` - Changes based on layout hierarchy
- `ElementFullscreenContext` - Changes on dimension updates

**Pattern to watch:**
```typescript
// If context value changes on every render, all consumers re-render
const value = {
  scriptRunState,
  scriptRunId,
  fragmentIdsThisRun,  // <- array reference changes
}
```

**Mitigation Strategies:**
1. Use `useMemo` for context values (most contexts already do this - good)
2. Split contexts into static and dynamic portions
3. Use React.memo on consumer components
4. Consider using `useContextSelector` pattern for fine-grained updates

**Most contexts are well-implemented with useMemo:**
- `FlexContext.tsx:85-116` - Uses useMemo (good)
- `ElementFullscreenWrapper.tsx:35-43` - Uses useMemo (good)

---

### 7. List Rendering with Array Index Keys

**File:** `frontend/lib/src/components/elements/ImageList/ImageList.tsx:199-213`

**Issue:** Using array index as key can cause unnecessary DOM updates when list order changes.

```typescript
{element.imgs.map(
  (iimage, idx): ReactElement => (
    <Image
      key={idx}  // <- array index as key
      // ...
    />
  )
)}
```

**Impact:**
- If images are reordered, React will re-mount components instead of moving them
- Minor performance impact for most use cases
- Can cause visual glitches with animated content

**Recommended Fix:**
Use a stable identifier from the image data:

```typescript
key={iimage.url || idx}  // Use URL as key when available
```

---

### 8. StreamlitMarkdown Component Analysis

**Files:** `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`, `utils.ts`

**Status:** Well-optimized - minimal improvement opportunities

The StreamlitMarkdown component has already been significantly optimized. It serves as a **good example** of React performance patterns.

#### Positive Patterns Already Implemented

1. **Component Memoization**
   - Both `StreamlitMarkdown` and `RenderedMarkdown` wrapped in `memo()`
   - Prevents re-renders when parent updates but props unchanged

2. **Extensive `useMemo` Usage**
   ```typescript
   // Plugin lists, renderers, and processed source are all memoized
   const remarkPlugins = useMemo<PluggableList>(() => [...], [theme, colorMapping, ...])
   const rehypePlugins = useMemo<PluggableList>(() => [...], [allowHTML, needsKatex, ...])
   const renderers = useMemo(() => ({...}), [overrideComponents])
   const processedSource = useMemo(() => source.replaceAll(...), [source])
   ```

3. **Lazy Plugin Loading with Module-Level Caching**
   ```typescript
   // utils.ts - Module-level cache shared across all instances
   const pluginCache: Record<PluginKey, PluginState<AnyPlugin>> = {
     katex: null, raw: null, emoji: null
   }

   // Plugins only loaded when needed (detected via regex)
   const needsKatex = useMemo(() => containsMathSyntax(source), [source])
   const needsEmoji = useMemo(() => containsEmojiShortcodes(source), [source])
   ```

4. **Static Constants Outside Component**
   ```typescript
   // BASE_RENDERERS and BASE_REMARK_PLUGINS are constant objects
   // defined at module level - never recreated
   const BASE_RENDERERS = { pre: CustomPreTag, code: CustomCodeTag, ... }
   const BASE_REMARK_PLUGINS = [remarkMathPlugin, remarkGfm, ...]
   ```

5. **Shared In-Flight Promise Prevention**
   ```typescript
   // Multiple components needing same plugin share the loading promise
   const existingPromise = loadingPromises[key]
   if (existingPromise) { /* reuse it */ }
   ```

#### Minor Improvement Opportunities

1. **Plugin Factory Functions on Theme Change**

   **Location:** `StreamlitMarkdown.tsx:997-998`

   ```typescript
   const remarkPlugins = useMemo<PluggableList>(() => {
     const plugins: PluggableList = [
       ...BASE_REMARK_PLUGINS,
       createRemarkColoringAndSmall(theme, colorMapping),  // New fn each time
       createRemarkMaterialIcons(theme),  // New fn each time
     ]
   }, [theme, colorMapping, ...])
   ```

   These factory functions create new plugin functions on each theme change. Since theme changes are infrequent (dark/light mode toggle), impact is minimal.

   **Potential Fix:** Memoize individual plugin factories:
   ```typescript
   const coloringPlugin = useMemo(
     () => createRemarkColoringAndSmall(theme, colorMapping),
     [theme, colorMapping]
   )
   ```

2. **ReactMarkdown Parsing Cost**

   For very large markdown documents, the parsing and AST transformation is expensive. Each `source` change triggers full re-parsing.

   **Potential Fix (Complex):** Implement markdown AST caching for repeated renders with same source. However, this adds significant complexity for marginal benefit in typical use cases.

3. **`createAnchorFromText` with xxhash Fallback**

   **Location:** `StreamlitMarkdown.tsx:231-248`

   For headings that can't be slugified (e.g., emoji-only headings), falls back to xxhash computation. Called via ref callback on heading render.

   **Impact:** Minimal - only affects edge cases with non-slugifiable headings.

#### Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Component memoization | Optimized | Both layers use `memo()` |
| Hook dependencies | Optimized | Proper `useMemo`/`useCallback` usage |
| Plugin loading | Optimized | Lazy + module-level cache |
| Static data | Optimized | Constants at module level |
| Re-render prevention | Optimized | Props properly memoized |

**Recommendation:** No immediate action needed. StreamlitMarkdown is a model for how other components should be structured. Use it as a reference when optimizing other components.

---

### 9. DataFrame Component Analysis

**Files:** `frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx`, `hooks/*.ts`

**Status:** Well-optimized with minor improvement opportunities

The DataFrame component uses the glide-data-grid library which provides built-in virtualization for large datasets. The component structure with many custom hooks shows good separation of concerns.

#### Positive Patterns Already Implemented

1. **Component Memoization**
   ```typescript
   const DataFrameWithFullscreen = withFullScreenWrapper(DataFrame)
   export default memo(DataFrameWithFullscreen)
   ```

2. **Virtualized Rendering via glide-data-grid**
   - Built-in row/column virtualization handles large datasets efficiently
   - Only visible cells are rendered
   - LARGE_TABLE_ROWS_THRESHOLD (150,000) triggers additional optimizations

3. **Custom Hooks with Proper Memoization**
   - `useCustomTheme` - Theme fully memoized
   - `useDataLoader` - `getCellContent` wrapped in `useCallback`
   - `useTableSizer` - Size calculations extracted to separate hook
   - `useDebouncedCallback` - Selection state syncing is debounced

4. **Extensive useCallback Usage**
   ```typescript
   const handleToggleColumnVisibilityMenu = useCallback(...)
   const handleCloseColumnVisibilityMenu = useCallback(...)
   const refreshCells = useCallback(...)
   const configureColumnMenu = useCallback(...)
   const getEmptyStateContent = useCallback(...)
   const onFormCleared = useCallback(...)
   ```

5. **Large Table Optimizations**
   ```typescript
   const isLargeTable = originalNumRows > LARGE_TABLE_ROWS_THRESHOLD
   // Sorting disabled for large tables
   // Select-all disabled for large tables
   // CSV export disabled for large tables
   ```

#### Minor Improvement Opportunities

1. **`useCalculatedDimensions` Without Debounce**

   **Location:** `DataFrame.tsx:153-156`

   ```typescript
   const {
     height: measuredContainerHeight,
     elementRef: resizableContainerRef,
   } = useCalculatedDimensions()  // No debounce option
   ```

   Unlike charts that use debouncing, DataFrame doesn't debounce dimension calculations.

   **Potential Fix:**
   ```typescript
   const {
     height: measuredContainerHeight,
     elementRef: resizableContainerRef,
   } = useCalculatedDimensions([], { debounceMs: 50 })
   ```

   **Impact:** Low - glide-data-grid handles resize efficiently internally.

2. **Scroll Detection Effect Runs Frequently**

   **Location:** `DataFrame.tsx:513-557`

   ```typescript
   useEffect(() => {
     const rafId = requestAnimationFrame(() => {
       timeoutId = setTimeout(() => {
         // Multiple getBoundingClientRect() calls (forced reflow)
         const scrollAreaBounds = resizableContainerRef.current
           ?.querySelector(".dvn-stack")
           ?.getBoundingClientRect()
         // ...
         setHasVerticalScroll(...)
         setHasHorizontalScroll(...)
       }, 0)
     })
     // ...
   }, [resizableSize, numRows, glideColumns, resizableContainerRef])
   ```

   This effect runs on every size/row/column change and performs DOM measurements.

   **Impact:** Low-Medium - The `requestAnimationFrame` + `setTimeout` pattern provides some protection, but multiple state updates could be batched.

   **Potential Fix:** Combine `hasVerticalScroll` and `hasHorizontalScroll` into a single state object to reduce render cycles.

3. **useTableSizer Hook Dependencies**

   **Location:** `hooks/useTableSizer.ts:18`

   ```typescript
   /* eslint-disable react-hooks/exhaustive-deps -- TODO: Update to match React best practices */
   ```

   The suppressed lint rule suggests potential dependency issues that could cause unexpected behavior or stale closures.

   **Recommendation:** Audit and fix the exhaustive-deps warnings.

4. **Multiple Conditional Spreads in GlideDataEditor Props**

   **Location:** `DataFrame.tsx:945-1022`

   ```typescript
   <GlideDataEditor
     {...(isRowSelectionActivated && { rowMarkers: {...}, ... })}
     {...(isColumnSelectionActivated && { columnSelect: ..., ... })}
     {...(isCellSelectionActivated && { rangeSelect: ..., ... })}
     {...(!isEmptyTable && element.editingMode !== READ_ONLY && !disabled && { ... })}
     {...(canAddRows && { trailingRowOptions: {...}, ... })}
     {...(canDeleteRows && { rowMarkers: {...}, ... })}
   />
   ```

   Each spread creates a new object on every render. While React and glide-data-grid likely handle this efficiently, consolidating into stable memoized objects could help.

   **Potential Fix:** Pre-compute conditional props in useMemo:
   ```typescript
   const conditionalProps = useMemo(() => ({
     ...(isRowSelectionActivated && { ... }),
     ...(isColumnSelectionActivated && { ... }),
     // ...
   }), [isRowSelectionActivated, isColumnSelectionActivated, ...])
   ```

5. **Multiple useState for Related State**

   The component has 7 useState calls that could potentially be consolidated:
   - `isFocused`, `showSearch`, `hasVerticalScroll`, `hasHorizontalScroll`
   - `showMenu`, `showColumnVisibilityMenu`, `columnOrder`

   **Potential Fix:** Use useReducer for related UI state to batch updates.

   **Impact:** Very Low - React batches state updates in event handlers.

#### Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Component memoization | Optimized | Uses `memo()` |
| Data virtualization | Optimized | glide-data-grid handles this |
| Large table handling | Optimized | Threshold-based optimizations |
| Custom hooks | Optimized | Good separation with memoization |
| Dimension handling | Minor issue | Could add debouncing |
| Hook dependencies | Minor issue | ESLint suppressions present |

**Recommendation:** DataFrame is well-architected. The main opportunity is adding debounce to `useCalculatedDimensions`, but impact would be minimal since glide-data-grid handles resize efficiently. The ESLint suppressions in `useTableSizer` should be addressed to prevent potential bugs.

---

## Already Optimized Areas (Recent Work)

### VegaLiteChart Resize Performance

The recent optimization work on VegaLiteChart serves as a model for other charts:

**Improvements Made:**
1. **Separate spec from dimensions** - Base spec is stable, dimensions handled separately
2. **In-place resize API** - Uses `view.width()`, `view.height()`, `view.resize()` instead of recreation
3. **Debounced resize observer** - 100ms debounce via `useCalculatedDimensions`
4. **requestAnimationFrame** - Syncs visual updates with browser paint cycles
5. **Delayed initial render** - Waits for valid dimensions before first render

**Results:**
- ~10x faster resize operations (195ms -> 18ms)
- Smoother window resizing experience
- Reduced main thread blocking

**Files Modified:**
- `useVegaEmbed.ts` - Added `resizeView()` function
- `useVegaElementPreprocessor.ts` - Separated base spec from dimensions
- `ArrowVegaLiteChart.tsx` - Conditional recreation logic
- `useResizeObserver.ts` - Added debounce support
- `useCalculatedDimensions.ts` - Added debounce options

---

## Performance Testing Recommendations

### 1. Use React DevTools Profiler

```bash
# Enable profiler in development
# Open Chrome DevTools -> React -> Profiler
# Record during interactions to find re-render hotspots
```

### 2. Add Performance Logging

```typescript
// Add to suspected slow components
useEffect(() => {
  console.time('ComponentName render')
  return () => console.timeEnd('ComponentName render')
})
```

### 3. Browser DevTools Performance Tab

```bash
# Test resize performance:
make debug work-tmp/perf_test.py
# Open DevTools -> Performance
# Record while resizing window
# Look for long tasks and scripting time
```

### 4. Create Performance Test Scripts

```python
# work-tmp/perf_test.py
import streamlit as st
import pandas as pd
import numpy as np

# Create a variety of elements to test rendering performance
for i in range(10):
    st.write(f"Section {i}")
    df = pd.DataFrame(np.random.randn(100, 5))
    st.dataframe(df)
    st.line_chart(df)
```

---

## Prioritized Action Items

### Immediate (Low-Hanging Fruit)

1. **Add debouncing to useWindowDimensions** - Simple fix, high impact
2. **Move PlotlyChart dimension update to useEffect** - Prevents render cycles
3. **Memoize JSON parsing in Json.tsx** - Simple useMemo wrapper

### Short-Term

4. **Add React.memo to ElementNodeRenderer** - Requires prop stability audit
5. **Apply VegaLiteChart optimization pattern to GraphVizChart**
6. **Add useCalculatedDimensions debounce to remaining chart components**

### Medium-Term

7. **Audit all components for proper memoization**
8. **Consider context splitting for frequently-changing values**
9. **Add performance monitoring/metrics**

---

## Metrics to Track

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Resize jank | Variable | < 16ms per frame | DevTools Performance |
| Initial render | ~500ms | < 300ms | Lighthouse |
| Re-render count | Unknown | Minimize | React DevTools Profiler |
| Main thread blocking | Variable | < 50ms | DevTools Performance |

---

## References

- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [Vega Performance Documentation](vega-rendering-performance.md)
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools)
