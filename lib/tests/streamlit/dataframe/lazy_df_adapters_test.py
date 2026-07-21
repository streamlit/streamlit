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

"""Unit tests for the native lazy dataframe adapters.

The Polars ``LazyFrame`` adapter requires the optional ``polars`` dependency, so
its tests are marked ``require_integration`` and import Polars inside the test
functions.
"""

from __future__ import annotations

import pyarrow as pa
import pytest

from streamlit.dataframe.lazy_df_adapters import (
    _align_to_schema,
    try_create_native_source,
)
from streamlit.dataframe.lazy_df_source import AccessMode, SortSpec


def test_align_to_schema_reorders_columns() -> None:
    """_align_to_schema reorders columns to match the canonical schema."""
    schema = pa.schema([("a", pa.int64()), ("b", pa.int64())])
    table = pa.table({"b": [1, 2], "a": [3, 4]})
    aligned = _align_to_schema(table, schema)
    assert aligned.schema.names == ["a", "b"]
    assert aligned.column("a").to_pylist() == [3, 4]


def test_align_to_schema_returns_as_is_on_mismatch() -> None:
    """Incompatible columns are returned as-is rather than raising."""
    schema = pa.schema([("a", pa.int64()), ("missing", pa.int64())])
    table = pa.table({"a": [1, 2], "b": [3, 4]})
    aligned = _align_to_schema(table, schema)
    # Could not align; original columns preserved.
    assert set(aligned.schema.names) == {"a", "b"}


def test_try_create_native_source_returns_none_for_plain_object() -> None:
    """Unsupported objects have no native adapter."""
    assert try_create_native_source(object()) is None
    assert try_create_native_source([1, 2, 3]) is None


@pytest.mark.require_integration
def test_try_create_native_source_detects_polars_lazyframe() -> None:
    """A Polars LazyFrame yields a PolarsLazyFrameSource."""
    import polars as pl

    from streamlit.dataframe.lazy_df_adapters import PolarsLazyFrameSource

    source = try_create_native_source(pl.LazyFrame({"a": [1, 2, 3]}))
    assert isinstance(source, PolarsLazyFrameSource)
    assert source.access_mode is AccessMode.RANDOM_ACCESS


@pytest.mark.require_integration
def test_polars_lazyframe_sort_is_deterministic_across_chunks() -> None:
    """Paginated sort over a tie-heavy column returns stable, non-overlapping rows.

    The synthetic row-index tiebreaker orders equal values by their original
    position, so consecutive chunk requests never overlap or skip rows and the
    tiebreaker column does not leak into the returned schema.
    """
    import polars as pl

    from streamlit.dataframe.lazy_df_adapters import PolarsLazyFrameSource

    # Every value in the sort column "k" is a tie, forcing the tiebreaker.
    lf = pl.LazyFrame({"k": [0] * 100, "v": list(range(100))})
    source = PolarsLazyFrameSource(lf)

    first = source.load_rows(0, 10, sort=SortSpec("k"))
    second = source.load_rows(10, 10, sort=SortSpec("k"))
    first_v = first.column("v").to_pylist()
    second_v = second.column("v").to_pylist()

    assert first_v == list(range(10))
    assert second_v == list(range(10, 20))
    assert set(first_v).isdisjoint(second_v)
    # The tiebreaker column must not leak into the returned schema.
    assert first.schema.names == ["k", "v"]
    assert source.schema.names == ["k", "v"]


@pytest.mark.require_integration
def test_polars_lazyframe_sort_avoids_row_index_name_collision() -> None:
    """Sorting preserves a user column matching the internal tiebreaker name."""
    import polars as pl

    from streamlit.dataframe.lazy_df_adapters import PolarsLazyFrameSource

    internal_name = PolarsLazyFrameSource._ROW_INDEX_COLUMN
    source = PolarsLazyFrameSource(
        pl.LazyFrame(
            {
                "k": [2, 1, 3],
                internal_name: ["user-a", "user-b", "user-c"],
            }
        )
    )

    chunk = source.load_rows(0, 3, sort=SortSpec("k"))

    assert chunk.schema.names == ["k", internal_name]
    assert chunk.column("k").to_pylist() == [1, 2, 3]
    assert chunk.column(internal_name).to_pylist() == [
        "user-b",
        "user-a",
        "user-c",
    ]
