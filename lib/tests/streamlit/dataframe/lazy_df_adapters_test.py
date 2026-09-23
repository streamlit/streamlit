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

Adapter logic is also covered without Polars via a stand-in lazy frame.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import TYPE_CHECKING
from unittest.mock import patch

import pyarrow as pa
import pytest

from streamlit import dataframe_util
from streamlit.dataframe.lazy_df_adapters import (
    PolarsLazyFrameSource,
    _align_to_schema,
    try_create_native_source,
)
from streamlit.dataframe.lazy_df_source import AccessMode, SortSpec

if TYPE_CHECKING:
    from collections.abc import Iterator


class _FakeCollected:
    """Minimal Polars ``collect()`` result used by ``PolarsLazyFrameSource``."""

    def __init__(self, table: pa.Table, item: int = 0) -> None:
        self._table = table
        self._item = item

    def item(self) -> int:
        return self._item

    def to_arrow(self) -> pa.Table:
        return self._table


class _FakeLazyFrame:
    """Stand-in for a Polars LazyFrame that Streamlit's adapter can drive."""

    def __init__(self, table: pa.Table, *, support_with_row_index: bool = True) -> None:
        self._table = table
        self._row_count = table.num_rows
        if support_with_row_index:
            self.with_row_index = self._with_row_index

    def _clone(self, table: pa.Table) -> _FakeLazyFrame:
        return _FakeLazyFrame(
            table, support_with_row_index=hasattr(self, "with_row_index")
        )

    def select(self, _expr: object) -> _FakeLazyFrame:
        return self

    def collect(self) -> _FakeCollected:
        return _FakeCollected(self._table, item=self._row_count)

    def head(self, n: int) -> _FakeLazyFrame:
        return self._clone(self._table.slice(0, n))

    def slice(self, offset: int, limit: int) -> _FakeLazyFrame:
        return self._clone(self._table.slice(offset, limit))

    def _with_row_index(self, name: str) -> _FakeLazyFrame:
        index = pa.array(range(self._table.num_rows), type=pa.int64())
        return self._clone(self._table.append_column(name, index))

    def with_row_count(self, name: str) -> _FakeLazyFrame:
        return self._with_row_index(name)

    def sort(
        self, columns: list[str], descending: list[bool] | None = None
    ) -> _FakeLazyFrame:
        first = columns[0]
        desc = bool(descending[0]) if descending else False
        values = self._table.column(first).to_pylist()
        order = sorted(
            range(len(values)),
            key=lambda i: (values[i] is None, values[i]),
            reverse=desc,
        )
        return self._clone(self._table.take(pa.array(order)))

    def drop(self, name: str) -> _FakeLazyFrame:
        keep = [col for col in self._table.column_names if col != name]
        return self._clone(self._table.select(keep))


def _sample_table() -> pa.Table:
    return pa.table({"k": [2, 1, 2], "v": [10, 20, 30]})


def _source(
    table: pa.Table | None = None, *, support_with_row_index: bool = True
) -> PolarsLazyFrameSource:
    return PolarsLazyFrameSource(
        _FakeLazyFrame(
            _sample_table() if table is None else table,
            support_with_row_index=support_with_row_index,
        )
    )


@pytest.fixture
def fake_polars() -> Iterator[None]:
    """Install a tiny ``polars`` module so ``row_count`` can import it."""
    with patch.dict("sys.modules", {"polars": SimpleNamespace(len=lambda: object())}):
        yield


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
    assert set(aligned.schema.names) == {"a", "b"}


def test_align_to_schema_returns_original_when_already_matching() -> None:
    """Matching schemas skip the cast/reorder path."""
    schema = pa.schema([("a", pa.int64()), ("b", pa.int64())])
    table = pa.table({"a": [1], "b": [2]}, schema=schema)
    assert _align_to_schema(table, schema) is table


def test_try_create_native_source_returns_none_for_plain_object() -> None:
    """Unsupported objects have no native adapter."""
    assert try_create_native_source(object()) is None
    assert try_create_native_source([1, 2, 3]) is None


@pytest.mark.require_integration
def test_try_create_native_source_detects_polars_lazyframe() -> None:
    """A Polars LazyFrame yields a PolarsLazyFrameSource."""
    import polars as pl

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


def test_try_create_native_source_builds_polars_adapter_when_detected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """try_create_native_source returns a Polars adapter when detection succeeds."""
    fake = object()
    monkeypatch.setattr(
        dataframe_util,
        "is_polars_lazyframe",
        lambda data: data is fake,
    )
    source = try_create_native_source(fake)
    assert isinstance(source, PolarsLazyFrameSource)
    assert try_create_native_source(object()) is None


def test_polars_lazyframe_source_exposes_schema_and_row_count(
    fake_polars: None,
) -> None:
    """Schema and row count are cached from the unevaluated frame."""
    source = _source()
    schema = source.schema

    assert source.sortable is True
    assert source.access_mode is AccessMode.RANDOM_ACCESS
    assert schema.names == ["k", "v"]
    assert source.row_count == 3
    assert source.schema is schema
    # A later read must reuse the cached count instead of collecting again.
    assert source.row_count == 3


def test_polars_lazyframe_source_load_rows_without_sort() -> None:
    """Unsorted chunks are sliced from the original row order."""
    chunk = _source().load_rows(1, 2)
    assert chunk.column("v").to_pylist() == [20, 30]
    assert chunk.schema.names == ["k", "v"]


def test_polars_lazyframe_source_load_rows_clamps_negative_offset() -> None:
    """Negative offsets and limits are treated as zero."""
    chunk = _source().load_rows(-5, -1)
    assert chunk.num_rows == 0
    assert chunk.schema.names == ["k", "v"]


def test_polars_lazyframe_source_sort_drops_synthetic_row_index() -> None:
    """Sorting adds a synthetic index, then drops it before returning."""
    chunk = _source().load_rows(0, 3, sort=SortSpec("k"))
    assert chunk.column("k").to_pylist() == [1, 2, 2]
    assert chunk.schema.names == ["k", "v"]


def test_polars_lazyframe_source_sort_falls_back_to_with_row_count() -> None:
    """Older Polars APIs without ``with_row_index`` still sort stably."""
    chunk = _source(support_with_row_index=False).load_rows(
        0, 3, sort=SortSpec("v", descending=True)
    )
    assert chunk.column("v").to_pylist() == [30, 20, 10]
    assert chunk.schema.names == ["k", "v"]


def test_polars_lazyframe_source_sort_skips_unknown_column() -> None:
    """A sort column missing from the schema is ignored."""
    chunk = _source().load_rows(0, 3, sort=SortSpec("missing"))
    assert chunk.column("v").to_pylist() == [10, 20, 30]


def test_polars_lazyframe_source_sort_avoids_user_column_name_collision() -> None:
    """A user column matching the internal tiebreaker name is preserved."""
    internal_name = PolarsLazyFrameSource._ROW_INDEX_COLUMN
    chunk = _source(
        pa.table({"k": [2, 1], internal_name: ["user-a", "user-b"]})
    ).load_rows(0, 2, sort=SortSpec("k"))
    assert chunk.schema.names == ["k", internal_name]
    assert chunk.column("k").to_pylist() == [1, 2]
    assert chunk.column(internal_name).to_pylist() == ["user-b", "user-a"]
