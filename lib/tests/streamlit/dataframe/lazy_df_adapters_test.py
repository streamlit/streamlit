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

The Polars ``LazyFrame`` tests need the optional ``polars`` dependency, so they
import it inside the test function and are marked ``require_integration`` to skip
gracefully when it is not installed.
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import pyarrow as pa
import pytest

from streamlit.dataframe import lazy_df_adapters
from streamlit.dataframe.lazy_df_adapters import (
    PolarsLazyFrameSource,
    SnowparkDataframeSource,
    _align_to_schema,
    try_create_native_source,
)
from streamlit.dataframe.lazy_df_source import (
    DEFAULT_PAGE_SIZE,
    AccessMode,
    SortSpec,
)


class _FakeSnowparkSession:
    """Tracks concurrent query execution shared by dataframes from one session."""

    def __init__(self) -> None:
        self.query_barrier: threading.Barrier | None = None
        self.query_counter_lock = threading.Lock()
        self.active_queries = 0
        self.max_active_queries = 0

    def begin_query(self) -> None:
        with self.query_counter_lock:
            self.active_queries += 1
            self.max_active_queries = max(self.max_active_queries, self.active_queries)

        if self.query_barrier is not None:
            try:
                self.query_barrier.wait(timeout=0.2)
            except threading.BrokenBarrierError:
                pass

    def end_query(self) -> None:
        with self.query_counter_lock:
            self.active_queries -= 1


class _FakeSnowparkState:
    """Data and recorded calls shared across clones of one fake query plan."""

    def __init__(
        self,
        pdf: pd.DataFrame,
        *,
        row_count: int | None = None,
        session: _FakeSnowparkSession | None = None,
        snowpark_columns: list[str] | None = None,
        unsortable_columns: set[str] | None = None,
        fail_unordered: bool = False,
        count_started: threading.Event | None = None,
        release_count: threading.Event | None = None,
    ) -> None:
        self.pdf = pdf
        self.explicit_count = row_count
        self.session = session or _FakeSnowparkSession()
        self.snowpark_columns = snowpark_columns or [
            str(column) for column in pdf.columns
        ]
        assert len(self.snowpark_columns) == len(pdf.columns)
        self.unsortable_columns = unsortable_columns or set()
        self.fail_unordered = fail_unordered
        self.count_started = count_started
        self.release_count = release_count
        self.sort_calls: list[tuple[tuple[str, ...], list[bool] | None]] = []
        self.limit_calls: list[tuple[int, int]] = []
        self.to_pandas_calls: list[
            tuple[tuple[str, ...] | None, list[bool] | None, int, int]
        ] = []
        self.count_calls = 0


class _FakeSnowparkDataFrame:
    """Minimal stand-in for Snowpark's immutable fluent ``DataFrame`` API."""

    def __init__(
        self,
        pdf: pd.DataFrame,
        *,
        row_count: int | None = None,
        session: _FakeSnowparkSession | None = None,
        snowpark_columns: list[str] | None = None,
        unsortable_columns: set[str] | None = None,
        fail_unordered: bool = False,
        count_started: threading.Event | None = None,
        release_count: threading.Event | None = None,
    ) -> None:
        self._state = _FakeSnowparkState(
            pdf,
            row_count=row_count,
            session=session,
            snowpark_columns=snowpark_columns,
            unsortable_columns=unsortable_columns,
            fail_unordered=fail_unordered,
            count_started=count_started,
            release_count=release_count,
        )
        self._ordering: tuple[tuple[str, ...], list[bool] | None] | None = None
        self._window: tuple[int, int] | None = None

    def _clone(self) -> _FakeSnowparkDataFrame:
        clone = object.__new__(type(self))
        clone._state = self._state
        clone._ordering = self._ordering
        clone._window = self._window
        return clone

    @property
    def columns(self) -> list[str]:
        session = self._state.session
        session.begin_query()
        try:
            return self._state.snowpark_columns
        finally:
            session.end_query()

    @property
    def session(self) -> _FakeSnowparkSession:
        return self._state.session

    @property
    def sort_calls(self) -> list[tuple[tuple[str, ...], list[bool] | None]]:
        return self._state.sort_calls

    @property
    def limit_calls(self) -> list[tuple[int, int]]:
        return self._state.limit_calls

    @property
    def to_pandas_calls(
        self,
    ) -> list[tuple[tuple[str, ...] | None, list[bool] | None, int, int]]:
        return self._state.to_pandas_calls

    @property
    def count_calls(self) -> int:
        return self._state.count_calls

    def count(self) -> int:
        self._state.count_calls += 1
        if self._state.count_started is not None:
            self._state.count_started.set()
        if self._state.release_count is not None:
            assert self._state.release_count.wait(timeout=5)
        if self._state.explicit_count is not None:
            return self._state.explicit_count
        return len(self._state.pdf)

    def sort(
        self, *cols: str, ascending: list[bool] | None = None
    ) -> _FakeSnowparkDataFrame:
        self._state.sort_calls.append((cols, ascending))
        clone = self._clone()
        clone._ordering = (cols, ascending)
        return clone

    def limit(self, n: int, offset: int = 0) -> _FakeSnowparkDataFrame:
        self._state.limit_calls.append((n, offset))
        clone = self._clone()
        clone._window = (n, offset)
        return clone

    def to_pandas(self) -> pd.DataFrame:
        session = self._state.session
        session.begin_query()

        try:
            n, offset = self._window or (len(self._state.pdf), 0)
            if self._ordering is None:
                ordered = None
                ascending = None
            else:
                ordered, ascending = self._ordering
            self._state.to_pandas_calls.append((ordered, ascending, n, offset))

            if ordered is None:
                if self._state.fail_unordered:
                    raise RuntimeError("unordered query failed")
                result = self._state.pdf
            else:
                unorderable = self._state.unsortable_columns.intersection(ordered)
                if unorderable:
                    raise ValueError(
                        f"Columns {sorted(unorderable)} cannot be used in an ORDER BY."
                    )
                ordered_labels = [
                    self._state.pdf.columns[self._state.snowpark_columns.index(column)]
                    for column in ordered
                ]
                result = self._state.pdf.sort_values(
                    ordered_labels, ascending=ascending, kind="stable"
                )
            return result.iloc[offset : offset + n].reset_index(drop=True)
        finally:
            session.end_query()


def _make_pdf(num_rows: int = 10) -> pd.DataFrame:
    return pd.DataFrame(
        {"a": list(range(num_rows)), "b": [value * 2 for value in range(num_rows)]}
    )


def _make_fake(num_rows: int = 10) -> _FakeSnowparkDataFrame:
    return _FakeSnowparkDataFrame(_make_pdf(num_rows))


def test_snowpark_row_count_uses_count_once() -> None:
    """row_count delegates to ``count()``, coerces, and caches the result."""
    fake = _FakeSnowparkDataFrame(_make_pdf(), row_count=42)
    source = SnowparkDataframeSource(fake)

    assert source.row_count == 42
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


def test_snowpark_row_count_is_thread_safe() -> None:
    """Concurrent first row-count reads issue only one Snowflake count query."""
    count_started = threading.Event()
    release_count = threading.Event()
    fake = _FakeSnowparkDataFrame(
        _make_pdf(),
        count_started=count_started,
        release_count=release_count,
    )
    source = SnowparkDataframeSource(fake)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(lambda: source.row_count)
        assert count_started.wait(timeout=5)
        second = executor.submit(lambda: source.row_count)
        try:
            assert fake.count_calls == 1
        finally:
            release_count.set()
        assert first.result() == 10
        assert second.result() == 10

    assert fake.count_calls == 1


def test_snowpark_schema_caches_first_page_and_exposes_capabilities() -> None:
    """The first page defines the cached schema and source capabilities."""
    fake = _make_fake()
    source = SnowparkDataframeSource(fake)

    assert source.schema.names == ["a", "b"]
    assert source.schema.names == ["a", "b"]
    assert fake.limit_calls == [(DEFAULT_PAGE_SIZE, 0)]
    assert source.sortable is True
    assert source.access_mode is AccessMode.RANDOM_ACCESS


def test_snowpark_load_rows_returns_requested_rows() -> None:
    """load_rows sends the requested range and returns it as an Arrow table."""
    fake = _make_fake(10)
    source = SnowparkDataframeSource(fake)

    chunk = source.load_rows(2, 3)

    assert isinstance(chunk, pa.Table)
    assert chunk.column("a").to_pylist() == [2, 3, 4]
    assert fake.limit_calls[-1] == (3, 2)


def test_snowpark_load_rows_clamps_negative_range() -> None:
    """Direct source calls clamp negative offsets and limits."""
    fake = _make_fake()
    source = SnowparkDataframeSource(fake)

    assert source.load_rows(-5, -5).num_rows == 0


def test_snowpark_orders_by_all_columns_when_unsorted() -> None:
    """Unsorted paging applies a deterministic ORDER BY over every column."""
    fake = _make_fake()
    source = SnowparkDataframeSource(fake)

    source.load_rows(2, 2)

    assert fake.sort_calls[-1] == (("a", "b"), [True, True])


@pytest.mark.parametrize(
    ("descending", "expected_ascending", "expected_values"),
    [
        (False, [True, True], [0, 2]),
        (True, [False, True], [18, 16]),
    ],
)
def test_snowpark_sort_puts_active_column_first(
    descending: bool,
    expected_ascending: list[bool],
    expected_values: list[int],
) -> None:
    """The active sort column leads, with all others as ascending tiebreakers."""
    fake = _make_fake()
    source = SnowparkDataframeSource(fake)

    chunk = source.load_rows(0, 2, sort=SortSpec("b", descending=descending))

    assert fake.sort_calls[-1] == (("b", "a"), expected_ascending)
    assert chunk.column("b").to_pylist() == expected_values


@pytest.mark.parametrize(
    ("snowpark_name", "arrow_name"),
    [
        ('"lower"', "lower"),
        ('"id with space"', "id with space"),
        ('"embedded""quote"', 'embedded"quote'),
    ],
)
def test_snowpark_sort_maps_arrow_names_to_quoted_identifiers(
    snowpark_name: str,
    arrow_name: str,
) -> None:
    """Frontend sort names map back to Snowpark's quoted identifiers."""
    fake = _FakeSnowparkDataFrame(
        pd.DataFrame({arrow_name: [1, 3, 2], "VALUE": [10, 20, 30]}),
        snowpark_columns=[snowpark_name, "VALUE"],
    )
    source = SnowparkDataframeSource(fake)

    chunk = source.load_rows(0, 3, sort=SortSpec(arrow_name, descending=True))

    assert chunk.column(arrow_name).to_pylist() == [3, 2, 1]
    assert fake.sort_calls[-1] == (
        (snowpark_name, "VALUE"),
        [False, True],
    )


def test_snowpark_unknown_sort_column_uses_default_order() -> None:
    """An unknown sort column is ignored in favor of deterministic base order."""
    fake = _make_fake()
    source = SnowparkDataframeSource(fake)

    source.load_rows(2, 2, sort=SortSpec("missing", descending=True))

    assert fake.sort_calls[-1] == (("a", "b"), [True, True])


def test_snowpark_falls_back_to_primary_sort_column_on_order_error() -> None:
    """A full-order failure degrades to only the valid active sort column.

    ``load_rows`` first resolves the schema, whose unsorted probe already
    discovers that a full ORDER BY fails, so the sorted chunk skips the
    known-bad full ordering and queries with just the active sort column.
    """
    fake = _FakeSnowparkDataFrame(
        pd.DataFrame({"a": [1, 2, 3], "b": [3, 2, 1]}),
        unsortable_columns={"a"},
    )
    source = SnowparkDataframeSource(fake)

    chunk = source.load_rows(0, 3, sort=SortSpec("b"))

    assert chunk.column("b").to_pylist() == [1, 2, 3]
    assert (("b", "a"), [True, True]) not in fake.sort_calls
    assert fake.sort_calls[-1] == (("b",), [True])


def test_snowpark_memoizes_full_order_failure_across_chunks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Once a full ORDER BY fails, later chunks skip it and warn only once."""
    fake = _FakeSnowparkDataFrame(
        pd.DataFrame({"a": [1, 2, 3], "b": [3, 2, 1]}),
        unsortable_columns={"a"},
    )
    source = SnowparkDataframeSource(fake)
    warnings: list[str] = []
    monkeypatch.setattr(
        lazy_df_adapters._LOGGER,
        "warning",
        lambda message, *args, **_kwargs: warnings.append(message % args),
    )

    source.load_rows(0, 2, sort=SortSpec("b"))
    source.load_rows(2, 2, sort=SortSpec("b"))

    # The known-bad full ordering is never attempted for either sorted chunk.
    assert [call for call in fake.sort_calls if call[0] == ("b", "a")] == []
    assert sum("by all columns" in warning for warning in warnings) == 1


def test_snowpark_falls_back_to_unordered_after_primary_order_error() -> None:
    """Failures in full and primary ordering degrade to an unordered query."""
    fake = _FakeSnowparkDataFrame(
        pd.DataFrame({"a": [1, 2, 3], "b": [3, 2, 1]}),
        unsortable_columns={"a"},
    )
    source = SnowparkDataframeSource(fake)

    chunk = source.load_rows(0, 2, sort=SortSpec("a"))

    assert chunk.column("a").to_pylist() == [1, 2]
    assert fake.sort_calls[-2:] == [
        (("a", "b"), [True, True]),
        (("a",), [True]),
    ]
    assert fake.to_pandas_calls[-1][0] is None


def test_snowpark_final_unordered_query_error_propagates() -> None:
    """A genuine failure in the final unordered attempt reaches the caller."""
    fake = _FakeSnowparkDataFrame(
        pd.DataFrame({"a": [1, 2], "b": [2, 1]}),
        unsortable_columns={"a"},
        fail_unordered=True,
    )
    source = SnowparkDataframeSource(fake)

    with pytest.raises(RuntimeError, match="unordered query failed"):
        source._query_chunk(0, 2, sort=SortSpec("a"))


def test_snowpark_schema_probe_degrades_when_ordering_unsupported() -> None:
    """The first-page schema probe falls back when no column is orderable."""
    fake = _FakeSnowparkDataFrame(
        pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
        unsortable_columns={"a", "b"},
    )
    source = SnowparkDataframeSource(fake)

    assert source.schema.names == ["a", "b"]
    assert fake.sort_calls == [(("a", "b"), [True, True])]
    assert fake.to_pandas_calls[-1][0] is None


def test_snowpark_reuses_and_slices_initial_page() -> None:
    """A covered page-zero request reuses and slices the schema probe result."""
    fake = _make_fake(DEFAULT_PAGE_SIZE + 1)
    source = SnowparkDataframeSource(fake)
    _ = source.schema

    chunk = source.load_rows(0, 7)

    assert chunk.num_rows == 7
    assert len(fake.limit_calls) == 1


def test_snowpark_oversized_initial_request_issues_fresh_query() -> None:
    """A request larger than a full cached page is not under-returned."""
    fake = _make_fake(DEFAULT_PAGE_SIZE + 1)
    source = SnowparkDataframeSource(fake)
    _ = source.schema

    chunk = source.load_rows(0, DEFAULT_PAGE_SIZE + 1)

    assert chunk.num_rows == DEFAULT_PAGE_SIZE + 1
    assert fake.limit_calls == [
        (DEFAULT_PAGE_SIZE, 0),
        (DEFAULT_PAGE_SIZE + 1, 0),
    ]


def test_snowpark_short_initial_page_is_known_to_be_complete() -> None:
    """A short cached first page satisfies an oversized page-zero request."""
    fake = _make_fake(10)
    source = SnowparkDataframeSource(fake)
    _ = source.schema

    chunk = source.load_rows(0, DEFAULT_PAGE_SIZE + 1)

    assert chunk.num_rows == 10
    assert fake.limit_calls == [(DEFAULT_PAGE_SIZE, 0)]


def test_snowpark_later_chunks_align_to_canonical_schema() -> None:
    """Later query results are reordered to the first page's canonical schema."""
    source = SnowparkDataframeSource(_make_fake())
    _ = source.schema

    def query_with_reordered_columns(
        offset: int, limit: int, *, sort: SortSpec | None
    ) -> pa.Table:
        return pa.table(
            {
                "b": pa.array([4], type=pa.int32()),
                "a": pa.array([2], type=pa.int32()),
            }
        )

    source._query_chunk = query_with_reordered_columns  # type: ignore[method-assign]
    chunk = source.load_rows(1, 1)

    assert chunk.schema.names == ["a", "b"]
    assert chunk.schema.equals(source.schema)
    assert chunk.column("a").to_pylist() == [2]


def test_snowpark_warns_once_for_concurrent_deep_offsets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Concurrent deep-offset requests emit one warning per source."""
    source = SnowparkDataframeSource(_make_fake())
    warnings: list[str] = []

    def record_warning(message: str, *args: object, **_kwargs: object) -> None:
        warnings.append(message % args)

    monkeypatch.setattr(lazy_df_adapters._LOGGER, "warning", record_warning)
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(source.load_rows, 100_001 + offset, 1)
            for offset in range(4)
        ]
        for future in futures:
            future.result()

    assert len(warnings) == 1
    assert "Requesting a deep offset" in warnings[0]


def test_snowpark_serializes_concurrent_queries() -> None:
    """Chunk execution is serialized for supported non-thread-safe sessions."""
    fake = _make_fake()
    source = SnowparkDataframeSource(fake)
    _ = source.schema
    fake.session.query_barrier = threading.Barrier(2)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(source.load_rows, 1, 1)
        second = executor.submit(source.load_rows, 2, 1)
        first.result()
        second.result()

    assert fake.session.max_active_queries == 1


def test_snowpark_serializes_queries_across_sources_for_same_session() -> None:
    """Cold dataframes sharing a session serialize schema and row queries."""
    session = _FakeSnowparkSession()
    first_fake = _FakeSnowparkDataFrame(_make_pdf(), session=session)
    second_fake = _FakeSnowparkDataFrame(_make_pdf(), session=session)
    first_source = SnowparkDataframeSource(first_fake)
    second_source = SnowparkDataframeSource(second_fake)
    session.query_barrier = threading.Barrier(2)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(first_source.load_rows, 1, 1)
        second = executor.submit(second_source.load_rows, 2, 1)
        first.result()
        second.result()

    assert session.max_active_queries == 1


def test_snowpark_query_lock_without_session_uses_fallback() -> None:
    """A dataframe without a session shares the process-wide fallback lock."""

    class _NoSession:
        session = None

    assert (
        lazy_df_adapters._get_snowpark_query_lock(_NoSession())
        is lazy_df_adapters._SNOWPARK_FALLBACK_QUERY_LOCK
    )


def test_snowpark_query_lock_non_weakreferenceable_session_uses_fallback() -> None:
    """A session that cannot be weak-referenced falls back to the shared lock."""

    class _IntSession:
        # ``int`` is hashable but not weak-referenceable, so WeakKeyDictionary
        # raises TypeError when it is used as a key.
        session = 12345

    assert (
        lazy_df_adapters._get_snowpark_query_lock(_IntSession())
        is lazy_df_adapters._SNOWPARK_FALLBACK_QUERY_LOCK
    )


def test_snowpark_schema_from_empty_result() -> None:
    """Schema derivation and paging work when the first page returns no rows."""
    fake = _make_fake(0)
    source = SnowparkDataframeSource(fake)

    assert source.schema.names == ["a", "b"]
    assert source.load_rows(0, 5).num_rows == 0


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
    """Optional-dependency-safe Snowpark detection creates the native source."""
    monkeypatch.setattr(
        lazy_df_adapters.dataframe_util,
        "is_polars_lazyframe",
        lambda _data: False,
    )
    monkeypatch.setattr(
        lazy_df_adapters.dataframe_util,
        "is_snowpark_data_object",
        lambda _data: True,
    )

    assert isinstance(try_create_native_source(_make_fake()), SnowparkDataframeSource)


def test_try_create_native_source_prioritizes_polars(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Polars detection remains first if detector predicates ever overlap."""
    monkeypatch.setattr(
        lazy_df_adapters.dataframe_util,
        "is_polars_lazyframe",
        lambda _data: True,
    )
    monkeypatch.setattr(
        lazy_df_adapters.dataframe_util,
        "is_snowpark_data_object",
        lambda _data: True,
    )

    assert isinstance(try_create_native_source(object()), PolarsLazyFrameSource)


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
