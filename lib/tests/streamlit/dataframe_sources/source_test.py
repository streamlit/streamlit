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

"""Unit tests for lazy dataframe sources."""

from __future__ import annotations

import pyarrow as pa
import pytest

from streamlit.dataframe_sources.source import (
    PandasDataframeSource,
    PolarsDataframeSource,
    SortConfig,
    create_dataframe_source,
)


class TestPandasDataframeSource:
    """Tests for PandasDataframeSource."""

    def test_row_count(self):
        """Test that row_count returns the correct number of rows."""
        import pandas as pd

        df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
        source = PandasDataframeSource(df)
        assert source.row_count == 3

    def test_schema(self):
        """Test that schema returns the Arrow schema."""
        import pandas as pd

        df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
        source = PandasDataframeSource(df)
        schema = source.schema

        assert isinstance(schema, pa.Schema)
        assert "a" in schema.names
        assert "b" in schema.names

    def test_sortable(self):
        """Test that sortable returns True."""
        import pandas as pd

        df = pd.DataFrame({"a": [1, 2, 3]})
        source = PandasDataframeSource(df)
        assert source.sortable is True

    def test_load_rows_basic(self):
        """Test basic row loading without sorting."""
        import pandas as pd

        df = pd.DataFrame({"a": [1, 2, 3, 4, 5], "b": [10, 20, 30, 40, 50]})
        source = PandasDataframeSource(df)

        # Load first 2 rows
        chunk_bytes = source.load_rows(offset=0, limit=2)
        assert isinstance(chunk_bytes, bytes)
        assert len(chunk_bytes) > 0

    def test_load_rows_with_offset(self):
        """Test row loading with offset."""
        import pandas as pd

        df = pd.DataFrame({"a": [1, 2, 3, 4, 5]})
        source = PandasDataframeSource(df)

        # Load rows 2-4
        chunk_bytes = source.load_rows(offset=2, limit=2)
        assert isinstance(chunk_bytes, bytes)

    def test_load_rows_with_sort_ascending(self):
        """Test row loading with ascending sort returns correctly ordered data."""
        import pandas as pd

        df = pd.DataFrame({"a": [3, 1, 2], "b": [30, 10, 20]})
        source = PandasDataframeSource(df)

        # Load all rows sorted by 'a' ascending
        chunk_bytes = source.load_rows(
            offset=0, limit=3, sort=SortConfig(column="a", ascending=True)
        )
        assert isinstance(chunk_bytes, bytes)

        # Verify the data is actually sorted
        reader = pa.ipc.open_stream(chunk_bytes)
        table = reader.read_all()
        values = table.column("a").to_pylist()
        assert values == [1, 2, 3]

    def test_load_rows_with_sort_descending(self):
        """Test row loading with descending sort returns correctly ordered data."""
        import pandas as pd

        df = pd.DataFrame({"a": [3, 1, 2], "b": [30, 10, 20]})
        source = PandasDataframeSource(df)

        # Load all rows sorted by 'a' descending
        chunk_bytes = source.load_rows(
            offset=0, limit=3, sort=SortConfig(column="a", ascending=False)
        )
        assert isinstance(chunk_bytes, bytes)

        # Verify the data is actually sorted in descending order
        reader = pa.ipc.open_stream(chunk_bytes)
        table = reader.read_all()
        values = table.column("a").to_pylist()
        assert values == [3, 2, 1]

    def test_load_rows_sort_with_offset(self):
        """Test row loading with sort and offset works correctly."""
        import pandas as pd

        df = pd.DataFrame({"a": [5, 3, 1, 4, 2]})
        source = PandasDataframeSource(df)

        # Load rows 1-3 (indices 1, 2) sorted ascending
        chunk_bytes = source.load_rows(
            offset=1, limit=2, sort=SortConfig(column="a", ascending=True)
        )

        reader = pa.ipc.open_stream(chunk_bytes)
        table = reader.read_all()
        values = table.column("a").to_pylist()
        # After sort: [1, 2, 3, 4, 5], take offset 1 with limit 2 -> [2, 3]
        assert values == [2, 3]

    def test_load_rows_sort_by_named_index(self):
        """Test sorting by a named index works correctly."""
        import pandas as pd

        df = pd.DataFrame({"a": [10, 20, 30]}, index=pd.Index([3, 1, 2], name="my_idx"))
        source = PandasDataframeSource(df)

        # Sort by the named index
        chunk_bytes = source.load_rows(
            offset=0, limit=3, sort=SortConfig(column="my_idx", ascending=True)
        )

        reader = pa.ipc.open_stream(chunk_bytes)
        table = reader.read_all()
        # After sorting by index: index order becomes [1, 2, 3], values become [20, 30, 10]
        values = table.column("a").to_pylist()
        assert values == [20, 30, 10]

    def test_load_rows_sort_unknown_column_ignored(self):
        """Test that sorting by an unknown column is silently ignored."""
        import pandas as pd

        df = pd.DataFrame({"a": [3, 1, 2]})
        source = PandasDataframeSource(df)

        # Sort by a non-existent column - should return original order
        chunk_bytes = source.load_rows(
            offset=0, limit=3, sort=SortConfig(column="nonexistent", ascending=True)
        )

        reader = pa.ipc.open_stream(chunk_bytes)
        table = reader.read_all()
        values = table.column("a").to_pylist()
        # Original order preserved since column doesn't exist
        assert values == [3, 1, 2]

    def test_load_rows_preserves_index_labels(self):
        """Test that sorting preserves original index labels."""
        import pandas as pd

        df = pd.DataFrame(
            {"a": [3, 1, 2]}, index=pd.Index(["x", "y", "z"], name="my_idx")
        )
        source = PandasDataframeSource(df)

        # Sort by 'a' ascending
        chunk_bytes = source.load_rows(
            offset=0, limit=3, sort=SortConfig(column="a", ascending=True)
        )

        reader = pa.ipc.open_stream(chunk_bytes)
        table = reader.read_all()
        # Values should be sorted
        values = table.column("a").to_pylist()
        assert values == [1, 2, 3]
        # Index should also be reordered to match: y (1), z (2), x (3)
        idx_values = table.column("my_idx").to_pylist()
        assert idx_values == ["y", "z", "x"]

    def test_load_rows_offset_beyond_end(self):
        """Test that offset beyond the end returns empty data."""
        import pandas as pd

        df = pd.DataFrame({"a": [1, 2, 3]})
        source = PandasDataframeSource(df)

        # Offset beyond the data
        chunk_bytes = source.load_rows(offset=10, limit=5)
        assert isinstance(chunk_bytes, bytes)


class TestPolarsDataframeSource:
    """Tests for PolarsDataframeSource."""

    @pytest.fixture
    def polars_df(self):
        """Create a test Polars DataFrame."""
        pytest.importorskip("polars")
        import polars as pl

        return pl.DataFrame({"a": [1, 2, 3, 4, 5], "b": [10, 20, 30, 40, 50]})

    def test_row_count(self, polars_df):
        """Test that row_count returns the correct number of rows."""
        source = PolarsDataframeSource(polars_df)
        assert source.row_count == 5

    def test_schema(self, polars_df):
        """Test that schema returns the Arrow schema."""
        source = PolarsDataframeSource(polars_df)
        schema = source.schema

        assert isinstance(schema, pa.Schema)
        assert "a" in schema.names
        assert "b" in schema.names

    def test_sortable(self, polars_df):
        """Test that sortable returns True."""
        source = PolarsDataframeSource(polars_df)
        assert source.sortable is True

    def test_load_rows_basic(self, polars_df):
        """Test basic row loading without sorting."""
        source = PolarsDataframeSource(polars_df)

        # Load first 2 rows
        chunk_bytes = source.load_rows(offset=0, limit=2)
        assert isinstance(chunk_bytes, bytes)
        assert len(chunk_bytes) > 0

    @pytest.mark.require_integration
    def test_load_rows_with_sort_ascending(self):
        """Test row loading with ascending sort returns correctly ordered data."""
        import polars as pl

        df = pl.DataFrame({"a": [3, 1, 2], "b": [30, 10, 20]})
        source = PolarsDataframeSource(df)

        # Load all rows sorted by 'a' ascending
        chunk_bytes = source.load_rows(
            offset=0, limit=3, sort=SortConfig(column="a", ascending=True)
        )

        reader = pa.ipc.open_stream(chunk_bytes)
        table = reader.read_all()
        values = table.column("a").to_pylist()
        assert values == [1, 2, 3]

    @pytest.mark.require_integration
    def test_load_rows_with_sort_descending(self):
        """Test row loading with descending sort returns correctly ordered data."""
        import polars as pl

        df = pl.DataFrame({"a": [3, 1, 2], "b": [30, 10, 20]})
        source = PolarsDataframeSource(df)

        # Load all rows sorted by 'a' descending
        chunk_bytes = source.load_rows(
            offset=0, limit=3, sort=SortConfig(column="a", ascending=False)
        )

        reader = pa.ipc.open_stream(chunk_bytes)
        table = reader.read_all()
        values = table.column("a").to_pylist()
        assert values == [3, 2, 1]

    @pytest.mark.require_integration
    def test_load_rows_sort_with_offset(self):
        """Test row loading with sort and offset works correctly."""
        import polars as pl

        df = pl.DataFrame({"a": [5, 3, 1, 4, 2]})
        source = PolarsDataframeSource(df)

        # Load rows 1-3 (indices 1, 2) sorted ascending
        chunk_bytes = source.load_rows(
            offset=1, limit=2, sort=SortConfig(column="a", ascending=True)
        )

        reader = pa.ipc.open_stream(chunk_bytes)
        table = reader.read_all()
        values = table.column("a").to_pylist()
        # After sort: [1, 2, 3, 4, 5], take offset 1 with limit 2 -> [2, 3]
        assert values == [2, 3]


class TestCreateDataframeSource:
    """Tests for create_dataframe_source factory function."""

    def test_create_from_pandas(self):
        """Test creating source from pandas DataFrame."""
        import pandas as pd

        df = pd.DataFrame({"a": [1, 2, 3]})
        source = create_dataframe_source(df)
        assert isinstance(source, PandasDataframeSource)

    def test_create_from_polars(self):
        """Test creating source from Polars DataFrame."""
        pytest.importorskip("polars")
        import polars as pl

        df = pl.DataFrame({"a": [1, 2, 3]})
        source = create_dataframe_source(df)
        assert isinstance(source, PolarsDataframeSource)

    def test_create_from_unsupported_type(self):
        """Test that unsupported types raise TypeError."""
        with pytest.raises(TypeError):
            create_dataframe_source([1, 2, 3])  # type: ignore[arg-type]
