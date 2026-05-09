---
author: lukasmasuch
created: 2026-05-07
---

# Lazy Loading for st.dataframe

## Summary

Add lazy row loading to read-only `st.dataframe` so users can inspect datasets that are too
large to send to the browser in one message. The end-state design should keep the simple
`st.dataframe(data)` path for supported lazy data objects, and expose a small
dataframe-specific source wrapper when users need custom loading logic.

The initial version should focus on read-only row loading for known-size sources, server-side
sorting, and automatic lazy delivery for compatible large in-memory dataframes. Unknown-size
sequential sources with `row_count=None`, server-side search/filtering, editing, and selection
semantics should be designed as follow-up capabilities instead of being bundled into the first
API.

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
- Provide one explicit dataframe-specific wrapper for custom loaders.
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
- Unknown-size sequential sources with `row_count=None`. The first version requires a known row
  count for callback-backed sources so the scrollbar, cache, and request validation can remain
  simple.
- Server-side search/filtering UI. Searching or filtering only loaded chunks would be misleading,
  and `st.dataframe` does not yet have filtering UI.
- Pandas Styler support in lazy mode. Styler output is tied to the materialized table.
- New required dependencies. Backend-specific support should use optional detection, as
  existing dataframe conversion does.

## Proposal

### 1. Auto-lazy Existing Unevaluated Data Objects

When `st.dataframe` receives a supported unevaluated object and Streamlit can determine a row
count plus fetch row ranges, Streamlit should render it as a lazy dataframe instead of
materializing a capped preview.

Note: The following examples show the target experience for Phase 2 adapters. In Phase 1,
these objects will still use the capped-preview fallback until their adapters are implemented.

```python
import polars as pl
import streamlit as st

# Phase 2: Polars LazyFrame adapter
events = pl.scan_parquet("s3://bucket/events/*.parquet")

st.dataframe(events)
```

```python
from snowflake.snowpark.functions import col

# Phase 2: Snowpark DataFrame adapter
orders = session.table("orders").filter(col("status") == "OPEN")

st.dataframe(orders)
```

```python
# Future: DuckDB relation adapter (Phase 3+)
rel = duckdb.sql("SELECT * FROM 'logs/*.parquet'")

st.dataframe(rel)
```

If a supported unevaluated object cannot provide the required lazy operations, Streamlit should
fall back to the current capped-preview behavior with a clear warning. This keeps compatibility
while allowing adapters to improve over time.

### 2. Explicit Source Wrapper for Custom Loaders

For arbitrary backends, users can provide a range loader and total row count.

```python
import pandas as pd
import pyarrow as pa
import streamlit as st
from streamlit import SortState


def load_orders(offset: int, limit: int, sort: SortState | None) -> pd.DataFrame:
    sortable_columns = {
        "id": "id",
        "status": "status",
        "created_at": "created_at",
        "total": "total",
    }

    order_by = "id ASC"  # default stable sort
    if sort:
        sort_column = sortable_columns.get(sort.column)
        if sort_column is None:
            raise ValueError(f"Unsupported sort column: {sort.column}")
        direction = "DESC" if sort.direction == "desc" else "ASC"
        order_by = f"{sort_column} {direction}, id ASC"

    return pd.read_sql(
        f"""
        SELECT id, status, created_at, total
        FROM orders
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
        """,
        connection,
        params=(limit, offset),
    )


orders = st.DataFrameSource(
    load_orders,
    row_count=lambda: pd.read_sql(
        "SELECT COUNT(*) FROM orders",
        connection,
    ).iat[0, 0],
    schema=pa.schema([
        ("id", pa.int64()),
        ("status", pa.string()),
        ("created_at", pa.timestamp("us")),
        ("total", pa.float64()),
    ]),
    sortable=True,
)

st.dataframe(orders)
```

The loader returns normal dataframe-like data. Streamlit handles Arrow serialization, chunk
cache metadata, retry behavior, and frontend integration. Sort columns should be translated
through an explicit whitelist like the example above; app code should not interpolate raw
frontend-provided column names into SQL.

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

For smaller in-memory dataframes, Streamlit should keep eager rendering by default. A source
wrapper can still force lazy delivery when the app author wants it.

## API

Preferred name: `st.DataFrameSource`.

```python
class DataFrameSource:
    def __init__(
        self,
        data: Data | Callable[[int, int, SortState | None], Data],
        *,
        row_count: int | Callable[[], int] | None = None,
        schema: pa.Schema | None = None,
        sortable: bool = True,
    ) -> None:
        ...
```

Parameters:

- `data`: Either a dataframe-like object to deliver in chunks, or a callable that accepts
  `(offset, limit, sort)` and returns rows in the half-open range `[offset, offset + limit)`.
  The `sort` parameter is a `SortState` object with `column: str` and `direction: "asc" | "desc"`,
  or `None` if no sort is active. Streamlit detects callables automatically.
- `row_count`: Total number of rows. Required for callback-backed sources in the first version.
  Can be callable so Streamlit can recompute it on rerun. The callable is invoked once per rerun
  when the element is rendered (not on every chunk request). Ignored when `data` is a dataframe
  (row count is derived from the data). `row_count=None` for unknown-size sequential sources is
  reserved for a follow-up phase.
- `schema`: Optional PyArrow schema for callback-backed sources. If omitted, Streamlit infers
  the schema from the first non-empty chunk. Empty sources should provide `schema`. Ignored
  when `data` is a dataframe (schema is derived from the data).
- `sortable`: Whether server-side sorting is enabled. Defaults to `True`. For callback sources,
  the callback must handle the `sort` parameter when `sortable=True`. Sorting is a global
  capability for the source; per-column sortable allowlists are not part of the first version.

Validation:

- If `data` is a dataframe, `row_count` and `schema` are derived from it. Passing these
  explicitly issues a warning but does not fail.
- If `data` is a callable and `row_count` is `None`, Streamlit raises
  `StreamlitAPIException("row_count is required for callable DataFrameSource")` in the first
  version.
- If `row_count` is provided, it must be non-negative. Negative values raise
  `StreamlitAPIException("row_count must be non-negative")`.
- Callback loaders must return a dataframe-like object with columns compatible with the
  declared or inferred schema.

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
Unknown-size sequential sources are covered in Phase 4.

### Sorting and Search

**Sorting:** Server-side sorting is supported in the first version via the `sortable` parameter.
When the user clicks a column header to sort:

1. The frontend clears cached chunks (sort changes row order).
2. Chunk requests include the current sort state (column + direction).
3. The source returns rows in the sorted order.
4. For dataframe sources, Streamlit handles sorting automatically.
5. For callback sources, the callback receives the sort state and must return correctly sorted data.

When `sortable=True`, sortable dataframe columns show the existing sort UI. When
`sortable=False`, sorting is disabled entirely. The first version intentionally does not expose a
per-column public allowlist; app authors whose backend can only sort some columns should set
`sortable=False` and keep sorting disabled until a narrower capability API exists.

**Search:** Table-wide search is disabled for lazy sources in the first version. Searching only
loaded chunks would be incorrect because unloaded rows would be excluded. Server-side search
can be added in a follow-up phase.

`st.dataframe` does not currently support filtering. Lazy loading should not introduce
filtering UI in the MVP, but the source API should leave a clear extension path for a future
server-side filtering feature.

### Follow-up: Server-side Search and Filtering

When `st.dataframe` gets search/filtering UI for lazy sources, the API can extend with
additional capabilities:

```python
st.DataFrameSource(
    load_orders,
    row_count=count_orders,
    schema=schema,
    sortable=True,
    searchable=True,  # future
    filterable=True,  # future
)
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

For **explicit** lazy sources (`st.DataFrameSource`), Streamlit should raise a clear
`StreamlitAPIException` when used with `on_select != "ignore"`.

For **implicit** auto-lazy sources (in-memory dataframes above the threshold), Streamlit should
fall back to the current eager/capped-preview behavior when `on_select != "ignore"` to maintain
backward compatibility. This avoids breaking existing `st.dataframe(obj, on_select=...)` calls.

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

- `pandas.Styler`: `st.dataframe(styler)` should keep the existing eager path;
  `st.DataFrameSource(styler)` should be rejected.

### Cache and Invalidation

- Lazy source state should be scoped to the user session.
- Rerunning the script should create a new source generation when the element identity or source
  configuration changes.
- The frontend should discard chunks from older generations.
- Server-side source state should be cleaned up when the session closes or the element
  disappears.

## Phased Implementation

### Phase 1: Lazy Transport, Custom Sources, and Server-side Sorting

- Add the backend/frontend protocol for row chunk requests with sort state.
- Add `st.DataFrameSource(data, row_count=..., schema=..., sortable=...)`.
- Support known-size dataframe and callable sources.
- Server-side sorting via `sortable` parameter.
- Auto-lazy compatible in-memory pandas/Polars dataframes above the existing frontend large-table
  threshold (`150000` rows).
- Disable selection, editing, Styler, and search for lazy sources.

### Phase 2: Existing Lazy Data Adapters

- Replace capped previews with lazy rendering for Polars LazyFrame and Snowpark DataFrame/Table.
- For Snowflake, direct `LIMIT/OFFSET` should be treated as a deterministic fallback, not as
  efficient deep random access.
- Keep capped-preview fallback for objects that cannot provide row count or stable range access.

### Phase 3: Server-side Search, Filtering, and Additional Adapters

- Add `searchable` and `filterable` capabilities to `st.DataFrameSource`.
- Add request metadata for search/filter state.
- Recompute row count when filters change.
- Reset chunk cache on search/filter changes.
- Restore search support for auto-lazy in-memory pandas/Polars dataframes via server-side search.
- Add DuckDB relation adapter and other unevaluated data object adapters based on user demand.

### Phase 4: Streaming Sources

- Add unknown-size sequential sources with `row_count=None` for append-only logs or generators.
- Use loaded-size scroll behavior until the source is exhausted.
- Define cache bounds and backpressure for long-running streams.

Note: The Phase 1 API reserves `row_count=None` for this later contract. Unknown-size sources
need additional scrolling and cache semantics work beyond the MVP. Known-size sources with
random access are the MVP focus.

## Alternatives Considered

### Only Recommend `st.pagination`

Rejected. Pagination is useful, but it does not preserve the dataframe interaction model and
does not solve native scrolling through a large table.

### Require `st.DataFrameSource(...)` for Every Lazy Object

Rejected. `st.dataframe` already accepts many unevaluated data objects. Requiring a new wrapper
for the same objects would add boilerplate and make the API feel less Streamlit-like.

### Add Many Parameters to `st.dataframe`

Rejected for the initial design. Parameters like `row_count`, `load`, `sortable`, and
future `filterable` capabilities only apply to lazy sources. Keeping them on a source wrapper
avoids widening the main `st.dataframe` signature for a specialized path.

### Source Wrapper Naming

Options:

- `st.DataFrameSource` is preferred. It is explicit, dataframe-specific, and works for both
  known-size random-access sources and unknown-size sequential sources.
- `st.LazyDataFrame` is understandable, but it sounds like a dataframe implementation rather
  than a loader/source wrapper.
- `st.LazyFrame` is concise, but it collides conceptually with Polars `LazyFrame` and could
  imply dataframe operations that Streamlit will not provide.
- `st.DataFrameLoader` describes callback use cases, but it fits wrapped in-memory dataframes
  less well.
- `st.dataframe_source(...)` would be a Streamlit-style factory function, but a class-like name
  is easier to document and type when users pass the object into `st.dataframe`.

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
