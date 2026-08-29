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

"""Internal data-source protocol and adapters for lazy ``st.dataframe``.

A lazy dataframe source exposes a known row count, an Arrow schema, and a
``load_rows`` method that returns an arbitrary row range (optionally sorted) as
a ``pyarrow.Table``. The session-scoped source manager registers these sources
and serves row chunks to the frontend without triggering a script rerun.

This module is internal. There is intentionally no public ``st.DataFrameSource``
API in the first version.
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any, Final, Protocol, runtime_checkable

from streamlit import config, dataframe_util
from streamlit.errors import StreamlitAPIException, StreamlitIncompatibleParametersError
from streamlit.logger import get_logger

if TYPE_CHECKING:
    import pyarrow as pa
    from pandas import DataFrame

_LOGGER: Final = get_logger(__name__)

# Reuse the existing frontend "large table" threshold (see
# ``LARGE_TABLE_ROWS_THRESHOLD`` in ``useDataFrameCapabilities.ts``). In-memory
# dataframes above this size are auto-delivered lazily when ``lazy=None``.
AUTO_LAZY_ROW_THRESHOLD: Final = 150_000

# Reuse the existing capped-preview threshold for unevaluated data objects.
# Native adapters with a known row count above this size are auto-delivered
# lazily when ``lazy=None`` instead of showing only a capped preview.
UNEVALUATED_AUTO_LAZY_ROW_THRESHOLD: Final = dataframe_util._MAX_UNEVALUATED_DF_ROWS

# For an explicit ``lazy=True`` request, inputs at or below this size keep eager
# rendering. Lazy loading a small dataset only adds downsides (extra round-trips
# and disabled lazy-incompatible features) without reducing the already-bounded
# payload.
FORCED_LAZY_MIN_ROWS: Final = 1_000

# Number of rows the backend serves per chunk by default.
DEFAULT_PAGE_SIZE: Final = 1_000

# Hard upper bound on the number of rows a single chunk request may return.
# Prevents a modified client from requesting arbitrarily large chunks.
MAX_CHUNK_ROWS: Final = 10_000


@dataclass(frozen=True)
class SortSpec:
    """Server-side sort state for a single column.

    ``column`` is a stable backend field name from the Arrow schema, not a
    displayed column label.
    """

    column: str
    descending: bool = False


@dataclass(frozen=True)
class EagerDataframeFallback:
    """A pre-converted dataframe that must continue through eager rendering.

    Resolving ``lazy=True`` for an arbitrary eager input requires materializing
    it to determine its row count. Returning that converted value prevents
    one-shot inputs, such as generators, from being consumed a second time by
    the regular eager serialization path.
    """

    data: DataFrame


class AccessMode(Enum):
    """How the rows of a lazy dataframe source can be accessed.

    ``RANDOM_ACCESS`` sources can serve an arbitrary row range on demand; all
    first-version sources are random-access. ``SEQUENTIAL`` is reserved for
    future unknown-size streaming sources that can only be read forward and is
    not produced yet.
    """

    RANDOM_ACCESS = "random_access"
    SEQUENTIAL = "sequential"


@runtime_checkable
class DataframeSource(Protocol):
    """Protocol for a known-size, randomly-accessible lazy dataframe source."""

    @property
    def row_count(self) -> int | None:
        """Total number of rows the source can serve.

        ``None`` means the size is unknown up front. This is reserved for future
        sequential sources; all first-version sources report an integer count.
        """
        ...

    @property
    def schema(self) -> pa.Schema:
        """The Arrow schema of the rows returned by ``load_rows``."""
        ...

    @property
    def sortable(self) -> bool:
        """Whether the source supports server-side sorting."""
        ...

    @property
    def access_mode(self) -> AccessMode:
        """How the source's rows can be accessed (random-access vs sequential)."""
        ...

    def load_rows(
        self,
        offset: int,
        limit: int,
        *,
        sort: SortSpec | None = None,
    ) -> pa.Table:
        """Return up to ``limit`` rows starting at ``offset``.

        The returned table must use the same schema as ``self.schema``. If
        ``sort`` is provided and the source is sortable, rows are returned in
        the requested order. An unknown sort column is ignored (rows are
        returned unsorted) rather than raising.
        """
        ...


def _pandas_to_arrow_table(df: DataFrame) -> pa.Table:
    """Convert a pandas DataFrame to a ``pyarrow.Table`` for lazy slicing.

    Unlike the eager serialization, this materializes the index as a real column
    (``preserve_index=True``). A default ``RangeIndex`` is otherwise stored only
    as schema metadata (start=0), so slicing a chunk would leave the metadata
    unchanged and every chunk would display an index restarting at 0. With the
    index materialized, each chunk slice carries the correct absolute index
    values, and the index travels with the rows through server-side sorting
    (matching the eager behavior). The index column is still marked as an index
    in the pandas metadata, so the frontend renders it in the index gutter.
    """
    return dataframe_util.convert_pandas_df_to_arrow_table(df, preserve_index=True)


def _materialize_arrow_table_index(table: pa.Table) -> pa.Table:
    """Materialize a metadata-only pandas RangeIndex in ``table``.

    ``pa.Table.from_pandas`` stores a RangeIndex only in schema metadata by
    default. Since slicing preserves that metadata verbatim, every lazy chunk
    would otherwise recreate the index from its original start. Materializing
    the index makes its values travel with slices and server-side sorts.
    """
    metadata = table.schema.pandas_metadata
    if metadata is None or not any(
        isinstance(index, dict) and index.get("kind") == "range"
        for index in metadata.get("index_columns", [])
    ):
        return table

    import pyarrow as pa

    dataframe = table.to_pandas()
    logical_index_name = dataframe.index.name
    physical_index_name = "__streamlit_lazy_index__"
    while physical_index_name in dataframe.columns:
        physical_index_name = f"_{physical_index_name}"
    dataframe.index.name = physical_index_name
    materialized = pa.Table.from_pandas(dataframe, preserve_index=True)

    # The temporary physical name must remain unique in Arrow, but preserve the
    # user's logical pandas index name (including an unnamed RangeIndex) in the
    # metadata that drives frontend index rendering.
    schema_metadata = dict(materialized.schema.metadata or {})
    pandas_metadata = json.loads(schema_metadata[b"pandas"])
    for column in pandas_metadata.get("columns", []):
        if column.get("field_name") == physical_index_name:
            column["name"] = logical_index_name
            break
    schema_metadata[b"pandas"] = json.dumps(pandas_metadata).encode()
    return materialized.replace_schema_metadata(schema_metadata)


class InMemoryDataframeSource:
    """A lazy source backed by a fully-materialized in-memory ``pyarrow.Table``.

    Used for in-memory pandas/Polars dataframes, ``pyarrow.Table`` inputs, and
    the ``lazy=True`` pandas fallback for arbitrary supported eager inputs.

    Materializing the whole table in server memory is intentional: lazy mode
    reduces the initial frontend payload and browser memory, not server memory.
    Keeping a single Arrow table guarantees a stable schema across all chunks.
    """

    def __init__(self, table: pa.Table, *, sortable: bool = True) -> None:
        self._table = table
        self._sortable = sortable
        self._lock = threading.Lock()
        # Cache the most recent sorted table so repeated chunk requests for the
        # same sort state (e.g. while scrolling) don't re-sort every time.
        self._sorted_cache: tuple[SortSpec, pa.Table] | None = None

    @property
    def row_count(self) -> int:
        return int(self._table.num_rows)

    @property
    def schema(self) -> pa.Schema:
        return self._table.schema

    @property
    def sortable(self) -> bool:
        return self._sortable

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
        table = self._resolve_sorted_table(sort)
        offset = max(0, offset)
        limit = max(0, limit)
        return table.slice(offset, limit)

    def _resolve_sorted_table(self, sort: SortSpec | None) -> pa.Table:
        if sort is None or not self._sortable:
            return self._table
        if sort.column not in self._table.schema.names:
            # Unknown column: return unsorted rather than failing the request.
            return self._table

        with self._lock:
            if self._sorted_cache is not None and self._sorted_cache[0] == sort:
                return self._sorted_cache[1]
            # Keep the first full-table sort inside the lock. Chunk requests
            # with the same new sort state can arrive concurrently; sorting
            # outside the lock would make each request allocate and compute an
            # identical sorted table before any one of them populated the
            # cache.
            sorted_table = self._sort_table(sort)
            self._sorted_cache = (sort, sorted_table)
            return sorted_table

    def _sort_table(self, sort: SortSpec) -> pa.Table:
        import pyarrow.compute as pc

        order = "descending" if sort.descending else "ascending"
        # ``pc.sort_indices`` is available since pyarrow 1.0 but is not exposed
        # by the type stubs, hence the suppressions below. Unsupported Arrow
        # types must raise: silently returning the original table would leave a
        # sort indicator visible while presenting unsorted rows.
        indices = pc.sort_indices(  # type: ignore[attr-defined, unused-ignore] # ty: ignore[unresolved-attribute]
            self._table, sort_keys=[(sort.column, order)]
        )
        return self._table.take(indices)


def _in_memory_source_from_pandas(df: DataFrame) -> InMemoryDataframeSource:
    return InMemoryDataframeSource(_pandas_to_arrow_table(df))


def _in_memory_source_from_polars(df: Any) -> InMemoryDataframeSource:
    # ``to_arrow`` is cheap for an already in-memory Polars DataFrame. ``df`` is
    # typed Any because Polars is an optional dependency without type stubs.
    return InMemoryDataframeSource(df.to_arrow())


def _should_lazy_load_in_memory(lazy: bool | None, num_rows: int) -> bool:
    """Apply the in-memory lazy thresholds for ``lazy=True`` and ``lazy=None``."""
    if lazy is True:
        return num_rows > FORCED_LAZY_MIN_ROWS
    if lazy is None:
        return num_rows > AUTO_LAZY_ROW_THRESHOLD
    return False


def _has_multi_level_columns(data: object) -> bool:
    """Return ``True`` if ``data`` has multi-level (MultiIndex) column headers.

    Lazy loading identifies a sort column by its flat Arrow field name, which
    cannot unambiguously address a single level of a multi-level header.
    """
    import pandas as pd

    if isinstance(data, pd.DataFrame):
        return isinstance(data.columns, pd.MultiIndex)

    import pyarrow as pa

    if isinstance(data, pa.Table):
        # A pyarrow.Table converted from a MultiIndex-column pandas DataFrame
        # records more than one column-header level in its pandas metadata.
        metadata = data.schema.pandas_metadata
        if metadata is not None:
            return len(metadata.get("column_indexes", [])) > 1

    return False


def _validate_lazy_columns(data: object) -> None:
    """Raise when ``data`` has column headers unsupported by lazy loading."""
    if _has_multi_level_columns(data):
        raise StreamlitAPIException(
            "`lazy=True` is not supported for dataframes with multi-level "
            "(`MultiIndex`) column headers. Flatten the column headers or set "
            "`lazy=False`.",
            error_id="lazy-multiindex-columns",
        )


def _try_create_native_source(data: object) -> DataframeSource | None:
    """Return a native lazy adapter for an unevaluated object, or ``None``.

    Available adapters (currently Polars ``LazyFrame``) are registered here.
    Objects without a ready adapter return ``None`` so the caller can fall back
    to the capped-preview path (``lazy=None``) or raise (``lazy=True``).
    """
    from streamlit.dataframe import lazy_df_adapters

    return lazy_df_adapters.try_create_native_source(data)


def _get_native_row_count(source: DataframeSource, lazy: bool | None) -> int | None:
    """Return a native source row count, handling default-path fallbacks."""
    try:
        row_count = source.row_count
    except Exception as ex:
        if lazy is True:
            raise StreamlitAPIException(
                "`lazy=True` is not supported for this object because Streamlit "
                "could not determine its row count for lazy loading.",
                error_id="lazy-could-not-determine-row-count",
            ) from ex
        _LOGGER.info(
            "Could not determine row count for native lazy dataframe source; "
            "falling back to the regular preview path.",
            exc_info=ex,
        )
        return None

    if row_count is None and lazy is True:
        raise StreamlitAPIException(
            "`lazy=True` is not supported for this object because the first "
            "lazy dataframe version requires a known row count.",
            error_id="lazy-requires-known-row-count",
        )
    return row_count


def resolve_lazy_source(
    data: object,
    lazy: bool | None,
    *,
    is_selection_activated: bool,
) -> DataframeSource | EagerDataframeFallback | None:
    """Decide whether to deliver ``data`` lazily and build the source if so.

    Returns a :class:`DataframeSource` when lazy delivery should be used,
    :class:`EagerDataframeFallback` when resolution already converted an input
    that should remain eager, or ``None`` to keep the existing eager /
    capped-preview path.

    Raises
    ------
    StreamlitIncompatibleParametersError
        If ``lazy=True`` is requested with an incompatible option such as
        ``on_select``.
    StreamlitAPIException
        If ``lazy=True`` is requested for an object Streamlit cannot serve
        lazily, including ``pandas.Styler`` and MultiIndex columns.
    """
    if data is None:
        # An empty dataframe is always rendered eagerly.
        return None

    if lazy is False:
        return None

    is_styler = dataframe_util.is_pandas_styler(data)
    if is_styler:
        if lazy is True:
            raise StreamlitAPIException(
                "`lazy=True` is not supported for `pandas.Styler` objects. "
                "Styler output is tied to the fully materialized table. Remove "
                "`lazy=True` or pass the underlying dataframe instead.",
                error_id="lazy-styler-not-supported",
            )
        return None

    if is_selection_activated:
        if lazy is True:
            raise StreamlitIncompatibleParametersError(
                "lazy=True",
                "on_select",
                explanation=(
                    "Lazy dataframes cannot use position-based selection in this "
                    'version. Set `on_select="ignore"` or remove `lazy=True`.'
                ),
            )
        # For lazy=None we fall back to eager rendering to preserve the existing
        # selection behavior.
        return None

    if lazy is True:
        _validate_lazy_columns(data)

    if config.get_option("global.appTest"):
        # AppTest exposes dataframe values through the element tree, not through
        # frontend chunk requests. Keep all AppTest dataframes eager, including
        # explicit ``lazy=True`` calls, so ``Dataframe.value`` is never silently
        # truncated to the initial chunk.
        return None

    # 1) Native adapter for supported unevaluated objects (currently Polars
    # LazyFrame). For ``lazy=True``, known small sources keep eager rendering as
    # the bounded small-data optimization. For ``lazy=None``, compatible
    # unevaluated sources auto-switch to lazy only above the existing
    # capped-preview threshold; smaller sources preserve today's eager path.
    native = _try_create_native_source(data)
    if native is not None:
        # TODO(lazy-dataframe): For ``lazy=None`` this reads ``row_count`` on
        # every rerun to decide whether to auto-lazy. For a native source like a
        # Polars ``LazyFrame`` that is a full ``select(pl.len()).collect()``
        # count/scan re-run each time, even when the size hasn't changed.
        # Consider caching the count across reruns, gating auto-lazy on a cheap
        # row-count capability, or deferring the count until the frontend first
        # requests a chunk.
        native_row_count = _get_native_row_count(native, lazy)
        if native_row_count is None:
            return None
        if lazy is True:
            if native_row_count <= FORCED_LAZY_MIN_ROWS:
                return None
            return native
        if native_row_count > UNEVALUATED_AUTO_LAZY_ROW_THRESHOLD:
            return native
        return None

    # 2) In-memory Polars DataFrame.
    if dataframe_util.is_polars_dataframe(data):
        # ``data`` is an untyped object here; Polars has no stubs in the
        # type-checking environment, so access ``height`` via an Any view.
        polars_df: Any = data
        num_rows = int(polars_df.height)
        if _should_lazy_load_in_memory(lazy, num_rows):
            return _in_memory_source_from_polars(polars_df)
        return None

    # 3) In-memory pandas DataFrame.
    import pandas as pd

    if isinstance(data, pd.DataFrame):
        # With lazy=None, unsupported multi-level columns keep eager rendering
        # for compatibility. Explicit lazy=True was rejected above.
        if _has_multi_level_columns(data):
            return None
        if _should_lazy_load_in_memory(lazy, len(data)):
            return _in_memory_source_from_pandas(data)
        return None

    # 4) In-memory pyarrow.Table.
    import pyarrow as pa

    if isinstance(data, pa.Table):
        # Match the pandas compatibility fallback for Arrow tables carrying
        # pandas MultiIndex column metadata.
        if _has_multi_level_columns(data):
            return None
        if _should_lazy_load_in_memory(lazy, data.num_rows):
            return InMemoryDataframeSource(_materialize_arrow_table_index(data))
        return None

    # 5) Unevaluated object without a ready native adapter.
    if dataframe_util.is_unevaluated_data_object(data):
        if lazy is True:
            raise StreamlitAPIException(
                "`lazy=True` is not supported for this object because no lazy "
                "adapter is available for it yet. Remove `lazy=True` to use the "
                "default preview behavior, or convert it to a pandas/Polars "
                "dataframe first.",
                error_id="lazy-no-adapter-available",
            )
        return None

    # 6) lazy=True on an arbitrary supported eager input: convert to pandas once
    # and serve slices from memory.
    if lazy is True:
        df = dataframe_util.convert_anything_to_pandas_df(data, ensure_copy=True)
        _validate_lazy_columns(df)
        # Return a small converted dataframe so one-shot inputs are not consumed
        # again by the eager serialization path.
        if len(df) <= FORCED_LAZY_MIN_ROWS:
            return EagerDataframeFallback(df)
        return _in_memory_source_from_pandas(df)

    # 7) lazy=None and not a large in-memory dataframe: keep eager.
    return None
