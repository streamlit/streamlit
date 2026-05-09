---
author: lukasmasuch
created: 2026-05-09
---

# Component-Owned Arrow Data Derivations

## Summary

Move frontend Arrow-derived data models out of `ElementNode` and into the components that render
them: `Table`, `DataFrame`, and `ArrowVegaLiteChart`. Keep `Quiver` immutable, pass
`node.elementHash` to these components as a payload identity hint, and use component-local hooks
or shared helpers for memoized parsing.

This is a frontend architecture refactor only. It introduces no public API changes.

## Problem

`ElementNode` currently owns derived frontend data models:

- `quiverElement` constructs a `Quiver` for `table` and `dataframe`.
- `vegaLiteChartElement` constructs a Vega-Lite wrapper containing `Quiver` instances for chart
  data and named datasets.
- `withPreservedDerivations()` copies those cached derived objects when a new `ForwardMsg` reuses
  an existing payload via matching `elementHash`.

This made sense when the render tree was also involved in dataframe mutation paths such as older
`add_rows` behavior. After recent `add_rows` cleanup, the render tree no longer needs to own
dataframe data mutation. Dataframe lazy loading makes the coupling more visible: chunk loading
needs component lifecycle, request subscriptions, visible range knowledge, sort state,
`DataEditorRef.updateCells()`, loading cells, and error cells. Those are component concerns.

The same ownership argument applies to eager `st.table` and Vega-Lite charts. They do not need
lazy loading, but their Arrow parsing is still rendering-specific component work. Keeping their
derived objects on `ElementNode` makes the render tree a mixed app-tree/data-model layer.

## Render-Tree Benefits and Replacements

The current render-tree cache has benefits, but none require the render tree as the owner:

| Current benefit | Component-owned replacement |
| --- | --- |
| Arrow bytes are parsed lazily only when the element renders. | Components parse with `useMemo`, so parsing still happens only when the component renders. |
| Parsed objects are preserved when `ForwardMsg.hash`/`ref_hash` reuses the same payload. | Pass `node.elementHash` as `payloadHash`; memoize parsing against `payloadHash` plus proto object identity. |
| Table/dataframe renderers receive ready `Quiver` instances from one conversion point. | Use shared hooks/helpers such as `useQuiverFromArrowData` and `useVegaLiteChartElement`. The conversion point moves out of the render tree, not into duplicated code. |
| Cached `Quiver` identity can survive some component remounts while the render-tree node remains alive. | This is the only meaningful behavioral difference. If remount reparsing becomes measurable, add a small frontend `ArrowDataCache` keyed by `payloadHash`. It does not need to live on `ElementNode`. |

The remaining argument for render-tree ownership is cache lifetime, not correctness. That is not
strong enough to keep the render tree coupled to table/dataframe/chart internals.

## Prior Art: Prototype PR #11032

Prototype PR [#11032](https://github.com/streamlit/streamlit/pull/11032) validates several useful
pieces of the lazy-loading model:

- A non-rerun `BackMsg` request can ask the backend for a dataframe chunk.
- The frontend can return Glide `LoadingCell` values while a chunk is missing.
- Loaded chunks need to trigger `DataEditorRef.updateCells()` so visible cells refresh.
- Chunk-level Arrow payloads can be parsed back into normal `Quiver` instances.

The prototype also shows what this refactor should avoid:

- It added `Delta.add_chunk`, routed chunk responses through `AppRoot`, and mutated an
  `ElementNode`-cached `Quiver`.
- It added mutable chunk methods directly to `Quiver` (`addChunk`, `hasChunk`, `getChunk`).
- It used polling to detect when a chunk appeared before calling `updateCells()`.
- It stored user chunk callbacks in fragment storage, which is too broad and rerun-coupled for
  long-lived session dataframe sources.

The useful learning is not "make Quiver lazy"; it is "keep chunks dataframe-specific and refresh
Glide cells when chunk responses arrive."

## Proposal

Refactor all current Arrow-derived render-tree data into component-owned hooks/helpers before
starting dataframe lazy loading:

1. Stop passing `node.quiverElement` and `node.vegaLiteChartElement` from `ElementNodeRenderer`.
2. Pass the proto plus `node.elementHash` to `Table`, `DataFrame`, and `ArrowVegaLiteChart`.
3. Construct `Quiver`/Vega derived objects inside those components with shared memoized helpers.
4. Remove `ElementNode`'s derived-data caches and `withPreservedDerivations()`.
5. Keep `Quiver` immutable.

This unifies render logic: `ElementNodeRenderer` maps element proto to React component, and leaf
components own the data models they need to render.

### Shared helpers

Add lightweight shared helpers near the relevant components or in a small dataframe/chart utility
module:

```typescript
function useQuiverFromArrowData(
  arrowData: IArrowData | undefined,
  payloadHash?: string
): Quiver {
  return useMemo(() => new Quiver(arrowData as IArrowData), [
    payloadHash,
    arrowData,
  ])
}

function createVegaLiteChartElement(
  proto: VegaLiteChartProto
): VegaLiteChartElement {
  return {
    data: proto.data ? new Quiver(proto.data) : null,
    spec: proto.spec,
    datasets: proto.datasets.length > 0 ? wrapDatasets(proto.datasets) : [],
    useContainerWidth: proto.useContainerWidth,
    vegaLiteTheme: proto.theme,
    id: proto.id,
    selectionMode: proto.selectionMode,
    formId: proto.formId,
  }
}
```

The exact module names can change during implementation. The key rule is that conversion helpers
are shared by components, not owned by the render tree.

If profiling later shows excessive reparsing after component remounts, add an optional cache:

```typescript
class ArrowDataCache {
  private readonly entries = new Map<string, Quiver>()

  getOrCreate(payloadHash: string | undefined, create: () => Quiver): Quiver {
    if (!payloadHash) {
      return create()
    }

    const existing = this.entries.get(payloadHash)
    if (existing) {
      return existing
    }

    const created = create()
    this.entries.set(payloadHash, created)
    return created
  }
}
```

This should be added only if needed. The first implementation can rely on `useMemo`.

### Renderer changes

`ElementNodeRenderer` should pass proto and payload identity only:

```tsx
<Table
  element={tableProto}
  payloadHash={node.elementHash}
  {...elementProps}
/>

<ArrowDataFrame
  key={dataframeProto.id || undefined}
  element={dataframeProto}
  payloadHash={node.elementHash}
  {...widgetProps}
/>

<ArrowVegaLiteChart
  element={vegaLiteChartProto}
  payloadHash={node.elementHash}
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
  payloadHash?: string
  widthConfig?: streamlit.IWidthConfig | null
  heightConfig?: streamlit.IHeightConfig | null
}
```

Inside `Table`:

```typescript
const table = useQuiverFromArrowData(element.arrowData as IArrowData, payloadHash)
```

All existing table rendering logic can continue to consume `table` exactly as it does today.

### DataFrame

Change `DataFrameProps` from caller-provided `data: Quiver` to component-owned parsing:

```typescript
export interface DataFrameProps {
  element: DataframeProto
  payloadHash?: string
  disabled: boolean
  widgetMgr: WidgetStateManager | undefined
  disableFullscreenMode?: boolean
  fragmentId?: string
  customToolbarActions?: React.ReactNode[]
  widthConfig?: streamlit.IWidthConfig | null
  heightConfig?: streamlit.IHeightConfig | null
}
```

Add a dataframe data hook, for example
`frontend/lib/src/components/widgets/DataFrame/hooks/useDataframeData.ts`.

Initial eager-only shape:

```typescript
interface DataframeDataState {
  data: Quiver
  rowCountOverride?: number
}

function useDataframeData(
  element: DataframeProto,
  payloadHash?: string
): DataframeDataState {
  const data = useQuiverFromArrowData(
    element.arrowData as IArrowData,
    payloadHash
  )

  return { data }
}
```

### Vega-Lite

Change `ArrowVegaLiteChart` to receive the proto and construct its current internal
`VegaLiteChartElement` wrapper locally:

```typescript
export interface Props {
  element: VegaLiteChartProto
  payloadHash?: string
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
  () => createVegaLiteChartElement(element),
  [payloadHash, element]
)
```

Most chart code can remain unchanged after this line, because it already works with
`VegaLiteChartElement`. Tests for lower-level hooks such as `useVegaElementPreprocessor` can keep
using `VegaLiteChartElement` directly.

### Remove render-tree derived data

After `Table`, `DataFrame`, and `ArrowVegaLiteChart` own their parsing:

- Remove `lazyQuiverElement` and `lazyVegaLiteChartElement` from `ElementNode`.
- Remove `quiverElement` and `vegaLiteChartElement` getters.
- Remove `withPreservedDerivations()`.
- Simplify `AppRoot.addElement()` to create a new `ElementNode` directly when payload reuse
  happens. Payload reuse should still reuse the same proto payload; only derived object copying is
  removed.
- Remove render-tree tests that assert `ElementNode` parses Arrow data.

`ElementNode` should remain an immutable render-tree node that stores proto payload and lifecycle
metadata only.

### Lazy dataframe extension point

When lazy dataframe metadata is added, extend `useDataframeData()` rather than reintroducing a
lazy branch to `ElementNode`:

```typescript
interface DataframeDataState {
  data: Quiver
  rowCountOverride?: number
  lazyCache?: LazyDataframeCache
}
```

Lazy loading should keep the initial schema/rows as an immutable `Quiver`, while mutable
loaded/loading/failed chunk state lives in `LazyDataframeCache`. Loaded chunks should be parsed
into separate immutable `Quiver` instances.

The implementation must preserve React's Rules of Hooks when a dataframe switches between eager
and lazy modes across reruns. Prefer optional-input/enabled hooks or a keyed child component
boundary instead of conditionally calling different hooks.

## Rollout Plan

### Phase 1: Component-owned eager derivations

- Add `payloadHash` props to `Table`, `DataFrame`, and `ArrowVegaLiteChart`.
- Add shared helpers for Arrow-to-`Quiver` and Vega-Lite proto-to-wrapper conversion.
- Update `Table`, `DataFrame`, and `ArrowVegaLiteChart` to construct derived data locally.
- Update `ElementNodeRenderer` to pass proto plus `payloadHash`.
- Delete render-tree derived-data caches from `ElementNode`.

This phase should land before dataframe lazy loading.

### Phase 2: Dataframe lazy loading

- Extend `useDataframeData()` for `element.lazyData`.
- Add `LazyDataframeCache` and chunk-response subscription handling in dataframe hooks.
- Keep chunk request/response handling out of `ElementNode` and `AppRoot`.
- Trigger `DataEditorRef.updateCells()` directly from dataframe chunk response handling.

This phase is part of the lazy loading project.

### Phase 3: Optional shared cache

If profiling shows meaningful reparsing after component remounts, add a small frontend cache keyed
by `payloadHash`. Do this only with evidence; avoid rebuilding the render-tree cache under a new
name unless there is a measurable problem.

## Alternatives Considered

### Keep render-tree derived data

This preserves the current cache lifetime and avoids touching table/chart/dataframe props. It also
keeps `ElementNode` coupled to three separate component data models.

Rejected. The same benefits can be replicated with component `useMemo`, `payloadHash`, shared
helpers, and, if needed, a small dedicated cache. The render tree should not own component-specific
Arrow derivations.

### Refactor dataframe only

This would be enough to unblock lazy dataframe loading with the smallest immediate diff.

Rejected after review. Table and Vega-Lite have the same ownership smell, and component-owned
derivations make `ElementNodeRenderer` simpler and more consistent. Doing all three before lazy
loading reduces the chance that lazy dataframe special cases drift from the eager element model.

### Route lazy chunks through `Delta.add_chunk`

This matches prototype PR #11032. The render tree receives chunk deltas, finds the element by
delta path, mutates or replaces derived dataframe data, and lets the component observe the updated
`Quiver`.

Rejected. Chunk responses are request/response data for a mounted dataframe, not script output.
Routing them through the render tree blurs app rerun state with frontend cache state and makes
component lifecycle cleanup harder.

### Make `Quiver` mutable

This would allow a single `Quiver` instance to represent the initial chunk plus later chunks.

Rejected. `Quiver` is documented as immutable and is shared by eager rendering paths. Mutable
chunk APIs would make table/dataframe/Vega behavior harder to reason about, especially when
payload reuse preserves object identity across reruns.

## Testing

- Frontend unit tests for shared conversion helpers:
  - constructs a `Quiver` from eager Arrow data;
  - constructs a `VegaLiteChartElement` from inline data and named datasets.
- Update `Table` and `DataFrame` tests to pass proto input instead of a prebuilt `Quiver`.
- Update `ArrowVegaLiteChart` tests to pass `VegaLiteChartProto`; keep lower-level hook tests on
  `VegaLiteChartElement` where appropriate.
- Update `ElementNodeRenderer` tests/snapshots for the prop changes.
- Remove `ElementNode.quiverElement` and `ElementNode.vegaLiteChartElement` tests after the
  getters are deleted.
- During lazy loading implementation, add tests that chunk responses update the dataframe-owned
  cache without touching `AppRoot` or `ElementNode`.

## Recommendation

Move all current Arrow-derived frontend data models out of the render tree before starting
dataframe lazy loading. The real render-tree benefit is cache lifetime, and it can be replaced by
`payloadHash` memoization or a dedicated cache if profiling shows a need.

The cleaner boundary is: render tree stores proto payload and lifecycle metadata; components own
the parsed data models required to render those payloads.
