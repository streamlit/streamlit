---
author: lukasmasuch
created: 2026-05-09
---

# Component-Owned Arrow Data Derivations

## Summary

Move frontend Arrow-derived data models out of `ElementNode` and into the components that render
them: `Table`, `DataFrame`, and `ArrowVegaLiteChart`. Keep `Quiver` immutable, pass
`node.elementHash` through as `elementHash`, and let each component memoize the parsing it needs.

This is a frontend architecture refactor only. It introduces no public API changes and is not
tied to any user-facing feature.

## Problem

`ElementNode` currently owns derived frontend data models:

- `quiverElement` constructs a `Quiver` for `table` and `dataframe`.
- `vegaLiteChartElement` constructs a Vega-Lite wrapper containing `Quiver` instances for chart
  data and named datasets.
- `withPreservedDerivations()` copies those cached derived objects when a new `ForwardMsg` reuses
  an existing payload via matching `elementHash`.

This mixes two responsibilities:

- The render tree stores proto payloads, lifecycle metadata, and app layout.
- Components parse those payloads into the data models they need to render.

After recent `add_rows` cleanup, the render tree no longer needs to own dataframe data mutation.
Keeping table/dataframe/chart parsing on `ElementNode` now makes the render tree aware of
component-specific data models without a strong architectural reason.

## Render-Tree Benefits and Replacements

The current render-tree cache has benefits, but they do not require render-tree ownership:

| Current benefit | Component-owned replacement |
| --- | --- |
| Arrow bytes are parsed only when the element renders and asks for `node.quiverElement`. | Components parse with `useMemo`, so parsing still happens only when the component renders. |
| Parsed objects are preserved when `ForwardMsg.hash`/`ref_hash` reuses the same payload. | `AppRoot` still reuses the same proto payload. Components receive `elementHash` and include it in memoization dependencies. |
| Renderers receive ready derived data from one place. | Each component keeps its own parsing close to the rendering logic. This is clearer because table, dataframe, and Vega-Lite have different data-shaping needs. |
| Cached object identity can survive some component remounts while the render-tree node remains alive. | Remounts are uncommon, and reparsing in that case is acceptable. Avoid adding another cache unless profiling shows a concrete issue. |

The remaining argument for render-tree ownership is cache lifetime across rare remounts. That
does not justify keeping component data models on `ElementNode`.

## Proposal

Refactor Arrow-derived render-tree data into component-owned memoization:

1. Stop passing `node.quiverElement` and `node.vegaLiteChartElement` from `ElementNodeRenderer`.
2. Pass the proto plus `node.elementHash` to `Table`, `DataFrame`, and `ArrowVegaLiteChart`.
3. Construct `Quiver` and Vega-Lite wrapper data inside those components with local `useMemo`.
4. Remove `ElementNode`'s derived-data caches and `withPreservedDerivations()`.
5. Keep `Quiver` immutable.

This unifies render logic: `ElementNodeRenderer` maps element proto to React component, and leaf
components own the parsed data models required to render those payloads.

## Component Changes

### Renderer

`ElementNodeRenderer` should pass proto and payload identity only:

```tsx
<Table
  element={tableProto}
  elementHash={node.elementHash}
  {...elementProps}
/>

<ArrowDataFrame
  key={dataframeProto.id || undefined}
  element={dataframeProto}
  elementHash={node.elementHash}
  {...widgetProps}
/>

<ArrowVegaLiteChart
  element={vegaLiteChartProto}
  elementHash={node.elementHash}
  key={vegaLiteChartProto.id || undefined}
  {...widgetProps}
/>
```

After this change, `ElementNodeRenderer` should not call `node.quiverElement` or
`node.vegaLiteChartElement`.

### Table

Change `TableProps` from caller-provided `data: Quiver` to component-owned parsing:

```typescript
export interface TableProps {
  element: TableProto
  elementHash?: string
  widthConfig?: streamlit.IWidthConfig | null
  heightConfig?: streamlit.IHeightConfig | null
}
```

Inside `Table`:

```typescript
const table = useMemo(
  () => new Quiver(element.arrowData as IArrowData),
  [elementHash, element.arrowData]
)
```

All existing table rendering logic can continue to consume `table` exactly as it does today.

### DataFrame

Change `DataFrameProps` from caller-provided `data: Quiver` to component-owned parsing:

```typescript
export interface DataFrameProps {
  element: DataframeProto
  elementHash?: string
  disabled: boolean
  widgetMgr: WidgetStateManager | undefined
  disableFullscreenMode?: boolean
  fragmentId?: string
  customToolbarActions?: React.ReactNode[]
  widthConfig?: streamlit.IWidthConfig | null
  heightConfig?: streamlit.IHeightConfig | null
}
```

Inside `DataFrame`:

```typescript
const data = useMemo(
  () => new Quiver(element.arrowData as IArrowData),
  [elementHash, element.arrowData]
)
```

If the dataframe component later needs more data-shaping logic, it can extract this into a
dataframe-local hook. There is no need to create a shared table/dataframe helper upfront.

### Vega-Lite

Change `ArrowVegaLiteChart` to receive the proto and construct its current internal
`VegaLiteChartElement` wrapper locally:

```typescript
export interface Props {
  element: VegaLiteChartProto
  elementHash?: string
  widgetMgr: WidgetStateManager
  fragmentId?: string
  disableFullscreenMode?: boolean
  widthConfig: streamlit.IWidthConfig | null | undefined
  heightConfig: streamlit.IHeightConfig | null | undefined
}
```

Inside `ArrowVegaLiteChart`:

```typescript
const inputElement = useMemo(
  () => ({
    data: element.data ? new Quiver(element.data) : null,
    spec: element.spec,
    datasets:
      element.datasets.length > 0 ? wrapDatasets(element.datasets) : [],
    useContainerWidth: element.useContainerWidth,
    vegaLiteTheme: element.theme,
    id: element.id,
    selectionMode: element.selectionMode,
    formId: element.formId,
  }),
  [elementHash, element]
)
```

Most chart code can remain unchanged after this line, because it already works with
`VegaLiteChartElement`. Vega-Lite is the only component that needs this wrapper, so the conversion
can stay local to the chart component or its existing `arrowUtils` module.

## Render-Tree Cleanup

After `Table`, `DataFrame`, and `ArrowVegaLiteChart` own their parsing:

- Remove the private Quiver and Vega-Lite cache fields from `ElementNode`.
- Remove `quiverElement` and `vegaLiteChartElement` getters.
- Remove `withPreservedDerivations()`.
- Simplify `AppRoot.addElement()` to create a new `ElementNode` directly when payload reuse
  happens. Payload reuse should still reuse the same proto payload; only derived object copying is
  removed.
- Remove render-tree tests that assert `ElementNode` parses Arrow data.

`ElementNode` should remain an immutable render-tree node that stores proto payload and lifecycle
metadata only.

## Rollout Plan

This can be implemented in one PR because the affected surface is narrow:

1. Add `elementHash` props to `Table`, `DataFrame`, and `ArrowVegaLiteChart`.
2. Update those components to construct their derived data locally with `useMemo`.
3. Update `ElementNodeRenderer` to pass proto plus `elementHash`.
4. Delete render-tree derived-data caches from `ElementNode`.
5. Update tests.

## Alternatives Considered

### Keep render-tree derived data

This preserves the current cache lifetime and avoids touching table/chart/dataframe props. It also
keeps `ElementNode` coupled to three separate component data models.

Rejected. The render tree should not own component-specific Arrow derivations. The only meaningful
loss is parsed object survival across rare component remounts, and reparsing in that case is
acceptable.

### Add shared conversion helpers

This would centralize Arrow-to-`Quiver` and Vega-Lite wrapper construction outside the render tree.

Rejected for the initial refactor. Table and dataframe may grow different data-shaping needs, and
Vega-Lite is the only component that needs the chart wrapper. Keep the code close to the component
until duplication becomes real.

### Refactor dataframe only

This would reduce the immediate diff, but it leaves the same ownership pattern in table and
Vega-Lite.

Rejected. All three elements currently depend on render-tree-owned parsed data. Moving all of
them makes `ElementNodeRenderer` simpler and gives the render tree one consistent responsibility.

## Testing

- Update `Table` and `DataFrame` tests to pass proto input instead of a prebuilt `Quiver`.
- Update `ArrowVegaLiteChart` tests to pass `VegaLiteChartProto`; keep lower-level hook tests on
  `VegaLiteChartElement` where appropriate.
- Update `ElementNodeRenderer` tests/snapshots for the prop changes.
- Remove `ElementNode.quiverElement` and `ElementNode.vegaLiteChartElement` tests after the
  getters are deleted.
- Add focused tests or assertions that repeated renders with the same `elementHash` and proto
  object do not reparse unnecessarily.

## Recommendation

Move all current Arrow-derived frontend data models out of the render tree. Use `elementHash` as
the payload identity hint passed from `ElementNodeRenderer`, but keep parsing logic local to each
component.

The cleaner boundary is: render tree stores proto payload and lifecycle metadata; components own
the parsed data models required to render those payloads.
