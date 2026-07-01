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

import threading
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any, Final, Protocol, runtime_checkable

from streamlit import dataframe_util
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger

if TYPE_CHECKING:
    import pyarrow as pa
    from pandas import DataFrame

_LOGGER: Final = get_logger(__name__)

# Reuse the existing frontend "large table" threshold (see
# ``LARGE_TABLE_ROWS_THRESHOLD`` in ``useDataFrameCapabilities.ts``). In-memory
# dataframes above this size are auto-delivered lazily when ``lazy=None``.
AUTO_LAZY_ROW_THRESHOLD: Final = 150_000

# For an explicit ``lazy=True`` request, inputs at or below this size keep eager
# rendering. Lazy loading a small dataset only adds downsides (extra round-trips
# and disabled lazy-incompatible features) without reducing the already-bounded
# payload.
FORCED_LAZY_MIN_ROWS: Final = 1_000

# Number of rows the backend serves per chunk by default.
DEFAULT_PAGE_SIZE: Final = 500

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
    import pyarrow as pa

    try:
        return pa.Table.from_pandas(df, preserve_index=True)
    except (pa.ArrowTypeError, pa.ArrowInvalid, pa.ArrowNotImplementedError) as ex:
        _LOGGER.info(
            "Serialization of dataframe to Arrow table was unsuccessful. "
            "Applying automatic fixes for column types to make the dataframe "
            "Arrow-compatible.",
            exc_info=ex,
        )
        fixed = dataframe_util.fix_arrow_incompatible_column_types(df)
        return pa.Table.from_pandas(fixed, preserve_index=True)


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

        # Sort outside the lock so an expensive sort doesn't serialize all
        # chunk requests.
        sorted_table = self._sort_table(sort)
        with self._lock:
            # A concurrent request for the same sort may have populated the
            # cache while we were sorting; reuse it so both callers share one
            # table instead of overwriting each other's result.
            if self._sorted_cache is not None and self._sorted_cache[0] == sort:
                return self._sorted_cache[1]
            self._sorted_cache = (sort, sorted_table)
        return sorted_table

    def _sort_table(self, sort: SortSpec) -> pa.Table:
        import pyarrow.compute as pc

        order = "descending" if sort.descending else "ascending"
        try:
            # ``pc.sort_indices`` is available since pyarrow 1.0 but is not
            # exposed by the type stubs, hence the suppressions below.
            indices = pc.sort_indices(  # type: ignore[attr-defined] # ty: ignore[unresolved-attribute]
                self._table, sort_keys=[(sort.column, order)]
            )
            return self._table.take(indices)
        except Exception as ex:
            _LOGGER.warning(
                "Failed to sort lazy dataframe by column %r; returning unsorted data.",
                sort.column,
                exc_info=ex,
            )
            return self._table


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
    cannot unambiguously address a single level of a multi-level header. To keep
    the first version simple, dataframes with multi-level column headers fall
    back to eager rendering instead of being served lazily.
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


def _try_create_native_source(data: object) -> DataframeSource | None:
    """Return a native lazy adapter for an unevaluated object, or ``None``.

    Phase 2 adapters (Polars ``LazyFrame``, Snowpark ``DataFrame``/``Table``)
    are registered here. Objects without a ready adapter return ``None`` so the
    caller can fall back to the capped-preview path (``lazy=None``) or raise
    (``lazy=True``).
    """
    from streamlit.dataframe import adapters

    return adapters.try_create_native_source(data)


def resolve_lazy_source(
    data: object,
    lazy: bool | None,
    *,
    is_selection_activated: bool,
) -> DataframeSource | None:
    """Decide whether to deliver ``data`` lazily and build the source if so.

    Returns a :class:`DataframeSource` when lazy delivery should be used, or
    ``None`` to keep the existing eager / capped-preview path.

    Raises
    ------
    StreamlitAPIException
        If ``lazy=True`` is requested for an input or option combination that
        cannot be served lazily.
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
                "`lazy=True` or pass the underlying dataframe instead."
            )
        return None

    if is_selection_activated:
        if lazy is True:
            raise StreamlitAPIException(
                "`lazy=True` is not supported together with `on_select`. "
                "Lazy dataframes cannot use position-based selection in this "
                'version. Set `on_select="ignore"` or remove `lazy=True`.'
            )
        # For lazy=None we fall back to eager rendering to preserve the existing
        # selection behavior.
        return None

    # 1) Native adapter for unevaluated objects (Polars LazyFrame, Snowpark).
    # In the first version these adapters are opt-in via an explicit `lazy=True`
    # request. For `lazy=None` we intentionally keep the existing capped-preview
    # behavior so default rendering of unevaluated objects is unchanged. Native
    # auto-lazy for `lazy=None` can be enabled in a follow-up once the adapters
    # have proven stable on hosted runtimes.
    if lazy is True:
        native = _try_create_native_source(data)
        if native is not None:
            # Native sources with a known small row count keep eager rendering
            # (see FORCED_LAZY_MIN_ROWS). Unknown-size sources (row_count=None)
            # are always served lazily.
            native_row_count = native.row_count
            if (
                native_row_count is not None
                and native_row_count <= FORCED_LAZY_MIN_ROWS
            ):
                return None
            return native

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
        # Multi-level column headers are not supported for lazy loading; keep
        # eager rendering (this also covers an explicit ``lazy=True``).
        if _has_multi_level_columns(data):
            return None
        if _should_lazy_load_in_memory(lazy, len(data)):
            return _in_memory_source_from_pandas(data)
        return None

    # 4) In-memory pyarrow.Table.
    import pyarrow as pa

    if isinstance(data, pa.Table):
        if _has_multi_level_columns(data):
            return None
        if _should_lazy_load_in_memory(lazy, data.num_rows):
            return InMemoryDataframeSource(data)
        return None

    # 5) Unevaluated object without a ready native adapter.
    if dataframe_util.is_unevaluated_data_object(data):
        if lazy is True:
            raise StreamlitAPIException(
                "`lazy=True` is not supported for this object because no lazy "
                "adapter is available for it yet. Remove `lazy=True` to use the "
                "default preview behavior, or convert it to a pandas/Polars "
                "dataframe first."
            )
        return None

    # 6) lazy=True on an arbitrary supported eager input: convert to pandas once
    # and serve slices from memory.
    if lazy is True:
        df = dataframe_util.convert_anything_to_pandas_df(data, ensure_copy=True)
        # Multi-level column headers are not supported for lazy loading; fall
        # back to eager rendering.
        if _has_multi_level_columns(df) or len(df) <= FORCED_LAZY_MIN_ROWS:
            return None
        return _in_memory_source_from_pandas(df)

    # 7) lazy=None and not a large in-memory dataframe: keep eager.
    return None
