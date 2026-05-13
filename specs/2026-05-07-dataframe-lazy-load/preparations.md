# Preparations Before Dataframe Lazy Loading

This document lists refactors that can be done before the lazy-loading implementation starts.
The goal is to reduce special casing in the lazy-loading PR and keep the core implementation
focused on protocol, backend source management, and chunk caching.

## Recommended Order

1. ~~Component-owned Arrow data derivations~~ ✅ DONE
2. ~~Dataframe capability/mode layer~~ ✅ DONE
3. Sorting strategy split
4. Cell-provider layering
5. Row-count abstraction
6. ~~Toolbar/export/search capability gates~~ ✅ DONE
7. ~~Generic non-rerun request/response scaffolding~~ ✅ DONE

The first six are mostly frontend/dataframe cleanup. The seventh touches protocol/runtime and is
useful, but should be a separate small spec before implementation.

## 1. Component-Owned Arrow Data Derivations ✅ DONE

**Implemented.** `Quiver`/Vega-Lite wrapper construction has been moved out of `ElementNode` and
into the respective components (`Table`, `DataFrame`, `ArrowVegaLiteChart`).

Why this helped:

- Keeps the render tree focused on proto payloads, lifecycle metadata, and app layout.
- Makes dataframe-owned lazy chunk state natural later.
- Avoids adding lazy dataframe branches to `ElementNode`.
- Keeps `Quiver` immutable.

## 2. Dataframe Capability/Mode Layer ✅ DONE

**Implemented.** A capability layer (`useDataFrameCapabilities`) now returns explicit feature
gates based on editing mode, disabled state, table size, and selection mode.

```typescript
interface DataFrameCapabilities {
  canSort: boolean
  canSearch: boolean
  canExportCsv: boolean
  canSelectRows: boolean
  canSelectColumns: boolean
  canSelectCells: boolean
  canEdit: boolean
  canAddRows: boolean
  canDeleteRows: boolean
}
```

Lazy loading can add `dataMode: "eager" | "lazy"` as an input without sprinkling `if (isLazy)`
checks throughout the component.

Why this helped:

- Makes current behavior easier to test.
- Avoids repeated `isLargeTable`, `isEmptyTable`, and editing-mode conditionals.
- Provides one place to disable search/CSV/export/editing for lazy dataframes.

## 3. Sorting Strategy Split

`useColumnSort` currently always uses Glide's client-side sorter, which builds a full row mapping
from `getCellContent`. That assumes every row is available in the browser.

Refactor the hook to support explicit strategies:

```typescript
type SortingMode = "client" | "disabled"
```

Keep current behavior by selecting:

- `"client"` for existing sortable eager dataframes
- `"disabled"` for large tables, empty tables, and modes that allow row addition

The lazy-loading implementation can later add:

```typescript
type SortingMode = "client" | "server" | "disabled"
```

Why this helps:

- Makes the client-sort/full-data assumption explicit.
- Gives server-side sorting a natural extension point.
- Avoids making lazy sorting a special case inside the current eager sorting hook.

## 4. Cell-Provider Layering

`useDataLoader` currently combines several concerns:

- map display row/column to original row/column
- read base cells from `Quiver`
- overlay edited and added rows
- apply pandas styler data
- convert Arrow/styled values to Glide cells
- return fallback error cells

Split this into smaller layers:

1. Base cell provider: reads a raw cell from the eager `Quiver`.
2. Editing overlay: handles editable cells, added rows, and edited values.
3. Cell formatter: converts Arrow/styled cell data to Glide `GridCell`.
4. Error boundary: catches unexpected lookup/formatting errors.

The lazy-loading implementation can then replace only the base cell provider with a lazy provider
that returns loaded, loading, or failed cells.

Why this helps:

- Preserves existing editing behavior.
- Keeps lazy chunk lookup separate from edit-state logic.
- Makes loading/error cell behavior easier to test in isolation.

## 5. Row-Count Abstraction

Today, `originalNumRows` is derived from `data.dimensions.numDataRows`. Lazy dataframes need the
displayed row count to come from metadata while only an initial chunk is loaded.

Add an explicit row-count/data-shape abstraction before lazy loading:

```typescript
interface DataFrameDataShape {
  numRows: number
  numDataColumns: number
  numIndexColumns: number
  isEmptyTable: boolean
}
```

For eager dataframes this still comes from `Quiver.dimensions`. Lazy loading can later supply
`numRows` from source metadata while keeping column/schema information from the initial chunk.

Why this helps:

- Removes the assumption that visible row count equals loaded row count.
- Keeps table sizing, selection setup, and toolbar gates consistent.
- Makes `height="content"` fallback behavior easier to reason about.

## 6. Toolbar, Search, and CSV Export Gates ✅ DONE

**Implemented.** Toolbar visibility is now controlled through the capability layer in
`useDataFrameCapabilities`. The `DataFrame.tsx` component uses `canSearch` and `canExportCsv`
flags to conditionally render toolbar actions.

```typescript
// In DataFrame.tsx
{canExportCsv && (
  <ToolbarAction label="Download as CSV" ... />
)}
{canSearch && (
  <ToolbarAction label="Search" ... />
)}
```

Why this helped:

- Prevents accidental "search/export only loaded chunks" behavior later.
- Keeps the lazy-loading MVP behavior clear.
- Makes future server-side search/export possible without rewriting toolbar logic again.

## 7. Generic Non-Rerun Request/Response Scaffolding ✅ DONE

**Implemented in PR [#15147](https://github.com/streamlit/streamlit/pull/15147).**

This scaffolding provides the reusable request/response plumbing that lazy dataframes will use.
The implementation follows the pattern described below and is now ready for dataframe chunk
requests to extend.

### What Was Implemented

**Frontend (`frontend/lib/src/BackendOperationClient.ts`):**

- `BackendOperationClient` class with typed request registry
- UUID-based request id generation
- Promise resolvers with configurable timeout handling
- Cleanup on disconnect, session reset, or timeout
- `requestDeferredFile(fileId)` as the first wrapped API
- Future `requestDataframeChunk(request)` will follow the same pattern

**Backend (`lib/streamlit/runtime/backend_operation_handler.py`):**

- `BackendOperationHandler` protocol for typed handlers
- `BackendOperationDispatcher` for routing requests by payload type
- `DeferredFileHandler` as the first implementation
- Async execution via `asyncio.to_thread()` to avoid blocking the event loop
- Structured error handling with typed responses

**Protocol (`proto/streamlit/proto/BackMsg.proto`, `ForwardMsg.proto`):**

- `BackendOperationRequest` with `oneof payload` for extensible request types
- `BackendOperationResponse` with `oneof payload` for typed responses
- `DeferredFileRequestPayload` and `DeferredFileResponsePayload` as first payload types

**Context (`frontend/lib/src/components/core/BackendOperationContext.tsx`):**

- Replaces the old `DownloadContext` with a generic operation context
- Provides `requestDeferredFile` through React context

### How Lazy Dataframes Will Use This

Lazy dataframe chunk requests will:

1. Add `DataframeChunkRequestPayload` to `BackendOperationRequest.payload` oneof
2. Add `DataframeChunkResponsePayload` to `BackendOperationResponse.payload` oneof
3. Register a `DataframeChunkHandler` with the backend dispatcher
4. Add `requestDataframeChunk(request)` method to `BackendOperationClient`
5. Use `BackendOperationContext` to send chunk requests from the DataFrame component

## Future Server-Side Validation

Server-side validation for widgets, for example `st.text_input(..., validate=...)`, could use the
same non-rerun request/response foundation. It should not be bundled into dataframe lazy loading.

Questions to resolve separately:

- Trigger timing: debounce, blur, submit, or every keystroke?
- How stale responses are ignored while the user keeps typing.
- Whether validation blocks form submission or only displays a warning/error.
- Whether validators can access `st.session_state` or Streamlit APIs.
- Threading and connection-safety rules for validators run outside the script thread.
- Rate limits and backpressure for hosted apps.
- How validation state is represented in widget state and frontend UI.

Recommendation: keep this as future product/API work. The shared request/response foundation can
make it easier later, but the widget semantics need their own design.

## Not Worth Doing First

- Do not build a generic mutable `Quiver`.
- Do not route lazy chunks through `Delta.add_chunk`/`AppRoot`.
- Do not generalize the media file manager into a generic callback manager.
- Do not implement server-side search or CSV export before the lazy-loading MVP.
- Do not support unknown-size sequential sources before known-size random-access sources work.

## Suggested PR Breakdown

1. ~~Component-owned Arrow data derivations.~~ ✅ Done
2. ~~Dataframe capability/mode layer.~~ ✅ Done
3. Sorting strategy split.
4. Cell-provider layering plus row-count abstraction.
5. ~~Toolbar/search/export gates from capabilities.~~ ✅ Done
6. ~~Non-rerun request/response implementation.~~ ✅ Done in PR #15147
7. Lazy dataframe protocol/source manager/chunk cache implementation.
