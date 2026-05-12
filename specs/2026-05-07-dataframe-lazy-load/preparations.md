# Preparations Before Dataframe Lazy Loading

This document lists refactors that can be done before the lazy-loading implementation starts.
The goal is to reduce special casing in the lazy-loading PR and keep the core implementation
focused on protocol, backend source management, and chunk caching.

## Recommended Order

1. Component-owned Arrow data derivations
2. Dataframe capability/mode layer
3. Sorting strategy split
4. Cell-provider layering
5. Row-count abstraction
6. Toolbar/export/search capability gates
7. Generic non-rerun request/response scaffolding

The first six are mostly frontend/dataframe cleanup. The seventh touches protocol/runtime and is
useful, but should be a separate small spec before implementation.

## 1. Component-Owned Arrow Data Derivations

Move `Quiver`/Vega-Lite wrapper construction out of `ElementNode` and into `Table`,
`DataFrame`, and `ArrowVegaLiteChart`.

Why this helps:

- Keeps the render tree focused on proto payloads, lifecycle metadata, and app layout.
- Makes dataframe-owned lazy chunk state natural later.
- Avoids adding lazy dataframe branches to `ElementNode`.
- Keeps `Quiver` immutable.

This refactor should be independent of lazy loading and can land first.

## 2. Dataframe Capability/Mode Layer

Today, `DataFrame.tsx` computes behavior through scattered booleans:

- large table threshold
- empty table handling
- editing mode
- add/delete row support
- sorting support
- selection support
- search and CSV toolbar visibility

Add a small capability layer, for example `useDataFrameCapabilities(...)`, that returns explicit
feature gates:

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

Initial inputs can be the existing eager-mode facts:

- `editingMode`
- `disabled`
- `isEmptyTable`
- `isLargeTable`
- selection mode

Lazy loading can later add one more input, such as `dataMode: "eager" | "lazy"`, without
sprinkling `if (isLazy)` checks throughout the component.

Why this helps:

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

## 6. Toolbar, Search, and CSV Export Gates

Search and CSV export currently assume local data:

- Search is a Glide UI over browser-available rows.
- CSV export iterates every row via `getCellContent`.

Move toolbar visibility to the capability layer:

```typescript
if (capabilities.canExportCsv) {
  // show CSV action
}

if (capabilities.canSearch) {
  // show search action
}
```

Do not implement server export or server search as preparation work. Just make the UI gates
explicit.

Why this helps:

- Prevents accidental "search/export only loaded chunks" behavior later.
- Keeps the lazy-loading MVP behavior clear.
- Makes future server-side search/export possible without rewriting toolbar logic again.

## 7. Generic Non-Rerun Request/Response Scaffolding

Deferred downloads already show the pattern lazy dataframes need:

1. Frontend sends a non-rerun `BackMsg`.
2. Backend executes work without a script rerun.
3. Backend responds with a typed `ForwardMsg`.
4. Frontend resolves a promise or notifies a listener.

The reusable part is not the media-file manager. The reusable part is the request/response
plumbing and session-scoped lifecycle.

Potential frontend refactor:

- Replace one-off `deferredFileListeners` in `App.tsx` with a small typed request registry.
- Support request id generation.
- Register promise resolvers or response subscribers.
- Reject/cleanup on disconnect, session reset, or timeout.
- Let feature-specific APIs wrap it:
  - `requestDeferredFile(fileId)`
  - future `requestDataframeChunk(request)`
  - future `requestServerValidation(request)`

Potential backend refactor:

- Add a small session action/request helper near `AppSession`.
- Execute slow work off the event loop with `asyncio.to_thread()`.
- Provide typed success/error response helpers.
- Support per-session cleanup and stale id rejection.
- Let feature-specific managers own payload semantics:
  - deferred downloads return media URLs
  - lazy dataframe chunks return Arrow bytes
  - future validation returns validation results

Why this helps:

- Reuses the deferred-download plumbing without forcing dataframe chunks through URL/media-file
  semantics.
- Gives future server-side widget validation a compatible transport.
- Centralizes timeout/disconnect/error handling.

Why this should be separate:

- It touches protobuf, `App.tsx`, `AppSession`, and tests.
- It could benefit multiple features, so it deserves a focused mini spec.
- It is not required to start the dataframe frontend cleanup.

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

1. Component-owned Arrow data derivations.
2. Dataframe capability/mode layer.
3. Sorting strategy split.
4. Cell-provider layering plus row-count abstraction.
5. Toolbar/search/export gates from capabilities.
6. Optional non-rerun request/response mini spec and implementation.
7. Lazy dataframe protocol/source manager/chunk cache implementation.
