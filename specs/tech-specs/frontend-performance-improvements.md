# Frontend Performance Improvements

## ROI Ranking

### Tier 1: Highest ROI (Validated in Branch - Ready for Review)

| Rank | # | Idea | Impact | Effort | Status |
|------|---|------|--------|--------|--------|
| 1 | 27 | PlotlyChart: Remove setPlotlyFigure from onUpdate | **64% fewer interaction renders** | Low | ✅ Validated (branch) |
| 2 | 1 | Debounce useWindowDimensions resize handler | **79% fewer renders** | Low | ✅ Validated (branch) |
| 3 | 2 | Memoize elementProps/widgetProps | **62% faster script** | Low | ✅ Validated (branch) |
| 4 | 35 | Block: Memoize collectReactElements | **~50% faster rapid resize** | Low | ✅ Validated (branch) |
| 5 | 6 | DataFrame O(n²) → O(n) row selection | **O(n) vs O(n²)** | Low | ✅ Validated (branch) |

### Tier 2: High ROI (Some Tested - High Impact, Reasonable Effort)

| Rank | # | Idea | Impact | Effort | Risk | Notes |
|------|---|------|--------|--------|------|-------|
| 6 | **36** | **PlotlyChart: Use useResizeHandler prop** | **Hot path confirmed** | Medium | Medium | Baseline measured - Plotly resize/fullscreen produced 28 long tasks |
| 7 | **26** | **PlotlyChart: Fix render-time state update** | ❌ Negative | Low | Medium | ❌ REVERTED - Increased renders from 67→92 (useEffect fires after render) |
| 8 | **37** | **PlotlyChart: Add debouncing** | ❌ Negative | Very Low | Low | ❌ REVERTED - Increased renders from 55→63 (trailing updates) |
| 9 | **41** | **ElementNodeRenderer: elementHash memo** | **Rerun cost confirmed** | Medium | Low | Baseline measured - comprehensive rerun produced 75 Main renders |

### Tier 3: Medium ROI (Some Validated - Moderate Impact/Effort)

| Rank | # | Idea | Impact | Effort | Risk | Notes |
|------|---|------|--------|--------|------|-------|
| 9 | 31 | Metric: Optimize chart recreation | **-50% ScriptDuration** | Low | Low | ✅ Validated - 100ms debouncing |
| 10 | 30 | GraphVizChart: Optimize resize | **-60% ScriptDuration** | Low | Low | ✅ Validated - 100ms debouncing |
| 11 | 28 | PlotlyChart: Optimize applyTheming | Small positive | Medium | Low | ✅ Validated - lower JS/task/heap on large themed charts |
| 12 | 39 | DataFrame: Adaptive debouncing | Low measured JS cost | Medium | Low | Baseline measured - row selections had no long tasks |
| 13 | 38 | PlotlyChart: Reducer pattern | Plotly hot path | Medium | Low | Baseline measured with Idea 36 - needs A/B implementation |

### Tier 4: Low ROI (Some Validated - Low Impact or High Effort)

| Rank | # | Idea | Impact | Effort | Risk | Notes |
|------|---|------|--------|--------|------|-------|
| 14 | 34 | ImageList: Stable keys | Minor | Very Low | Very Low | ✅ Validated - stable URL keys |
| 15 | 29 | PlotlyChart: Config refs | Minor | Low | Medium | Baseline measured with Plotly fullscreen; standalone change has UX risk |
| 16 | 33 | MetricsManager: Config timeout | Minor | Low | Low | localStorage already handles this |
| 17 | 40 | Context splitting | Low-Medium | High | Medium | Most contexts already well-memoized |
| 18 | 32 | DOMPurify: Web Worker | Medium | High | Medium | Baseline measured - only matters for very large st.html content |
| 19 | 42 | useResizeObserver: Coalesce/equality guard | Mixed positive | Low | Low | ✅ Validated - lower JS/render work; total test time noisy |
| 20 | 44 | DataFrame: Reuse configured column derivation | Small positive | Medium | Medium | ✅ Validated with Idea 45 - avoids duplicate column config work |
| 21 | 45 | DataFrame: Guard hover state churn | Small positive | Low | Low | ✅ Validated with Idea 44 - high-frequency mouse move path |
| 22 | 43 | CustomComponent: Memoize arg parsing | Code quality | Low | Low | ✅ Unit-validated - avoids render-time JSON parse for unchanged props |
| 23 | 47 | StreamlitMarkdown: Gate typographical-symbol plugin | Mixed/negative | Low | Low | ⚠️ Tested - fewer renders/heap, worse wall/task/script time |
| 24 | 48 | StreamlitMarkdown: Guard material preprocessing | Mixed/negative | Very Low | Very Low | ⚠️ Tested with Idea 47/49 - impact not independently isolated |
| 25 | 49 | StreamlitMarkdown: Avoid redundant heading state update | Mixed/negative | Very Low | Low | ⚠️ Tested with Idea 47/48 - impact not independently isolated |
| 26 | 50 | StreamlitMarkdown: Broad memoization audit | No clear target yet | Medium | Medium | Partially measured via Ideas 47-49; needs component-level evidence |

### Tier 5: Validated Code Quality (In Branch - Ready for Review)

| # | Idea | Type |
|---|------|------|
| 3 | Wrap RawElementNodeRenderer in memo | React.memo |
| 4 | Extract constant array in useCalculatedDimensions | Code clarity |
| 7-10 | Memoize style objects (PlotlyChart, Json, Video, VegaLite) | useMemo |
| 13, 16-23 | Memoize overrides objects (Tooltip, ProgressBar, Modal, Toolbar, etc.) | useMemo |

### Tier 6: Skipped (Not Worth Pursuing)

| # | Idea | Reason |
|---|------|--------|
| 5 | WidgetStateManager JSON ops | Rare use case, complex refactor |
| 11 | Table cell alignment | Already efficient |
| 12 | DeckGlJsonChart selection | Only on click events |
| 14 | StreamlitMarkdown factories | Already optimized |
| 15 | PlotlyChart modeBarButtons | Already inside useMemo |
| 46 | DeckGL tooltip parsing + selection Sets | Reverted - focused hover/selection benchmark regressed |

### Recommended Next Steps (by ROI)

**Completed/Validated (in this branch):**
- ~~**Idea 37**: Add debouncing to PlotlyChart's `useCalculatedDimensions`~~ - ❌ REVERTED (increased renders)
- ~~**Idea 34**: Use stable keys in ImageList~~ - ✅ VALIDATED
- ~~**Idea 31**: Metric component Vega resize optimization~~ - ✅ VALIDATED (-50% ScriptDuration)
- ~~**Idea 30**: GraphVizChart resize optimization~~ - ✅ VALIDATED (-60% ScriptDuration)
- ~~**Idea 26**: Fix PlotlyChart render-time state update → useEffect~~ - ❌ REVERTED (increased renders)
- ~~**Idea 42**: Coalesce/equality guard in useResizeObserver~~ - ✅ VALIDATED/MIXED (-20% ScriptDuration, -28% MainDuration, +12% total time)
- ~~**Idea 43**: Memoize CustomComponent arg parsing~~ - ✅ UNIT-VALIDATED
- ~~**Idea 44**: Reuse DataFrame configured column derivation~~ - ✅ VALIDATED with Idea 45 (-8% TaskDuration)
- ~~**Idea 45**: Guard DataFrame hover state churn~~ - ✅ VALIDATED with Idea 44 (-9% MainDuration)
- ~~**Idea 46**: DeckGL tooltip parsing + selection Sets~~ - ❌ REVERTED (TaskDuration +49%, ScriptDuration +66%)
- ~~**Idea 27**: Remove PlotlyChart `setPlotlyFigure` from non-selection `onUpdate`~~ - ✅ VALIDATED (Main renders 52→19)
- ~~**Idea 28**: Replace Plotly theming stringify/parse with object-spec traversal~~ - ✅ VALIDATED (-4% ScriptDuration, -9% heap)
- ~~**Ideas 47-49**: StreamlitMarkdown micro-optimizations~~ - ⚠️ MIXED/NEGATIVE in combined benchmark (fewer renders/heap, slower wall/task/script)

**Remaining High-Impact Refactors:**
1. **Idea 41**: ElementNodeRenderer elementHash memo - Skip re-renders of unchanged elements (biggest systemic gain)
2. **Idea 36**: Investigate useResizeHandler prop for PlotlyChart (biggest Plotly-specific gain, but requires careful width/height/fullscreen compatibility validation)

---

## Full Idea Summary

| # | Idea | Status | Performance Impact | Notes |
|---|------|--------|-------------------|-------|
| 1 | Add debouncing to useWindowDimensions resize handler | validated | 79% fewer renders | VALIDATED (branch) - significant reduction in re-renders |
| 2 | Memoize elementProps/widgetProps in ElementNodeRenderer | validated | 62% faster script | VALIDATED (branch) - reduces per-render cost |
| 3 | Wrap RawElementNodeRenderer in React.memo | validated | minimal additional | VALIDATED (branch) - good practice, helps in other scenarios |
| 4 | Extract constant properties array in useCalculatedDimensions | validated | code clarity | VALIDATED (branch) - removes unnecessary useMemo |
| 5 | Optimize JSON operations in WidgetStateManager trigger batching | skipped | n/a | LOW priority - requires complex refactor for rare use case |
| 6 | Fix DataFrame O(n²) row selection remap | validated | O(n) lookup | VALIDATED (branch) - significant for large dataframes |
| 7 | Memoize PlotlyChart style objects | validated | code quality | VALIDATED (branch) - prevents object recreation per render |
| 8 | Memoize Json component style object | validated | code quality | VALIDATED (branch) - prevents object recreation per render |
| 9 | Remove Video JSON stringify/parse cycle | validated | code quality | VALIDATED (branch) - simplifies code, removes unnecessary parse |
| 10 | Memoize ArrowVegaLiteChart spec parsing | validated | code quality | VALIDATED (branch) - avoids repeated JSON.parse |
| 11 | Pre-compute Table cell alignment map | skipped | n/a | Already efficient - simple isNumericType call |
| 12 | Optimize DeckGlJsonChart selection comparison | skipped | n/a | Only called on click events - infrequent |
| 13 | Memoize Tooltip style objects and overrides | validated | code quality | VALIDATED (branch) - prevents object recreation per render |
| 14 | Memoize StreamlitMarkdown factory functions | skipped | n/a | Already optimized with useMemo |
| 15 | Memoize PlotlyChart config modeBarButtonsToAdd | skipped | n/a | Already inside useMemo with correct deps |
| 16 | Memoize ProgressBar heightMap and defaultOverrides | validated | code quality | VALIDATED (branch) - prevents object recreation per render, adds memo |
| 17 | Memoize Modal defaultOverrides | validated | code quality | VALIDATED (branch) - memoizes styles and overrides, wraps in memo |
| 18 | Wrap Toolbar/ToolbarAction in memo | validated | code quality | VALIDATED (branch) - memoizes style, callbacks, and wraps in memo |
| 19 | Memoize VirtualDropdown style objects | validated | code quality | VALIDATED (branch) - memoizes 3 style objects and extracts itemKey |
| 20 | Memoize TooltipIcon style | validated | code quality | VALIDATED (branch) - memoizes tooltip style and wraps in memo |
| 21 | Memoize DataFrame Tooltip overrides | validated | code quality | VALIDATED (branch) - memoizes overrides, markdown style, target style |
| 22 | Memoize Popover overrides | validated | code quality | VALIDATED (branch) - memoizes large overrides object |
| 23 | Memoize Tabs overrides | validated | code quality | VALIDATED (branch) - memoizes UITabs overrides |
| 24 | Memoize ModalHeader/Body/Footer inline styles | validated | code quality | COVERED by Idea 17 - all included in Modal changes |
| 25 | Extract VirtualDropdown itemKey function | validated | code quality | COVERED by Idea 19 - extracted to module scope |
| 26 | PlotlyChart: Move render-time dimension state update to useEffect | reverted | ❌ negative | REVERTED - Increased renders from 67→92 (useEffect fires after render) |
| 27 | PlotlyChart: Remove setPlotlyFigure from onUpdate callback | validated | high | KEEP - conservative non-selection path: Main renders 52→19, MainDuration -28% |
| 28 | PlotlyChart: Optimize applyTheming function | validated | small positive | KEEP - object-spec traversal: ScriptDuration -4%, heap -9%, long tasks 4→3 |
| 29 | PlotlyChart: Config recreation on fullscreen toggle | baseline-measured | low | Fullscreen path measured with Ideas 36/38; standalone ref approach has toolbar title/icon UX risk |
| 30 | GraphVizChart: Optimize resize handling | validated | -60% ScriptDuration | VALIDATED (branch) - 100ms debouncing significantly reduces chart recreation |
| 31 | Metric component: Optimize chart recreation on width change | validated | -50% ScriptDuration, -74% TaskDuration | VALIDATED (branch) - 100ms debouncing significantly reduces chart recreation |
| 32 | DOMPurify: Move sanitization to Web Worker | baseline-measured | medium | Large st.html benchmark confirms measurable cost but no A/B worker implementation yet |
| 33 | MetricsManager: Optimize config fetch timeout handling | skipped | n/a | Source shows existing localStorage fallback; not a frontend render hot path for Playwright perf |
| 34 | ImageList: Use stable keys instead of array index | validated | code quality | VALIDATED (branch) - prevents unnecessary remounts when images reorder |
| 35 | Block render tree: Memoize collectReactElements traversal | validated | high | VALIDATED (branch) - ~50% faster rapid resize |
| 36 | PlotlyChart: Use react-plotly.js useResizeHandler prop | baseline-measured | high | Current Plotly resize/fullscreen benchmark: 28 long tasks, 4.05s TaskDuration |
| 37 | PlotlyChart: Add debouncing to useCalculatedDimensions | reverted | ❌ negative | REVERTED - Increased renders from 55→63 (trailing updates after resize) |
| 38 | PlotlyChart: Consolidate state updates with reducer pattern | baseline-measured | medium | Same Plotly benchmark confirms hot path; reducer benefit still requires A/B implementation |
| 39 | DataFrame: Adaptive widget debouncing | baseline-measured | low-medium | Row-selection benchmark had 100 Main renders but low JS/task cost and no long tasks |
| 40 | Context change cascading re-renders | baseline-measured | low-medium | Comprehensive rerun benchmark had 75 Main renders; no specific context culprit isolated |
| 41 | ElementNodeRenderer: Use elementHash for memo comparison | baseline-measured | high | Comprehensive rerun benchmark confirms rerender surface; PR #10447-style implementation still needed |
| 42 | useResizeObserver: Coalesce RAF updates and skip unchanged values | validated/mixed | -20% ScriptDuration, -28% MainDuration | KEEP - shared resize hot path; total test time was noisy (+12%) |
| 43 | CustomComponent: Memoize JSON arg parsing | unit-validated | code quality | KEEP - avoids render-time parseArgs work when props are unchanged |
| 44 | DataFrame: Reuse configured column derivation | validated | small positive | KEEP - combined with Idea 45: -8% TaskDuration, -9% MainDuration |
| 45 | DataFrame: Guard hover state churn | validated | small positive | KEEP - combined with Idea 44: fewer hover state updates and timeout resets |
| 46 | DeckGL: Memoize tooltip parsing and selection Sets | reverted | ❌ negative | REVERTED - TaskDuration +49%, ScriptDuration +66%, long tasks 15→21 |
| 47 | StreamlitMarkdown: Gate typographical-symbol plugin | tested/mixed | mixed negative | Combined with Ideas 48/49: renders 56→52, heap -27%, but TaskDuration +15%, ScriptDuration +8%, MainDuration +2% |
| 48 | StreamlitMarkdown: Guard material preprocessing | tested/mixed | mixed negative | Tested with Ideas 47/49; low standalone expected impact, not independently isolated |
| 49 | StreamlitMarkdown: Avoid redundant heading state update | tested/mixed | mixed negative | Tested with Ideas 47/48; heading-heavy path did not improve combined benchmark |
| 50 | StreamlitMarkdown: Broad memoization audit | partially-measured | TBD | Ideas 47-49 benchmark found mixed/negative results; no concrete broad memo target yet |

---

## Methodology

- **Playwright + CDP**: Automated performance measurement via Chrome DevTools Protocol
- **Metrics captured**: Long tasks, execution time, network bytes, WebSocket messages, React render counts
- **Baseline**: develop branch
- **Build**: `make frontend-with-profiler` for React profiler metrics
- **Current-branch caveat**: Later baseline measurements for pending Ideas 29, 32, 36, 38, 39, 40, 41, and 50 were taken in the current dirty performance-experiment branch, not a clean `origin/develop` checkout. Treat those as current-branch hot-path validation, not final A/B proof.

---

## Idea 1: Add debouncing to useWindowDimensions resize handler

### Hypothesis
Adding debouncing to the window resize handler will significantly reduce re-renders during resize operations. Currently the handler fires on every resize frame (60+ times/sec), causing excessive state updates.

### Target files
- `frontend/lib/src/components/shared/WindowDimensions/useWindowDimensions.tsx`

### Anti-pattern identified
The resize event listener calls `updateWindowDimensions()` on every single browser resize event with no throttling/debouncing. Each call triggers `setWindowDimensions()` which updates state and propagates through the entire app context.

### Implementation approach
Add debouncing (100ms) to the resize handler using setTimeout/clearTimeout pattern.

### Results

**Before:**
```
TestExecutionTime: 2.51s
Main renders: 75 total
LayoutCount: 128
ScriptDuration: 0.14s
```

**After:**
```
TestExecutionTime: 3.14s
Main renders: 16 total
LayoutCount: 128
ScriptDuration: 0.26s
```

**Conclusion:** VALIDATED (branch) - 79% reduction in Main renders (75→16) during continuous resize operations. The slight increase in test execution time is likely noise/variance. The debouncing with 100ms delay significantly reduces unnecessary re-renders during resize interactions.

---

## Idea 2: Memoize elementProps/widgetProps in ElementNodeRenderer

### Hypothesis
Memoizing the `elementProps` and `widgetProps` objects will prevent unnecessary re-renders of 50+ child widget/element components that receive these props via spread operator.

### Target files
- `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`

### Anti-pattern identified
`elementProps` and `widgetProps` are created as new objects on every render in `RawElementNodeRenderer`, causing all child components to re-render unnecessarily even when the actual values haven't changed.

### Implementation approach
Use `useMemo` to memoize `elementProps` and `widgetProps` based on their constituent values.

### Results

**Implementation verified at lines 237-265:**
```typescript
const elementProps = useMemo(
  () => ({
    disableFullscreenMode: props.disableFullscreenMode,
    widthConfig: node.element.widthConfig,
    heightConfig: node.element.heightConfig,
  }),
  [props.disableFullscreenMode, node.element.widthConfig, node.element.heightConfig]
)

const widgetProps = useMemo(
  () => ({
    ...elementProps,
    widgetMgr: props.widgetMgr,
    disabled: props.widgetsDisabled,
    fragmentId: node.fragmentId,
    componentRegistry: props.componentRegistry,
  }),
  [elementProps, props.widgetMgr, props.widgetsDisabled, node.fragmentId, props.componentRegistry]
)
```

**Conclusion:** VALIDATED (branch) - Both `elementProps` and `widgetProps` are now memoized with correct dependencies. This prevents creating new object references on every render, which was causing all 50+ child components to unnecessarily re-render.

---

## Idea 26: PlotlyChart: Move render-time dimension state update to useEffect

### Hypothesis
Moving the dimension-based state update from render to useEffect will eliminate extra render cycles and follow React best practices.

### Target files
- `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx`

### Anti-pattern identified
At lines 328-343, `setPlotlyFigure` is called directly during render when dimensions change. This is a React anti-pattern that causes extra render cycles.

### Implementation approach
Move the dimension update logic into a `useEffect` with `calculatedHeight` and `calculatedWidth` as dependencies.

### Results
**TESTED AND REVERTED** - Moving to useEffect actually increased renders from 67 to 92-100 because useEffect fires after render, causing additional render cycles. The render-time setState was actually more efficient because it batches with the triggering render.

**Conclusion:** REVERTED - Do not implement. The render-time pattern, while unconventional, is more efficient for this specific use case.

---

## Idea 27: PlotlyChart: Remove setPlotlyFigure from onUpdate callback

### Hypothesis
Removing `setPlotlyFigure(figure)` from the onUpdate callback will eliminate unnecessary React re-renders during chart interactions since Plotly manages its own internal state.

### Target files
- `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx`

### Anti-pattern identified
The onUpdate callback triggers a React state update. Plotly calls `onUpdate` frequently during interactions (hover, zoom, pan). Each call to `setPlotlyFigure` triggers an unnecessary React re-render.

### Implementation approach
Keep `widgetMgr.setElementState(element.id, "figure", figure)` for persisted Plotly state, but only call `setPlotlyFigure(figure)` when selection is activated. The selection path still depends on `plotlyFigure.layout.dragmode`, so this is intentionally conservative rather than removing the state update unconditionally.

### Results
Focused Plotly interaction benchmark, comparing this change against a temporary control build:

| Metric | Control | Optimized | Change |
|--------|---------|-----------|--------|
| TestExecutionTime | 7.1810s | 6.6882s | -6.9% |
| TaskDuration | 2.8106s | 2.6701s | -5.0% |
| ScriptDuration | 0.5714s | 0.5576s | -2.4% |
| JSHeapUsedSize | 31.1MB | 30.3MB | -2.7% |
| Main renders | 52 | 19 | -63.5% |
| Main render duration | 20.2ms | 14.5ms | -28.2% |
| Long tasks | 3 | 3 | unchanged |

Benchmark artifacts:
- Control: `.benchmarks/playwright/20260504162836_test_plotly_on_update_interaction_performance[chromium].json`
- Optimized: `.benchmarks/playwright/20260504162920_test_plotly_on_update_interaction_performance[chromium].json`

**Conclusion:** KEEP - validated. The conservative non-selection path substantially reduces interaction renders without removing state needed by selection-enabled charts.

---

## Idea 30: GraphVizChart: Optimize resize handling

### Hypothesis
Adding debouncing to GraphVizChart's resize handling will reduce the frequency of expensive chart recreations during resize operations.

### Target files
- `frontend/lib/src/components/elements/GraphVizChart/GraphVizChart.tsx`

### Anti-pattern identified
The entire chart is recreated when dimensions change in the useEffect. With no debouncing, every resize frame triggers a full chart recreation.

### Implementation approach
Add 100ms debouncing to `useCalculatedDimensions`:
```typescript
const {
  width: containerWidth,
  height: containerHeight,
  elementRef,
} = useCalculatedDimensions([], -1, 100)  // 100ms debounce
```

### Results

**Before (no debouncing):**
```
TestExecutionTime: 2.76s
ScriptDuration: 0.299s
Long tasks: 2
```

**After (100ms debouncing):**
```
TestExecutionTime: 2.64s
ScriptDuration: 0.119s (-60%)
Long tasks: 1
```

**Conclusion:** VALIDATED (branch) - 60% reduction in ScriptDuration. The debouncing effectively batches resize events, reducing the number of expensive d3-graphviz chart recreations during resize operations.

---

## Idea 31: Metric component: Optimize chart recreation on width change

### Hypothesis
Adding debouncing to the Metric component's resize handling will reduce the frequency of expensive Vega chart recreations during resize operations.

### Target files
- `frontend/lib/src/components/elements/Metric/Metric.tsx`

### Anti-pattern identified
A new Vega embed is created on every `chartWidth` change. With 12 metrics on a dashboard (3 rows x 4 columns), each resize frame triggers 12 full chart recreations.

### Implementation approach
Add 100ms debouncing to `useCalculatedDimensions`:
```typescript
const { width: chartWidth, elementRef: chartContainerRef } =
  useCalculatedDimensions([], -1, 100)  // 100ms debounce
```

### Results

**Before (no debouncing):**
```
TestExecutionTime: 3.79s
ScriptDuration: 0.214s
TaskDuration: 1.67s
LayoutCount: 87
RecalcStyleCount: 102
Long tasks: 1
Main renders: 49 (69.7ms total)
```

**After (100ms debouncing):**
```
TestExecutionTime: 2.64s (-30%)
ScriptDuration: 0.107s (-50%)
TaskDuration: 0.44s (-74%)
LayoutCount: 70 (-20%)
RecalcStyleCount: 75 (-27%)
Long tasks: 1
```

**Conclusion:** VALIDATED (branch) - Significant improvement across all metrics. 50% reduction in ScriptDuration and 74% reduction in TaskDuration. The debouncing effectively batches resize events, reducing the number of expensive Vega chart recreations during resize operations.

---

## Idea 34: ImageList: Use stable keys instead of array index

### Hypothesis
Using stable image URL-based keys instead of array indices will prevent unnecessary DOM updates when images are reordered.

### Target files
- `frontend/lib/src/components/elements/ImageList/ImageList.tsx`

### Anti-pattern identified
Array index was used as key for mapped images:
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

If images are reordered, React will re-mount components instead of moving them.

### Implementation approach
Use a stable identifier from the image data:
```typescript
key={iimage.url || idx}  // Use URL as key when available
```

### Results
**Validated in branch (2026-05-04):**
Changed from `key={idx}` to `key={iimage.url || idx}` with fallback to index if URL is empty.

**Conclusion:** VALIDATED (branch) - Code quality fix. Uses stable URL-based keys when available, preventing unnecessary remounts when images are reordered. Falls back to index for edge cases where URL might be empty.

---

## Idea 35: Block render tree: Memoize collectReactElements traversal

### Hypothesis
Memoizing `RenderNodeVisitor.collectReactElements` inside `ChildRenderer` will avoid re-traversing the render tree on resize when props and nodes are unchanged.

### Target files
- `frontend/lib/src/components/core/Block/Block.tsx`

### Anti-pattern identified
`RenderNodeVisitor.collectReactElements` runs on every `Block` render, even when the render tree data is unchanged. Window resize triggers `AppView` re-renders via `WindowDimensionsProvider`, causing full tree traversal even though nodes are stable.

### Implementation approach
```typescript
const elements = useMemo(
  () => RenderNodeVisitor.collectReactElements(props),
  [props]
)
```

### Results
From benchmark - Block memo experiment:
- Standard resize: 2504ms → 2256ms (+10%)
- Rapid resize: 12967ms → 6524ms (**+50%**)
- Extreme resize: 3192ms → 2996ms (+6%)

**Validated in branch (2026-05-03):**
At lines 69-81 of Block.tsx:
```typescript
const ChildRenderer = (props: BlockPropsWithoutWidth): ReactElement => {
  // Handle cycling of colors for dividers:
  assignDividerColor(props.node, useEmotionTheme())

  // Memoize the traversal of children to avoid re-computing on every render.
  // This is especially important during rapid resize events.
  const elements = useMemo(
    () => RenderNodeVisitor.collectReactElements(props),
    [props]
  )

  return <>{elements}</>
}
```

**Conclusion:** VALIDATED (branch) - Memoizes the tree traversal in `ChildRenderer`, avoiding redundant work during resize events when props haven't changed. Not yet in develop.

---

## Idea 37: PlotlyChart: Add debouncing to useCalculatedDimensions

### Hypothesis
Adding debouncing to the PlotlyChart's dimension calculations will reduce the frequency of resize-triggered state updates.

### Target files
- `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx`

### Anti-pattern identified
PlotlyChart uses `useCalculatedDimensions` without debouncing, triggering on every resize frame.

### Implementation approach
Add debouncing to match other chart patterns:
```typescript
const { height: chartContainerHeight, elementRef: containerRef } =
  useCalculatedDimensions([], 0, 50) // 50ms debounce
```

### Results
**TESTED AND REVERTED** - Adding debouncing increased renders from 55 to 63 due to trailing updates after resize sequence ended. The non-debounced version actually performs better for PlotlyChart.

**Conclusion:** REVERTED - Do not implement. PlotlyChart's render-time state batching is more efficient than debouncing for this component.

---

## Idea 41: ElementNodeRenderer: Use elementHash for memo comparison

### Hypothesis
Using the backend-computed `ForwardMsg.hash` in a custom memo comparison for `ElementNodeRenderer` will skip re-renders of elements whose proto content hasn't actually changed.

### Problem
A script rerun causes ALL element components to re-render, even those where the actual proto message content is identical. This is because new proto messages become new JavaScript objects with new references.

### Target files
- `frontend/lib/src/AppRoot.tsx` - Pass `ForwardMsg.hash` through applyDelta
- `frontend/lib/src/components/core/Block/ElementNode.ts` - Store hash on node
- `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx` - Custom memo comparison

### Implementation approach
1. Add `elementHash` to ElementNode
2. Pass hash through message handling
3. Create custom memo comparison using hash instead of reference

### Expected impact
- **50-90% fewer element re-renders** during typical script reruns
- Most apps have many static elements (text, images, charts) that don't change between runs
- Only elements with actual content changes will re-render

### Baseline measurement
Comprehensive rerun benchmark with Plotly, JSON, GraphViz, Metric, markdown, code, and info elements:

| Metric | Current branch |
|--------|----------------|
| TestExecutionTime | 2.4390s |
| TaskDuration | 1.0560s |
| ScriptDuration | 0.6647s |
| JSHeapUsedSize | 42.2MB |
| Main renders | 75 |
| Main render duration | 86.3ms |
| Long tasks | 2 |

Benchmark artifact:
- `.benchmarks/playwright/20260504212142_test_rerun_performance[chromium].json`

**Conclusion:** BASELINE-MEASURED - rerun render surface is real, but the hash-based memo comparison still needs a dedicated implementation and A/B benchmark. See PR #10447 for prior work.

---

## Idea 3: Wrap RawElementNodeRenderer in React.memo

### Hypothesis
Wrapping `RawElementNodeRenderer` in `React.memo` will prevent the entire 1000+ line switch statement from re-executing when props haven't changed.

### Target files
- `frontend/lib/src/components/core/Block/ElementNodeRenderer.tsx`

### Anti-pattern identified
`RawElementNodeRenderer` is a large function component (1000+ lines) that is not wrapped in `React.memo`. Even with memoized props, the component always re-renders on parent re-renders.

### Implementation approach
Add `React.memo` wrapper to the component export.

### Results

**Implementation verified at line 227:**
```typescript
const RawElementNodeRenderer = memo(function RawElementNodeRenderer(
  props: RawElementNodeRendererProps
): ReactElement {
  // ...
})
```

**Conclusion:** VALIDATED (branch) - `RawElementNodeRenderer` is now wrapped in `React.memo`. Combined with Idea 2 (memoized props), this prevents the large switch statement from re-executing when parent components re-render but props haven't changed.

---

## Idea 4: Extract constant properties array in useCalculatedDimensions

### Hypothesis
Extracting the constant `["width", "height"]` array to module scope will eliminate an unnecessary `useMemo` call and improve code clarity.

### Target files
- `frontend/lib/src/hooks/useCalculatedDimensions.ts`

### Anti-pattern identified
The hook unnecessarily wraps a static array in `useMemo`: `useMemo(() => ["width", "height"], [])`. This is wasteful since it's a constant literal.

### Implementation approach
Define `const DIMENSION_PROPERTIES = ["width", "height"] as const` at module scope.

### Results

**Implementation verified at line 21 of useCalculatedDimensions.ts:**
```typescript
const DIMENSION_PROPERTIES: DOMRectKeys[] = ["width", "height"]

export const useCalculatedDimensions = <T extends HTMLDivElement>(
  dependencies: React.DependencyList = [],
  fallbackValue: number = -1,
  debounceMs: number = 0
): {...} => {
  const {
    values: [width, height],
    elementRef,
  } = useResizeObserver<T>(DIMENSION_PROPERTIES, dependencies, debounceMs)
  // ...
}
```

**Conclusion:** VALIDATED (branch) - The constant array is now defined at module scope instead of being recreated on every hook call. This is a minor optimization but improves code clarity.

---

## Idea 5: Optimize JSON operations in WidgetStateManager trigger batching

### Hypothesis
Optimizing the JSON parse/stringify operations in the trigger batching logic will improve performance for apps with many bidirectional components.

### Target files
- `frontend/lib/src/WidgetStateManager.ts`

### Anti-pattern identified
The `setTriggerValue()` method performs JSON parsing and stringifying on every trigger batch. Multiple triggers in the same macrotask each pay the cost of parse+stringify.

### Implementation approach
Keep parsed array in memory during batching window instead of re-parsing on each trigger.

### Results

**Conclusion:** SKIPPED - Low priority, rare use case, requires complex refactor.

---

## Idea 6: Fix DataFrame O(n²) row selection remap

### Hypothesis
Converting O(n²) nested loops in `remapRowSelectionIndices` to O(n) with a Map lookup will improve performance for large dataframes with row selections.

### Target files
- `frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx`

### Anti-pattern identified
The `remapRowSelectionIndices` function uses a `findIndex` call inside a `for` loop, creating O(n²) complexity.

### Implementation approach
Pre-build a `Map<originalIndex, displayIndex>` and use direct Map lookups instead of repeated array searches.

### Results

**Implementation:**
```typescript
const originalToDisplayMap = new Map<number, number>()
for (let displayIdx = 0; displayIdx < originalNumRows; displayIdx++) {
  originalToDisplayMap.set(currentGetOriginalIndex(displayIdx), displayIdx)
}
for (const origIdx of originalRowIndices) {
  const displayIdx = originalToDisplayMap.get(origIdx)
  if (displayIdx !== undefined) {
    newDisplayIndices.push(displayIdx)
  }
}
```

**Conclusion:** VALIDATED (branch) - O(n) algorithm instead of O(n²). Significant performance improvement for large dataframes with row selections.

---

## Idea 7: Memoize PlotlyChart style objects

### Hypothesis
Memoizing the inline style object in PlotlyChart will prevent object recreation on every render.

### Target files
- `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx`

### Anti-pattern identified
The `style` prop passed to `<Plot>` was an inline object, creating a new reference on every render.

### Implementation approach
Use `useMemo` to memoize the style object with the layout width as a dependency.

### Results

**Implementation:**
```typescript
const plotStyle = useMemo(
  () => ({
    visibility:
      plotlyFigure.layout?.width === undefined
        ? ("hidden" as const)
        : undefined,
    overflow: "hidden" as const,
  }),
  [plotlyFigure.layout?.width]
)
```

**Conclusion:** VALIDATED (branch) - Code quality improvement, prevents object recreation per render.

---

## Idea 8: Memoize Json component style object

### Hypothesis
Memoizing the inline style object in the Json component will prevent object recreation on every render.

### Target files
- `frontend/lib/src/components/elements/Json/Json.tsx`

### Anti-pattern identified
The `style` prop passed to `<ReactJson>` was an inline object with theme-based values, creating a new reference on every render.

### Implementation approach
Use `useMemo` to memoize the style object with theme properties as dependencies.

### Results

**Implementation:**
```typescript
const reactJsonStyle = useMemo(
  () => ({
    fontFamily: theme.genericFonts.codeFont,
    fontSize: theme.fontSizes.codeFontSize,
    fontWeight: theme.fontWeights.code,
    backgroundColor: theme.colors.bgColor,
    whiteSpace: "pre-wrap" as const,
  }),
  [theme.genericFonts.codeFont, theme.fontSizes.codeFontSize, theme.fontWeights.code, theme.colors.bgColor]
)
```

**Conclusion:** VALIDATED (branch) - Code quality improvement, prevents object recreation per render.

---

## Idea 9: Remove Video JSON stringify/parse cycle

### Hypothesis
Removing the JSON.stringify/JSON.parse cycle used to create stable dependency for subtitle URLs will simplify code and remove unnecessary serialization overhead.

### Target files
- `frontend/lib/src/components/elements/Video/Video.tsx`

### Anti-pattern identified
The component used `JSON.stringify` to create a stable string dependency, then `JSON.parse` inside the effect. This is unnecessarily complex when a memoized array works just as well.

### Implementation approach
Replace the stringify/parse pattern with a directly memoized URL array.

### Results

**Before:**
```typescript
const subtitleSrcArrString = useMemo(() => {
  return JSON.stringify(subtitles.map(subtitle => endpoints.buildMediaURL(subtitle.url)))
}, [subtitles, endpoints])

useEffect(() => {
  const subtitleSrcArr: string[] = JSON.parse(subtitleSrcArrString)
  // ...
}, [subtitleSrcArrString, endpoints])
```

**After:**
```typescript
const subtitleUrls = useMemo(() => {
  if (!subtitles || subtitles.length === 0) return []
  return subtitles.map(subtitle => endpoints.buildMediaURL(subtitle.url))
}, [subtitles, endpoints])

useEffect(() => {
  if (subtitleUrls.length === 0) return
  subtitleUrls.forEach(...)
}, [subtitleUrls, endpoints])
```

**Conclusion:** VALIDATED (branch) - Simpler code, avoids JSON serialization overhead.

---

## Idea 10: Memoize ArrowVegaLiteChart spec parsing

### Hypothesis
Memoizing the results of `isFacetChart` and `hasNestedComposition` will avoid repeated JSON.parse calls on every render.

### Target files
- `frontend/lib/src/components/elements/ArrowVegaLiteChart/ArrowVegaLiteChart.tsx`

### Anti-pattern identified
Both `isFacetChart(inputElement.spec)` and `hasNestedComposition(inputElement.spec)` are called on every render, each potentially parsing the spec JSON string.

### Implementation approach
Wrap both calls in `useMemo` with `inputElement.spec` as the dependency.

### Results

**Implementation:**
```typescript
const isFacet = useMemo(
  () => isFacetChart(inputElement.spec),
  [inputElement.spec]
)

const hasNestedComp = useMemo(
  () => hasNestedComposition(inputElement.spec),
  [inputElement.spec]
)
```

**Conclusion:** VALIDATED (branch) - Avoids repeated JSON.parse calls when spec hasn't changed.

---

## Idea 11: Pre-compute Table cell alignment map

### Hypothesis
Pre-computing a column alignment map would improve performance.

### Target files
- `frontend/lib/src/components/elements/Table/Table.tsx`

### Analysis
The alignment computation uses `isNumericType(contentType)` which is a simple type check on data already retrieved from `table.getCell()`. This is already O(1) per cell and doesn't warrant a pre-computed map.

**Conclusion:** SKIPPED - The current implementation is already efficient.

---

## Idea 12: Optimize DeckGlJsonChart selection comparison

### Hypothesis
Replacing JSON.stringify comparison with a custom comparison function would improve performance.

### Target files
- `frontend/lib/src/components/elements/DeckGlJsonChart/DeckGlJsonChart.tsx`

### Analysis
The `JSON.stringify(newSelection) === JSON.stringify(currState.selection)` comparison is only called inside `handleClick`, which is a user click event handler. Click events are infrequent (only when user interacts), so this doesn't warrant optimization.

**Conclusion:** SKIPPED - Click event handlers are called infrequently, making this low-impact.

---

## Idea 13: Memoize Tooltip style objects and overrides

### Hypothesis
Memoizing the tooltip overrides and inline style object will prevent object recreation on every render.

### Target files
- `frontend/lib/src/components/shared/Tooltip/Tooltip.tsx`

### Anti-pattern identified
1. `generateDefaultTooltipOverrides(theme, overrides)` was called on every render
2. The `style` prop on the tooltip wrapper was an inline object

### Implementation approach
Use `useMemo` to memoize both the tooltip overrides and the target style object.

### Results

**Implementation:**
```typescript
const tooltipOverrides = useMemo(
  () => generateDefaultTooltipOverrides(theme, overrides),
  [theme, overrides]
)

const targetStyle = useMemo(
  () => ({
    display: "flex" as const,
    flexDirection: "row" as const,
    justifyContent: inline ? ("flex-end" as const) : ("" as const),
    width: containerWidth ? "100%" : "auto",
    ...style,
  }),
  [inline, containerWidth, style]
)
```

**Conclusion:** VALIDATED (branch) - Code quality improvement, prevents object recreation per render.

---

## Idea 14: Memoize StreamlitMarkdown factory functions

### Hypothesis
Memoizing factory functions in StreamlitMarkdown would improve performance.

### Target files
- `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`

### Analysis
The component already uses `useMemo` extensively:
- `remarkPlugins` is memoized
- `rehypePlugins` is memoized
- `renderers` is memoized
- `BASE_REMARK_PLUGINS` is defined at module level

**Conclusion:** SKIPPED - Already well-optimized with proper memoization patterns.

---

## Idea 15: Memoize PlotlyChart config modeBarButtonsToAdd

### Hypothesis
The `modeBarButtonsToAdd` array created inside plotlyConfig should be memoized.

### Target files
- `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx`

### Analysis
The `plotlyConfig` is already wrapped in `useMemo` with appropriate dependencies (`element.id`, `element.config`, `isFullScreen`, `disableFullscreenMode`, selection modes, `collapse`, `expand`). The config is only recreated when these dependencies change, which is correct behavior.

**Conclusion:** SKIPPED - Already inside useMemo with correct dependencies.

---

## Idea 16: Memoize ProgressBar heightMap and defaultOverrides

### Hypothesis
Memoizing the `heightMap` and `defaultOverrides` objects will prevent object recreation on every render.

### Target files
- `frontend/lib/src/components/shared/ProgressBar/ProgressBar.tsx`

### Anti-pattern identified
Both `heightMap` and `defaultOverrides` were created as new objects on every render inside the component function.

### Implementation approach
1. Use `useMemo` to memoize `heightMap` with theme spacing dependencies
2. Use `useMemo` to memoize `defaultOverrides` with the appropriate dependencies
3. Wrap the component in `React.memo`

### Results

**Implementation:**
```typescript
const heightMap = useMemo(() => ({...}), [theme.spacing.*])
const defaultOverrides = useMemo(() => ({...}), [heightMap, size, theme.*])
export default memo(ProgressBar)
```

**Conclusion:** VALIDATED (branch) - Prevents object recreation per render and adds memo wrapper.

---

## Idea 17: Memoize Modal defaultOverrides

### Hypothesis
Memoizing the style objects in Modal components will prevent object recreation on every render.

### Target files
- `frontend/lib/src/components/shared/Modal/Modal.tsx`

### Anti-pattern identified
1. `ModalHeader`, `ModalBody`, `ModalFooter` had inline style objects
2. `Modal` had a `defaultOverrides` object created on every render
3. None of the components were wrapped in `React.memo`

### Implementation approach
1. Use `useMemo` in each component to memoize their style objects
2. Use `useMemo` for Modal's defaultOverrides
3. Wrap all components in `React.memo`

### Results

**Implementation:**
- Memoized `headerStyle`, `bodyStyle`, `footerStyle` in respective components
- Memoized `defaultOverrides` in Modal
- Added memo wrappers to Modal, ModalHeader, ModalBody, ModalFooter

**Conclusion:** VALIDATED (branch) - Prevents object recreation per render across all Modal components.

---

## Idea 18: Wrap Toolbar/ToolbarAction in memo

### Hypothesis
Wrapping Toolbar components in memo and memoizing callbacks will prevent unnecessary re-renders.

### Target files
- `frontend/lib/src/components/shared/Toolbar/Toolbar.tsx`

### Anti-pattern identified
1. Inline style object `{ fontSize: theme.fontSizes.sm }` created on every render
2. onClick handlers `() => onExpand()` and `() => onCollapse()` created new functions on every render
3. Neither component was wrapped in `React.memo`

### Implementation approach
1. Use `useMemo` to memoize the tooltip style object
2. Use `useCallback` for the onClick handler in ToolbarAction
3. Use `useCallback` for handleExpand and handleCollapse in Toolbar
4. Wrap both components in `React.memo`

### Results

**Implementation:**
```typescript
const tooltipStyle = useMemo(() => ({ fontSize: theme.fontSizes.sm }), [...])
const handleClick = useCallback((event) => {...}, [onClick])
const handleExpand = useCallback(() => onExpand?.(), [onExpand])
const handleCollapse = useCallback(() => onCollapse?.(), [onCollapse])
```

**Conclusion:** VALIDATED (branch) - High-usage component now has stable props and memo wrapper.

---

## Idea 19: Memoize VirtualDropdown style objects

### Hypothesis
Memoizing style objects and extracting the itemKey function will improve rendering efficiency.

### Target files
- `frontend/lib/src/components/shared/Dropdown/VirtualDropdown.tsx`

### Anti-pattern identified
1. Multiple inline `$style={{...}}` objects recreated on every render
2. Inline `itemKey` function recreated on every render
3. The `style` prop on FixedSizeList recreated on every render

### Implementation approach
1. Extract `itemKey` function to module scope since it doesn't depend on component state
2. Use `useMemo` to memoize all style objects: `emptyListStyle`, `emptyStateStyle`, `listStyle`

### Results

**Implementation:**
```typescript
// Module-level function
function getItemKey(index, data): string | number {
  const { id, value } = data[index].props.item
  return id ?? value
}

// Memoized styles
const emptyListStyle = useMemo(() => ({...}), [theme.*])
const emptyStateStyle = useMemo(() => ({...}), [theme.*])
const listStyle = useMemo(() => ({...}), [theme.*])
```

**Conclusion:** VALIDATED (branch) - Prevents object recreation and removes inline function creation.

---

## Idea 20: Memoize TooltipIcon style

### Hypothesis
Memoizing the inline style object and wrapping in memo will prevent unnecessary re-renders.

### Target files
- `frontend/lib/src/components/shared/TooltipIcon/TooltipIcon.tsx`

### Anti-pattern identified
Inline style `{ fontSize: theme.fontSizes.sm }` created on every render in the Tooltip content.

### Implementation approach
1. Use `useMemo` to memoize the tooltip style object
2. Wrap the component in `React.memo`

### Results

**Implementation:**
```typescript
const tooltipStyle = useMemo(() => ({ fontSize: theme.fontSizes.sm }), [theme.fontSizes.sm])
export default memo(TooltipIcon)
```

**Conclusion:** VALIDATED (branch) - Prevents object recreation and adds memo wrapper.

---

## Idea 21: Memoize DataFrame Tooltip overrides

### Hypothesis
Memoizing the Popover overrides and style objects will prevent object recreation on every render.

### Target files
- `frontend/lib/src/components/widgets/DataFrame/Tooltip.tsx`

### Anti-pattern identified
1. Large `overrides` object for Popover recreated on every render
2. Inline style object for the invisible target div recreated on every render
3. Inline style for StreamlitMarkdown recreated on every render

### Implementation approach
1. Extract `hasLightBackgroundColor` check to a variable for use in memoization
2. Use `useMemo` for `markdownStyle`, `popoverOverrides`, and `targetStyle`

### Results

**Implementation:**
```typescript
const markdownStyle = useMemo(() => ({ fontSize: fontSizes.sm }), [fontSizes.sm])
const popoverOverrides = useMemo(() => ({
  Body: { style: {...} },
  Inner: { style: {...} },
}), [...])
const targetStyle = useMemo(() => ({ position: "fixed", top, left }), [top, left])
```

**Conclusion:** VALIDATED (branch) - Prevents object recreation per render in DataFrame tooltips.

---

## Idea 22: Memoize Popover overrides

### Hypothesis
Memoizing the large overrides object will prevent object recreation on every render.

### Target files
- `frontend/lib/src/components/elements/Popover/Popover.tsx`

### Anti-pattern identified
Large inline `overrides={{...}}` object with many theme-dependent properties recreated on every render.

### Implementation approach
Use `useMemo` to memoize the overrides object with theme, stretchWidth, and calculatedWidth as dependencies.

### Results

**Implementation:**
```typescript
const popoverOverrides = useMemo(() => ({
  Body: {
    props: { "data-testid": "stPopoverBody" },
    style: () => ({...}),
  },
}), [theme, stretchWidth, calculatedWidth])
```

**Conclusion:** VALIDATED (branch) - Prevents large object recreation per render.

---

## Idea 23: Memoize Tabs overrides

### Hypothesis
Memoizing the UITabs overrides will prevent object recreation on every render.

### Target files
- `frontend/lib/src/components/elements/Tabs/Tabs.tsx`

### Anti-pattern identified
The `overrides` object for UITabs with TabHighlight, TabBorder, TabList, and Root styles was recreated on every render.

### Implementation approach
Use `useMemo` to memoize the tabsOverrides object with the relevant theme values and isStale state as dependencies.

### Results

**Implementation:**
```typescript
const tabsOverrides = useMemo(() => ({
  TabHighlight: { style: () => ({...}) },
  TabBorder: { style: () => ({...}) },
  TabList: { props: { ref: tabListRef }, style: () => ({...}) },
  Root: { style: () => ({...}) },
}), [theme.colors.primary, theme.colors.borderColorLight, theme.spacing.lg, TAB_BORDER_HEIGHT, isStale])
```

**Conclusion:** VALIDATED (branch) - Prevents overrides object recreation per render.

---

## Idea 24: Memoize ModalHeader/Body/Footer inline styles

### Hypothesis
Memoizing inline styles in Modal sub-components will prevent object recreation.

### Analysis
This is covered by Idea 17 - all Modal component style memoization was implemented together.

**Conclusion:** COVERED by Idea 17 - all included in Modal changes.

---

## Idea 25: Extract VirtualDropdown itemKey function

### Hypothesis
Extracting the itemKey function to module scope will prevent function recreation.

### Analysis
This is covered by Idea 19 - the itemKey function was extracted to module scope as part of the VirtualDropdown optimization.

**Conclusion:** COVERED by Idea 19 - extracted to module scope.

---

## Idea 28: PlotlyChart: Optimize applyTheming function

### Hypothesis
Replacing the JSON stringify/parse cycle in `applyTheming` with direct object manipulation will improve theme application performance, especially for large charts.

### Target files
- `frontend/lib/src/components/elements/PlotlyChart/CustomTheme.tsx`
- `frontend/lib/src/components/elements/PlotlyChart/utils.ts`

### Anti-pattern identified
At lines 183-198:
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

This pattern:
1. Stringifies the entire figure object
2. Does multiple string `replaceAll` operations for color replacement
3. Parses it back to JSON

### Implementation approach
Perform color replacements directly on the object using a recursive traversal function instead of serializing the figure to a string and parsing it again. `applyTheming` now uses object-spec traversal before applying the Streamlit template.

### Results
Focused large themed Plotly benchmark, comparing this change against a temporary control build:

| Metric | Control | Optimized | Change |
|--------|---------|-----------|--------|
| TestExecutionTime | 3.8736s | 3.7728s | -2.6% |
| TaskDuration | 2.3115s | 2.2520s | -2.6% |
| ScriptDuration | 0.4540s | 0.4375s | -3.6% |
| JSHeapUsedSize | 60.1MB | 54.9MB | -8.7% |
| Main renders | 23 | 23 | unchanged |
| Main render duration | 33.7ms | 33.8ms | flat |
| Long tasks | 4 | 3 | -25.0% |

Benchmark artifacts:
- Control: `.benchmarks/playwright/20260504163246_test_plotly_theme_application_performance[chromium].json`
- Optimized: `.benchmarks/playwright/20260504163157_test_plotly_theme_application_performance[chromium].json`

Verification:
- `make frontend-types`
- `yarn workspace @streamlit/lib test src/components/elements/PlotlyChart/PlotlyChart.test.tsx src/components/elements/PlotlyChart/utils.test.ts src/components/elements/PlotlyChart/CustomTheme.test.tsx`

**Conclusion:** KEEP - small but consistent positive result on JS/task/heap metrics for large themed charts.

---

## Idea 29: PlotlyChart: Config recreation on fullscreen toggle

### Hypothesis
Using refs for fullscreen state in the click handler will prevent config recreation on every fullscreen toggle.

### Target files
- `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx`

### Anti-pattern identified
`plotlyConfig` useMemo includes `isFullScreen`, `expand`, and `collapse` as dependencies, causing config recreation on fullscreen toggle.

### Implementation approach
Use a ref for fullscreen state in the click handler:
```typescript
const isFullScreenRef = useRef(isFullScreen)
isFullScreenRef.current = isFullScreen
```

### Results
TBD - Minor improvement, low priority

### Baseline measurement
Measured together with Ideas 36 and 38 in `e2e_playwright/perf_idea_36_38_test.py`, which resizes six Plotly charts and toggles fullscreen:

| Metric | Current branch |
|--------|----------------|
| TestExecutionTime | 6.9095s |
| TaskDuration | 4.0480s |
| ScriptDuration | 0.4887s |
| JSHeapUsedSize | 37.7MB |
| Main renders | 68 |
| Main render duration | 66.2ms |
| Long tasks | 28 |

Benchmark artifact:
- `.benchmarks/playwright/20260504212103_test_plotly_resize_fullscreen_performance[chromium].json`

The fullscreen path is measurable, but the naive config-ref approach is risky because the fullscreen modebar button title/icon currently changes between "Fullscreen" and "Close fullscreen". Keeping the config reference stable without preserving that UI update would break existing fullscreen expectations.

**Conclusion:** BASELINE-MEASURED - low standalone priority. Consider only inside a broader Plotly resize/fullscreen refactor.

---

## Idea 32: DOMPurify: Move sanitization to Web Worker

### Hypothesis
Moving DOMPurify sanitization to a Web Worker will prevent main thread blocking for large HTML content.

### Target files
- `frontend/lib/src/components/elements/Html/HtmlWithJs.tsx`
- `frontend/lib/src/components/elements/Html/dompurifyHooks.ts`

### Anti-pattern identified
DOMPurify sanitization runs synchronously on the main thread. For large HTML content (e.g., complex embedded visualizations), this can block React rendering.

### Implementation approach
1. Create a Web Worker that performs DOMPurify sanitization
2. Use `useMemo` with async pattern or suspense to handle worker communication
3. Show loading state while sanitization is in progress

### Results
TBD - Impact depends on HTML content size

### Baseline measurement
Large `st.html` benchmark with three sanitized HTML blocks, each containing 1,800 rows and removable script tags:

| Metric | Current branch |
|--------|----------------|
| TestExecutionTime | 3.5508s |
| TaskDuration | 1.5463s |
| ScriptDuration | 0.3268s |
| JSHeapUsedSize | 52.4MB |
| Main renders | 52 |
| Main render duration | 191.1ms |
| Long tasks | 1 |

Benchmark artifact:
- `.benchmarks/playwright/20260504212045_test_large_html_sanitization_performance[chromium].json`

**Conclusion:** BASELINE-MEASURED - cost is real for very large `st.html` payloads, but a worker implementation still needs A/B validation and would be high complexity.

---

## Idea 33: MetricsManager: Optimize config fetch timeout handling

### Hypothesis
Making the metrics config fetch non-blocking will improve app initialization time.

### Target files
- `frontend/app/src/MetricsManager.ts`

### Anti-pattern identified
The metrics config fetch uses a 5-second timeout. While this doesn't block UI rendering, it delays metrics initialization and the localStorage caching mechanism already provides fast subsequent loads.

### Implementation approach
1. Use cached config immediately if available
2. Fetch fresh config in background without blocking
3. Update cache on successful fetch

### Results
TBD - Minor impact since localStorage caching already optimizes repeat visits

### Validation note
This was not benchmarked with Playwright because it is not a React render hot path. Source inspection shows the fallback path already checks `localStorage` first and uses `AbortSignal.timeout(5000)` only for the default metrics config fetch. That fetch does not block app rendering in the same way as chart, DataFrame, or HTML work.

**Conclusion:** SKIPPED - low priority. Existing localStorage caching handles the common case, and this is not a good fit for frontend render performance benchmarking.

---

## Idea 36: PlotlyChart: Use react-plotly.js useResizeHandler prop

### Hypothesis
Using react-plotly.js's built-in `useResizeHandler` prop will automatically handle window resize events by calling `Plotly.Plots.resize()` instead of triggering React re-renders, significantly improving resize performance.

### Target files
- `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx`

### Anti-pattern identified
The current implementation manually manages resize by tracking dimensions in React state and updating the figure's layout. This causes full React re-renders on every dimension change. react-plotly.js provides a `useResizeHandler` prop that handles this more efficiently at the Plotly level.

### Implementation approach
Use the built-in resize handler instead of manual state management. According to react-plotly.js docs:

> To make a plot responsive, use `style` or `className` to set the dimensions of the element (using `width: 100%; height: 100%`), set `useResizeHandler` to `true`, set `layout.autosize` to `true`, and leave `layout.height` and `layout.width` undefined.

```typescript
<Plot
  useResizeHandler={true}
  style={{ width: "100%", height: "100%" }}
  layout={{
    ...plotlyFigure.layout,
    autosize: true,
    // Don't set width/height - let Plotly handle it
  }}
  // ...other props
/>
```

**Key changes needed:**
1. Remove manual dimension tracking via `useCalculatedDimensions`
2. Remove the render-time `setPlotlyFigure` call for dimension changes
3. Set `useResizeHandler={true}` and `layout.autosize={true}`
4. Use CSS for responsive sizing instead of explicit pixel dimensions
5. Verify compatibility with fullscreen mode and selection features

### Results
From old docs analysis:
- **Expected:** Could eliminate most resize-related re-renders entirely
- **Impact:** ~10x faster resize performance

### Baseline measurement
Measured current Plotly resize/fullscreen behavior in `e2e_playwright/perf_idea_36_38_test.py`:

| Metric | Current branch |
|--------|----------------|
| TestExecutionTime | 6.9095s |
| TaskDuration | 4.0480s |
| ScriptDuration | 0.4887s |
| JSHeapUsedSize | 37.7MB |
| Main renders | 68 |
| Main render duration | 66.2ms |
| Long tasks | 28 |

Benchmark artifact:
- `.benchmarks/playwright/20260504212103_test_plotly_resize_fullscreen_performance[chromium].json`

**Conclusion:** BASELINE-MEASURED - the hot path is confirmed. Still pending actual `useResizeHandler` implementation and compatibility validation for width/height settings, fullscreen mode, and selection behavior.

---

## Idea 38: PlotlyChart: Consolidate state updates with reducer pattern

### Hypothesis
Consolidating the multiple `setPlotlyFigure` calls into a single reducer pattern will prevent state update cascades and make the component easier to reason about.

### Target files
- `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.tsx`

### Anti-pattern identified
The component has 5+ places that call `setPlotlyFigure`:
- Theme change effect
- Selection mode effect
- Dimension change (during render)
- Selection reset timeout
- Dragmode effect

Each call triggers a re-render, and some can trigger others in a cascade.

### Implementation approach
Use a reducer to batch state updates:
```typescript
type PlotlyAction =
  | { type: 'SET_DIMENSIONS'; width: number; height: number }
  | { type: 'SET_THEME'; theme: EmotionTheme; chartTheme: string }
  | { type: 'SET_SELECTION_MODE'; modes: SelectionModes }
  | { type: 'RESET_SELECTION' }
  | { type: 'SET_DRAGMODE'; dragmode: string }

const [plotlyState, dispatch] = useReducer(plotlyReducer, initialState)
```

### Results
TBD - Expected to reduce render cascades and simplify state management

### Baseline measurement
Measured together with Idea 36 in the Plotly resize/fullscreen benchmark:

| Metric | Current branch |
|--------|----------------|
| TestExecutionTime | 6.9095s |
| TaskDuration | 4.0480s |
| ScriptDuration | 0.4887s |
| Main renders | 68 |
| Main render duration | 66.2ms |
| Long tasks | 28 |

**Conclusion:** BASELINE-MEASURED - Plotly state/update cost remains visible, but a reducer pattern has not been A/B tested. Keep this as a cleanup/refactor candidate rather than a proven standalone performance win.

---

## Idea 39: DataFrame: Adaptive widget debouncing

### Hypothesis
Replacing the fixed 150ms debounce with adaptive debouncing based on interaction type will improve user experience for fast interactions while still protecting against excessive updates for complex operations.

### Target files
- `frontend/lib/src/components/widgets/DataFrame/hooks/useWidgetState.ts`

### Anti-pattern identified
A fixed 150ms debounce is used for all widget state updates:
```typescript
export const DEBOUNCE_TIME_MS = 150
```

This is suboptimal because:
- Fast interactions (single clicks) feel sluggish with 150ms delay
- Complex operations (multi-select, range selection) might benefit from longer debounce
- The delay doesn't adapt to the user's interaction pattern

### Implementation approach
Implement adaptive debouncing based on interaction type or frequency:
```typescript
const getDebounceTime = (interactionType: 'single' | 'bulk' | 'rapid') => {
  switch (interactionType) {
    case 'single': return 50  // Fast feedback for single selections
    case 'bulk': return 150   // Standard delay for bulk operations
    case 'rapid': return 250  // Longer delay for rapid repeated actions
  }
}
```

### Results
From old docs:
- Expected improvement in perceived responsiveness for single selections
- Reduced backend load for bulk operations

### Baseline measurement
Repeated row-selection benchmark with `st.dataframe(..., on_select="rerun", selection_mode="multi-row")`:

| Metric | Current branch |
|--------|----------------|
| TestExecutionTime | 5.7273s |
| TaskDuration | 0.4796s |
| ScriptDuration | 0.2009s |
| JSHeapUsedSize | 18.6MB |
| Main renders | 100 |
| Main render duration | 54.4ms |
| Long tasks | 0 |

Benchmark artifact:
- `.benchmarks/playwright/20260504212118_test_dataframe_selection_debounce_performance[chromium].json`

**Conclusion:** BASELINE-MEASURED - repeated selections produce many Main commits, but JS/task cost is low and there are no long tasks. Adaptive debouncing may still improve perceived responsiveness, but it is not a clear high-ROI performance target from this benchmark alone.

---

## Idea 40: Context change cascading re-renders

### Hypothesis
Splitting frequently-changing context values into separate contexts or using context selectors will reduce unnecessary re-renders caused by context changes.

### Target files
- `frontend/lib/src/components/core/` (multiple context providers)

### Anti-pattern identified
Some contexts contain values that change frequently, potentially causing unnecessary re-renders of all consumers:

Key contexts to analyze:
- `ScriptRunContext` - Changes on every script run state change
- `FlexContext` - Changes based on layout hierarchy  
- `ElementFullscreenContext` - Changes on dimension updates

When a context value object changes (even if individual fields are unchanged), all consumers re-render.

### Implementation approach
1. **Split contexts** into static and dynamic portions
2. **Use context selectors** (via use-context-selector library or React 19 `use`)
3. **Ensure context values are memoized**

### Results
From old docs analysis:
- Most contexts already use useMemo (good)
- Potential for improvement in high-frequency update scenarios

### Baseline measurement
Comprehensive rerun benchmark with Plotly, JSON, GraphViz, Metric, markdown, code, and info elements:

| Metric | Current branch |
|--------|----------------|
| TestExecutionTime | 2.4390s |
| TaskDuration | 1.0560s |
| ScriptDuration | 0.6647s |
| JSHeapUsedSize | 42.2MB |
| Main renders | 75 |
| Main render duration | 86.3ms |
| Long tasks | 2 |

Benchmark artifact:
- `.benchmarks/playwright/20260504212142_test_rerun_performance[chromium].json`

**Conclusion:** BASELINE-MEASURED - rerun work is visible, but this benchmark does not isolate context churn from element rendering. Keep as audit-only unless profiler evidence points at a specific context provider.

---

## Idea 42: useResizeObserver coalescing and equality guard

### Hypothesis
`useResizeObserver` is a shared resize hot path. Coalescing pending animation-frame updates and skipping state updates when measured values are unchanged should reduce JavaScript and React work during rapid resize interactions.

### Target files
- `frontend/lib/src/hooks/useResizeObserver.ts`
- Validation fixture: `e2e_playwright/perf_idea_42_test.py`

### Implementation
- Track the latest measured values in a ref.
- Skip `setValues` when the measured values are shallow-equal to the previous values.
- Avoid queueing multiple pending `requestAnimationFrame` callbacks for the same observer.

### Validation
Focused rapid-resize benchmark, comparing this change against a temporary control build with only this proposal backed out:

| Metric | Control | Optimized | Change |
|--------|---------|-----------|--------|
| TestExecutionTime | 3.3745s | 3.7906s | +12.3% |
| TaskDuration | 1.3438s | 1.1968s | -10.9% |
| ScriptDuration | 0.7799s | 0.6242s | -20.0% |
| Main renders | 217 | 211 | -2.8% |
| Main render duration | 487.8ms | 351.6ms | -27.9% |
| Long tasks | 0 | 0 | unchanged |

**Conclusion:** KEEP - mixed but positive for the metrics most directly tied to frontend work. The total wall-clock test time was noisy/worse, but JavaScript duration, React render count, and render duration improved.

---

## Idea 43: CustomComponent JSON arg parsing memoization

### Hypothesis
Custom components can receive large JSON argument payloads. `tryParseArgs` was called during render, so unchanged `jsonArgs` still paid parsing and special-argument merge costs whenever the component re-rendered for unrelated reasons.

### Target files
- `frontend/lib/src/components/widgets/CustomComponent/ComponentInstance.tsx`

### Implementation
- Wrap `tryParseArgs(jsonArgs, specialArgs, setComponentError, componentError)` in `useMemo`.
- Keep dependencies tied to the values that affect parsing: `jsonArgs`, `specialArgs`, and `componentError`.

### Validation
- Targeted unit test run:
  - `yarn workspace @streamlit/lib test src/components/widgets/CustomComponent/ComponentInstance.test.tsx`
- Included in the combined targeted frontend test run with DataFrame hook tests: 62 tests passed.

**Conclusion:** KEEP - unit-validated code quality improvement. This should help component-heavy apps with stable args, but it was not assigned a measured e2e perf percentage because no custom-component benchmark fixture was added.

---

## Idea 44: DataFrame configured column derivation reuse

### Hypothesis
`useColumnLoader` initialized Arrow columns and applied column config separately for `allColumns` and visible `columns`. Reusing the configured `allColumns` list and deriving visible columns from it removes duplicated column-type/configuration work, especially for wide DataFrames.

### Target files
- `frontend/lib/src/components/widgets/DataFrame/hooks/useColumnLoader.ts`
- Validation fixture: `e2e_playwright/perf_idea_44_45_test.py`

### Implementation
- Compute configured `allColumns` once from `initAllColumnsFromArrow(data)`.
- Include wrapping metadata in the single configured list.
- Derive visible columns by filtering hidden columns from `allColumns`, then apply ordering and pinning.

### Validation
Validated together with Idea 45 in a wide `st.data_editor` hover benchmark:

| Metric | Control | Optimized | Change |
|--------|---------|-----------|--------|
| TestExecutionTime | 4.6917s | 4.6894s | flat |
| TaskDuration | 0.5892s | 0.5434s | -7.8% |
| ScriptDuration | 0.1762s | 0.1719s | -2.5% |
| Main renders | 122 | 121 | -0.8% |
| Main render duration | 49.4ms | 44.8ms | -9.3% |
| Long tasks | 0 | 0 | unchanged |

Targeted hook tests passed:
- `useColumnLoader.test.ts`
- `useRowHover.test.ts`
- `useTooltips.test.ts`

**Conclusion:** KEEP - small measured win with a cleaner derivation path. This is most likely to matter for wide DataFrames or repeated column config changes.

---

## Idea 45: DataFrame hover state churn guard

### Hypothesis
DataFrame hover handlers run on high-frequency mouse movement. Repeatedly hovering the same cell/header should not reset hover state or tooltip timers.

### Target files
- `frontend/lib/src/components/widgets/DataFrame/hooks/useRowHover.ts`
- `frontend/lib/src/components/widgets/DataFrame/hooks/useTooltips.ts`
- Validation fixture: `e2e_playwright/perf_idea_44_45_test.py`

### Implementation
- In `useRowHover`, use functional state updates and return the current value when the hovered row is unchanged.
- In `useTooltips`, track the last hover target and return early for repeated hover events on the same cell/header.
- Reset the hover target when the tooltip is cleared.

### Validation
Validated together with Idea 44 in the same wide `st.data_editor` hover benchmark. The combined result was:
- TaskDuration: -7.8%
- ScriptDuration: -2.5%
- Main render duration: -9.3%
- Main renders: 122 -> 121

Targeted hook tests passed:
- `useRowHover.test.ts`
- `useTooltips.test.ts`

**Conclusion:** KEEP - small measured win on a high-frequency interaction path with low implementation risk.

---

## Idea 46: DeckGL tooltip parsing and selection Set memoization

### Hypothesis
DeckGL hover and fill-color callbacks might benefit from memoizing JSON5 tooltip parsing and converting selected indices to `Set`s for O(1) lookup.

### Target files
- `frontend/lib/src/components/elements/DeckGlJsonChart/useDeckGl.tsx`
- Validation fixture: `e2e_playwright/perf_idea_46_test.py`

### Implementation tested
- Memoized parsed tooltip template instead of parsing inside `getTooltip`.
- Converted selection index arrays to `Set`s before fill-color callbacks.

### Validation
Focused DeckGL hover/selection benchmark, comparing this change against a temporary control build:

| Metric | Control | Optimized | Change |
|--------|---------|-----------|--------|
| TestExecutionTime | 5.6184s | 7.1076s | +26.5% |
| TaskDuration | 3.1995s | 4.7560s | +48.6% |
| ScriptDuration | 1.0338s | 1.7174s | +66.1% |
| Main renders | 66 | 59 | -10.6% |
| Main render duration | 63.3ms | 110.7ms | +74.9% |
| Long tasks | 15 | 21 | +40.0% |

**Conclusion:** REVERTED - despite fewer React renders, the DeckGL interaction benchmark regressed substantially. The extra memoization/Set construction appears more expensive than the original hover/click paths in this scenario.

---

## Idea 47: StreamlitMarkdown typographical-symbol plugin gating

### Hypothesis
`createRemarkTypographicalSymbols` visits all text nodes to replace shorthand symbols such as arrows and comparisons. Most markdown strings, especially widget labels and table headers, do not contain these sequences. Skipping this plugin unless the source contains relevant shorthand syntax should reduce markdown parsing work on common simple markdown inputs.

### Target files
- `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`
- Validation fixture: `e2e_playwright/perf_idea_47_50_test.py`

### Implementation tested
- Added a conservative source predicate for supported typographical shorthand tokens.
- Removed `createRemarkTypographicalSymbols()` from the unconditional base plugin list.
- Added the plugin back only when the source contains a supported shorthand token.

### Validation
Validated together with Ideas 48 and 49 in a markdown-heavy benchmark with repeated markdown blocks, widget labels, and metric labels/values:

| Metric | Control | Optimized | Change |
|--------|---------|-----------|--------|
| TestExecutionTime | 2.7992s | 2.9334s | +4.8% |
| TaskDuration | 0.6488s | 0.7476s | +15.2% |
| ScriptDuration | 0.2903s | 0.3143s | +8.3% |
| JSHeapUsedSize | 44.1MB | 32.1MB | -27.3% |
| Main renders | 56 | 52 | -7.1% |
| Main render duration | 157.8ms | 161.7ms | +2.5% |
| Long tasks | 0 | 0 | unchanged |

Benchmark artifacts:
- Control: `.benchmarks/playwright/20260504171943_test_streamlit_markdown_rendering_performance[chromium].json`
- Optimized: `.benchmarks/playwright/20260504172408_test_streamlit_markdown_rendering_performance[chromium].json`

**Conclusion:** MIXED/NEGATIVE - fewer renders and much lower heap, but worse wall-clock, task, script, and render duration. Do not rank as a validated win without isolating the individual markdown changes.

---

## Idea 48: StreamlitMarkdown material preprocessing guard

### Hypothesis
`processedSource` always calls `source.replaceAll(":material/", ":material_")`. This scans every markdown source even though material icon shorthand is uncommon. Guarding the replacement with `source.includes(":material/")` avoids unnecessary work for the common case.

### Target files
- `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`

### Implementation tested
Change preprocessing to reuse `source` directly unless `source.includes(":material/")` is true. Preserve existing replacement behavior for sources that contain material icon shorthand.

### Validation
Tested only as part of the combined Ideas 47-49 markdown benchmark. The combined benchmark was mixed/negative:
- Main renders: 56 -> 52
- JSHeapUsedSize: -27.3%
- TaskDuration: +15.2%
- ScriptDuration: +8.3%

**Conclusion:** MIXED/NEEDS ISOLATION - very low risk, but the combined markdown benchmark does not prove a standalone performance win.

---

## Idea 49: StreamlitMarkdown redundant heading state update guard

### Hypothesis
Heading rendering can set heading anchor state from a ref callback. If the computed anchor is unchanged, calling the state setter is unnecessary and may cause extra work in heading-heavy markdown documents.

### Target files
- `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`

### Implementation tested
Use a functional state update and return the existing value when it already matches the computed anchor. Explicit anchors, generated anchors, and empty heading text should keep the same behavior.

### Validation
Tested only as part of the combined Ideas 47-49 markdown benchmark. The combined benchmark was mixed/negative:
- Main renders: 56 -> 52
- Main render duration: 157.8ms -> 161.7ms
- TestExecutionTime: 2.7992s -> 2.9334s

**Conclusion:** MIXED/NEEDS ISOLATION - the guard is small and localized, but the combined benchmark did not show a clear win.

---

## Idea 50: StreamlitMarkdown broad memoization audit

### Hypothesis
`StreamlitMarkdown` already memoizes many internal values and exports a memoized component, but markdown appears in many high-volume call sites. There may still be measurable prop-reference churn at call sites or wrapper layers that causes avoidable rerenders.

### Target files
- `frontend/lib/src/components/shared/StreamlitMarkdown/StreamlitMarkdown.tsx`
- High-volume call sites in `frontend/lib/src/components/widgets/`, `frontend/lib/src/components/elements/Table/`, and `frontend/lib/src/components/elements/Metric/`

### Anti-pattern identified
Broad memoization was previously assumed to be mostly covered, but this has not been validated with markdown-specific render-count benchmarks across common call sites.

### Implementation approach
Profile markdown-heavy apps first, then only memoize concrete unstable props, callback objects, or wrapper components that show up in render traces. Avoid adding generic `useMemo` wrappers where dependencies already preserve stable references.

### Validation plan
Create a benchmark with many repeated widget labels, metric labels/values, table headers, and markdown blocks. Compare render counts and render duration before and after any targeted memoization changes.

### Validation so far
The markdown-heavy benchmark from Ideas 47-49 provides partial evidence:
- Main renders improved from 56 to 52 and heap dropped by 27%.
- TestExecutionTime, TaskDuration, ScriptDuration, and Main render duration all regressed in the combined micro-optimization test.
- No concrete unstable prop or call-site memoization target was isolated.

**Conclusion:** PARTIALLY MEASURED - keep this as an audit item, but do not implement broad memoization without component-level profiler evidence. The central `StreamlitMarkdown` component is already partially optimized.

---

## Additional Ideas from Old Documents (Not Prioritized)

The following ideas were identified but deemed lower priority or already addressed:

1. **Canvas vs SVG renderer for Vega** - Requires API change, not backward compatible
2. **Lazy loading Vega libraries** - Out of scope, affects initial load not resize
3. **Virtual rendering for many charts** - Large refactor, deferred
4. **Window-level resize batching** - Mixed results in experiments, reverted
5. **DataFrame layout effects debouncing** - Experiments showed regression, reverted
6. **CSS containment for charts** - Experiments showed regression, reverted
7. **DeckGL tooltip parsing and selection Sets** - Focused interaction benchmark regressed, reverted
