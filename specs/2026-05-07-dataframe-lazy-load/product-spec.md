---
author: lukasmasuch
created: 2026-05-07
---

# Lazy Loading for st.dataframe

## Summary

Add lazy row loading to read-only `st.dataframe` so users can inspect datasets that are too
large to send to the browser in one message. The end-state design should keep the simple
`st.dataframe(data)` path and add a small `lazy: bool | None = None` parameter for users who
want to force or disable lazy delivery.

The initial version should focus on read-only row loading for known-size sources, server-side
sorting, `lazy=True` delivery for supported/convertible inputs, and automatic lazy delivery for
compatible large in-memory dataframes. Unknown-size sequential sources, server-side
search/filtering, editing, selection semantics, and public custom source APIs should be designed
as follow-up capabilities instead of being bundled into the first API.

## Problem

`st.dataframe` currently serializes dataframe data into Arrow bytes before the element is sent
to the frontend. For ordinary in-memory dataframes this means the browser receives the full
dataset. For many unevaluated data objects, Streamlit currently materializes only a capped
number of rows and warns the user that more data exists.

This creates practical limits:

- Large in-memory dataframes can freeze or crash the browser.
- Lazy dataframes and database-backed objects are truncated instead of browsable.
- Apps that need to inspect logs, query results, or large parquet files fall back to manual
  pagination.
- Manual pagination loses the native dataframe experience: scroll position, column sizing,
  keyboard navigation, and visual continuity.

Current workaround:

```python
page = st.pagination(num_pages=total_pages)
start = (page - 1) * page_size
df_page = query_orders(offset=start, limit=page_size)

st.dataframe(df_page)
```

## Goals

- Preserve the familiar `st.dataframe(data)` API for data types Streamlit already accepts.
- Avoid forcing users to wrap Polars LazyFrame, Snowpark DataFrame, DuckDB relation, Dask,
  PySpark, or DB-API cursor objects only to get lazy rendering.
- Provide a simple `lazy` parameter to force eager mode, force lazy delivery, or use automatic
  selection.
- Auto-switch large compatible in-memory dataframes to lazy delivery above the existing
  frontend large-table threshold.
- Keep scroll-triggered row loading out of the normal script rerun path.
- Make unsupported interactions explicit instead of giving partial or misleading behavior.
- Ship a minimal useful surface first and leave expandable hooks for later capabilities.

## Non-goals for the First Version

- `st.data_editor` lazy loading. Editing requires write-back, conflict handling, and a row
  identity model.
- Push-based real-time streaming. Unknown-size pull-based sources can fit the same source API,
  but live updates beyond scroll-triggered loading need separate lifecycle behavior.
- Unknown-size sequential sources with `row_count=None`, including generator/iterator inputs that
  yield dataframe-compatible chunks. The first version requires a known row count for lazy sources
  so the scrollbar, cache, and request validation can remain simple.
- Server-side search/filtering UI. Searching or filtering only loaded chunks would be misleading,
  and `st.dataframe` does not yet have filtering UI.
- Pandas Styler support in lazy mode. Styler output is tied to the materialized table.
- Public custom source APIs. The first version should keep custom source protocols internal or
  advanced-only until the adapter contract is proven.
- New required dependencies. Backend-specific support should use optional detection, as
  existing dataframe conversion does.

## Proposal

### 1. `lazy` Parameter

Add a tri-state `lazy` parameter to `st.dataframe`:

```python
st.dataframe(data, *, lazy: bool | None = None, ...)
```

Semantics:

- `lazy=None` (default): Streamlit chooses. Use lazy delivery for supported unevaluated objects
  and compatible in-memory dataframes above the large-table threshold. Use the existing eager or
  capped-preview path otherwise.
- `lazy=False`: Never use lazy delivery. Preserve today's eager rendering path for in-memory
  dataframes and today's capped-preview fallback for unevaluated objects.
- `lazy=True`: Explicitly request lazy delivery. Use a native lazy adapter when available. If no
  native adapter is needed or available, convert supported eager inputs to an in-memory pandas
  dataframe and serve row slices from server memory. If lazy delivery conflicts with the input or
  options, raise a clear `StreamlitAPIException`.

`lazy=True` should apply lazy delivery for inputs with more than 1,000 rows. For inputs with
1,000 rows or fewer, Streamlit may keep eager rendering as a small-data optimization because the
full payload is already bounded.

The pandas fallback for `lazy=True` reduces the initial frontend payload and browser memory
usage. It does not reduce server memory usage or the cost of converting the input to pandas. For
remote unevaluated objects, Streamlit should prefer native lazy adapters and should not silently
materialize an entire remote dataset just to satisfy `lazy=True`.

### 2. Auto-lazy Existing Unevaluated Data Objects

When `st.dataframe` receives a supported unevaluated object and Streamlit can determine a row
count plus fetch row ranges, Streamlit should render it as a lazy dataframe instead of
materializing a capped preview.

Note: The following examples show the target experience for native lazy adapters. The first
implementation should include only adapters that can provide known row counts and stable range
access; unsupported objects keep the capped-preview fallback for `lazy=None` and raise for
`lazy=True`.

```python
import polars as pl
import streamlit as st

events = pl.scan_parquet("s3://bucket/events/*.parquet")

st.dataframe(events)
```

```python
from snowflake.snowpark.functions import col

orders = session.table("orders").filter(col("status") == "OPEN")

st.dataframe(orders)
```

```python
# Future: DuckDB relation adapter (Phase 3+)
rel = duckdb.sql("SELECT * FROM 'logs/*.parquet'")

st.dataframe(rel)
```

If a supported unevaluated object cannot provide the required lazy operations, Streamlit should
fall back to the current capped-preview behavior with a clear warning when `lazy=None` or
`lazy=False`. If `lazy=True`, raise a clear error explaining that no lazy adapter is available.
This keeps compatibility for the default path while making explicit lazy requests reliable.

### 3. Auto-lazy Large In-memory Dataframes

Streamlit already treats tables with more than 150,000 rows as large in the frontend and
disables some expensive features. Lazy row loading should reuse that threshold for compatible
in-memory pandas and Polars dataframes.

```python
df = pd.read_parquet("large_export.parquet")

st.dataframe(df)  # uses lazy delivery when len(df) > 150_000 and lazy mode is compatible
```

This does not reduce server memory usage. It reduces the initial Arrow payload and browser
memory usage.

Auto-lazy should only apply when lazy mode can preserve or intentionally match existing large
table behavior:

- `st.dataframe` is read-only.
- `on_select="ignore"`.
- The input is not a `pandas.Styler`.
- CSV download remains disabled or is reimplemented as a server-side export.

**Backwards Compatibility Note:** The existing large-table path (>150k rows) already disables
sorting and CSV download but still shows search UI. Auto-lazy additionally disables search since
searching only loaded chunks would be misleading. This is an intentional user-visible behavior
change for the first version in exchange for bounded initial payload and browser memory usage.
Server-side search can restore search for auto-lazy dataframes in a later phase.

For smaller in-memory dataframes, Streamlit should keep eager rendering by default. Users can set
`lazy=True` to force lazy delivery for inputs above the forced-lazy minimum row threshold.

### 4. Advanced Custom Sources

Streamlit should still normalize every lazy input to an internal `DataframeSourceProtocol`.
Built-in adapters and the in-memory pandas fallback use this protocol. A public custom source API
can be added later if users need arbitrary range loaders, but it should not be the primary API in
the first version.

If exposed later, custom loaders should translate sort columns through an explicit whitelist; app
code should not interpolate raw frontend-provided column names into SQL.

## API

Add one keyword-only parameter to `st.dataframe`:

```python
def dataframe(
    data: Data = None,
    width: int | None = None,
    height: int | None = None,
    *,
    use_container_width: bool | None = None,
    hide_index: bool | None = None,
    column_order: Iterable[str] | None = None,
    column_config: ColumnConfigMappingInput | None = None,
    key: Key | None = None,
    on_select: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
    selection_mode: SelectionMode | Iterable[SelectionMode] = "multi-row",
    row_height: int | None = None,
    lazy: bool | None = None,
) -> DeltaGenerator | DataframeState:
    ...
```

`lazy` controls frontend delivery mode:

- `None`: Auto-select. This is the default.
- `False`: Force existing eager/capped-preview behavior.
- `True`: Force lazy delivery when supported. Streamlit uses native lazy adapters first and falls
  back to an in-memory pandas source for supported eager inputs.

Validation and fallback:

- `lazy=True` with incompatible options raises a `StreamlitAPIException`. Examples include
  `pandas.Styler`, `on_select != "ignore"` in the first version, and inputs that cannot use a
  native adapter or safe in-memory pandas fallback.
- `lazy=None` should prefer compatibility: if lazy mode is not supported for the input/options,
  Streamlit uses eager rendering or the existing capped-preview fallback.
- `lazy=False` always uses eager rendering or the existing capped-preview fallback.
- For supported eager inputs, `lazy=True` converts to an in-memory pandas dataframe once, derives
  row count and schema from that dataframe, and serves row ranges from server memory.
- For remote unevaluated inputs, `lazy=True` should not silently materialize the full remote
  dataset. It should use a native adapter or raise a clear error.

Internal API:

- Built-in adapters normalize to an internal `DataframeSourceProtocol`.
- A custom source wrapper can be considered later in an advanced/internal namespace, but
  `st.DataFrameSource` should not be part of the primary Phase 1 public API.

## Behavior

### Initial Render

The initial element message should include:

- Element metadata and layout options.
- Source metadata, including a source id and optional row count.
- Column schema.
- An initial row chunk when it is cheap to fetch.

The first visible rows should render immediately when the initial chunk is present. Otherwise,
the table should show loading rows and request the first visible chunk.

### Scrolling

- Scrolling requests missing row chunks from the server.
- Scroll-triggered chunk requests must not trigger a script rerun.
- The frontend should prefetch near the visible range and avoid duplicate in-flight requests.
- Cached chunks should render synchronously once loaded.
- Failed chunks should show an inline error state with retry.

For the first version, all lazy sources have a known row count and support row-range requests.
Unknown-size sequential sources are covered in Phase 4, including automatic support for
generators that yield dataframe chunks such as pandas dataframes or PyArrow tables.

### Sorting and Search

**Sorting:** Server-side sorting is supported in the first version via a source-level boolean
`sortable` capability. When the user clicks a column header to sort:

1. The frontend clears cached chunks (sort changes row order).
2. Chunk requests include the current sort state (column + direction).
3. The source returns rows in the sorted order.
4. For in-memory dataframe sources, Streamlit handles sorting automatically.
5. For native unevaluated adapters, the adapter pushes the sort state into the backend query when
   it can do so safely.

When `sortable=True`, sortable dataframe columns show the existing sort UI. When
`sortable=False`, sorting is disabled entirely. The first version intentionally does not expose a
per-column public allowlist; adapters whose backend can only sort some columns should set
`sortable=False` and keep sorting disabled until a narrower capability API exists.

**Search:** Table-wide search is disabled for lazy sources in the first version. Searching only
loaded chunks would be incorrect because unloaded rows would be excluded. Both the search toolbar
button and the search keyboard shortcut (Ctrl/Cmd+F) are disabled for lazy dataframes.
Server-side search can be added in a follow-up phase.

**Select-all:** The select-all keyboard shortcut (Ctrl/Cmd+A) is disabled for lazy dataframes to
prevent triggering load requests for all data. This matches the existing behavior for large tables
(>150k rows) where select-all is already disabled for performance reasons.

`st.dataframe` does not currently support filtering. Lazy loading should not introduce
filtering UI in the MVP, but the source API should leave a clear extension path for a future
server-side filtering feature.

### Follow-up: Server-side Search and Filtering

When `st.dataframe` gets search/filtering UI for lazy sources, the internal source protocol or a
future public custom-source API can extend with additional capabilities:

```python
source = create_orders_dataframe_source(
    query,
    searchable=True,  # future
    filterable=True,  # future
)
st.dataframe(source, lazy=True)
```

The follow-up should define:

- Filter expression schema and supported operators.
- How filter state is represented in dataframe widget state, if at all.
- How `row_count` is recomputed when filters change.
- How chunk caches are invalidated when filter state changes.
- How filtering composes with server-side sorting and search.

### Selection

`on_select` should not be supported for lazy dataframes in the first version. Current
`st.dataframe` selection state is position-based relative to the original dataframe, and lazy
server-side data can be reordered, filtered, or partially unavailable.

When `lazy=True`, Streamlit should raise a clear `StreamlitAPIException` if
`on_select != "ignore"`.

When `lazy=None`, Streamlit should fall back to the current eager/capped-preview behavior when
`on_select != "ignore"` to maintain backward compatibility. This avoids breaking existing
`st.dataframe(obj, on_select=...)` calls. When `lazy=False`, Streamlit uses the existing eager
selection behavior.

### Styling and Column Configuration

Supported in lazy mode:

- `column_config`
- `column_order`
- `hide_index`
- `row_height`
- `placeholder`
- `width`
- `height="auto"`, `height="stretch"`, `height="content"`, and fixed integer heights

Note on `height="content"` with lazy sources: For sources with a known `row_count`, the height
is computed upfront from the total row count and capped at the existing 10,000px maximum content
height. Very large lazy dataframes therefore still render as a scrollable table inside the capped
height instead of expanding the page to the full dataset height.

Not supported in lazy mode:

- `pandas.Styler`: `st.dataframe(styler)` should keep the existing eager path for
  `lazy=None` and `lazy=False`; `st.dataframe(styler, lazy=True)` should raise a clear
  `StreamlitAPIException`.

### Cache and Invalidation

- Lazy source state should be scoped to the user session.
- Rerunning the script should create a new source generation when the element identity or source
  configuration changes.
- The frontend should discard chunks from older generations.
- Server-side source state should be cleaned up when the session closes or the element
  disappears.

## Phased Implementation

### Phase 1: Lazy Transport, `lazy` Parameter, and Server-side Sorting

- Add the backend/frontend protocol for row chunk requests with sort state.
- Add `lazy: bool | None = None` to `st.dataframe`.
- Add an internal `DataframeSourceProtocol` and source manager for known-size lazy sources.
- Support in-memory pandas fallback sources for `lazy=True` when the input can be safely converted.
- Auto-lazy compatible in-memory pandas/Polars dataframes above the existing frontend
  large-table threshold (`150000` rows) when `lazy=None`.
- Support native lazy adapters that are implementation-ready; unsupported unevaluated objects keep
  the capped-preview fallback for `lazy=None` and raise for `lazy=True`.
- Server-side sorting via the internal `sortable` source capability.
- Disable selection, editing, Styler, and search for lazy sources.

### Phase 2: Existing Lazy Data Adapters

- Expand native lazy rendering for Polars LazyFrame, Snowpark DataFrame/Table, and other
  unevaluated objects not completed in Phase 1.
- For Snowflake, direct `LIMIT/OFFSET` should be treated as a deterministic fallback, not as
  efficient deep random access.
- Keep capped-preview fallback for objects that cannot provide row count or stable range access.

### Phase 3: Server-side Search, Filtering, and Advanced Sources

- Add `searchable` and `filterable` capabilities to the internal source protocol or a future
  advanced custom-source API.
- Add request metadata for search/filter state.
- Recompute row count when filters change.
- Reset chunk cache on search/filter changes.
- Restore search support for auto-lazy in-memory pandas/Polars dataframes via server-side search.
- Add DuckDB relation adapter and other unevaluated data object adapters based on user demand.
- Consider exposing a public custom source API after the built-in adapter contract has proven
  stable.

### Phase 4: Streaming Sources

- Add unknown-size sequential sources with `row_count=None` for append-only logs or generators.
- Auto-wrap generator/iterator inputs that yield dataframe-compatible chunks, such as
  `pandas.DataFrame`, `pyarrow.Table`, `pyarrow.RecordBatch`, or other supported dataframe
  objects.
- Use loaded-size scroll behavior until the source is exhausted.
- Infer schema from the first yielded chunk when possible; require a schema only for generators
  that may yield no rows before exhaustion.
- Disable sorting, search, and random row jumps unless a later source type adds explicit support.
- Define cache bounds and backpressure for long-running streams.

Note: The Phase 1 internal protocol reserves `row_count=None` for this later contract.
Unknown-size sources need additional scrolling and cache semantics work beyond the MVP.
Known-size sources with random access are the MVP focus.

## Alternatives Considered

### Only Recommend `st.pagination`

Rejected. Pagination is useful, but it does not preserve the dataframe interaction model and
does not solve native scrolling through a large table.

### Require `st.DataFrameSource(...)` for Every Lazy Object

Rejected. `st.dataframe` already accepts many unevaluated data objects. Requiring a new wrapper
for the same objects would add boilerplate and make the API feel less Streamlit-like.

### Expose Many Lazy-source Parameters on `st.dataframe`

Rejected for the initial design. Parameters like `row_count`, `load`, `sortable`, `searchable`,
and `filterable` only apply to lazy sources. The public dataframe API should add the single
mode-selection parameter `lazy`; richer source capabilities should stay internal until there is
clear demand for custom sources.

### Add `st.DataFrameSource` in Phase 1

Rejected for the initial design. A public wrapper is still useful for arbitrary databases and
custom range loaders, but it is not necessary to solve the first product problem. Keeping the
source protocol internal lets Streamlit validate the transport, cache, sorting, and adapter
contracts before committing to a public custom-loader API.

### Infer Sort/Filter Capabilities from Loader Signature

Rejected. Signature inspection is convenient in demos but brittle in real apps. Explicit
capability declarations are clearer and make unsupported UI states easier to explain.

## Open Questions

- What stable row identity API is needed before lazy dataframes can support `on_select`?
- Which existing unevaluated object types should be included in the first adapter phase beyond
  Polars LazyFrame, Snowpark, and DuckDB?
- For Snowflake, when should Streamlit pay the upfront cost to materialize a session temporary
  table with row numbers instead of using direct `LIMIT/OFFSET`?
- Should auto-lazy use the hard-coded 150,000-row frontend threshold, or should it become a
  config option once server-side lazy loading exists?

## Checklist

| Item                         | ✅ or comment                                          |
|------------------------------|--------------------------------------------------------|
| Works on SiS, Cloud, etc?    | Yes, chunk loading stays server-side and session-bound |
| No breaking API changes      | API additive; auto-lazy changes large-table search UI  |
| No new dependencies          | Yes, adapters use optional detection                   |
| Metrics collected            | Track lazy source type, chunks loaded, errors, bytes   |
| Any security/legal impact?   | Needs request/source id validation per session         |
| Any docs changes needed?     | Yes, document lazy mode, limits, and examples          |
