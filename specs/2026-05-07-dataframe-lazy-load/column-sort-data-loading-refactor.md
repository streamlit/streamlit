# Dataframe column sort and data loading refactor plan

This document focuses only on the frontend dataframe hook refactor needed before
or during lazy-loading work. It is intentionally narrower than the broader lazy
loading preparation plan.

## Summary

The prototype adds separate lazy hooks (`useLazyDataLoader` and
`useLazyColumnSort`) and selects between eager and lazy results in
`DataFrame.tsx`. That works, but it spreads the data-mode distinction into the
component.

Recommended direction:

- Keep `DataFrame.tsx` as one component.
- Keep `DataFrame.tsx` calling a single hook-level data pipeline.
- Implement eager/client and lazy/server behavior as separate strategies behind
  that pipeline.
- Keep `useDataLoader` and `useColumnSort` as stable facade concepts, but move
  mode-specific logic into strategy implementations.

The intent is not to merge eager and lazy logic into one branch-heavy hook body.
The intent is to expose one stable hook contract to the component while keeping
the two data models separate internally.

## Current state

### `useDataLoader`

`useDataLoader` currently assumes the entire dataframe is available in one
`Quiver`. It combines several responsibilities:

- bounds checks,
- display row/column to original row/column mapping through `EditingState`,
- edited-cell and added-row overlay,
- base cell lookup from the eager `Quiver`,
- pandas Styler lookup,
- Arrow/styled value conversion into Glide cells,
- fallback error cells.

That is correct for eager dataframes, but lazy dataframes have different
requirements:

- only some chunks are loaded,
- `getCellContent` must still be synchronous,
- missing chunks should render loading cells,
- failed chunks should render error cells,
- chunk requests happen from visible-region changes and cell misses,
- stale generation/source responses must be ignored.

### `useColumnSort`

`useColumnSort` currently always delegates to Glide's client-side sorter. Glide
builds a row mapping from the full table by calling `getCellContent` across
rows. That is correct only when all rows are available in the browser.

Lazy sorting needs a different model:

- keep sort state in the frontend,
- decorate the sorted column header,
- send the active sort state to the backend with chunk requests,
- keep row mapping as identity because the server returns already-sorted rows,
- never invoke a full client-side scan of lazy rows.

## Goals

- Avoid splitting `DataFrame.tsx` into eager and lazy component trees.
- Keep the component wiring close to today's hook flow.
- Make the eager/client and lazy/server assumptions explicit.
- Preserve eager behavior while introducing the abstraction.
- Allow lazy loading to plug in with minimal new branching in `DataFrame.tsx`.
- Keep client-side sorting from accidentally operating on lazy row counts or
  lazy cell getters.

## Non-goals

- Do not make editing, added rows, or pandas Styler work in lazy mode for the
  initial lazy-loading PR.
- Do not build a mutable `Quiver`.
- Do not make Glide's client-side sorter lazy-aware.
- Do not implement server-side search or CSV export here.
- Do not split `DataFrame.tsx` into `EagerDataFrame` and `LazyDataFrame`
  components.

## Proposed architecture

Introduce one hook-level coordinator used by `DataFrame.tsx`:

```typescript
type DataFrameDataMode = "eager" | "lazy"

interface DataFrameDataPipelineResult {
  columns: BaseColumn[]
  getCellContent: DataEditorProps["getCellContent"]
  getOriginalIndex: (index: number) => number
  sortColumn: (
    index: number,
    direction?: "asc" | "desc" | "auto",
    autoReset?: boolean
  ) => void
  onVisibleRegionChanged?: DataEditorProps["onVisibleRegionChanged"]
}
```

Example call site:

```typescript
const dataPipeline = useDataFrameDataPipeline({
  mode: isLazy ? "lazy" : "eager",
  data,
  columns: originalColumns,
  numRows: originalNumRows,
  editingState,
  lazyData,
  backendOperationClient,
})
```

`DataFrame.tsx` then consumes:

```typescript
const {
  columns,
  getCellContent,
  getOriginalIndex,
  sortColumn,
  onVisibleRegionChanged,
} = dataPipeline
```

The coordinator owns the dependency between sorting and loading:

- eager loading builds the base eager `getCellContent`,
- client sorting wraps that eager getter,
- server sorting produces `serverSortState`,
- lazy loading consumes `serverSortState` for chunk requests.

## Column sorting strategy

Keep `useColumnSort` as the public hook concept, but make the sorting mode
explicit:

```typescript
type ColumnSortMode = "client" | "server" | "disabled"

interface ColumnSortResult {
  columns: BaseColumn[]
  sortColumn: (
    index: number,
    direction?: "asc" | "desc" | "auto",
    autoReset?: boolean
  ) => void
  getOriginalIndex: (index: number) => number
  getCellContent: DataEditorProps["getCellContent"]
  serverSortState?: {
    column: string
    descending: boolean
  }
}
```

### Client strategy

The client strategy is the current behavior:

- delegates to Glide's `useColumnSort`,
- passes eager columns and eager `getCellContent`,
- returns Glide's sorted `getCellContent`,
- returns Glide's original-row mapping,
- uses `BaseColumn.sortMode`.

This strategy is valid only for eager dataframes with all rows present in the
browser.

### Server strategy

The server strategy is for lazy dataframes:

- stores the active sort column and direction,
- decorates the active column title with the same sort indicator as eager mode,
- returns the input `getCellContent` unchanged,
- returns identity `getOriginalIndex`,
- exposes `serverSortState` for the lazy loader,
- ignores columns that cannot be represented by a backend Arrow field name.

The server strategy must not call Glide's client-side sorter.

### Disabled strategy

The disabled strategy:

- returns input columns unchanged,
- returns input `getCellContent` unchanged,
- returns identity `getOriginalIndex`,
- makes `sortColumn` a no-op,
- exposes no `serverSortState`.

Use it for empty tables, unsupported modes, or inactive strategy branches.

### Shared sort utilities

Extract these helpers before adding server mode:

- `getNextSortDirection(...)` for asc -> desc -> none and explicit direction
  handling,
- `shouldResetSort(...)` for `autoReset`,
- `applySortIndicator(...)` for header title decoration,
- `getSortableColumn(...)` / `canServerSortColumn(...)` for guard checks.

This removes duplication between client and server sorting.

## Data loading strategy

Define a shared strategy result:

```typescript
interface DataLoaderStrategyResult {
  getCellContent: DataEditorProps["getCellContent"]
  onVisibleRegionChanged?: DataEditorProps["onVisibleRegionChanged"]
}
```

### Eager strategy

Move today's `useDataLoader` behavior into an eager strategy, for example
`useEagerDataLoaderStrategy`.

Responsibilities:

- validate row/column bounds,
- map displayed row to original row through `EditingState`,
- apply edited cells and added rows,
- read base cells from the eager `Quiver`,
- read pandas Styler metadata,
- convert Arrow/styled values to Glide cells,
- return standard error cells for unexpected failures.

This strategy should be behavior-preserving.

### Lazy strategy

Add a lazy strategy, for example `useLazyDataLoaderStrategy`.

Responsibilities:

- initialize a cache from the lazy initial chunk,
- map row index to chunk index,
- return loaded cells from cached chunks,
- return loading cells for missing or in-flight chunks,
- request visible and near-visible chunks through `BackendOperationClient`,
- deduplicate in-flight chunk requests,
- debounce chunk requests during fast scrolling,
- record failed chunks and render error cells,
- retry failed chunks when they re-enter the visible range,
- ignore responses with stale `sourceId` or `generation`,
- reset the cache when source, generation, page size, or `serverSortState`
  changes.

The lazy strategy should not know about editing state or pandas Styler for the
initial implementation, because those features are disabled in lazy mode.

### Shared data-loader utilities

Extract these utilities where useful:

- row/column bounds checks,
- standard internal-error cell creation,
- Arrow cell -> Glide cell conversion wrapper,
- chunk/page index helpers,
- stable loading cell definition.

Avoid over-generalizing the editing overlay. It is eager-only for the initial
lazy-loading version.

## Hook-order constraint

React hooks cannot be called conditionally based on `mode` if `mode` can change
between renders. The coordinator and facades must keep hook order stable.

Recommended implementation:

- Call the sort facade once with an explicit mode.
- Inside the sort facade, call strategy hooks in a fixed order.
- Ensure inactive strategies are cheap and safe.
- For the client strategy, pass safe disabled inputs or an `enabled` flag so
  Glide does not build a full row map when active mode is not `"client"`.
- Call the eager and lazy loader strategies in a fixed order if both are hooks,
  then return the active result.
- If an inactive strategy cannot be made cheap, move most of its mode-specific
  work into pure functions and keep only lightweight hooks at the facade level.

The most important invariant: client-side sorting must never inspect lazy rows.

## Coordinator flow

The coordinator can be structured like this:

```typescript
function useDataFrameDataPipeline(params): DataFrameDataPipelineResult {
  const eagerLoader = useEagerDataLoaderStrategy({
    data: params.data,
    columns: params.columns,
    numRows: params.numRows,
    editingState: params.editingState,
    enabled: params.mode === "eager",
  })

  const sort = useColumnSort({
    mode: params.mode === "lazy" ? "server" : "client",
    columns: params.columns,
    numRows: params.numRows,
    getCellContent: eagerLoader.getCellContent,
  })

  const lazyLoader = useLazyDataLoaderStrategy({
    initialChunk: params.data,
    columns: params.columns,
    numRows: params.numRows,
    lazyData: params.lazyData,
    backendOperationClient: params.backendOperationClient,
    sortState: sort.serverSortState,
    enabled: params.mode === "lazy",
  })

  if (params.mode === "lazy") {
    return {
      columns: sort.columns,
      getCellContent: lazyLoader.getCellContent,
      getOriginalIndex: sort.getOriginalIndex,
      sortColumn: sort.sortColumn,
      onVisibleRegionChanged: lazyLoader.onVisibleRegionChanged,
    }
  }

  return {
    columns: sort.columns,
    getCellContent: sort.getCellContent,
    getOriginalIndex: sort.getOriginalIndex,
    sortColumn: sort.sortColumn,
  }
}
```

This preserves one call site in `DataFrame.tsx` while keeping the actual eager
and lazy implementations separate.

## Suggested implementation phases

### Phase 1: Sort facade with client/disabled modes

- Extract shared sort utilities.
- Move current Glide logic into `useClientColumnSortStrategy`.
- Add `useDisabledColumnSortStrategy`.
- Keep exported `useColumnSort`.
- Preserve existing eager behavior.
- Add tests for helper behavior and disabled mode.

This can merge before any lazy proto/backend work.

### Phase 2: Eager data-loader strategy extraction

- Move current `useDataLoader` logic into `useEagerDataLoaderStrategy`.
- Extract small shared data-loader utilities.
- Keep exported `useDataLoader` or introduce `useDataFrameDataPipeline` in
  eager-only mode.
- Preserve existing eager behavior.
- Add tests around editing overlay, added rows, styled cells, and error cells if
  coverage is missing.

This can merge independently, but it touches the eager render path and should
be reviewed carefully.

### Phase 3: Pipeline coordinator

- Introduce `useDataFrameDataPipeline`.
- Wire `DataFrame.tsx` through the pipeline while still using eager/client mode
  only.
- Verify the resulting `DataFrame.tsx` diff is mostly mechanical.

This gives the lazy PR a stable hook integration point.

### Phase 4: Lazy/server strategies

- Add server sort mode.
- Add `LazyDataframeCache`.
- Add `useLazyDataLoaderStrategy`.
- Thread `serverSortState` into lazy chunk requests.
- Return `onVisibleRegionChanged` from the pipeline in lazy mode.
- Keep lazy-incompatible features disabled via capabilities.

This phase can live in the final lazy-loading PR or be split if the PR is too
large.

## Test plan

### Sort tests

- Client mode preserves current sort behavior.
- Disabled mode returns identity row mapping and does not alter cell content.
- Auto direction toggles asc -> desc -> none.
- `autoReset` removes the active sort when requested with the same direction.
- Header indicator is applied only to the active column.
- Server mode exposes backend column name and descending flag.
- Server mode ignores unsortable columns, including index columns without a
  backend field name.
- Client strategy does not invoke full-table sort behavior when inactive.

### Data-loader tests

- Eager strategy returns cells matching the old `useDataLoader`.
- Eager strategy applies edited cells and added rows.
- Eager strategy applies Styler metadata.
- Eager strategy returns bounds/error cells consistently.
- Lazy strategy seeds chunk 0 from the initial chunk.
- Lazy strategy returns loading cells for unloaded chunks.
- Lazy strategy requests visible and buffered chunks.
- Lazy strategy deduplicates in-flight chunk requests.
- Lazy strategy ignores stale source/generation responses.
- Lazy strategy resets cache on sort/source/generation/page-size changes.
- Lazy strategy records and retries failed chunks.

### Integration tests

- `DataFrame.tsx` uses the pipeline result for:
  - `columns`,
  - `getCellContent`,
  - `getOriginalIndex`,
  - `sortColumn`,
  - `onVisibleRegionChanged`.
- Eager dataframe behavior is unchanged after pipeline introduction.
- Lazy dataframe sorting causes new chunk requests with sort state.

## Risks and mitigations

### Risk: eager regressions

The eager path is high-traffic and currently stable. Keep extraction mechanical,
land it separately, and prefer tests that compare the old and new behavior.

### Risk: accidental lazy full-table scan

The client sort strategy must be disabled or inert in lazy mode. Add tests that
prove the lazy path does not call the client sorter with lazy row counts.

### Risk: hook complexity moves instead of shrinking

The goal is not fewer files. The goal is a smaller public integration surface in
`DataFrame.tsx` and clear strategy boundaries. Keep strategy files small and
name them by behavior.

### Risk: over-abstracting editing/styling

Editing and pandas Styler are eager-only for the initial lazy PR. Do not force
the lazy loader through those abstractions until the product supports those
features in lazy mode.

## Recommendation

Use the strategy/facade approach.

It gives the component a single hook-level data pipeline, keeps the current
eager behavior reviewable, and lets lazy loading add server sorting and chunked
loading without exposing `useLazyDataLoader` / `useLazyColumnSort` directly in
`DataFrame.tsx`.
