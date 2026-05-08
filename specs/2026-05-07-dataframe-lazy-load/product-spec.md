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

The initial version should focus on read-only row loading. Known-size sources can support
random access; unknown-size sources should fit the same API as sequential sources with
`row_count=None`. Server-side sorting, search, filtering, editing, and selection semantics
should be designed as follow-up capabilities instead of being bundled into the first API.

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
- Server-side sorting/search/filtering UI. Sorting or searching only loaded chunks would be
  misleading, and `st.dataframe` does not yet have filtering UI.
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
# Phase 2: DuckDB relation adapter
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
import streamlit as st


def load_orders(offset: int, limit: int) -> pd.DataFrame:
    return pd.read_sql(
        """
        SELECT id, status, created_at, total
        FROM orders
        ORDER BY id
        LIMIT ? OFFSET ?
        """,
        connection,
        params=(limit, offset),
    )


orders = st.DataFrameSource(
    load=load_orders,
    row_count=lambda: pd.read_sql(
        "SELECT COUNT(*) FROM orders",
        connection,
    ).iat[0, 0],
    columns={
        "id": "int64",
        "status": "string",
        "created_at": "datetime64[ns]",
        "total": "float64",
    },
)

st.dataframe(orders)
```

The loader returns normal dataframe-like data. Streamlit handles Arrow serialization, chunk
cache metadata, retry behavior, and frontend integration.

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
- `height!="content"`.
- CSV download remains disabled or is reimplemented as a server-side export.

**Backwards Compatibility Note:** The existing large-table path (>150k rows) already disables
sorting and CSV download but still shows search UI. Auto-lazy would additionally disable search
since searching only loaded chunks would be misleading. This is a user-visible behavior change
for existing apps. Until server-side search is implemented, auto-lazy should be limited to
explicit `st.DataFrameSource` wrappers rather than silently auto-converting large in-memory
dataframes. The auto-lazy threshold for in-memory dataframes should only activate once
server-side search exists to avoid removing existing search functionality.

For smaller in-memory dataframes, Streamlit should keep eager rendering by default. A source
wrapper can still force lazy delivery when the app author wants it.

## API

Preferred name: `st.DataFrameSource`.

```python
class DataFrameSource:
    def __init__(
        self,
        data: Data | None = None,
        *,
        load: Callable[[int, int], Data] | None = None,
        row_count: int | Callable[[], int | None] | None = None,
        columns: Mapping[str, str] | Sequence[str] | None = None,
    ) -> None:
        ...
```

Parameters:

- `data`: An existing dataframe-like object to deliver in chunks. This is mainly for forcing
  lazy delivery below the auto-lazy threshold.
- `load`: Callback that accepts `offset` and `limit`, and returns rows in the half-open range
  `[offset, offset + limit)`.
- `row_count`: Total number of rows, or `None` when the total is unknown. Can be callable so
  Streamlit can recompute it on rerun. The callable is invoked once per rerun when the
  element is rendered (not on every chunk request). If the callable raises an exception,
  Streamlit logs a warning and falls back to the last known row count (or treats as
  unknown-size if no prior count exists).
- `columns`: Optional schema for callback-backed sources. If omitted, Streamlit can infer it
  from the first non-empty chunk. Empty sources should provide `columns`. When provided as a
  `Mapping`, keys are column names and values are pandas-compatible dtype strings (`"int64"`,
  `"float64"`, `"string"`, `"bool"`, `"datetime64[ns]"`, `"timedelta64[ns]"`, `"object"`,
  `"category"`). Note: Use the canonical pandas dtype strings; shortcuts like `"datetime"`
  are not supported to avoid vocabulary fragmentation.

Validation:

- Exactly one of `data` or `load` must be provided:
  - Passing neither raises `StreamlitAPIException("DataFrameSource requires either 'data' or 'load'")`.
  - Passing both raises `StreamlitAPIException("DataFrameSource accepts 'data' or 'load', not both")`.
- When `data` is provided, `row_count` and `columns` are ignored (they are derived from
  the dataframe). Passing these alongside `data` issues a deprecation warning but does not
  fail, allowing future flexibility if explicit overrides become useful.
- If `row_count` is `None`, the source is sequential: Streamlit can request forward chunks but
  cannot support arbitrary row jumps.
- If `row_count` is provided, it must be non-negative. Negative values raise
  `StreamlitAPIException("row_count must be non-negative")`.
- If `row_count` is a callable that returns `None` after previously returning a known row count,
  Streamlit should treat this as an error and fall back to the last known row count with a warning.
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

For sources with `row_count=None`, the scrollbar should reflect the loaded extent instead of a
known total size. The frontend should only request the next unloaded range; jumping to arbitrary
unloaded offsets is not supported until the source reports a total row count and random-access
capability.

### Sorting and Search

In the first version, table-wide sort/search should be disabled for lazy sources unless the
source explicitly supports server-side behavior in a later phase. Sorting or searching only
loaded chunks would be incorrect because unloaded rows would be excluded.

`st.dataframe` does not currently support filtering. Lazy loading should not introduce
filtering UI in the MVP, but the source API should leave a clear extension path for a future
server-side filtering feature.

### Follow-up: Server-side Filtering

When `st.dataframe` gets filtering UI, lazy dataframes should support it with explicit source
capabilities instead of inferring support from the loader signature:

```python
st.DataFrameSource(
    load=load_orders,
    row_count=count_orders,
    columns=columns,
    sortable=["created_at", "total"],
    filterable=["status", "created_at"],
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
- `height="auto"`, `height="stretch"`, and fixed integer heights

Not supported in lazy mode:

- `pandas.Styler`: `st.dataframe(styler)` should keep the existing eager path;
  `st.DataFrameSource(styler)` should be rejected.
- `height="content"` with a lazy source, because computing content height requires knowing and
  rendering all rows.

### Cache and Invalidation

- Lazy source state should be scoped to the user session.
- Rerunning the script should create a new source generation when the element identity or source
  configuration changes.
- The frontend should discard chunks from older generations.
- Server-side source state should be cleaned up when the session closes or the element
  disappears.

## Phased Implementation

### Phase 1: Lazy Transport and Custom Sources

- Add the backend/frontend protocol for row chunk requests.
- Add callback-backed `st.DataFrameSource(load=..., row_count=...)`.
- Add `st.DataFrameSource(df)` for explicit in-memory pandas/Polars chunking below the
  auto-lazy threshold.
- Disable selection, editing, Styler, and table-wide sort/search for lazy sources.

Note: Auto-lazy for in-memory dataframes above 150,000 rows is deferred to Phase 3 when
server-side search exists, per the Backwards Compatibility Note above (lines 171-177).

### Phase 2: Existing Lazy Data Adapters

- Replace capped previews with lazy rendering where feasible for existing unevaluated data
  objects.
- Start with Polars LazyFrame, Snowpark DataFrame/Table, and DuckDB relation. For Snowflake,
  direct `LIMIT/OFFSET` should be treated as a deterministic fallback, not as efficient deep
  random access.
- Keep capped-preview fallback for objects that cannot provide row count or stable range access.

### Phase 3: Server-side Sorting, Search, Filtering, and Auto-lazy

- Add explicit sort/search/filter capabilities to `st.DataFrameSource`.
- Add request metadata for sort/search/filter state.
- Recompute row count when filters change.
- Reset chunk cache on sort/search/filter changes.
- Enable auto-lazy for in-memory pandas/Polars dataframes above 150,000 rows (now that
  server-side search exists to replace client-side search).

### Phase 4: Streaming Sources

- Add unknown-size sequential sources with `row_count=None` for append-only logs or generators.
- Use loaded-size scroll behavior until the source is exhausted.
- Define cache bounds and backpressure for long-running streams.

Note: The API and behavior sections describe `row_count=None` support to define the full
contract, but Phase 4 timing reflects that unknown-size sources need additional scrolling
and cache semantics work beyond the MVP. Known-size sources with random access are the
MVP focus.

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
| No breaking API changes      | Yes, API is additive; auto-lazy behavior needs care    |
| No new dependencies          | Yes, adapters use optional detection                   |
| Metrics collected            | Track lazy source type, chunks loaded, errors, bytes   |
| Any security/legal impact?   | Needs request/source id validation per session         |
| Any docs changes needed?     | Yes, document lazy mode, limits, and examples          |
