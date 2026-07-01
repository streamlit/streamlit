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

"""Unit tests for the internal lazy dataframe source protocol and adapters."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest

from streamlit.dataframe import source as dataframe_source
from streamlit.dataframe.source import (
    AUTO_LAZY_ROW_THRESHOLD,
    FORCED_LAZY_MIN_ROWS,
    AccessMode,
    InMemoryDataframeSource,
    SortSpec,
    resolve_lazy_source,
)
from streamlit.dataframe_util import (
    convert_arrow_bytes_to_pandas_df,
    convert_arrow_table_to_arrow_bytes,
)
from streamlit.errors import StreamlitAPIException


def _make_table(num_rows: int) -> pa.Table:
    """Build a simple two-column Arrow table with ``num_rows`` rows."""
    return pa.table({"a": list(range(num_rows)), "b": [x * 2 for x in range(num_rows)]})


def test_in_memory_source_exposes_metadata() -> None:
    """The in-memory source reports row count, schema, and capability flags."""
    source = InMemoryDataframeSource(_make_table(10))
    assert source.row_count == 10
    assert source.schema.names == ["a", "b"]
    assert source.sortable is True
    assert source.access_mode is AccessMode.RANDOM_ACCESS


def test_in_memory_source_load_rows_slices() -> None:
    """``load_rows`` returns the requested row range with a stable schema."""
    source = InMemoryDataframeSource(_make_table(100))
    chunk = source.load_rows(10, 5)
    assert chunk.num_rows == 5
    assert chunk.column("a").to_pylist() == [10, 11, 12, 13, 14]
    assert chunk.schema.equals(source.schema)


def test_in_memory_source_load_rows_clamps_offset_and_limit() -> None:
    """Negative offsets/limits are clamped instead of raising."""
    source = InMemoryDataframeSource(_make_table(20))
    assert source.load_rows(-5, -5).num_rows == 0
    # Requesting beyond the end returns the available tail only.
    assert source.load_rows(18, 100).num_rows == 2


def test_in_memory_source_sorts_descending() -> None:
    """Server-side descending sort returns rows in the expected order."""
    source = InMemoryDataframeSource(_make_table(50))
    chunk = source.load_rows(0, 3, sort=SortSpec("a", descending=True))
    assert chunk.column("a").to_pylist() == [49, 48, 47]


def test_in_memory_source_unknown_sort_column_returns_unsorted() -> None:
    """An unknown sort column is ignored rather than raising."""
    source = InMemoryDataframeSource(_make_table(10))
    chunk = source.load_rows(0, 3, sort=SortSpec("does_not_exist"))
    assert chunk.column("a").to_pylist() == [0, 1, 2]


def test_in_memory_source_not_sortable_ignores_sort() -> None:
    """A non-sortable source ignores the sort state."""
    source = InMemoryDataframeSource(_make_table(10), sortable=False)
    chunk = source.load_rows(0, 3, sort=SortSpec("a", descending=True))
    assert chunk.column("a").to_pylist() == [0, 1, 2]


def test_resolve_returns_none_for_none_data() -> None:
    """``None`` data always renders eagerly."""
    assert resolve_lazy_source(None, True, is_selection_activated=False) is None


def test_resolve_lazy_false_always_eager() -> None:
    """``lazy=False`` keeps eager rendering even for large dataframes."""
    df = pd.DataFrame({"a": np.arange(AUTO_LAZY_ROW_THRESHOLD + 1)})
    assert resolve_lazy_source(df, False, is_selection_activated=False) is None


def test_resolve_auto_lazy_large_pandas() -> None:
    """Large in-memory pandas dataframes auto-switch to lazy for ``lazy=None``."""
    df = pd.DataFrame({"a": np.arange(AUTO_LAZY_ROW_THRESHOLD + 1)})
    source = resolve_lazy_source(df, None, is_selection_activated=False)
    assert isinstance(source, InMemoryDataframeSource)
    assert source.row_count == AUTO_LAZY_ROW_THRESHOLD + 1


def test_resolve_small_pandas_eager_for_auto() -> None:
    """Small in-memory dataframes keep eager rendering for ``lazy=None``."""
    df = pd.DataFrame({"a": np.arange(100)})
    assert resolve_lazy_source(df, None, is_selection_activated=False) is None


def test_resolve_forced_lazy_small_data_short_circuits() -> None:
    """``lazy=True`` keeps eager rendering for inputs at/below the small threshold."""
    df = pd.DataFrame({"a": np.arange(FORCED_LAZY_MIN_ROWS)})
    assert resolve_lazy_source(df, True, is_selection_activated=False) is None


def test_resolve_forced_lazy_medium_data() -> None:
    """``lazy=True`` uses a lazy source for inputs above the small threshold."""
    df = pd.DataFrame({"a": np.arange(FORCED_LAZY_MIN_ROWS + 1)})
    source = resolve_lazy_source(df, True, is_selection_activated=False)
    assert isinstance(source, InMemoryDataframeSource)


def test_in_memory_pandas_source_carries_absolute_index() -> None:
    """Chunks from a pandas source keep absolute index values (not per-chunk 0).

    A default RangeIndex is materialized so a chunk at offset N displays the
    index starting at N rather than restarting at 0.
    """
    df = pd.DataFrame({"a": np.arange(2000)})
    source = resolve_lazy_source(df, True, is_selection_activated=False)
    assert isinstance(source, InMemoryDataframeSource)

    chunk = source.load_rows(500, 5)
    result = convert_arrow_bytes_to_pandas_df(convert_arrow_table_to_arrow_bytes(chunk))
    assert list(result.index) == [500, 501, 502, 503, 504]


def test_in_memory_pandas_source_index_follows_sort() -> None:
    """The materialized index travels with rows through server-side sorting."""
    df = pd.DataFrame({"a": np.arange(2000)})
    source = resolve_lazy_source(df, True, is_selection_activated=False)
    assert isinstance(source, InMemoryDataframeSource)

    chunk = source.load_rows(0, 3, sort=SortSpec("a", descending=True))
    result = convert_arrow_bytes_to_pandas_df(convert_arrow_table_to_arrow_bytes(chunk))
    # Descending sort: the first rows are the last original positions.
    assert list(result.index) == [1999, 1998, 1997]


def test_resolve_forced_lazy_pyarrow_table() -> None:
    """``lazy=True`` works with a pyarrow.Table input."""
    table = _make_table(FORCED_LAZY_MIN_ROWS + 1)
    source = resolve_lazy_source(table, True, is_selection_activated=False)
    assert isinstance(source, InMemoryDataframeSource)


def _make_multiindex_pandas(num_rows: int) -> pd.DataFrame:
    """Build a pandas DataFrame with two-level (MultiIndex) column headers."""
    columns = pd.MultiIndex.from_tuples(
        [("group1", "a"), ("group1", "b")], names=["level_0", "level_1"]
    )
    return pd.DataFrame(np.arange(num_rows * 2).reshape(num_rows, 2), columns=columns)


def test_resolve_multiindex_columns_lazy_true_falls_back_to_eager() -> None:
    """``lazy=True`` on a MultiIndex-column pandas DataFrame renders eagerly.

    Multi-level column headers are unsupported for lazy loading, so they fall
    back to eager rendering rather than raising.
    """
    df = _make_multiindex_pandas(FORCED_LAZY_MIN_ROWS + 1)
    assert resolve_lazy_source(df, True, is_selection_activated=False) is None


def test_resolve_multiindex_columns_lazy_none_falls_back_to_eager() -> None:
    """A large MultiIndex-column pandas DataFrame stays eager for ``lazy=None``."""
    df = _make_multiindex_pandas(AUTO_LAZY_ROW_THRESHOLD + 1)
    assert resolve_lazy_source(df, None, is_selection_activated=False) is None


def test_resolve_multiindex_columns_pyarrow_falls_back_to_eager() -> None:
    """A pyarrow.Table carrying MultiIndex column metadata stays eager."""
    df = _make_multiindex_pandas(FORCED_LAZY_MIN_ROWS + 1)
    table = pa.Table.from_pandas(df)
    assert resolve_lazy_source(table, True, is_selection_activated=False) is None


def test_resolve_single_level_columns_stay_lazy() -> None:
    """A regular (single-level) column DataFrame is still served lazily.

    Guards against the MultiIndex check accidentally excluding normal
    dataframes.
    """
    df = pd.DataFrame(np.arange(2 * (FORCED_LAZY_MIN_ROWS + 1)).reshape(-1, 2))
    source = resolve_lazy_source(df, True, is_selection_activated=False)
    assert isinstance(source, InMemoryDataframeSource)


def test_resolve_forced_lazy_numpy_fallback() -> None:
    """``lazy=True`` converts an arbitrary supported eager input to pandas."""
    data = np.arange(FORCED_LAZY_MIN_ROWS + 1).reshape(-1, 1)
    source = resolve_lazy_source(data, True, is_selection_activated=False)
    assert isinstance(source, InMemoryDataframeSource)
    assert source.row_count == FORCED_LAZY_MIN_ROWS + 1


def test_resolve_styler_lazy_true_raises() -> None:
    """``lazy=True`` raises for a pandas Styler."""
    styler = pd.DataFrame({"a": [1, 2, 3]}).style
    with pytest.raises(StreamlitAPIException, match="Styler"):
        resolve_lazy_source(styler, True, is_selection_activated=False)


def test_resolve_styler_lazy_none_eager() -> None:
    """``lazy=None`` falls back to eager for a pandas Styler."""
    styler = pd.DataFrame({"a": [1, 2, 3]}).style
    assert resolve_lazy_source(styler, None, is_selection_activated=False) is None


def test_resolve_selection_lazy_true_raises() -> None:
    """``lazy=True`` raises when selections are activated."""
    df = pd.DataFrame({"a": np.arange(FORCED_LAZY_MIN_ROWS + 1)})
    with pytest.raises(StreamlitAPIException, match="on_select"):
        resolve_lazy_source(df, True, is_selection_activated=True)


def test_resolve_selection_lazy_none_eager() -> None:
    """``lazy=None`` falls back to eager when selections are activated."""
    df = pd.DataFrame({"a": np.arange(AUTO_LAZY_ROW_THRESHOLD + 1)})
    assert resolve_lazy_source(df, None, is_selection_activated=True) is None


@pytest.mark.require_integration
def test_resolve_polars_lazyframe_native_adapter() -> None:
    """A Polars LazyFrame uses the native lazy adapter for ``lazy=True``."""
    import polars as pl

    from streamlit.dataframe.adapters import PolarsLazyFrameSource

    lf = pl.LazyFrame({"a": list(range(5000)), "b": list(range(5000))})
    source = resolve_lazy_source(lf, True, is_selection_activated=False)
    assert isinstance(source, PolarsLazyFrameSource)
    assert source.row_count == 5000
    assert source.schema.names == ["a", "b"]
    chunk = source.load_rows(0, 3, sort=SortSpec("a", descending=True))
    assert chunk.column("a").to_pylist() == [4999, 4998, 4997]


@pytest.mark.require_integration
def test_resolve_auto_lazy_large_polars_dataframe() -> None:
    """Large in-memory Polars dataframes auto-switch to lazy for ``lazy=None``."""
    import polars as pl

    df = pl.DataFrame({"a": list(range(AUTO_LAZY_ROW_THRESHOLD + 1))})
    source = resolve_lazy_source(df, None, is_selection_activated=False)
    assert isinstance(source, InMemoryDataframeSource)
    assert source.row_count == AUTO_LAZY_ROW_THRESHOLD + 1


def test_default_page_size_is_positive() -> None:
    """The default page size constant is a sane positive value."""
    assert dataframe_source.DEFAULT_PAGE_SIZE > 0
    assert dataframe_source.MAX_CHUNK_ROWS >= dataframe_source.DEFAULT_PAGE_SIZE
