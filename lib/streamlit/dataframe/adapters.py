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
the internal :class:`~streamlit.dataframe.source.DataframeSource` protocol.

Phase 2 adapters:
- Polars ``LazyFrame``: ``.slice(offset, limit).collect()`` per chunk.
- Snowpark ``DataFrame`` / ``Table``: deterministic ``ORDER BY`` + ``LIMIT/OFFSET``
  ("offset" mode). Efficient deep random access (materialized row-index table)
  is intentionally out of scope for the first version.

Adapters use optional detection only and never require new dependencies.
"""

from __future__ import annotations

import hashlib
import threading
from typing import TYPE_CHECKING, Any, Final

from cachetools import TTLCache

from streamlit import dataframe_util
from streamlit.dataframe.source import AccessMode
from streamlit.logger import get_logger

if TYPE_CHECKING:
    import pyarrow as pa

    from streamlit.dataframe.source import DataframeSource, SortSpec

_LOGGER: Final = get_logger(__name__)
_ROW_COUNT_CACHE_MAX_ENTRIES: Final = 256
_ROW_COUNT_CACHE_TTL_SECONDS: Final = 60
_ROW_COUNT_CACHE: Final[TTLCache[tuple[str, str], int]] = TTLCache(
    maxsize=_ROW_COUNT_CACHE_MAX_ENTRIES, ttl=_ROW_COUNT_CACHE_TTL_SECONDS
)
_ROW_COUNT_CACHE_LOCK: Final = threading.Lock()


def _get_session_id() -> str:
    """Return the current session id for session-scoped adapter caches."""
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        get_script_run_ctx,
    )

    ctx = get_script_run_ctx(suppress_warning=True)
    if ctx is None:
        return "dontcare"
    return ctx.session_id


def _stable_hash(prefix: str, payload: object) -> str:
    payload_bytes = repr(payload).encode("utf-8", errors="replace")
    digest = hashlib.sha256(payload_bytes).hexdigest()
    return f"{prefix}:{digest}"


def _cached_row_count(cache_key: str | None, compute: Any) -> int:
    """Return a cached row count for stable native query plans."""
    if cache_key is None:
        return int(compute())

    scoped_key = (_get_session_id(), cache_key)
    with _ROW_COUNT_CACHE_LOCK:
        cached = _ROW_COUNT_CACHE.get(scoped_key)
    if cached is not None:
        return cached

    row_count = int(compute())
    with _ROW_COUNT_CACHE_LOCK:
        _ROW_COUNT_CACHE[scoped_key] = row_count
    return row_count


def _clear_row_count_cache() -> None:
    """Clear the native row-count cache. Intended for tests."""
    with _ROW_COUNT_CACHE_LOCK:
        _ROW_COUNT_CACHE.clear()


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
        self._row_count_cache_key: str | None = None
        self._row_count_cache_key_loaded = False
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
                    self._row_count = _cached_row_count(
                        self.row_count_cache_key,
                        lambda: self._lf.select(pl.len()).collect().item(),
                    )
        return self._row_count

    @property
    def row_count_cache_key(self) -> str | None:
        if not self._row_count_cache_key_loaded:
            try:
                plan = self._lf.explain(optimized=True)
            except TypeError:
                try:
                    plan = self._lf.explain()
                except Exception:
                    plan = None
            except Exception:
                plan = None
            self._row_count_cache_key = (
                None if plan is None else _stable_hash("polars-lazyframe", plan)
            )
            self._row_count_cache_key_loaded = True
        return self._row_count_cache_key

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
            with_row_index = getattr(frame, "with_row_index", None)
            if with_row_index is not None:
                frame = with_row_index(self._ROW_INDEX_COLUMN)
            else:
                # `with_row_index` was introduced in Polars 0.20.4. Older
                # supported versions expose the same behavior as `with_row_count`.
                frame = frame.with_row_count(self._ROW_INDEX_COLUMN)
            frame = frame.sort(
                [sort.column, self._ROW_INDEX_COLUMN],
                descending=[sort.descending, False],
            ).drop(self._ROW_INDEX_COLUMN)
        chunk = frame.slice(max(0, offset), max(0, limit)).collect()
        return _align_to_schema(chunk.to_arrow(), self.schema)


class SnowparkDataframeSource:
    """Lazy source backed by a Snowpark ``DataFrame`` or ``Table``.

    Uses deterministic ``ORDER BY`` + ``LIMIT/OFFSET`` ("offset" mode). Deep
    offsets can be slow on Snowflake; this is acceptable for browsing and as a
    fallback, but it is not efficient arbitrary random access. A materialized
    row-index mode is reserved for a later phase.

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
        self._row_count_cache_key: str | None = None
        self._row_count_cache_key_loaded = False
        self._schema: pa.Schema | None = None
        # The first page is loaded to derive a canonical schema; cache it so the
        # initial chunk request does not re-query.
        self._initial_table: pa.Table | None = None
        self._warned_deep_offset = False
        # Guards the lazily-initialized properties below. Chunk requests run in
        # worker threads (asyncio.to_thread), so concurrent first accesses could
        # otherwise both issue the same Snowflake query.
        self._lock = threading.Lock()

    @property
    def row_count(self) -> int:
        if self._row_count is None:
            with self._lock:
                if self._row_count is None:
                    self._row_count = _cached_row_count(
                        self.row_count_cache_key, self._df.count
                    )
        return self._row_count

    @property
    def row_count_cache_key(self) -> str | None:
        if not self._row_count_cache_key_loaded:
            try:
                queries = self._df.queries
            except Exception:
                queries = None
            self._row_count_cache_key = (
                None if queries is None else _stable_hash("snowpark", queries)
            )
            self._row_count_cache_key_loaded = True
        return self._row_count_cache_key

    @property
    def schema(self) -> pa.Schema:
        if self._schema is None:
            from streamlit.dataframe.source import DEFAULT_PAGE_SIZE

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
        from streamlit.dataframe.source import DEFAULT_PAGE_SIZE

        # Resolve the schema first; this also caches the unsorted first page.
        schema = self.schema

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

        if (
            offset > self._DEEP_OFFSET_WARNING_THRESHOLD
            and not self._warned_deep_offset
        ):
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
        # We prefer ordering by every column (with the active sort column
        # first), so the row order is stable across requests. Rows that are
        # identical across all columns are interchangeable, so this yields
        # consistent pagination even without a unique key.
        #
        # Some Snowflake column types (e.g. GEOGRAPHY/GEOMETRY) cannot appear in
        # an ORDER BY and would raise at query time, so we degrade gracefully:
        # try the full ordering first, then ordering by just the active sort
        # column, then no ordering. This keeps a rendering with an unorderable
        # column working (at the cost of deterministic pagination in that case)
        # instead of failing the request outright.
        column_names = [str(name) for name in self._df.columns]
        if sort is not None and sort.column in column_names:
            others = [name for name in column_names if name != sort.column]
            full_ordering = (
                [sort.column, *others],
                [not sort.descending, *([True] * len(others))],
            )
            primary_ordering: tuple[list[str], list[bool]] = (
                [sort.column],
                [not sort.descending],
            )
        else:
            full_ordering = (column_names, [True] * len(column_names))
            # No active sort column, so there is no intermediate fallback.
            primary_ordering = ([], [])

        # Prefer the fully deterministic ordering. If it fails at query time
        # (e.g. an unorderable Snowflake column type like GEOGRAPHY), degrade to
        # ordering by just the active sort column, then to no ORDER BY, so the
        # render never fails outright. The final unordered query runs outside a
        # try/except so a genuine (non-ordering) failure surfaces to the caller.
        try:
            return self._execute_chunk(*full_ordering, offset, limit)
        except Exception as ex:
            _LOGGER.warning(
                "Failed to query a Snowpark chunk with a full ORDER BY; "
                "retrying with a less strict ordering.",
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
        self, ordered: list[str], ascending: list[bool], offset: int, limit: int
    ) -> pa.Table:
        import pyarrow as pa

        frame = self._df
        if ordered:
            # Snowpark's ``DataFrame.sort`` accepts column names plus a per-column
            # ``ascending`` flag, so we avoid importing ``snowflake.snowpark``.
            frame = frame.sort(*ordered, ascending=ascending)

        # Snowpark's limit supports an offset keyword for range queries.
        chunk_df = frame.limit(max(0, limit), offset=max(0, offset))
        pandas_df = chunk_df.to_pandas()
        return pa.Table.from_pandas(pandas_df, preserve_index=False)
