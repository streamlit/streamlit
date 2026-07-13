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

The Snowpark adapter cannot execute against a real Snowflake account locally, so
its query building is exercised through a lightweight fake that mimics the
Snowpark ``DataFrame`` fluent API (``columns``/``count``/``sort``/``limit``/
``to_pandas``).
"""

from __future__ import annotations

import pandas as pd
import pyarrow as pa
import pytest

from streamlit.dataframe import adapters
from streamlit.dataframe.adapters import (
    SnowparkDataframeSource,
    _align_to_schema,
    try_create_native_source,
)
from streamlit.dataframe.source import AccessMode, SortSpec


class _FakeLimited:
    """Result of ``FakeSnowparkDataFrame.limit`` exposing ``to_pandas``."""

    def __init__(self, pdf: pd.DataFrame) -> None:
        self._pdf = pdf

    def to_pandas(self) -> pd.DataFrame:
        return self._pdf


class _FakeSnowparkDataFrame:
    """Minimal stand-in for a Snowpark ``DataFrame`` for query-building tests."""

    def __init__(
        self,
        pdf: pd.DataFrame,
        *,
        row_count: int | None = None,
        unsortable_columns: set[str] | None = None,
    ) -> None:
        self._pdf = pdf
        self._explicit_count = row_count
        # Columns that cannot appear in an ORDER BY (mimics Snowflake types like
        # GEOGRAPHY/GEOMETRY). Sorting by one raises, exercising the graceful
        # ORDER BY degradation.
        self._unsortable = unsortable_columns or set()
        self.sort_calls: list[tuple[tuple[str, ...], list[bool] | None]] = []
        self.limit_calls: list[tuple[int, int]] = []
        self.count_calls = 0
        self.queries = {
            "queries": ["select a, b from fake_table"],
            "post_actions": [],
        }

    @property
    def columns(self) -> list[str]:
        return list(self._pdf.columns)

    def count(self) -> int:
        self.count_calls += 1
        return (
            self._explicit_count if self._explicit_count is not None else len(self._pdf)
        )

    def sort(
        self, *cols: str, ascending: list[bool] | None = None
    ) -> _FakeSnowparkDataFrame:
        self.sort_calls.append((cols, ascending))
        unorderable = self._unsortable.intersection(cols)
        if unorderable:
            raise ValueError(
                f"Columns {sorted(unorderable)} cannot be used in an ORDER BY."
            )
        return self

    def limit(self, n: int, offset: int = 0) -> _FakeLimited:
        self.limit_calls.append((n, offset))
        return _FakeLimited(self._pdf.iloc[offset : offset + n])


def _make_fake(num_rows: int = 10) -> _FakeSnowparkDataFrame:
    return _FakeSnowparkDataFrame(
        pd.DataFrame(
            {"a": list(range(num_rows)), "b": [x * 2 for x in range(num_rows)]}
        )
    )


def test_snowpark_row_count_uses_count() -> None:
    """row_count delegates to the Snowpark ``count()`` aggregation."""
    fake = _FakeSnowparkDataFrame(_make_fake()._pdf, row_count=42)
    source = SnowparkDataframeSource(fake)
    assert source.row_count == 42
    assert fake.count_calls == 1


def test_snowpark_row_count_is_fresh_for_each_source() -> None:
    """A new source recounts because the same query plan may have changed."""
    first = _make_fake(10)
    second = _make_fake(11)

    assert SnowparkDataframeSource(first).row_count == 10
    assert SnowparkDataframeSource(second).row_count == 11

    assert first.count_calls == 1
    assert second.count_calls == 1


def test_snowpark_schema_exposes_columns() -> None:
    """The schema is derived from the first page and exposes the columns."""
    source = SnowparkDataframeSource(_make_fake())
    assert source.schema.names == ["a", "b"]
    assert source.sortable is True
    assert source.access_mode is AccessMode.RANDOM_ACCESS


def test_snowpark_load_rows_returns_requested_rows() -> None:
    """load_rows returns the requested Arrow row range."""
    source = SnowparkDataframeSource(_make_fake(10))
    chunk = source.load_rows(2, 3)
    assert isinstance(chunk, pa.Table)
    assert chunk.column("a").to_pylist() == [2, 3, 4]


def test_snowpark_orders_by_all_columns_when_unsorted() -> None:
    """Unsorted paging applies a deterministic ORDER BY over every column."""
    fake = _make_fake()
    source = SnowparkDataframeSource(fake)
    source.load_rows(0, 2)
    # The first sort call (schema probe) orders by every column ascending.
    cols, ascending = fake.sort_calls[0]
    assert cols == ("a", "b")
    assert ascending == [True, True]


def test_snowpark_sort_puts_active_column_first() -> None:
    """An active sort orders by the sort column first, others as tiebreakers."""
    fake = _make_fake()
    source = SnowparkDataframeSource(fake)
    source.load_rows(0, 2, sort=SortSpec("b", descending=True))
    cols, ascending = fake.sort_calls[-1]
    assert cols == ("b", "a")
    assert ascending == [False, True]


def test_snowpark_falls_back_to_primary_sort_column_on_order_error() -> None:
    """If ordering by every column fails, retry with only the sort column.

    Mimics a Snowflake table with an unorderable column (e.g. GEOGRAPHY): the
    full ORDER BY raises, so the adapter degrades to ordering by the active
    sort column instead of failing the request.
    """
    fake = _FakeSnowparkDataFrame(
        pd.DataFrame({"a": [1, 2, 3], "b": [3, 2, 1]}),
        unsortable_columns={"a"},
    )
    source = SnowparkDataframeSource(fake)
    chunk = source.load_rows(0, 3, sort=SortSpec("b", descending=False))
    assert isinstance(chunk, pa.Table)
    attempted = [cols for cols, _ in fake.sort_calls]
    # The full ordering (with the unorderable "a") was attempted first.
    assert ("b", "a") in attempted
    # ...then the adapter retried with just the active sort column.
    assert fake.sort_calls[-1][0] == ("b",)


def test_snowpark_schema_probe_degrades_when_ordering_unsupported() -> None:
    """The initial schema probe still succeeds if no column is orderable.

    Guards the first-render path: if every column is unorderable, the unsorted
    schema probe must fall back to no ORDER BY rather than raising.
    """
    fake = _FakeSnowparkDataFrame(
        pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
        unsortable_columns={"a", "b"},
    )
    source = SnowparkDataframeSource(fake)
    assert source.schema.names == ["a", "b"]
    # The full ordering was attempted and failed; the adapter then fell back to
    # no ORDER BY (which issues no sort call) to complete the schema probe.
    assert fake.sort_calls[-1][0] == ("a", "b")


def test_snowpark_caches_initial_page() -> None:
    """The unsorted first page is queried once and reused for the initial chunk."""
    from streamlit.dataframe.source import DEFAULT_PAGE_SIZE

    fake = _make_fake(10)
    source = SnowparkDataframeSource(fake)
    # Accessing the schema loads the first page.
    _ = source.schema
    limit_calls_after_schema = len(fake.limit_calls)
    # Requesting the initial chunk reuses the cache (no extra query).
    source.load_rows(0, DEFAULT_PAGE_SIZE)
    assert len(fake.limit_calls) == limit_calls_after_schema


def test_snowpark_warns_on_deep_offset() -> None:
    """A deep offset sets the one-shot deep-offset warning flag."""
    source = SnowparkDataframeSource(_make_fake(10))
    assert source._warned_deep_offset is False
    source.load_rows(200_001, 2)
    assert source._warned_deep_offset is True


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


def test_try_create_native_source_detects_snowpark(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A detected Snowpark object yields a SnowparkDataframeSource."""
    monkeypatch.setattr(
        adapters.dataframe_util, "is_snowpark_data_object", lambda _obj: True
    )
    source = try_create_native_source(_make_fake())
    assert isinstance(source, SnowparkDataframeSource)


@pytest.mark.require_integration
def test_try_create_native_source_detects_polars_lazyframe() -> None:
    """A Polars LazyFrame yields a PolarsLazyFrameSource."""
    import polars as pl

    from streamlit.dataframe.adapters import PolarsLazyFrameSource

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

    from streamlit.dataframe.adapters import PolarsLazyFrameSource

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

    from streamlit.dataframe.adapters import PolarsLazyFrameSource

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
