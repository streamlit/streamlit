---
author: lukasmasuch
created: 2026-05-07
---

# Lazy Loading for st.dataframe

## Summary

Implement lazy row loading for read-only `st.dataframe` by registering a session-scoped data
source on the backend and allowing the frontend to request Arrow row chunks without triggering
a script rerun. The first version supports known-size sources, server-side sorting, and
the tri-state `lazy: bool | None = None` API. `lazy=True` uses native lazy adapters when
available and otherwise falls back to an in-memory pandas source for supported eager inputs;
`lazy=None` auto-selects lazy mode for supported unevaluated inputs and large compatible
in-memory dataframes. The frontend should keep a row-range cache and continue using Glide's
synchronous `getCellContent` path by returning loading/error cells for ranges that are not yet
available.

## Current Architecture Constraints

- `lib/streamlit/elements/arrow.py` currently converts `data` to a pandas DataFrame or Arrow
  table before enqueueing the dataframe element.
- `proto/streamlit/proto/Dataframe.proto` only carries inline `ArrowData` for the table data.
- `frontend/lib/src/dataframes/Quiver.ts` parses a complete Arrow payload into an immutable
  row-major structure.
- `frontend/lib/src/components/widgets/DataFrame/hooks/useDataLoader.ts` returns a synchronous
  `getCellContent` callback for Glide Data Grid.
- `BackMsg` already has a non-rerun request/response pattern for deferred downloads. Lazy
  dataframe chunks need a similar AppSession-handled path, but not the media-file manager
  because chunks are not downloadable files or stable URLs.

## Prior Art: Prototype PR #11032

Prototype PR [#11032](https://github.com/streamlit/streamlit/pull/11032) validates several useful
parts of the lazy-loading model:

- A non-rerun `BackMsg` request can ask the backend for a dataframe chunk.
- The frontend can return Glide `LoadingCell` values while a chunk is missing.
- Loaded chunks need to trigger `DataEditorRef.updateCells()` so visible cells refresh.
- Chunk-level Arrow payloads can be parsed back into normal `Quiver` instances.

This spec should not copy these prototype details:

- `Delta.add_chunk` routed through `AppRoot` and `ElementNode`; chunk responses should instead go
  through dataframe-owned request/response handling.
- Mutable chunk methods on `Quiver`; the chunk cache should store immutable chunk-level
  `Quiver` instances.
- Polling to detect loaded chunks; the response handler should directly update affected cells.
- `fragment_storage` for user chunk callbacks; lazy sources need a dedicated session-scoped
  source manager with explicit lifecycle cleanup.

## Preparatory Refactors

See `preparations.md` in this directory for recommended frontend/dataframe cleanup that can land
before the lazy-loading implementation starts. Key refactors:

1. **Component-owned Arrow data derivations**: Move `Quiver` construction out of `ElementNode` and
   into `DataFrame`, `Table`, and `ArrowVegaLiteChart`. See `preparations.md` section 1 for details.

2. **Dataframe capability/mode layer**: Add `useDataFrameCapabilities(...)` returning explicit
   feature gates (`canSort`, `canSearch`, `canExportCsv`, `canEdit`, etc.). Lazy loading adds one
   input (`dataMode: "eager" | "lazy"`) instead of sprinkling `if (isLazy)` conditionals.

3. **Sorting strategy split**: Refactor `useColumnSort` into explicit `sortingMode: "client" | "server" | "disabled"`.
   Client sorting assumes all data is local; server sorting only manages sort state and header UI.

4. **Cell-provider layering**: Split `useDataLoader` into base cell provider, editing overlay, cell
   formatter, and error boundary. Lazy loading replaces only the base cell provider.

5. **Row-count abstraction**: Decouple displayed row count from `Quiver.dimensions.numDataRows`.
   Lazy dataframes get `numRows` from source metadata while columns/schema come from the initial chunk.

6. **Toolbar/search/export gates**: Move toolbar visibility to capability layer gates
   (`capabilities.canSearch`, `capabilities.canExportCsv`) so lazy mode disables these cleanly.

These refactors make the lazy-loading implementation simpler because eager/lazy differences are
handled through explicit modes and capabilities rather than scattered conditionals.

## Proposal

### Backend Data Source Protocol

Use a small internal protocol. Built-in adapters, auto-lazy in-memory sources, and the
`lazy=True` pandas fallback normalize to this shape. Do not expose a public
`st.DataFrameSource` API in the first implementation; a custom-source wrapper can be added later
after the protocol has proven stable.

```python
class DataframeSourceProtocol(Protocol):
    @property
    def row_count(self) -> int:
        ...

    @property
    def schema(self) -> pa.Schema:
        ...

    @property
    def sortable(self) -> bool:
        ...

    def load_rows(
        self,
        offset: int,
        limit: int,
        *,
        sort: SortState | None = None,
    ) -> Data:
        ...
```

`Data` is any existing dataframe-compatible return type that can be serialized through
`dataframe_util.convert_anything_to_arrow_bytes`.

Phase 1 requires a known `row_count`. Unknown-size sequential sources with `row_count=None` can
extend this protocol in a later phase with an explicit `access_mode` and end-of-stream contract.
That later phase can auto-wrap Python generator/iterator inputs that yield dataframe-compatible
chunks such as `pandas.DataFrame`, `pyarrow.Table`, `pyarrow.RecordBatch`, or other supported
dataframe objects.

Sorting is part of Phase 1 via the boolean `sortable` source capability. Search/filter support
can extend this protocol later with explicit capability declarations and keyword-only request
parameters. Filtering is not part of current `st.dataframe` behavior, so the first version should
reserve the extension point but not implement filtering UI or infer capabilities from callback
signatures.

### Lazy Mode Resolution

`st.dataframe` should resolve delivery mode before Arrow serialization:

1. Validate public arguments that are independent of lazy mode.
2. If `lazy is False`, use the existing eager path for in-memory inputs and the existing
   capped-preview fallback for unevaluated objects.
3. If the input/options are incompatible with lazy mode:
   - `lazy=True`: raise `StreamlitAPIException` with the incompatible option.
   - `lazy=None`: use eager rendering or the existing capped-preview fallback.
4. If a native lazy adapter exists and can provide a known row count, schema, and stable row-range
   access, use it when `lazy=True` or when `lazy=None` auto-selects lazy mode.
5. If `lazy=True` and the input is a supported eager data format, convert it once to an
   in-memory pandas dataframe and serve row slices from that object. This reduces the initial
   browser payload but not server memory usage or conversion cost.
6. If `lazy=None` and the input is an in-memory pandas or Polars dataframe above the existing
   large-table threshold (`150000` rows), use an in-memory source.
7. Otherwise use the existing eager path.

For remote unevaluated inputs, `lazy=True` must not silently materialize the full dataset just to
use the pandas fallback. It should use a native adapter or raise a clear error.

The forced-lazy small-data threshold is 1,000 rows. Inputs with 1,000 rows or fewer may stay on
the eager path even when `lazy=True` because the payload is bounded and eager rendering is simpler.

### Session Source Manager

Add a session-scoped manager for lazy dataframe sources. This follows the same pattern as
`MediaFileManager.add_deferred()` for deferred download buttons (see
`lib/streamlit/runtime/media_file_manager.py`), but with dataframe-specific semantics.

**Pattern reference:** The deferred download mechanism in `st.download_button` demonstrates
the non-rerun request/response flow:
1. `add_deferred()` registers a callable with a unique `file_id`
2. Frontend sends `DeferredFileRequest` BackMsg
3. `AppSession._handle_deferred_file_request()` executes callable via `asyncio.to_thread()`
4. `DeferredFileResponse` ForwardMsg sent back with URL or error

Lazy dataframe chunks use the same pattern but return Arrow data directly instead of URLs.

Responsibilities:

- Register a source for the current session and element generation.
- Return a unique `source_id` that cannot be used across sessions.
- Load row ranges in a worker thread via `asyncio.to_thread()` so slow data queries do not
  block the event loop (same as deferred downloads).
  Source loaders run in this worker thread; they do not have access to `ScriptRunContext` and
  must not call Streamlit APIs (e.g., `st.session_state`). If Streamlit later exposes custom
  user callbacks, those callbacks must pass shared state explicitly via closure or use
  thread-safe patterns, including per-call database connections or thread-safe connection pools.
- Limit concurrent in-flight chunk requests per source (e.g., max 3 concurrent requests) to
  prevent a rapidly scrolling user from queuing unbounded simultaneous queries.
- Convert loaded chunks to Arrow bytes.
- Reject stale source ids after reruns, element removal, or session shutdown.
- Bound server-side metadata and clean up per-session state.
- Source lifecycle should mirror the media-file reference pattern rather than requiring the
  backend to inspect the frontend element tree:
  - Use the dataframe element coordinates (`DeltaGenerator._get_delta_path_str()`) plus
    generation as the server-side location key.
  - On a full rerun, clear the session's active dataframe-source references before the script
    starts, register sources as `st.dataframe` calls execute, and prune sources that were not
    re-registered after the script finishes.
  - On a fragment rerun, only replace sources re-rendered by that fragment. Do not prune
    unrelated full-app sources that remain visible.
  - When a source is replaced at the same coordinates, mark the previous generation stale so
    in-flight chunk responses are ignored by the frontend.
  - Session shutdown clears all sources for that session.

This should live near runtime/session code, not in the media file manager. The media file
manager is optimized for deferred file generation and URL serving, while dataframe chunks are
short-lived protocol responses.

### Proto Shape

Keep the existing eager `arrow_data` field for compatibility. Add lazy metadata to
`Dataframe`.

```proto
message Dataframe {
  ArrowData arrow_data = 1;
  // existing fields...

  optional LazyDataframe lazy_data = 13;
}

message LazyDataframe {
  string source_id = 1;
  optional uint64 row_count = 2;  // Always set in Phase 1; optional for future sequential sources
  uint64 initial_offset = 3;
  uint32 page_size = 4;
  string generation = 5;
  AccessMode access_mode = 6;
  ArrowData initial_chunk = 7;  // Dedicated field for initial rows; keeps arrow_data for eager path only
  bytes serialized_schema = 8;  // Arrow IPC schema bytes when initial_chunk is empty
  bool sortable = 9;  // Whether server-side sorting is enabled

  enum AccessMode {
    ACCESS_MODE_UNSPECIFIED = 0;
    RANDOM_ACCESS = 1;
    SEQUENTIAL = 2;
  }
}
```

For lazy dataframes, the `initial_chunk` field in `LazyDataframe` contains the initial rows and
schema. If no initial rows are available, `serialized_schema` should contain the Arrow IPC schema
bytes so the frontend can construct columns without waiting for the first chunk. The top-level
`arrow_data` field in `Dataframe` remains reserved for the eager (non-lazy) rendering path.

Add chunk request/response messages to `BackMsg` and `ForwardMsg`.

```proto
message SortState {
  string column = 1;
  SortDirection direction = 2;

  enum SortDirection {
    SORT_DIRECTION_UNSPECIFIED = 0;
    ASCENDING = 1;
    DESCENDING = 2;
  }
}

message DataframeChunkRequest {
  string source_id = 1;
  string request_id = 2;
  uint64 offset = 3;
  uint32 limit = 4;
  string generation = 5;
  optional SortState sort = 6;  // Current sort state, if any
}

message DataframeChunkResponse {
  string source_id = 1;
  string request_id = 2;
  uint64 offset = 3;
  string generation = 4;
  bool end_of_stream = 7;  // True when this is the final chunk for sequential sources
  oneof result {
    ArrowData arrow_data = 5;
    string error_msg = 6;
  }
}
```

`end_of_stream` is reserved for future sequential sources. In Phase 1, known-size random-access
sources should return `end_of_stream=false` for successful chunks and rely on `row_count` for
scroll bounds.

For future generator-backed sequential sources, the source manager should consume yielded chunks
in order, serialize each yielded dataframe-compatible object to Arrow, and send
`end_of_stream=true` when the generator is exhausted. These sources should use loaded-size scroll
behavior, disable sorting/search/random jumps by default, and infer schema from the first yielded
chunk when possible. Generators that may be empty need an explicit schema through the future
sequential-source contract.

**Future `end_of_stream` semantics:**
- For sequential sources, `end_of_stream=true` signals the source is exhausted. The frontend
  MUST treat this as terminal and stop requesting further chunks.
- `end_of_stream=true` with `error_msg` is a terminal error state (no retry).
- For sequential sources, `end_of_stream=false` with zero-row `arrow_data` is invalid; the
  server must set `end_of_stream=true` when returning the final (possibly empty) chunk.

The server must enforce a maximum on `limit` (e.g., 10,000 rows) to prevent a modified client
from requesting arbitrarily large chunks and causing OOM or warehouse cost spikes. The server
should also apply per-session concurrency/backpressure rules to bound simultaneous in-flight
requests. If a valid row-limited chunk still serializes above the websocket message size limit,
the server should return a chunk error response and log the source id, offset, limit, and
serialized size. Adaptive byte-based chunk splitting can be added later if this shows up in real
usage.

`request_id` should be a UUID generated by the frontend per request to deduplicate responses.
`generation` should be a UUID generated by the backend when a source is registered, changing
on rerun or source invalidation to allow stale-response detection.

The response should be ignored by the frontend if `source_id`, `request_id`, or `generation`
does not match an active table request.

### Backend Render Flow

Lazy loading integrates into the existing `st.dataframe` implementation in `lib/streamlit/elements/arrow.py`,
not as a separate element. The existing parameter handling for `column_config`, `column_order`, `hide_index`,
`use_container_width`, `height`, and display options should work unchanged for lazy sources.

1. `st.dataframe` resolves `lazy` mode:
   - `lazy=False`: eager/capped-preview path.
   - `lazy=None`: auto-select lazy mode only when compatible.
   - `lazy=True`: require lazy mode, with native adapter or safe in-memory pandas fallback.
2. Validate unsupported combinations such as `on_select`, `pandas.Styler`, and `data_editor`.
3. Normalize the selected lazy input to `DataframeSourceProtocol`.
4. Register the source in the session source manager.
5. Fetch an initial chunk if cheap and safe.
6. Enqueue `Dataframe` with normal display configuration plus `lazy_data`.

### Chunk Request Flow

Following the same pattern as `_handle_deferred_file_request()` in `app_session.py`:

1. Frontend sends `DataframeChunkRequest` BackMsg over the existing websocket.
2. `AppSession.handle_backmsg()` routes to `_handle_dataframe_chunk_request()` without
   triggering a script rerun.
3. The handler validates session/source/generation.
4. The source's `load_rows` implementation is executed via `asyncio.to_thread()` to avoid
   blocking the event loop. The worker thread does NOT have `ScriptRunContext`; source loaders
   cannot call Streamlit APIs.
5. The chunk is serialized as Arrow and sent back as `DataframeChunkResponse` ForwardMsg.
6. The frontend inserts the chunk into its cache and triggers a render.

### Frontend Transport and Render-tree Integration

The frontend should add a dataframe-specific request/response path alongside the existing
deferred-file plumbing:

- `App.tsx` handles `ForwardMsg.dataframe_chunk_response` in the top-level ForwardMsg dispatch.
- `App.tsx` exposes a `requestDataframeChunk(request)` callback and a response subscription
  registry through a small context, similar in spirit to `DownloadContext` but keyed by
  `(source_id, generation, request_id)`.
- `DataFrame` registers a listener while a lazy dataframe is mounted and unregisters it on
  unmount, source id changes, or generation changes.
- `DataFrame` sends `BackMsg.dataframe_chunk_request` through that context instead of reaching
  into connection state directly.

This spec assumes the component-owned Arrow data refactor described in `preparations.md` section 1
has landed. Lazy dataframe handling
should stay inside the dataframe component/hooks rather than adding a lazy branch to
`frontend/lib/src/render-tree/ElementNode.ts`:

- Top-level `arrow_data` remains the eager-only payload.
- `DataFrame` constructs the schema/initial-data `Quiver` from
  `dataframe.lazy_data.initial_chunk`.
- To avoid a special schema-only `Quiver` constructor, the backend should prefer sending
  `initial_chunk` as a valid Arrow IPC table with the full schema and zero or more rows. The
  separate `serialized_schema` field remains available as a fallback if a zero-row Arrow table is
  impractical for a specific adapter.
- `DataFrame` must derive the displayed row count from `lazy_data.row_count` when lazy metadata is
  present, not from `data.dimensions.numDataRows` on the initial chunk.
- Column loading, column configuration, and formatting continue to use the schema/initial
  `Quiver`. Cell lookup for rows not present in the initial chunk goes through the lazy cache.

### Server-side Sorting Integration

This section assumes the sorting strategy split from `preparations.md` has landed: `useColumnSort`
has been refactored to support explicit `sortingMode: "client" | "server" | "disabled"`.

Lazy dataframes cannot use the current client-side `useColumnSort` path because that hook derives
a complete sorted row mapping by calling `getCellContent` across the full table. For lazy
sources, sorting must use `sortingMode: "server"`:

- Split the dataframe sorting hook into eager and lazy branches, or add an explicit
  `sortingMode: "client" | "server" | "disabled"` option.
- In server mode, the hook only manages sort state and header indicators. It must not call
  Glide's `useColumnSort` helper and must not build a row remapping array.
- `getOriginalIndex` can be identity for lazy dataframes because selection and editing are
  disabled in the MVP.
- Header clicks and column-menu sort actions update the server sort state, clear the lazy chunk
  cache, cancel/deprioritize stale in-flight requests, and request the currently visible chunk
  with the new sort state.
- Chunk requests include the active `SortState`. The `column` value should be a stable backend
  field id/name from the Arrow schema, not the displayed column label.
- `sortable=False` disables all sort UI for lazy sources. `sortable=True` enables sorting for the
  source as a whole; per-column public allowlists are out of scope for the first version.
- Built-in in-memory dataframe sources sort before slicing. Pandas sources should use a stable
  sort (for example `kind="mergesort"`), and Polars sources should apply `.sort(...)` before
  `.slice(...)`.
- Native adapters and future custom sources receive the sort state and are responsible for
  returning rows in that order. If a backend cannot safely sort every exposed column, the source
  should set `sortable=False`.

### Frontend Cache and Rendering

This section assumes the following preparatory refactors from `preparations.md` have landed:

- **Component-owned Arrow data derivations**: `DataFrame` owns its `Quiver` construction.
- **Dataframe capability/mode layer**: `useDataFrameCapabilities(...)` returns explicit feature
  gates that respect `dataMode: "eager" | "lazy"`.
- **Cell-provider layering**: `useDataLoader` is split into base cell provider, editing overlay,
  cell formatter, and error boundary.
- **Row-count abstraction**: `DataFrameDataShape.numRows` is decoupled from loaded data.
- **Toolbar/export/search gates**: Search and CSV export visibility use `capabilities.canSearch`
  and `capabilities.canExportCsv`.

Integrate lazy loading into the existing `DataFrame` component rather than creating a separate
lazy dataframe component. This keeps all rendering, column configuration, selection, and toolbar
logic unified. All compatible existing features must continue to work for lazy sources:

- **Column configuration**: `column_config` for custom renderers, type overrides, and formatting
- **Column display**: `column_order` and `hide_index`
- **Sizing**: `width`, `height`, `use_container_width`; `height="content"` uses
  `lazy_data.row_count` and the existing 10,000px content-height cap
- **Row display**: `row_height` (custom row heights via proto)
- **Toolbar**: Fullscreen toggle, column visibility (search and CSV download hidden for lazy)

With the cell-provider layering from preparations, lazy loading replaces only the base cell
provider. The editing overlay, cell formatter, and error boundary layers remain unchanged.
The base cell provider branches on `dataMode`:

- **Eager mode** (existing): Direct `data.getCell()` access on the complete Quiver
- **Lazy mode** (new): Chunk-based lookup with `LoadingCell` fallback for missing ranges

Add a lazy row cache for dataframe elements.

Responsibilities:

- Track loaded, loading, failed, and missing row ranges.
- Deduplicate overlapping in-flight requests.
- **Debounce chunk requests during rapid scroll**: Show loading cells immediately (no UI
  debounce), but debounce actual network requests (~100-200ms) so rapid scrolling doesn't
  fire dozens of requests for chunks the user scrolls past. After the debounce, request only
  the currently visible range plus buffer—not every range scrolled through.
- **Cancel or deprioritize stale requests**: If a chunk request is in flight for a range that
  is no longer near the visible viewport (e.g., user scrolled away), consider canceling it or
  letting it complete at low priority. This prevents wasted bandwidth and server load.
- **Chunk-based pagination**: The frontend should request data in fixed-size chunks (e.g., 500
  rows) rather than individual rows. The chunk size is provided by the backend in `page_size`.
  When the visible range spans rows 1200–1250, the frontend calculates the required chunk
  indices (`chunkIndex = Math.floor(row / pageSize)`) and requests any missing chunks. This
  reduces request overhead and aligns with how the backend fetches data.
- Prefetch a small buffer before and after the visible range.
- Enforce an LRU limit for random-access chunks (e.g., retain the most recent N chunks).
- Clear all chunks when the source generation or sort state changes.
- Surface per-range errors and support retry.

Glide's `getCellContent` must remain synchronous. The cache should therefore return:

- Parsed cell content for loaded rows.
- Loading cells for missing rows while a request is in flight.
- Error cells for failed ranges.

Each Arrow chunk can be parsed into a `Quiver`. The cache can either store chunk-level Quivers
plus offset metadata, or normalize parsed cells into a row cache. Chunk-level Quivers are likely
less invasive for the first implementation because existing column/type parsing remains intact.

#### Loading Cell Implementation

Glide Data Grid provides a native `LoadingCell` type with built-in skeleton animation:

```typescript
import { GridCellKind, LoadingCell } from "@glideapps/glide-data-grid"

// Return from getCellContent when chunk is not yet loaded
return {
  kind: GridCellKind.Loading,
  allowOverlay: false,
  skeletonHeight: 20,
  skeletonWidth: 100,
  skeletonWidthVariability: 30,
} as LoadingCell
```

No custom loading UI is required. The `useDataLoader` hook should check chunk availability and
return `LoadingCell` for rows in missing chunks while triggering a chunk request.

#### Cell Refresh After Chunk Load

When a `DataframeChunkResponse` ForwardMsg arrives, the frontend must trigger a re-render of
the affected cells. Glide Data Grid's `updateCells()` API allows targeted cell refresh without
a full table re-render:

```typescript
// After chunk is inserted into cache, refresh affected cells
const cellsToUpdate: { cell: [number, number] }[] = []
for (let row = 0; row < chunkSize; row++) {
  for (let col = 0; col < columnCount; col++) {
    cellsToUpdate.push({ cell: [col, chunkOffset + row] })
  }
}
dataEditorRef.current?.updateCells(cellsToUpdate)
```

The ForwardMsg handler should directly trigger this update when a chunk response arrives,
avoiding the polling approach used in the prototype PR #11032. This provides immediate
feedback when chunks load and avoids unnecessary timer overhead.

#### Lazy Chunk Storage

Each loaded Arrow chunk should still be parsed into a normal `Quiver` so the existing Arrow
type parsing and cell conversion code stays centralized. The chunk map itself should live in a
lazy dataframe cache object owned by the dataframe component/hook, not in the initial eager
`Quiver` instance:

```typescript
class LazyDataframeCache {
  private chunks: Map<number, Quiver> = new Map()
  private failedChunks: Map<number, string> = new Map()

  public constructor(
    private readonly chunkSize: number,
    private readonly requestChunk: (chunkIndex: number) => void,
  ) {}

  public addChunk(chunk: Quiver, chunkIndex: number): void {
    this.chunks.set(chunkIndex, chunk)
    this.failedChunks.delete(chunkIndex)
  }

  public getCell(row: number, column: number): DataFrameCell | "loading" | "error" {
    const chunkIndex = Math.floor(row / this.chunkSize)
    const rowInChunk = row % this.chunkSize
    const chunk = this.chunks.get(chunkIndex)
    if (chunk) {
      return chunk.getCell(rowInChunk, column)
    }
    this.requestChunk(chunkIndex)
    return this.failedChunks.has(chunkIndex) ? "error" : "loading"
  }
}
```

The exact class/function shape can be adjusted during implementation, but the key constraint is
that the initial schema `Quiver` remains a parsed Arrow snapshot while mutable loaded/loading/
failed state lives in the lazy cache. This keeps the existing `Quiver` immutability assumption
intact and still reuses `Quiver.getCell()` for every loaded chunk.

### Adapter Strategy

Phase 1 adapters:

- In-memory pandas fallback for `lazy=True`: convert supported eager inputs to pandas once,
  derive `row_count` and schema, apply server-side sort state with stable `sort_values(...)` when
  active, then slice with `.iloc[offset : offset + limit]`.
- In-memory pandas DataFrame: same source implementation as the fallback, without an extra
  conversion step.
- In-memory Polars DataFrame: apply `.sort(...)` when sort state is active, then slice with
  `.slice(offset, limit)`.
- Auto-lazy in-memory pandas/Polars dataframes above the existing frontend large-table
  threshold (`150000` rows) when lazy mode is compatible.
- Native unevaluated adapters that are implementation-ready and can provide known row count,
  schema, stable range access, and safe sorting semantics.

Phase 2 adapters:

- Polars LazyFrame: use `.slice(offset, limit).collect()` if not completed in Phase 1.
- Snowpark DataFrame/Table: generate bounded queries and use native count if not completed in
  Phase 1.

DuckDB and other adapters can be added in Phase 3+ based on user demand.

Keep using `dataframe_util.is_unevaluated_data_object` as the central detection point. If an
object is detected but no lazy adapter is ready, keep the current capped-preview fallback for
`lazy=None` and `lazy=False`; for `lazy=True`, raise a clear `StreamlitAPIException`.

### Snowflake Loading Strategy

Snowflake deserves a specific design because it is one of the main use cases, but efficient
random access is not the same thing as adding `OFFSET` to every query.

#### Required Invariant: Stable Ordering

Every Snowflake-backed lazy dataframe needs a stable row order. Snowflake supports `LIMIT` /
`OFFSET`, and Snowpark exposes `DataFrame.limit(n, offset=...)`, but results are
non-deterministic without an `ORDER BY`. Chunked rendering without stable ordering can show
duplicates, omit rows, or reorder already-loaded chunks across requests.

For a future custom-source API, the app author should own the `ORDER BY` clause. For automatic
Snowpark adapters, Streamlit should only claim random-access semantics when it can preserve or
require a deterministic order. A later API may need an explicit `order_by` option for Snowflake
sources.

#### Mode 1: Direct `LIMIT/OFFSET`

Direct range queries are the simplest implementation:

```sql
SELECT *
FROM (<base_query>) q
ORDER BY <stable_sort_cols>, <unique_tie_breaker>
LIMIT :limit OFFSET :offset
```

This is correct when the order is deterministic, and it is acceptable for initial chunks,
small tables, shallow offsets, and fallback behavior. It should not be presented as efficient
arbitrary random access for large result sets. Deep offsets still require Snowflake to identify
and skip rows before the requested window. Top-K pruning can help some `ORDER BY ... LIMIT`
queries, but it does not turn arbitrary deep page jumps into constant-time lookup.

**Result caching:** Snowflake caches query results for up to 24 hours. Identical queries
(same SQL text and parameters) return cached results instantly without warehouse cost. This
helps when users scroll back to previously viewed pages, but does not help with new offsets.

**Performance expectations:**

- Shallow offsets (<10,000 rows): Typically fast, benefits from result caching
- Medium offsets (10,000–100,000 rows): Acceptable latency, may take 1–5 seconds
- Deep offsets (>100,000 rows): Increasingly slow, can take 10+ seconds for very deep pages
- Very deep offsets (>1,000,000 rows): May timeout or consume significant credits

These are rough estimates; actual performance depends on table size, clustering, and warehouse
size. Streamlit should log a warning when offset exceeds 100,000 rows.

#### Mode 2: Keyset Loading for Sequential Scroll

For normal scroll-down behavior, keyset loading is often cheaper than repeated offsets:

```sql
SELECT *
FROM (<base_query>) q
WHERE <sort_col> > :last_sort_value
   OR (
     <sort_col> = :last_sort_value
     AND <tie_breaker> > :last_tie_value
   )
ORDER BY <sort_col>, <tie_breaker>
LIMIT :limit
```

This works well for adjacent chunks once Streamlit has loaded an anchor row. It can benefit
from Snowflake micro-partition pruning when the predicate aligns with clustered or naturally
ordered data. It does not solve arbitrary jumps to row 5,000,000 unless Streamlit already has a
nearby anchor.

The adapter can combine direct offsets and keyset loading:

- Use direct offset for the first visible chunk and rare jumps.
- Cache anchors at chunk boundaries.
- Use keyset predicates for adjacent prefetches from known anchors.
- Drop anchors when the source generation changes.

#### Mode 3: Materialized Row-index Table for True Random Access

The most robust way to support efficient random access is to materialize a session-scoped,
ordered result with a synthetic row number:

```sql
CREATE TEMP TABLE "__st_dataframe_<sanitized_source_id>" AS
SELECT
  ROW_NUMBER() OVER (
    ORDER BY <stable_sort_cols>, <unique_tie_breaker>
  ) - 1 AS __st_row_num,
  q.*
FROM (<base_query>) q
ORDER BY __st_row_num;
```

Note: `source_id` contains hyphens (UUID format) which are invalid in unquoted Snowflake
identifiers. The adapter must always use double-quoted identifiers
(`"__st_dataframe_<source_id>"`) to avoid case-folding and character restrictions. The
identifier must also be length-checked (Snowflake limit: 255 chars) before use.

Then each chunk is a range predicate against the materialized row index:

```sql
SELECT <user_columns>
FROM __st_dataframe_<source_id>
WHERE __st_row_num >= :offset
  AND __st_row_num < :offset + :limit
ORDER BY __st_row_num;
```

This shifts cost to source initialization: Snowflake computes the full ordered result once and
stores it in a temporary table for the session. Subsequent random chunk reads can be much more
predictable because the range predicate targets the synthetic row index and the table can be
written or clustered by that index. For very large materialized results, evaluate adding a
`CLUSTER BY (__st_row_num)` table definition and verify the benefit in query profiles. This is
the right mode when the user scrolls, jumps, sorts columns in a future server-side phase, or
repeatedly inspects the same large result.

Tradeoffs:

- Higher initial latency and warehouse cost.
- Temporary table storage charges while the session is alive.
- Cleanup lifecycle:
  - **On source invalidation**: DROP when element is removed or source generation changes.
  - **On session end**: Snowflake auto-drops TEMPORARY tables when session closes.
  - **On explicit disposal**: If Streamlit adds a `source.dispose()` API.
  - **Cleanup failure**: Log warning but do not block; session end is the backstop.
- The result is a snapshot. Underlying table changes are not reflected until rerun.
- The base query must have a deterministic order. If there is no unique tie-breaker, the
  adapter should reject materialized random access or add a documented best-effort fallback.

Snowpark `DataFrame.cache_result()` is a useful primitive because it stores a DataFrame result
in a temporary table, but Streamlit still needs a stable row-number column for random access.
The adapter should either create its own CTAS with `ROW_NUMBER()` or wrap a cached result with
an indexed projection.

#### Not Recommended as the Primary Random-access Mechanism

- `RESULT_SCAN`: Useful for post-processing a prior query result, but Snowflake documents that
  large scanned results can be slower than querying a real table and that order is not
  guaranteed unless the `RESULT_SCAN` query specifies an `ORDER BY`. It also has result-cache
  lifetime constraints.
- `to_pandas_batches()` / connector `fetch_pandas_batches()`: Efficient for sequential
  transfer from one query result, but they are cursor-like APIs, not random-access APIs.

#### Recommendation

The Snowflake adapter should expose three internal strategies:

1. `offset`: deterministic direct `LIMIT/OFFSET`, used as the default low-setup fallback.
2. `keyset`: adjacent-chunk optimization from cached anchors.
3. `materialized`: session temporary table with `__st_row_num`, used when Streamlit needs
   reliable random access over a large result.

For the MVP, implement `offset` plus the protocol hooks needed to add `materialized`.
Do not promise efficient deep random access until materialized row-index mode exists.

#### Auto-materialization Criteria

The adapter should consider auto-materializing when:

1. **Row count exceeds threshold**: Total rows > 500,000 (configurable)
2. **Deep pagination detected**: User scrolls past 50,000 rows
3. **Random access pattern**: User jumps to non-adjacent pages frequently

For MVP, materialization should be opt-in via an explicit parameter or triggered by user
action (e.g., "Enable fast scrolling" button that warns about upfront cost). Auto-detection
can be added in a later phase once usage patterns are understood.

## Follow-up: Server-side Filtering

`st.dataframe` does not currently support filtering. Lazy loading should therefore keep
filtering out of the MVP while reserving protocol space for a later dataframe filtering
feature.

The follow-up should add:

- Explicit source capabilities such as `filterable=True` or `filterable=[...]`.
- A typed filter expression schema rather than arbitrary Python callbacks from the frontend.
- Chunk request metadata for active filters.
- Row count recomputation for known-size filtered sources.
- Cache invalidation keyed by source generation plus sort/search/filter state.
- Tests that filtering never applies only to loaded chunks.

## Unsupported Combinations in MVP

- `on_select != "ignore"`: for `lazy=True`, raise `StreamlitAPIException`; for `lazy=None`,
  fall back to eager rendering to maintain backward compatibility; for `lazy=False`, use the
  existing eager behavior.
- `pandas.Styler`: keep existing eager `st.dataframe(styler)` behavior for `lazy=None` and
  `lazy=False`; raise `StreamlitAPIException` for `lazy=True`.
- `st.data_editor`: out of scope
- Client-side search: disabled for lazy dataframes. Searching only loaded chunks would be
  incorrect. Server-side search is deferred to a follow-up phase.
- CSV download/export: hidden for lazy dataframes in MVP. Server-side export can be added later.
- Filtering: out of scope until `st.dataframe` has a filtering UI/API.

Note: Server-side sorting IS supported in MVP via the internal `sortable` source capability.

## Security and Isolation

- Source ids must be unguessable and scoped to a single session.
- Chunk requests must validate that the source id belongs to the current `AppSession` and that
  the requested generation is active.
- Chunk requests reuse the existing websocket session authentication (XSRF, cookies,
  identity binding). No additional auth mechanism is required since chunk requests are
  BackMsg/ForwardMsg pairs on the same authenticated websocket connection.
- The frontend must not be able to request arbitrary Python callables.
- Errors returned to the frontend should be useful but should not expose sensitive connection
  details beyond what Streamlit normally exposes for app exceptions.

## Metrics

Collect:

- Lazy dataframe render count by source adapter type.
- Number of chunk requests per source.
- Bytes sent for initial chunks and follow-up chunks.
- Chunk load latency and error count.
- Fallback count for unevaluated objects that cannot lazy-load.

## Alternatives Considered

### HTTP Endpoint for Chunks

Possible, but it creates a second transport path with separate auth/session validation. The
existing websocket protocol already carries Arrow bytes and has a precedent for non-rerun
requests, so a BackMsg/ForwardMsg pair is the smaller initial change.

### Reuse Deferred File Requests

Rejected. Deferred file requests execute a callable and return a media URL. Dataframe chunks
are short-lived table payloads tied to an element generation and should not be stored as media
files.

### Make `Quiver` Mutable

Rejected for the first version. `Quiver` is intentionally immutable and widely used. A lazy
cache around chunk-level Quivers is less invasive than changing `Quiver` ownership semantics.

### Infer Loader Capabilities from Function Signatures

Rejected. It creates surprising behavior when users wrap functions, use partials, or omit type
annotations. Explicit capabilities are easier to validate and document.

## Testing

- Python unit tests for `lazy` mode resolution, internal source validation, adapter slicing,
  pandas fallback behavior, source manager cleanup, and stale source rejection.
- Proto tests through generated types after `make protobuf`.
- Frontend unit tests for cache range merging, stale response handling, loading cells, error
  cells, retry, and server-side sort state transitions that do not call the client-side sorter.
- E2E tests for scroll loading without script rerun, server-side sorting, auto-lazy large
  in-memory dataframes, rerun invalidation, hidden search/CSV controls, `height="content"`
  fallback behavior, and unsupported combinations.
- External e2e coverage is recommended because chunk requests use websocket session transport and
  future Snowflake/Snowpark adapters depend on hosted runtime/session behavior. Focus on proxied
  websocket chunk requests, stale response handling after rerun/reconnect, and Snowflake session
  lifecycle cleanup.
- Performance smoke test with a source larger than browser memory to verify initial payload size
  stays bounded.

## References

- Component-owned Arrow data refactor: see `preparations.md` section 1
- Prior prototype PR #11032: https://github.com/streamlit/streamlit/pull/11032
- Snowflake `LIMIT / FETCH`: https://docs.snowflake.com/en/sql-reference/constructs/limit
- Snowpark `DataFrame.limit`: https://docs.snowflake.com/en/developer-guide/snowpark/reference/python/latest/snowpark/api/snowflake.snowpark.DataFrame.limit
- Snowflake top-K pruning: https://docs.snowflake.com/en/user-guide/querying-top-k-pruning-optimization
- Snowflake micro-partitions and pruning: https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions
- Snowflake temporary tables: https://docs.snowflake.com/user-guide/tables-temp-transient
- Snowpark `DataFrame.cache_result`: https://docs.snowflake.com/en/developer-guide/snowpark/reference/python/latest/snowpark/api/snowflake.snowpark.DataFrame.cache_result
- Snowflake `RESULT_SCAN`: https://docs.snowflake.com/en/sql-reference/functions/result_scan
- Snowpark `DataFrame.to_pandas_batches`: https://docs.snowflake.com/en/developer-guide/snowpark/reference/python/latest/snowpark/api/snowflake.snowpark.DataFrame.to_pandas_batches
