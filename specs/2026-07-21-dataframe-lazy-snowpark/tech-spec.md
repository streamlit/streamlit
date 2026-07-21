---
author: lukasmasuch
created: 2026-07-21
---

# Lazy `st.dataframe` — Snowpark native adapter (follow-up)

## Summary

This tech spec covers a follow-up to the lazy `st.dataframe` feature
([#15756](https://github.com/streamlit/streamlit/pull/15756)): a native lazy
adapter for Snowpark `DataFrame`/`Table` objects. The base lazy feature ships
with in-memory adapters (pandas / Polars / `pyarrow.Table`), a `lazy=True`
pandas fallback, and a native adapter for Polars `LazyFrame`. Snowpark support
was prototyped alongside those adapters but intentionally split out into this
follow-up because it cannot be exercised in the default local/CI environment
(no Snowflake account) and warrants its own review of query semantics and cost
trade-offs.

The adapter serves row chunks straight from Snowflake via deterministic
`ORDER BY` + `LIMIT`/`OFFSET` ("offset" mode), so a large Snowpark result set
renders and paginates without first materializing the whole table into the
browser (or a rerun).

## Problem

Today, passing an unevaluated Snowpark `DataFrame`/`Table` to `st.dataframe`
runs the existing capped-preview path: Streamlit evaluates the query up to
`_MAX_UNEVALUATED_DF_ROWS` (10,000) rows and sends that capped Arrow payload to
the browser. Users with larger Snowflake results cannot browse beyond the cap,
and there is no server-side pagination or sorting for these objects. This is the
same class of problem the lazy feature solves for in-memory and Polars data, and
is called out in the lazy dataframe product spec (Phase 2: existing lazy data
adapters) and in adjacent unevaluated-data performance work
([#11701](https://github.com/streamlit/streamlit/issues/11701)).

The base lazy feature already provides everything the adapter needs:

- **Source protocol** (`lib/streamlit/dataframe/lazy_df_source.py`):
  `DataframeSource` (`row_count`, `schema`, `sortable`, `access_mode`,
  `load_rows(offset, limit, *, sort)`), plus `SortSpec`, `AccessMode`, and the
  `resolve_lazy_source(...)` decision logic.
- **Native adapter registry** (`lib/streamlit/dataframe/lazy_df_adapters.py`):
  `try_create_native_source(data)` is the single extension point; it currently
  returns `PolarsLazyFrameSource` for a Polars `LazyFrame` and `None` otherwise.
- **Session-scoped source manager** (`lib/streamlit/runtime/dataframe_source_manager.py`)
  and **chunk handler** (`lib/streamlit/runtime/dataframe_chunk_handler.py`),
  which register a source, serve capped chunks over `BackendOperationRequest`
  without a rerun, and clean up on rerun/fragment/session teardown.
- **Proto + frontend** (`Dataframe.proto` `LazyDataframe`, `LazyDataframeCache`,
  `useLazyDataLoader`, `useLazyColumnSort`), all source-type agnostic.

So this follow-up is purely a **new backend adapter** plus its resolution wiring
and tests. No proto, source-manager, chunk-handler, or frontend changes are
required.

## Proposal

Add a `SnowparkDataframeSource` class to `lib/streamlit/dataframe/lazy_df_adapters.py`
and register it in `try_create_native_source`:

```python
def try_create_native_source(data: object) -> DataframeSource | None:
    if dataframe_util.is_polars_lazyframe(data):
        return PolarsLazyFrameSource(data)
    if dataframe_util.is_snowpark_data_object(data):
        return SnowparkDataframeSource(data)
    return None
```

`dataframe_util.is_snowpark_data_object(...)` already exists and detects Snowpark
`DataFrame`/`Table` without importing `snowflake.snowpark` (optional-dependency
safe). The adapter implements the `DataframeSource` protocol:

- **`row_count`** — `int(self._df.count())`, computed once and cached behind a
  lock (chunk requests run in worker threads via `asyncio.to_thread`, so
  concurrent first accesses must not double-count).
- **`schema`** — derived by loading and caching the unsorted first page
  (`DEFAULT_PAGE_SIZE` rows). Caching the first page also avoids a second
  Snowflake query on the initial render.
- **`sortable`** — `True`.
- **`access_mode`** — `AccessMode.RANDOM_ACCESS`.
- **`load_rows(offset, limit, *, sort)`** — returns the cached first page when it
  fully covers the request (`sort is None and offset == 0` and the cache holds
  `>= limit` rows or is the whole dataset); otherwise queries a fresh chunk. The
  returned table is aligned to the canonical schema with the shared
  `_align_to_schema(...)` helper so every chunk has a consistent schema.

**Offset mode / deterministic pagination.** `LIMIT`/`OFFSET` over Snowflake is
non-deterministic without an `ORDER BY` and can duplicate or skip rows across
chunks. The adapter orders by every column (active sort column first) so the row
order is total and stable across requests, even without a unique key (rows that
are identical across all columns are interchangeable). Snowpark's
`DataFrame.sort(*cols, ascending=[...])` + `DataFrame.limit(n, offset=m)` build
the query; no `snowflake.snowpark` import is needed.

**Graceful ordering degradation.** Some Snowflake column types (e.g.
`GEOGRAPHY`/`GEOMETRY`) cannot appear in an `ORDER BY` and raise at query time.
The adapter degrades in three steps so a render never fails outright:

1. Full ordering (all columns, active sort column first).
2. Ordering by just the active sort column (skipped when there is no active sort).
3. No `ORDER BY` (final attempt; runs outside `try/except` so a genuine,
   non-ordering failure surfaces to the caller).

Deterministic pagination is lost only in the fallback cases, which is preferable
to failing the request.

**Deep-offset warning.** Deep `OFFSET` values force Snowflake to skip many rows
and can be slow / consume warehouse credits. When `offset` exceeds a threshold
(`_DEEP_OFFSET_WARNING_THRESHOLD = 100_000`), log a one-shot warning per source.
The source manager already short-circuits provably out-of-bounds offsets
(`offset >= row_count`) with an empty schema-only chunk before calling the
source, so no query runs past the end of the data.

**Resolution wiring** (already implemented generically in `resolve_lazy_source`;
no change needed, documented here for reviewers): once
`try_create_native_source` returns a `SnowparkDataframeSource`, the existing
native branch applies:

- `lazy=None` → lazy only when `row_count > UNEVALUATED_AUTO_LAZY_ROW_THRESHOLD`
  (10,000); at or below that, keep today's capped preview.
- `lazy=True` → lazy when `row_count > FORCED_LAZY_MIN_ROWS` (1,000); bounded
  small results stay eager as the small-data optimization.
- If `row_count` cannot be determined: `lazy=None` falls back to the preview
  path; `lazy=True` raises a `StreamlitAPIException`.

No new required dependencies: detection is optional and the adapter only uses the
Snowpark object's public fluent API.

### Implementation plan

1. Add `SnowparkDataframeSource` to `lazy_df_adapters.py` and register it in
   `try_create_native_source`. Restore the module docstring's Snowpark bullet.
2. Update the `st.dataframe` `lazy` docstring in `lib/streamlit/elements/arrow.py`
   to mention Snowpark dataframes as a native lazy adapter (both the `lazy=None`
   auto-lazy list and the `lazy=True` native-adapter example).
3. Update the internal comments/docstrings that enumerate available adapters
   (`_try_create_native_source` and the resolution comment in
   `lazy_df_source.py`; the deep-offset comment in `dataframe_source_manager.py`).
4. Add unit tests (below).

The prior prototype for all of the above is available in the git history of PR
[#15756](https://github.com/streamlit/streamlit/pull/15756) (removed in the
"defer Snowpark lazy adapter" change) and can be lifted largely as-is.

### Testing

- **Unit (mocked), no Snowflake required.** Reintroduce a lightweight
  `_FakeSnowparkDataFrame` that mimics the Snowpark fluent API
  (`columns` / `count()` / `sort(*cols, ascending=...)` / `limit(n, offset=...)`
  / `to_pandas()`) in `lib/tests/streamlit/dataframe/lazy_df_adapters_test.py`.
  Cover: `row_count` uses `count()`; schema derivation; requested row range;
  unsorted paging orders by all columns; active sort puts the sort column first;
  graceful degradation when a column is unorderable (both a schema probe and a
  sorted request); first-page cache reuse; deep-offset warning flag; and
  `try_create_native_source` detection via a monkeypatched
  `is_snowpark_data_object`.
- **Resolution.** Extend `lazy_df_source_test.py` so `lazy=None`/`lazy=True`
  thresholds and the unknown-row-count fallback/raise paths are covered for a
  Snowpark-shaped native source (the existing native-source tests already
  monkeypatch `_try_create_native_source`, so this reuses that pattern).
- **Integration (optional).** Gate a real end-to-end test on Snowflake
  credentials via `pytest.mark.skipif` on the relevant environment variables, so
  it runs only where a warehouse is configured and skips cleanly everywhere else.

### Out of scope

- **Materialized row-index mode** for efficient deep random access (a session
  temporary table with row numbers). Offset mode is acceptable for browsing and
  as a fallback; the materialized mode is a later phase and would need its own
  cost/lifecycle design.
- Other unevaluated adapters (PySpark, DuckDB, Dask, DB-API cursors).
- Server-side search/filter, `on_select` for lazy sources, and lazy
  `st.data_editor` — all already out of scope for the base lazy feature.

### Risks and mitigations

- **Deep-offset cost.** Deep `OFFSET` scans are slow and consume credits.
  Mitigated by the one-shot warning and the manager's out-of-bounds
  short-circuit; fully addressed only by the future materialized mode.
- **Non-deterministic pagination without a stable key.** Mitigated by ordering
  over all columns; residual risk only when ordering must degrade for
  unorderable column types.
- **WebSocket chunk size.** Bounded by the existing `MAX_CHUNK_ROWS` cap in the
  source manager (shared by all sources).
- **Stale chunk responses across reruns.** Handled by the existing generation
  token on the lazy source (shared infrastructure, not adapter-specific).

## Alternatives Considered

- **Materialized row-index temp table (instead of offset mode).** Create a
  session-scoped temporary table with an added row-number column and fetch
  chunks by range on that column. Pros: efficient arbitrary/deep random access;
  fully deterministic. Cons: upfront materialization cost and credits, temp-table
  lifecycle management tied to the session, and more Snowflake-specific code.
  Rejected for the first Snowpark version in favor of the simpler offset mode;
  kept as a documented future phase.
- **Keep Snowpark on the capped-preview path (do nothing).** Rejected: it leaves
  the exact large-result problem the lazy feature is meant to solve unsolved for
  a common Snowflake use case, and the shared infrastructure already makes the
  adapter a small, contained addition.
- **Ship Snowpark in the base lazy PR.** Rejected: it cannot be validated in the
  default local/CI environment (no Snowflake), and its query semantics/cost
  trade-offs deserve focused review — hence this follow-up.
