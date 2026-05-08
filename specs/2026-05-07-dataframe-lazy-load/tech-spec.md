---
author: lukasmasuch
created: 2026-05-07
---

# Lazy Loading for st.dataframe

## Summary

Implement lazy row loading for read-only `st.dataframe` by registering a session-scoped data
source on the backend and allowing the frontend to request Arrow row chunks without triggering
a script rerun. The frontend should keep a row-range cache and continue using Glide's
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

## Proposal

### Backend Data Source Protocol

Use a small internal protocol. Public `st.DataFrameSource` and built-in adapters should
normalize to this shape.

```python
class DataframeSourceProtocol(Protocol):
    @property
    def row_count(self) -> int | None:
        ...

    @property
    def schema(self) -> pa.Schema:
        ...

    def load_rows(self, offset: int, limit: int) -> Data:
        ...
```

`Data` is any existing dataframe-compatible return type that can be serialized through
`dataframe_util.convert_anything_to_arrow_bytes`.

`row_count=None` means the source is sequential and unknown-size. Streamlit can request forward
chunks and grow the loaded extent, but it should not issue arbitrary random-access requests.

Future sort/search/filter support can extend this protocol with explicit capability
declarations and keyword-only request parameters. Filtering is not part of current
`st.dataframe` behavior, so the first version should reserve the extension point but not
implement filtering UI or inspect callback signatures to infer capabilities.

### Session Source Manager

Add a session-scoped manager for lazy dataframe sources.

Responsibilities:

- Register a source for the current session and element generation.
- Return a unique `source_id` that cannot be used across sessions.
- Load row ranges in a worker thread so slow data queries do not block the event loop.
  User `load` and `row_count` callables run in this worker thread; they do not have access
  to `ScriptRunContext` and must not call Streamlit APIs (e.g., `st.session_state`). Users
  who need shared state should pass it explicitly via closure or use thread-safe patterns.
  This means callables must create per-call database connections or use thread-safe
  connection pools.
- Limit concurrent in-flight chunk requests per source (e.g., max 3 concurrent requests) to
  prevent a rapidly scrolling user from queuing unbounded simultaneous queries.
- Convert loaded chunks to Arrow bytes.
- Reject stale source ids after reruns, element removal, or session shutdown.
- Bound server-side metadata and clean up per-session state.
- Element disappearance detection: The source manager tracks registered sources by element
  id. On each rerun, the manager compares the new element tree against registered sources.
  Sources whose element ids no longer appear in the tree are marked stale and their state
  is cleaned up. Session shutdown also triggers cleanup of all sources for that session.

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
  optional uint64 row_count = 2;
  uint64 initial_offset = 3;
  uint32 page_size = 4;
  string generation = 5;
  AccessMode access_mode = 6;
  ArrowData initial_chunk = 7;  // Dedicated field for initial rows; keeps arrow_data for eager path only
  bytes serialized_schema = 8;  // Arrow IPC schema bytes when initial_chunk is empty

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
message DataframeChunkRequest {
  string source_id = 1;
  string request_id = 2;
  uint64 offset = 3;
  uint32 limit = 4;
  string generation = 5;
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

**`end_of_stream` semantics:**
- For sequential sources, `end_of_stream=true` signals the source is exhausted. The frontend
  MUST treat this as terminal and stop requesting further chunks.
- `end_of_stream=true` with `error_msg` is a terminal error state (no retry).
- For sequential sources, `end_of_stream=false` with zero-row `arrow_data` is invalid; the
  server must set `end_of_stream=true` when returning the final (possibly empty) chunk.
```

The server must enforce a maximum on `limit` (e.g., 10,000 rows) to prevent a modified client
from requesting arbitrarily large chunks and causing OOM or warehouse cost spikes. The server
should also apply per-session concurrency/backpressure rules to bound simultaneous in-flight
requests.

`request_id` should be a UUID generated by the frontend per request to deduplicate responses.
`generation` should be a UUID generated by the backend when a source is registered, changing
on rerun or source invalidation to allow stale-response detection.

The response should be ignored by the frontend if `source_id`, `request_id`, or `generation`
does not match an active table request.

### Backend Render Flow

1. `st.dataframe` detects a lazy-capable source:
   - explicit `st.DataFrameSource`
   - supported unevaluated object adapter
   - compatible in-memory pandas/Polars dataframe above the large-table threshold
2. Validate unsupported combinations such as `on_select`, `pandas.Styler`, `data_editor`, and
   `height="content"`.
3. Register the source in the session source manager.
4. Fetch an initial chunk if cheap and safe.
5. Enqueue `Dataframe` with normal display configuration plus `lazy_data`.

### Chunk Request Flow

1. Frontend sends `DataframeChunkRequest` over the existing connection.
2. `AppSession` routes it without requesting a script rerun.
3. The source manager validates the session/source/generation.
4. The requested rows are loaded in an executor. The executor does NOT propagate the
   registering rerun's `ScriptRunContext`; user callbacks cannot call Streamlit APIs.
   This isolation prevents concurrency issues with concurrent script reruns.
5. The chunk is serialized as Arrow and returned as `DataframeChunkResponse`.
6. The frontend inserts the chunk into its cache and triggers a render.

### Frontend Cache and Rendering

Add a lazy row cache for dataframe elements.

Responsibilities:

- Track loaded, loading, failed, and missing row ranges.
- Deduplicate overlapping in-flight requests.
- Prefetch a small buffer before and after the visible range.
- Enforce an LRU limit for random-access chunks (e.g., retain the most recent N chunks).
- Enforce a memory bound for sequential-source caches to prevent unbounded growth when
  scrolling through large append-only logs. Use the same LRU limit as random-access sources.
- Clear all chunks when the source generation changes.
- Surface per-range errors and support retry.
- For sequential sources, request only the next unloaded range and grow the apparent row count
  as chunks arrive. The `end_of_stream` response flag signals exhaustion; the frontend should
  stop requesting further chunks and finalize the row count when this flag is true.

Glide's `getCellContent` must remain synchronous. The cache should therefore return:

- Parsed cell content for loaded rows.
- Loading cells for missing rows while a request is in flight.
- Error cells for failed ranges.

Each Arrow chunk can be parsed into a `Quiver`. The cache can either store chunk-level Quivers
plus offset metadata, or normalize parsed cells into a row cache. Chunk-level Quivers are likely
less invasive for the first implementation because existing column/type parsing remains intact.

### Adapter Strategy

Phase 1 adapters:

- Callback source: `st.DataFrameSource(loader, row_count=..., schema=...)`
- In-memory pandas DataFrame: slice with `.iloc[offset : offset + limit]`
- In-memory Polars DataFrame: slice with `.slice(offset, limit)`
- Auto-lazy in-memory pandas/Polars dataframes above the existing frontend large-table
  threshold (`150000` rows) when lazy mode is compatible.

Phase 2 adapters:

- Polars LazyFrame: use `.slice(offset, limit).collect()`
- Snowpark DataFrame/Table: generate bounded queries and use native count
- DuckDB relation: use relation limit/offset APIs

Keep using `dataframe_util.is_unevaluated_data_object` as the central detection point. If an
object is detected but no lazy adapter is ready, keep the current capped-preview fallback.

### Snowflake Loading Strategy

Snowflake deserves a specific design because it is one of the main use cases, but efficient
random access is not the same thing as adding `OFFSET` to every query.

#### Required Invariant: Stable Ordering

Every Snowflake-backed lazy dataframe needs a stable row order. Snowflake supports `LIMIT` /
`OFFSET`, and Snowpark exposes `DataFrame.limit(n, offset=...)`, but results are
non-deterministic without an `ORDER BY`. Chunked rendering without stable ordering can show
duplicates, omit rows, or reorder already-loaded chunks across requests.

For custom loaders, the app author should own the `ORDER BY` clause. For automatic Snowpark
adapters, Streamlit should only claim random-access semantics when it can preserve or require a
deterministic order. A later API may need an explicit `order_by` option for Snowflake sources.

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

- `on_select != "ignore"`: for explicit `st.DataFrameSource`, raise `StreamlitAPIException`;
  for implicit auto-lazy sources, fall back to eager rendering to maintain backward compatibility
- `pandas.Styler`: keep existing eager `st.dataframe(styler)` behavior and reject explicit
  lazy wrapping
- `st.data_editor`: out of scope
- Client-side table-wide sort/search: disable for explicit lazy dataframes. For in-memory
  dataframes, defer auto-lazy until server-side search exists to avoid removing the existing
  search affordance.
- Filtering: out of scope until `st.dataframe` has a filtering UI/API.

## Security and Isolation

- Source ids must be unguessable and scoped to a single session.
- Chunk requests must validate the active session id and source generation.
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

- Python unit tests for `DataFrameSource` validation, adapter slicing, source manager cleanup, and
  stale source rejection.
- Proto tests through generated types after `make protobuf`.
- Frontend unit tests for cache range merging, stale response handling, loading cells, error
  cells, and retry.
- E2E tests for scroll loading without script rerun, rerun invalidation, and unsupported
  combinations.
- Performance smoke test with a source larger than browser memory to verify initial payload size
  stays bounded.

## References

- Snowflake `LIMIT / FETCH`: https://docs.snowflake.com/en/sql-reference/constructs/limit
- Snowpark `DataFrame.limit`: https://docs.snowflake.com/en/developer-guide/snowpark/reference/python/latest/snowpark/api/snowflake.snowpark.DataFrame.limit
- Snowflake top-K pruning: https://docs.snowflake.com/en/user-guide/querying-top-k-pruning-optimization
- Snowflake micro-partitions and pruning: https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions
- Snowflake temporary tables: https://docs.snowflake.com/user-guide/tables-temp-transient
- Snowpark `DataFrame.cache_result`: https://docs.snowflake.com/en/developer-guide/snowpark/reference/python/latest/snowpark/api/snowflake.snowpark.DataFrame.cache_result
- Snowflake `RESULT_SCAN`: https://docs.snowflake.com/en/sql-reference/functions/result_scan
- Snowpark `DataFrame.to_pandas_batches`: https://docs.snowflake.com/en/developer-guide/snowpark/reference/python/latest/snowpark/api/snowflake.snowpark.DataFrame.to_pandas_batches
