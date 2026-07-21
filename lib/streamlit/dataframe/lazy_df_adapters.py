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

Adapters use optional detection only and never require new dependencies.
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING, Any, Final

from streamlit import dataframe_util
from streamlit.dataframe.lazy_df_source import AccessMode
from streamlit.logger import get_logger

if TYPE_CHECKING:
    import pyarrow as pa

    from streamlit.dataframe.lazy_df_source import DataframeSource, SortSpec

_LOGGER: Final = get_logger(__name__)


def try_create_native_source(data: object) -> DataframeSource | None:
    """Return a native lazy adapter for ``data``, or ``None`` if unsupported."""
    if dataframe_util.is_polars_lazyframe(data):
        return PolarsLazyFrameSource(data)
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
