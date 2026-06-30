# Lazy `st.dataframe` preparation PRs

This file lists refactoring and preparation PRs that can be merged
independently before the full lazy-loading PR. The suggestions are based on the
prototype implementation in this branch and focus on changes that either:

- are behavior-preserving cleanups needed by the prototype,
- add dormant infrastructure that has no user-visible effect until lazy mode is
  wired into `st.dataframe`, or
- reduce the final lazy-loading PR to the actual feature activation.

The target shape is a final PR that mostly adds `lazy` API wiring, lazy-mode
frontend integration, and end-to-end coverage on top of already-reviewed
building blocks.

## Split criteria

Good preparation PRs should satisfy most of these:

- Merge cleanly into `develop` without enabling lazy loading.
- Have focused tests that do not require the full feature path.
- Avoid public behavior changes unless they fix an existing inconsistency.
- Avoid large refactors of the eager dataframe render path unless the
  lazy-loading PR would otherwise become hard to review.
- Leave generated proto/types, unused helpers, or dormant runtime plumbing only
  when the dormant state is easy to reason about.

## Prototype map

The branch currently introduces all of these areas in one feature prototype:

- Proto: `LazyDataframe`, `SortState`, `DataframeChunkRequestPayload`, and
  `DataframeChunkResponsePayload`.
- Backend source layer: `streamlit.dataframe.source` and
  `streamlit.dataframe.adapters`.
- Runtime serving layer: `DataframeSourceManager`,
  `DataframeChunkHandler`, dispatcher registration, and script/session
  lifecycle cleanup.
- `st.dataframe` API wiring: the `lazy` parameter, source resolution,
  source registration, and initial-chunk marshalling in `elements/arrow.py`.
- Frontend transport: `BackendOperationClient.requestDataframeChunk`.
- Frontend dataframe rendering: lazy initial `Quiver`, lazy row count,
  capability gating, `LazyDataframeCache`, `useLazyDataLoader`,
  `useLazyColumnSort`, and `DataFrame.tsx` integration.
- Tests: backend unit tests, frontend unit tests, typing coverage, and e2e
  tests for a lazy dataframe.

Those pieces are separable. The most valuable prep work is to land source
abstractions, transport scaffolding, and low-risk frontend cleanup before
touching the public `st.dataframe(..., lazy=...)` surface.

## Recommended PR sequence

### PR 1: Dataframe capability cleanup in the eager frontend

**Goal.** Make dataframe feature gating more consistent before lazy mode adds
more gates.

**Prototype signal.** Lazy mode needs to disable search, CSV export, editing,
statistics, and some selection/keybinding behavior. The prototype found at
least one existing inconsistency: the toolbar search affordance is gated by
`canSearch`, but the `Ctrl/Cmd+F` keybinding in `DataFrame.tsx` toggles search
without checking `canSearch`.

**Scope.**

- Gate the `Ctrl/Cmd+F` search shortcut on `canSearch`.
- Consider adding capability names for select-all and statistics display,
  rather than keeping those decisions spread across `DataFrame.tsx` and
  `ColumnMenu.tsx`.
- Keep current eager behavior unchanged except where the shortcut currently
  bypasses an existing capability.
- Add or update frontend unit tests for `useDataFrameCapabilities`,
  `DataFrame.tsx`, and/or `ColumnMenu.tsx`.

**Why this can merge independently.** It is either behavior-preserving or fixes
an existing capability mismatch. It has no proto or backend dependency.

**Likely files.**

- `frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx`
- `frontend/lib/src/components/widgets/DataFrame/hooks/useDataFrameCapabilities.ts`
- `frontend/lib/src/components/widgets/DataFrame/menus/ColumnMenu.tsx`

**Risk.** Low.

### PR 2: Introduce a column-sort strategy facade

**Goal.** Keep `DataFrame.tsx` using a single `useColumnSort` hook while making
the sorting strategy explicit.

**Prototype signal.** The prototype adds `useLazyColumnSort` because the
existing `useColumnSort` delegates to Glide's client-side sorter. That sorter
builds a full row map by calling `getCellContent` across the table, which is
correct for eager dataframes but incompatible with lazy dataframes. At the same
time, the lazy implementation duplicates useful eager behavior: direction
toggling and header title indicators.

**Scope.**

- Define a sort mode such as:

  ```typescript
  type ColumnSortMode = "client" | "server" | "disabled"
  ```

- Keep the exported `useColumnSort` name, but turn it into a strategy facade
  that returns one stable contract:

  ```typescript
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

- Move the current Glide-backed logic into a client strategy, e.g.
  `useClientColumnSortStrategy`.
- Add a disabled strategy that returns the input columns/getter and identity
  row mapping.
- Add shared helpers for:
  - asc -> desc -> none toggle behavior,
  - auto-reset behavior,
  - header title indicators,
  - sortable column checks.
- Add a server strategy only when lazy loading lands, or add a dormant strategy
  first if it can be fully tested without chunk loading.
- Ensure the client strategy is inert when `mode !== "client"` so Glide does
  not try to sort a lazy row count or lazy cell getter.

**Why this can merge independently.** The first PR can keep behavior identical
by supporting only `"client"` and `"disabled"` modes. The later lazy PR extends
the same facade with `"server"` rather than adding a separate hook at the
`DataFrame.tsx` call site.

**Likely files.**

- `frontend/lib/src/components/widgets/DataFrame/hooks/useColumnSort.ts`
- new strategy/helper files near the existing hook, for example:
  - `hooks/useClientColumnSortStrategy.ts`
  - `hooks/useDisabledColumnSortStrategy.ts`
  - `hooks/columnSortUtils.ts`
- existing/new frontend unit tests

**Risk.** Low for the client/disabled split; medium when adding server mode
because it changes how the loader receives sort state.

### PR 3: Add additive lazy-dataframe proto scaffolding

**Goal.** Land generated message types before backend and frontend code start
depending on them.

**Prototype signal.** Multiple later pieces need the same proto types:
runtime chunk handling, `BackendOperationClient.requestDataframeChunk`,
lazy metadata on the dataframe element, and server-side sort state.

**Scope.**

- Add optional `lazy_data` metadata to `Dataframe`.
- Add `LazyDataframe` and `SortState`.
- Add `dataframe_chunk` request and response payloads to the existing backend
  operation request/response oneofs.
- Run `make protobuf`.
- Do not produce or consume these fields yet.

**Why this can merge independently.** The proto change is additive. Without
callers, it has no runtime behavior.

**Likely files.**

- `proto/streamlit/proto/Dataframe.proto`
- `proto/streamlit/proto/BackMsg.proto`
- `proto/streamlit/proto/ForwardMsg.proto`
- generated Python and frontend protobuf outputs

**Risk.** Low. The main review point is choosing stable field numbers and names
before generated code lands.

### PR 4: Add the internal dataframe source protocol and in-memory source

**Goal.** Land the backend data-source abstraction with unit coverage before
connecting it to `st.dataframe`.

**Prototype signal.** Most backend lazy-loading semantics are contained in
`streamlit.dataframe.source`: known row count, schema stability, range loading,
sorting, thresholds, and `lazy=True` compatibility decisions.

**Scope.**

- Add an internal `streamlit.dataframe` package.
- Add `DataframeSource`, `SortSpec`, and constants such as default page size,
  max chunk rows, and auto-lazy thresholds.
- Add `InMemoryDataframeSource`, including Arrow conversion and server-side
  sorting.
- Add source-resolution logic if we are comfortable landing dormant
  `lazy=True` error messages before the API exists. Otherwise split resolution
  into the final PR and land only the source implementation here.
- Unit-test pandas, Polars DataFrame if available/mocked, pyarrow table,
  sorting, invalid sort columns, Arrow compatibility fixes, and thresholds.
- Do not import this module from `elements/arrow.py` yet.

**Why this can merge independently.** The module is internal and unused until
the final feature wiring.

**Likely files.**

- `lib/streamlit/dataframe/__init__.py`
- `lib/streamlit/dataframe/source.py`
- `lib/tests/streamlit/dataframe/source_test.py`

**Risk.** Low to medium. Low if only the source classes land; medium if source
resolution and lazy-specific API error text land before the public parameter.

### PR 5: Add dormant runtime source manager and chunk handler

**Goal.** Land session-scoped source registration and chunk serving before the
feature starts registering sources.

**Prototype signal.** The prototype mirrors media-file lifecycle behavior:
sources are registered by session and element coordinates, stale generations
are rejected, source IDs are session-scoped, references are cleared on full
rerun, and orphaned sources are pruned after script completion.

**Scope.**

- Add `DataframeSourceManager`.
- Add `DataframeChunkHandler`.
- Register the handler with the backend-operation dispatcher once the proto
  payload exists.
- Add `Runtime.dataframe_source_mgr`.
- Add script/session lifecycle cleanup:
  - clear refs at full-rerun start,
  - keep refs for fragment reruns,
  - remove orphaned sources after script completion,
  - clear session sources on shutdown.
- Update test runtime mocks that use `MagicMock(spec=Runtime)` so tests do not
  receive a fake manager accidentally.
- Unit-test session validation, stale generation handling, limit clamping,
  out-of-range chunks, cleanup, and handler error handling.

**Why this can merge independently.** The dispatcher can know how to handle
`dataframe_chunk`, but no frontend code sends those requests and no
`st.dataframe` call registers sources yet. The manager should remain empty in
normal apps.

**Likely files.**

- `lib/streamlit/runtime/dataframe_source_manager.py`
- `lib/streamlit/runtime/dataframe_chunk_handler.py`
- `lib/streamlit/runtime/runtime.py`
- `lib/streamlit/runtime/app_session.py`
- `lib/streamlit/runtime/scriptrunner/script_runner.py`
- `lib/streamlit/testing/v1/app_test.py`
- `lib/tests/delta_generator_test_case.py`
- runtime unit tests

**Risk.** Medium because it touches script/session lifecycle. The dormant state
needs explicit tests to prove ordinary reruns and fragment reruns are
unaffected.

**Dependencies.** PR 3 and PR 4.

### PR 6: Add frontend backend-operation support for dataframe chunks

**Goal.** Add the typed frontend transport method without connecting it to the
dataframe component.

**Prototype signal.** `BackendOperationClient` already supports deferred-file
requests. The prototype adds a second payload type with the same request,
timeout, response, and error handling machinery.

**Scope.**

- Add `requestDataframeChunk`.
- Extend the request payload union to include `dataframeChunk`.
- Extend response extraction to return `dataframeChunk`.
- Add a request timeout appropriate for row chunk loading.
- Unit-test request construction, response resolution, error propagation, and
  pending request cleanup.
- Do not import this method from `DataFrame.tsx` yet.

**Why this can merge independently.** It is additive frontend infrastructure.
No component calls it until the final lazy-loading integration.

**Likely files.**

- `frontend/lib/src/BackendOperationClient.ts`
- `frontend/lib/src/BackendOperationClient.test.ts`

**Risk.** Low.

**Dependencies.** PR 3.

### PR 7: Land `LazyDataframeCache` as an isolated frontend utility

**Goal.** Separate the browser-side chunk cache from the larger lazy data loader
hook.

**Prototype signal.** `LazyDataframeCache` is a plain data structure with FIFO
eviction and failed-chunk tracking. It can be reviewed and tested without
React, Glide, protobuf, or a backend connection.

**Scope.**

- Add `LazyDataframeCache`.
- Unit-test chunk indexing, cache hits, FIFO eviction, failure recording,
  failure clearing, and cache clearing.
- Keep it unused until the lazy data loader lands.

**Why this can merge independently.** It is an unused utility with complete unit
coverage.

**Likely files.**

- `frontend/lib/src/components/widgets/DataFrame/LazyDataframeCache.ts`
- `frontend/lib/src/components/widgets/DataFrame/LazyDataframeCache.test.ts`

**Risk.** Very low.

### PR 8: Refactor dataframe loading into hook-level strategies

**Goal.** Avoid splitting `DataFrame.tsx` into eager/lazy components while also
avoiding one large hook body full of eager/lazy branches.

**Prototype signal.** The prototype keeps `useDataLoader` and
`useLazyDataLoader` separate, then selects between their results in
`DataFrame.tsx`. That is safe, but it leaks the strategy split into the
component. A better shape is to keep the split inside hooks and expose a single
data pipeline to the component.

**Important dependency.** Sorting and loading cannot be designed in complete
isolation:

- Eager sorting wraps an eager `getCellContent` and returns a sorted
  `getCellContent` plus an original-row mapping.
- Lazy sorting only tracks server-side sort state. The lazy loader needs that
  sort state before it sends chunk requests.

Because of that dependency, the cleanest hook-level abstraction is a small
coordinator hook rather than two fully independent facades that know nothing
about each other.

**Proposed shape.**

Keep strategy implementations separate, but route through one hook-level
pipeline:

```typescript
type DataframeDataMode = "eager" | "lazy"

interface DataframeDataPipelineResult {
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

Inside the pipeline:

1. Build the eager base cell provider from the current `useDataLoader` logic.
2. Pass that eager getter into `useColumnSort` in `"client"` mode for eager
   dataframes, or `"server"` mode for lazy dataframes.
3. Build the lazy loader strategy with the server sort state from
   `useColumnSort`.
4. Return the active strategy result based on `mode`.

This keeps `DataFrame.tsx` simple, avoids component splits, and keeps the
client-sort/full-data assumption out of lazy mode.

**Data-loader strategy split.**

Move the current eager behavior into an eager strategy:

```typescript
interface DataLoaderStrategyResult {
  getCellContent: DataEditorProps["getCellContent"]
  onVisibleRegionChanged?: DataEditorProps["onVisibleRegionChanged"]
}
```

Recommended internal files:

- `useEagerDataLoaderStrategy.ts`
- `useLazyDataLoaderStrategy.ts`
- `useDataFrameDataPipeline.ts`
- `dataLoaderUtils.ts`

The eager strategy should preserve today's behavior:

- map display coordinates to original row/column,
- apply editing state and added rows,
- read from the eager `Quiver`,
- apply pandas Styler data,
- convert Arrow/styled values to Glide cells,
- return error cells for unexpected lookup/formatting failures.

The lazy strategy should handle only lazy-specific behavior:

- map row index to chunk index,
- return loaded cells from cached chunks,
- return loading cells for in-flight/missing chunks,
- record failed chunk loads,
- retry failed chunks when they re-enter the visible range,
- ignore stale source/generation responses,
- reset cache on source, generation, page size, or server sort change.

**Shared utilities to extract.**

- bounds checking and standard error-cell creation,
- Arrow cell -> Glide cell conversion wrapper,
- sort direction/header helpers from PR 2,
- chunk index/page helpers from `LazyDataframeCache`.

**Hook-order rule.** Do not conditionally call hooks based on `mode`. The
pipeline should either call both strategies with safe/inert inputs and return
the active result, or keep mode-specific behavior in pure helper functions
called by hooks that are always present. In particular, the client sort
strategy must not run Glide's full-table sort when the active mode is lazy.

**Why this can merge independently.** The first version can introduce the
pipeline with only eager behavior and assert that the returned result matches
the current `useDataLoader` + `useColumnSort` composition. The lazy PR then adds
the lazy loader strategy and `"server"` sort strategy behind the same pipeline
contract.

**Risk.** Medium. This touches the eager dataframe render path, so it needs
focused regression coverage. The payoff is a much cleaner final lazy PR with no
component split and fewer lazy-specific branches in `DataFrame.tsx`.

**Dependencies.** The eager-only pipeline depends on PR 2. The lazy strategy
depends on PR 6 and PR 7 once it starts issuing backend chunk requests.

### PR 9: Optional native adapter prep

**Goal.** Decide how much native unevaluated-data support should land before
the initial lazy PR.

**Prototype signal.** The prototype includes Polars `LazyFrame` and Snowpark
adapters. They are useful, but they carry different confidence levels:
Polars can be exercised locally, while Snowpark behavior is mostly mock-tested
without a live Snowflake account.

**Possible split.**

- PR 9a: Add adapter detection and a Polars `LazyFrame` source with unit tests.
- PR 9b: Add Snowpark source behind explicit `lazy=True`, with careful docs,
  mocks, and possibly hosted/manual validation before broad exposure.

**Recommendation.** Do not block the basic in-memory lazy-loading PR on
Snowpark. Either keep native adapters in a follow-up PR, or land Polars first
and Snowpark separately. This keeps the initial feature focused on the
transport, lifecycle, and rendering model.

**Likely files.**

- `lib/streamlit/dataframe/adapters.py`
- `lib/tests/streamlit/dataframe/adapters_test.py`
- detection helpers in `streamlit.dataframe_util` if additional helpers are
  needed

**Risk.** Medium for Polars, higher for Snowpark because performance and query
semantics depend on the external service.

## What should remain in the full lazy-loading PR

After the prep PRs above, the final feature PR should mainly contain:

- Public `st.dataframe(..., lazy: bool | None = None)` API wiring and docs.
- `elements/arrow.py` integration:
  - call source resolution,
  - register a source with the runtime manager,
  - marshal `lazy_data`,
  - include the initial chunk,
  - fall back to eager behavior when no runtime is active.
- `useDataFrameCapabilities` lazy-mode gates if they were not fully prepared.
- `DataFrame.tsx` integration:
  - choose lazy initial chunk vs eager `arrow_data`,
  - derive row count from lazy metadata,
  - select lazy strategies through the hook-level data pipeline,
  - wire `onVisibleRegionChanged`,
  - hide lazy-incompatible affordances.
- Lazy-specific tests that need the full path:
  - Python API behavior and errors,
  - generated proto marshalling,
  - frontend component integration,
  - typing test for the `lazy` parameter,
  - e2e scroll/sort/load behavior.

That final PR still has meaningful surface area, but it becomes a feature
activation PR instead of a combined transport, runtime, backend-source,
frontend-cache, and API PR.

## Suggested dependency graph

```text
PR 1 capability cleanup      independent
PR 2 sort helpers            independent
PR 3 proto scaffolding       independent
PR 4 source protocol         independent

PR 5 runtime manager/handler depends on PR 3 + PR 4
PR 6 frontend transport      depends on PR 3
PR 7 lazy cache utility      independent
PR 8 data pipeline strategy  eager path depends on PR 2; lazy path needs PR 6 + PR 7
PR 9 native adapters         depends on PR 4, optional

Final lazy-loading PR        depends on PR 1-8, optionally PR 9
```

## Review notes for prep PRs

- Keep each PR explicitly dormant unless it is a behavior-preserving frontend
  cleanup.
- Add tests that fail without the prep code even though lazy mode is not wired
  yet.
- Avoid renaming public protobuf fields after PR 3 merges.
- Treat lifecycle changes in PR 5 as the highest-risk prep item and review them
  against media-file cleanup behavior.
- Keep eager dataframe behavior identical while introducing the hook-level data
  pipeline. The intent is not to mix eager and lazy internals in one branch-heavy
  hook body; it is to expose one stable pipeline contract backed by separate
  eager/client and lazy/server strategies.
