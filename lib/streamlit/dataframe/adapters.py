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

from typing import TYPE_CHECKING, Any, Final

from streamlit import dataframe_util
from streamlit.logger import get_logger

if TYPE_CHECKING:
    import pyarrow as pa

    from streamlit.dataframe.source import DataframeSource, SortSpec

_LOGGER: Final = get_logger(__name__)


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

    @property
    def row_count(self) -> int:
        if self._row_count is None:
            import polars as pl

            self._row_count = int(self._lf.select(pl.len()).collect().item())
        return self._row_count

    @property
    def schema(self) -> pa.Schema:
        if self._schema is None:
            # Collecting zero rows is cheap and yields the full Arrow schema
            # without materializing data.
            self._schema = self._lf.head(0).collect().to_arrow().schema
        return self._schema

    @property
    def sortable(self) -> bool:
        return True

    def load_rows(
        self,
        offset: int,
        limit: int,
        *,
        sort: SortSpec | None = None,
    ) -> pa.Table:
        frame = self._lf
        if sort is not None and sort.column in self.schema.names:
            frame = frame.sort(sort.column, descending=sort.descending)
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
        self._schema: pa.Schema | None = None
        # The first page is loaded to derive a canonical schema; cache it so the
        # initial chunk request does not re-query.
        self._initial_table: pa.Table | None = None
        self._warned_deep_offset = False

    @property
    def row_count(self) -> int:
        if self._row_count is None:
            self._row_count = int(self._df.count())
        return self._row_count

    @property
    def schema(self) -> pa.Schema:
        if self._schema is None:
            from streamlit.dataframe.source import DEFAULT_PAGE_SIZE

            # Loading (and caching) the first page also derives a stable Arrow
            # schema and avoids a second query on the initial render.
            self._initial_table = self._query_chunk(0, DEFAULT_PAGE_SIZE, sort=None)
            self._schema = self._initial_table.schema
        return self._schema

    @property
    def sortable(self) -> bool:
        return True

    def load_rows(
        self,
        offset: int,
        limit: int,
        *,
        sort: SortSpec | None = None,
    ) -> pa.Table:
        # Resolve the schema first; this also caches the unsorted first page.
        schema = self.schema

        # Reuse the cached first page (used to derive the schema) when possible.
        if (
            sort is None
            and offset == 0
            and self._initial_table is not None
            and self._initial_table.num_rows <= limit
        ):
            return self._initial_table

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
        frame = self._df

        # Offset pagination over Snowflake is non-deterministic without an
        # ORDER BY, which can return duplicate or missing rows across chunks.
        # We always order by every column (with the active sort column first),
        # so the row order is stable across requests. Rows that are identical
        # across all columns are interchangeable, so this yields consistent
        # pagination even without a unique key.
        column_names = [str(name) for name in frame.columns]
        if sort is not None and sort.column in column_names:
            ordered = [
                sort.column,
                *(name for name in column_names if name != sort.column),
            ]
            ascending = [not sort.descending, *([True] * (len(ordered) - 1))]
        else:
            ordered = column_names
            ascending = [True] * len(ordered)

        if ordered:
            # Snowpark's ``DataFrame.sort`` accepts column names plus a per-column
            # ``ascending`` flag, so we avoid importing ``snowflake.snowpark``.
            frame = frame.sort(*ordered, ascending=ascending)

        # Snowpark's limit supports an offset keyword for range queries.
        chunk_df = frame.limit(max(0, limit), offset=max(0, offset))
        pandas_df = chunk_df.to_pandas()

        import pyarrow as pa

        return pa.Table.from_pandas(pandas_df, preserve_index=False)
