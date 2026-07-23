# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Native lazy adapters for unevaluated data objects.

These adapters let ``st.dataframe`` render unevaluated objects lazily without
materializing the full dataset up front. Each adapter normalizes its backend to
the internal :class:`~streamlit.dataframe.lazy_df_source.DataframeSource` protocol.

Available adapters:
- Polars ``LazyFrame``: ``.slice(offset, limit).collect()`` per chunk.
- Snowpark ``DataFrame`` / ``Table``: deterministic ``ORDER BY`` + ``LIMIT/OFFSET``
  ("offset" mode). Efficient deep random access (materialized row-index table)
  is intentionally out of scope for the first version.

Adapters use optional detection only and never require new dependencies.
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING, Any, Final
from weakref import WeakKeyDictionary

from streamlit import dataframe_util
from streamlit.dataframe.lazy_df_source import DEFAULT_PAGE_SIZE, AccessMode
from streamlit.logger import get_logger

if TYPE_CHECKING:
    import pyarrow as pa

    from streamlit.dataframe.lazy_df_source import DataframeSource, SortSpec

_LOGGER: Final = get_logger(__name__)

# Snowpark query submission was not thread-safe in all versions that Streamlit
# supports. Share a lock across dataframes from the same session while allowing
# independent sessions to execute concurrently. Weak keys avoid extending a
# session's lifetime; the fallback covers unusual non-weak-referenceable session
# implementations without importing Snowpark.
_SNOWPARK_SESSION_LOCKS: Final[WeakKeyDictionary[object, threading.Lock]] = (
    WeakKeyDictionary()
)
_SNOWPARK_SESSION_LOCKS_GUARD: Final = threading.Lock()
_SNOWPARK_FALLBACK_QUERY_LOCK: Final = threading.Lock()


def _get_snowpark_query_lock(snowpark_df: object) -> threading.Lock:
    """Return the lock shared by dataframes from ``snowpark_df``'s session."""
    session = getattr(snowpark_df, "session", None)
    if session is None:
        return _SNOWPARK_FALLBACK_QUERY_LOCK

    with _SNOWPARK_SESSION_LOCKS_GUARD:
        try:
            query_lock = _SNOWPARK_SESSION_LOCKS.get(session)
            if query_lock is None:
                query_lock = threading.Lock()
                _SNOWPARK_SESSION_LOCKS[session] = query_lock
            return query_lock
        except TypeError:
            # WeakKeyDictionary requires weak-referenceable, hashable keys.
            return _SNOWPARK_FALLBACK_QUERY_LOCK


def try_create_native_source(data: object) -> DataframeSource | None:
    """Return a native lazy adapter for ``data``, or ``None`` if unsupported."""
    if dataframe_util.is_polars_lazyframe(data):
        return PolarsLazyFrameSource(data)
    if dataframe_util.is_snowpark_data_object(data):
        return SnowparkDataframeSource(data)
    return None


def _align_to_schema(table: pa.Table, schema: pa.Schema) -> pa.Table:
    """Cast/reorder ``table`` to match ``schema`` so all chunks are consistent.

    Returns the original table if it already matches or if casting fails.
    """
    if table.schema.equals(schema, check_metadata=False):
        return table
    try:
        # Reorder columns to the canonical schema order before casting.
        if set(table.column_names) == set(schema.names):
            table = table.select(schema.names)
        return table.cast(schema)
    except Exception as ex:
        _LOGGER.warning(
            "Could not align lazy dataframe chunk to the canonical schema; "
            "serving the chunk as-is.",
            exc_info=ex,
        )
        return table


class PolarsLazyFrameSource:
    """Lazy source backed by a Polars ``LazyFrame``."""

    def __init__(self, lazy_frame: object) -> None:
        # Typed as Any because Polars is an optional dependency without stubs in
        # the type-checking environment.
        self._lf: Any = lazy_frame
        self._row_count: int | None = None
        self._schema: pa.Schema | None = None
        # Guards the lazily-initialized properties below. Chunk requests run in
        # worker threads (asyncio.to_thread), so concurrent first accesses could
        # otherwise both run the full Polars query.
        self._lock = threading.Lock()

    @property
    def row_count(self) -> int:
        if self._row_count is None:
            import polars as pl

            with self._lock:
                if self._row_count is None:
                    self._row_count = int(self._lf.select(pl.len()).collect().item())
        return self._row_count

    @property
    def schema(self) -> pa.Schema:
        if self._schema is None:
            with self._lock:
                if self._schema is None:
                    # Collecting zero rows is cheap and yields the full Arrow
                    # schema without materializing data.
                    self._schema = self._lf.head(0).collect().to_arrow().schema
        return self._schema

    @property
    def sortable(self) -> bool:
        return True

    @property
    def access_mode(self) -> AccessMode:
        return AccessMode.RANDOM_ACCESS

    # Temporary column used as a deterministic tiebreaker when sorting. The
    # name is unlikely to collide with a real column and is dropped before the
    # chunk is returned.
    _ROW_INDEX_COLUMN: Final = "__streamlit_lazy_row_index__"

    def load_rows(
        self,
        offset: int,
        limit: int,
        *,
        sort: SortSpec | None = None,
    ) -> pa.Table:
        frame = self._lf
        if sort is not None and sort.column in self.schema.names:
            # Polars' sort is not stable (``maintain_order=False``), so with
            # duplicate values in the sort column, offset pagination across
            # separate chunk requests could return duplicate or skipped rows.
            # Add a synthetic row index as a deterministic tiebreaker (then drop
            # it) so the row order is total and stable across requests. A row
            # index avoids ordering by every column, which could fail for
            # unorderable column types (e.g. nested/struct columns).
            row_index_column = self._ROW_INDEX_COLUMN
            while row_index_column in self.schema.names:
                row_index_column = f"_{row_index_column}"
            with_row_index = getattr(frame, "with_row_index", None)
            if with_row_index is not None:
                frame = with_row_index(row_index_column)
            else:
                # `with_row_index` was introduced in Polars 0.20.4. Older
                # supported versions expose the same behavior as `with_row_count`.
                frame = frame.with_row_count(row_index_column)
            frame = frame.sort(
                [sort.column, row_index_column],
                descending=[sort.descending, False],
            ).drop(row_index_column)
        chunk = frame.slice(max(0, offset), max(0, limit)).collect()
        return _align_to_schema(chunk.to_arrow(), self.schema)


class SnowparkDataframeSource:
    """Lazy source backed by a Snowpark ``DataFrame`` or ``Table``.

    Uses deterministic ``ORDER BY`` + ``LIMIT/OFFSET`` ("offset" mode). Deep
    offsets can be slow on Snowflake; this is acceptable for browsing and as a
    fallback, but it is not efficient arbitrary random access. A materialized
    row-index mode is reserved for a later phase.

    If a dataframe contains a column that cannot appear in an ``ORDER BY`` (for
    example ``GEOGRAPHY``/``GEOMETRY``), the source degrades to a less strict
    ordering, so pagination for that dataframe may not be fully deterministic.

    .. note::
        Snowpark execution cannot be tested locally without a Snowflake account.
        Unit tests mock the Snowpark object.
    """

    # Warn when a chunk offset gets deep enough that Snowflake must skip many
    # rows before the requested window.
    _DEEP_OFFSET_WARNING_THRESHOLD: Final = 100_000

    def __init__(self, snowpark_df: object) -> None:
        # Typed as Any because Snowpark is an optional dependency without stubs
        # in the type-checking environment.
        self._df: Any = snowpark_df
        self._row_count: int | None = None
        self._schema: pa.Schema | None = None
        # The first page is loaded to derive a canonical schema; cache it so the
        # initial chunk request does not re-query.
        self._initial_table: pa.Table | None = None
        self._warned_deep_offset = False
        # Whether a full ORDER BY works for this dataframe. Orderability depends
        # on column types (e.g. GEOGRAPHY cannot be ordered), not the query, so
        # this is safe to reuse across chunks and sort specs. Set to False on
        # the first failure so later chunks skip the known-bad query instead of
        # retrying (and re-logging) it on every page. A one-off non-ordering
        # error also disables full ordering for this short-lived, per-render
        # source, which we accept over paying the failed query per page.
        self._all_columns_orderable = True
        # Guards lazy metadata initialization and the one-shot warning flag.
        # Chunk requests run in worker threads (asyncio.to_thread), so concurrent
        # first accesses could otherwise issue duplicate queries or warnings.
        self._lock = threading.Lock()
        self._query_lock = _get_snowpark_query_lock(snowpark_df)

    @property
    def row_count(self) -> int:
        if self._row_count is None:
            with self._lock:
                if self._row_count is None:
                    with self._query_lock:
                        self._row_count = int(self._df.count())
        return self._row_count

    @property
    def schema(self) -> pa.Schema:
        if self._schema is None:
            with self._lock:
                if self._schema is None:
                    # Loading (and caching) the first page also derives a stable
                    # Arrow schema and avoids a second query on the initial
                    # render.
                    self._initial_table = self._query_chunk(
                        0, DEFAULT_PAGE_SIZE, sort=None
                    )
                    self._schema = self._initial_table.schema
        return self._schema

    @property
    def sortable(self) -> bool:
        return True

    @property
    def access_mode(self) -> AccessMode:
        return AccessMode.RANDOM_ACCESS

    def load_rows(
        self,
        offset: int,
        limit: int,
        *,
        sort: SortSpec | None = None,
    ) -> pa.Table:
        # Resolve the schema first; this also caches the unsorted first page.
        schema = self.schema
        offset = max(0, offset)
        limit = max(0, limit)

        # Reuse the cached first page (used to derive the schema) when it fully
        # covers the requested window: either it holds at least ``limit`` rows,
        # or it is the entire dataset (fewer than a full page exists). Otherwise
        # (e.g. a client requesting a window larger than the cached page) fall
        # through to a fresh query so we don't under-return rows.
        cached = self._initial_table
        if (
            sort is None
            and offset == 0
            and cached is not None
            and (limit <= cached.num_rows or cached.num_rows < DEFAULT_PAGE_SIZE)
        ):
            return cached.slice(0, limit)

        if offset > self._DEEP_OFFSET_WARNING_THRESHOLD:
            with self._lock:
                if not self._warned_deep_offset:
                    self._warned_deep_offset = True
                    _LOGGER.warning(
                        "Requesting a deep offset (%s) from a Snowpark dataframe. "
                        "Deep offsets can be slow and consume warehouse credits.",
                        offset,
                    )

        return _align_to_schema(self._query_chunk(offset, limit, sort=sort), schema)

    def _query_chunk(
        self, offset: int, limit: int, *, sort: SortSpec | None
    ) -> pa.Table:
        # Offset pagination over Snowflake is non-deterministic without an
        # ORDER BY, which can return duplicate or missing rows across chunks.
        # Ordering by every column (active sort column first) keeps the row
        # order stable across requests; rows identical across all columns are
        # interchangeable, so pagination stays consistent even without a unique
        # key. Some column types (e.g. GEOGRAPHY/GEOMETRY) cannot appear in an
        # ORDER BY, so the query below degrades gracefully instead of failing.

        # Resolving ``DataFrame.columns`` can trigger session-backed schema
        # analysis in older Snowpark versions, so protect this metadata access
        # with the same session lock as query execution.
        with self._query_lock:
            column_names = [str(name) for name in self._df.columns]
        # Snowpark retains quotes around case-sensitive identifiers in
        # ``DataFrame.columns``, while ``to_pandas`` (and therefore Arrow and
        # SortSpec) exposes the unquoted display name. Once the canonical schema
        # exists, use its positional relationship to map the frontend name back
        # to the exact identifier Snowpark expects.
        schema_names = (
            self._schema.names
            if self._schema is not None and len(self._schema.names) == len(column_names)
            else column_names
        )
        sort_column_index = (
            schema_names.index(sort.column)
            if sort is not None and sort.column in schema_names
            else None
        )
        if sort is not None and sort_column_index is not None:
            sort_column = column_names[sort_column_index]
            others = [
                name
                for index, name in enumerate(column_names)
                if index != sort_column_index
            ]
            full_ordering = (
                [sort_column, *others],
                [not sort.descending, *([True] * len(others))],
            )
            primary_ordering: tuple[list[str], list[bool]] = (
                [sort_column],
                [not sort.descending],
            )
        else:
            full_ordering = (column_names, [True] * len(column_names))
            # No active sort column, so there is no intermediate fallback.
            primary_ordering = ([], [])

        # Prefer the fully deterministic ordering. If it fails at query time
        # (e.g. an unorderable Snowflake column type like GEOGRAPHY), degrade to
        # ordering by just the active sort column, then to no ORDER BY. The final
        # unordered query runs outside a try/except so a genuine, non-ordering
        # failure surfaces to the caller.
        #
        # The first full-ordering failure is remembered in
        # ``_all_columns_orderable`` so subsequent chunks skip the known-bad
        # query (and its warning) instead of retrying it on every page.
        if self._all_columns_orderable:
            try:
                return self._execute_chunk(*full_ordering, offset, limit)
            except Exception as ex:
                # A plain bool write/read is atomic under the GIL, and the
                # double-check keeps the warning to a single log even if a
                # concurrent first chunk also just failed.
                if self._all_columns_orderable:
                    self._all_columns_orderable = False
                    _LOGGER.warning(
                        "Failed to order a Snowpark dataframe by all columns; "
                        "degrading to a less strict ordering for later chunks. "
                        "Pagination may be less deterministic.",
                        exc_info=ex,
                    )

        if primary_ordering[0]:
            try:
                return self._execute_chunk(*primary_ordering, offset, limit)
            except Exception as ex:
                _LOGGER.warning(
                    "Failed to query a Snowpark chunk ordered by the sort "
                    "column; retrying without any ORDER BY.",
                    exc_info=ex,
                )

        return self._execute_chunk([], [], offset, limit)

    def _execute_chunk(
        self, order_by: list[str], ascending: list[bool], offset: int, limit: int
    ) -> pa.Table:
        import pyarrow as pa

        with self._query_lock:
            frame = self._df
            if order_by:
                # Pass column names directly to avoid importing
                # ``snowflake.snowpark``; ``DataFrame.sort`` accepts names plus
                # a per-column ``ascending`` flag.
                frame = frame.sort(*order_by, ascending=ascending)

            # Snowpark's limit supports an offset keyword for range queries.
            chunk_df = frame.limit(limit, offset=offset)
            pandas_df = chunk_df.to_pandas()
        return pa.Table.from_pandas(pandas_df, preserve_index=False)
