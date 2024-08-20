# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from __future__ import annotations

import enum
import unittest
from datetime import date
from decimal import Decimal
from typing import Any
from unittest.mock import patch

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest
from pandas.api.types import infer_dtype
from parameterized import parameterized

import streamlit as st
from streamlit import dataframe_util
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.data_mocks.snowpandas_mocks import DataFrame as SnowpandasDataFrame
from tests.streamlit.data_mocks.snowpandas_mocks import Index as SnowpandasIndex
from tests.streamlit.data_mocks.snowpandas_mocks import Series as SnowpandasSeries
from tests.streamlit.data_mocks.snowpark_mocks import DataFrame as SnowparkDataFrame
from tests.streamlit.data_mocks.snowpark_mocks import Row as SnowparkRow
from tests.streamlit.data_test_cases import (
    SHARED_TEST_CASES,
    CaseMetadata,
    TestObject,
)
from tests.testutil import create_snowpark_session, patch_config_options


class DataframeUtilTest(unittest.TestCase):
    def test_convert_pandas_df_to_arrow_bytes(self):
        df1 = pd.DataFrame(["foo", "bar"])
        df2 = pd.DataFrame(df1.dtypes)

        try:
            dataframe_util.convert_pandas_df_to_arrow_bytes(df2)
        except Exception as ex:
            self.fail(f"Converting dtype dataframes to Arrow should not fail: {ex}")

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_convert_anything_to_pandas_df(
        self,
        name: str,
        input_data: Any,
        metadata: CaseMetadata,
    ):
        """Test that `convert_anything_to_pandas_df` correctly converts
        a variety of types to a DataFrame.
        """
        converted_df = dataframe_util.convert_anything_to_pandas_df(input_data)
        self.assertIsInstance(converted_df, pd.DataFrame)
        self.assertEqual(converted_df.shape[0], metadata.expected_rows)
        self.assertEqual(converted_df.shape[1], metadata.expected_cols)

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_unevaluated_dataframe_handling(
        self,
        name: str,
        input_data: Any,
        metadata: CaseMetadata,
    ):
        """Test that unevaluated data objects are correctly detected and
        handled by limiting the number of rows to be displayed.
        """
        with patch("streamlit.dataframe_util._show_data_information") as mock:
            if metadata.is_unevaluated:
                assert dataframe_util.is_unevaluated_data_object(input_data) is True
                converted_df = dataframe_util.convert_anything_to_pandas_df(
                    input_data, max_unevaluated_rows=1
                )
                assert isinstance(converted_df, pd.DataFrame)
                assert converted_df.shape[0] <= 1
                mock.assert_called_once()
            else:
                assert dataframe_util.is_unevaluated_data_object(input_data) is False
                converted_df = dataframe_util.convert_anything_to_pandas_df(
                    input_data, max_unevaluated_rows=1
                )
                assert converted_df.shape[0] == metadata.expected_rows
                mock.assert_not_called()

    def test_convert_anything_to_pandas_df_ensure_copy(self):
        """Test that `convert_anything_to_pandas_df` creates a copy of the original
        dataframe if `ensure_copy` is True.
        """
        orginal_df = pd.DataFrame(
            {
                "integer": [1, 2, 3],
                "float": [1.0, 2.1, 3.2],
                "string": ["foo", "bar", None],
            },
            index=[1.0, "foo", 3],
        )

        converted_df = dataframe_util.convert_anything_to_pandas_df(
            orginal_df, ensure_copy=True
        )
        # Apply a change
        converted_df["integer"] = [4, 5, 6]
        # Ensure that the original dataframe is not changed
        self.assertEqual(orginal_df["integer"].to_list(), [1, 2, 3])

        converted_df = dataframe_util.convert_anything_to_pandas_df(
            orginal_df, ensure_copy=False
        )
        # Apply a change
        converted_df["integer"] = [4, 5, 6]
        # The original dataframe should be changed here since ensure_copy is False
        self.assertEqual(orginal_df["integer"].to_list(), [4, 5, 6])

    def test_convert_anything_to_pandas_df_supports_key_value_dicts(self):
        """Test that `convert_anything_to_pandas_df` correctly converts
        key-value dicts to a dataframe.
        """
        data = {"a": 1, "b": 2}
        df = dataframe_util.convert_anything_to_pandas_df(data)
        pd.testing.assert_frame_equal(
            df, pd.DataFrame.from_dict(data, orient="index", columns=["value"])
        )

    def test_convert_anything_to_pandas_df_converts_stylers(self):
        """Test that `convert_anything_to_pandas_df` correctly converts Stylers to DF,
        without cloning the data.
        """
        original_df = pd.DataFrame(
            {
                "integer": [1, 2, 3],
                "float": [1.0, 2.1, 3.2],
                "string": ["foo", "bar", None],
            },
            index=[1.0, "foo", 3],
        )

        original_styler = original_df.style.highlight_max(axis=0)

        out = dataframe_util.convert_anything_to_pandas_df(original_styler)
        self.assertNotEqual(id(original_styler), id(out))
        self.assertEqual(id(original_df), id(out))
        pd.testing.assert_frame_equal(original_df, out)

    def test_convert_anything_to_pandas_df_converts_stylers_and_clones_data(self):
        """Test that `convert_anything_to_pandas_df` correctly converts Stylers to DF, cloning the data."""
        original_df = pd.DataFrame(
            {
                "integer": [1, 2, 3],
                "float": [1.0, 2.1, 3.2],
                "string": ["foo", "bar", None],
            },
            index=[1.0, "foo", 3],
        )

        original_styler = original_df.style.highlight_max(axis=0)

        out = dataframe_util.convert_anything_to_pandas_df(
            original_styler, ensure_copy=True
        )
        self.assertNotEqual(id(original_styler), id(out))
        self.assertNotEqual(id(original_df), id(out))
        pd.testing.assert_frame_equal(original_df, out)

    def test_convert_anything_to_pandas_df_calls_to_pandas_when_available(self):
        class DataFrameIsh:
            def to_pandas(self):
                return pd.DataFrame([])

        converted = dataframe_util.convert_anything_to_pandas_df(DataFrameIsh())
        assert isinstance(converted, pd.DataFrame)
        assert converted.empty

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_convert_anything_to_arrow_bytes(
        self,
        name: str,
        input_data: Any,
        metadata: CaseMetadata,
    ):
        """Test that `convert_anything_to_arrow_bytes` correctly converts
        a variety of types to Arrow bytes.
        """
        converted_bytes = dataframe_util.convert_anything_to_arrow_bytes(input_data)
        self.assertIsInstance(converted_bytes, bytes)

        # Load bytes back into a DataFrame and check the shape.
        reconstructed_df = dataframe_util.convert_arrow_bytes_to_pandas_df(
            converted_bytes
        )
        self.assertEqual(reconstructed_df.shape[0], metadata.expected_rows)
        self.assertEqual(reconstructed_df.shape[1], metadata.expected_cols)

    @parameterized.expand(
        [
            # Complex numbers:
            (pd.Series([1 + 2j, 3 + 4j, 5 + 6 * 1j], dtype=np.complex64), True),
            (pd.Series([1 + 2j, 3 + 4j, 5 + 6 * 1j], dtype=np.complex128), True),
            # Mixed-integer types:
            (pd.Series([1, 2, "3"]), True),
            # Mixed:
            (pd.Series([1, 2.1, "3", True]), True),
            # Frozenset:
            (pd.Series([frozenset([1, 2]), frozenset([3, 4])]), True),
            # Dicts:
            (pd.Series([{"a": 1}, {"b": 2}]), True),
            # Complex types:
            (pd.Series([TestObject(), TestObject()]), True),
            # Supported types:
            (pd.Series([1, 2, 3]), False),
            (pd.Series([1, 2, 3.0]), False),
            (pd.Series(["foo", "bar"]), False),
            (pd.Series([True, False, None]), False),
            (pd.Series(["foo", "bar", None]), False),
            (pd.Series([[1, 2], [3, 4]]), False),
            (pd.Series(["a", "b", "c", "a"], dtype="category"), False),
            (pd.Series([date(2020, 1, 1), date(2020, 1, 2)]), False),
            (pd.Series([Decimal("1.1"), Decimal("2.2")]), False),
            (pd.Series([np.timedelta64(1, "D"), np.timedelta64(2, "D")]), False),
            (pd.Series([pd.Timedelta("1 days"), pd.Timedelta("2 days")]), False),
        ]
    )
    def test_is_colum_type_arrow_incompatible(
        self, column: pd.Series, incompatible: bool
    ):
        self.assertEqual(
            dataframe_util.is_colum_type_arrow_incompatible(column),
            incompatible,
            f"Expected {column} to be {'incompatible' if incompatible else 'compatible'} with Arrow.",
        )

    @parameterized.expand(
        [
            # Complex numbers:
            (pd.Series([1 + 2j, 3 + 4j, 5 + 6 * 1j]), True),
            # Mixed-integer types:
            (pd.Series([1, 2, "3"]), True),
            # Mixed:
            (pd.Series([1, 2.1, "3", True]), True),  # Frozenset:
            (pd.Series([frozenset([1, 2]), frozenset([3, 4])]), True),
            # Dicts:
            (pd.Series([{"a": 1}, {"b": 2}]), True),
            # Complex types:
            (pd.Series([TestObject(), TestObject()]), True),
            # Supported types:
            (pd.Series([1, 2, 3]), False),
            (pd.Series([1, 2, 3.0]), False),
            (pd.Series(["foo", "bar"]), False),
            (pd.Series([True, False, None]), False),
            (pd.Series(["foo", "bar", None]), False),
            (pd.Series([[1, 2], [3, 4]]), False),
            (pd.Series(["a", "b", "c", "a"], dtype="category"), False),
            (pd.Series([date(2020, 1, 1), date(2020, 1, 2)]), False),
            (pd.Series([Decimal("1.1"), Decimal("2.2")]), False),
            (pd.Series([pd.Timedelta("1 days"), pd.Timedelta("2 days")]), False),
            (pd.Series([np.timedelta64(1, "D"), np.timedelta64(2, "D")]), False),
        ]
    )
    def test_fix_arrow_incompatible_column_types(
        self, column: pd.Series, incompatible: bool
    ):
        """Test that `fix_arrow_incompatible_column_types` correctly fixes
        columns containing unsupported types by converting them to string and
        leaves supported columns unchanged.
        """
        df = pd.DataFrame({"c1": column})
        fixed_df = dataframe_util.fix_arrow_incompatible_column_types(df)
        col_dtype = fixed_df["c1"].dtype
        inferred_type = infer_dtype(fixed_df["c1"])

        if incompatible:
            # Column should have been converted to string.
            self.assertIsInstance(col_dtype, pd.StringDtype)
            self.assertEqual(inferred_type, "string")
        else:
            # Column should have the original type.
            self.assertEqual(col_dtype, df["c1"].dtype)
            self.assertEqual(inferred_type, infer_dtype(df["c1"]))

    def test_fix_no_columns(self):
        """Test that `fix_arrow_incompatible_column_types` does not
        modify a DataFrame if all columns are compatible with Arrow.
        """

        df = pd.DataFrame(
            {
                "integer": [1, 2, 3],
                "float": [1.1, 2.2, 3.3],
                "string": ["foo", "bar", None],
                "boolean": [True, False, None],
            }
        )

        fixed_df = dataframe_util.fix_arrow_incompatible_column_types(df)
        pd.testing.assert_frame_equal(df, fixed_df)

    def test_fix_mixed_column_types(self):
        """Test that `fix_arrow_incompatible_column_types` correctly fixes
        columns containing mixed types by converting them to string.
        """
        df = pd.DataFrame(
            {
                "mixed-integer": [1, "foo", 3],
                "mixed": [1.0, "foo", 3],
                "integer": [1, 2, 3],
                "float": [1.0, 2.1, 3.2],
                "string": ["foo", "bar", None],
            },
            index=[1.0, "foo", 3],
        )

        fixed_df = dataframe_util.fix_arrow_incompatible_column_types(df)

        # Check dtypes
        self.assertIsInstance(fixed_df["mixed-integer"].dtype, pd.StringDtype)
        self.assertIsInstance(fixed_df["mixed"].dtype, pd.StringDtype)
        self.assertTrue(pd.api.types.is_integer_dtype(fixed_df["integer"].dtype))
        self.assertTrue(pd.api.types.is_float_dtype(fixed_df["float"].dtype))
        self.assertTrue(pd.api.types.is_object_dtype(fixed_df["string"].dtype))
        self.assertEqual(fixed_df.index.dtype.kind, "O")

        # Check inferred types:
        self.assertEqual(infer_dtype(fixed_df["mixed-integer"]), "string")
        self.assertEqual(infer_dtype(fixed_df["mixed"]), "string")
        self.assertEqual(infer_dtype(fixed_df["integer"]), "integer")
        self.assertEqual(infer_dtype(fixed_df["float"]), "floating")
        self.assertEqual(infer_dtype(fixed_df["string"]), "string")
        self.assertEqual(infer_dtype(fixed_df.index), "string")

    def test_data_frame_with_unsupported_column_types(self):
        """Test that `data_frame_to_bytes` correctly handles dataframes
        with unsupported column types by converting those types to string.
        """
        df = pd.DataFrame(
            {
                "mixed-integer": [1, "foo", 3],
                "mixed": [1.0, "foo", 3],
                "complex": [1 + 2j, 3 + 4j, 5 + 6 * 1j],
                "integer": [1, 2, 3],
                "float": [1.0, 2.1, 3.2],
                "string": ["foo", "bar", None],
            },
            index=[1.0, "foo", 3],
        )

        try:
            dataframe_util.convert_pandas_df_to_arrow_bytes(df)
        except Exception as ex:
            self.fail(
                "No exception should have been thrown here. "
                f"Unsupported types of this dataframe should have been automatically fixed: {ex}"
            )

    def test_is_pandas_data_object(self):
        """Test that `is_pandas_data_object` correctly detects pandas data objects."""
        assert dataframe_util.is_pandas_data_object(pd.DataFrame()) is True
        assert dataframe_util.is_pandas_data_object(pd.Series()) is True
        assert dataframe_util.is_pandas_data_object(pd.Index(["a", "b"])) is True
        assert dataframe_util.is_pandas_data_object(pd.array(["a", "b"])) is True
        assert dataframe_util.is_pandas_data_object(["a", "b"]) is False

    def test_is_snowpandas_data_object(self):
        df = pd.DataFrame([1, 2, 3])

        self.assertFalse(dataframe_util.is_snowpandas_data_object(df))

        # Our mock objects should be detected as snowpandas data objects:
        self.assertTrue(
            dataframe_util.is_snowpandas_data_object(SnowpandasDataFrame(df))
        )
        self.assertTrue(dataframe_util.is_snowpandas_data_object(SnowpandasSeries(df)))
        self.assertTrue(dataframe_util.is_snowpandas_data_object(SnowpandasIndex(df)))

    def test_is_snowpark_row_list(self):
        class DummyClass:
            """DummyClass for testing purposes"""

        # empty list should not be snowpark dataframe
        self.assertFalse(dataframe_util.is_snowpark_row_list([]))

        # list with items should not be snowpark dataframe
        self.assertFalse(
            dataframe_util.is_snowpark_row_list(
                [
                    "any text",
                ]
            )
        )
        self.assertFalse(
            dataframe_util.is_snowpark_row_list(
                [
                    123,
                ]
            )
        )
        self.assertFalse(
            dataframe_util.is_snowpark_row_list(
                [
                    DummyClass(),
                ]
            )
        )

        # list with SnowparkRow should be SnowparkDataframe
        self.assertTrue(
            dataframe_util.is_snowpark_row_list(
                [
                    SnowparkRow({"col1": 1, "col2": "foo"}),
                    SnowparkRow({"col1": 2, "col2": "bar"}),
                ]
            )
        )

    def test_is_snowpark_dataframe(self):
        df = pd.DataFrame(
            {
                "mixed-integer": [1, "foo", 3],
                "mixed": [1.0, "foo", 3],
                "complex": [1 + 2j, 3 + 4j, 5 + 6 * 1j],
                "integer": [1, 2, 3],
                "float": [1.0, 2.1, 3.2],
                "string": ["foo", "bar", None],
            },
            index=[1.0, "foo", 3],
        )

        # pandas dataframe should not be SnowparkDataFrame
        self.assertFalse(dataframe_util.is_snowpark_data_object(df))

        # if snowflake.snowpark.dataframe.DataFrame def is_snowpark_data_object should return true
        self.assertTrue(dataframe_util.is_snowpark_data_object(SnowparkDataFrame(df)))

    def test_verify_sqlite3_integration(self):
        """Verify that sqlite3 cursor can be used as a data source."""
        import sqlite3

        con = sqlite3.connect("file::memory:")
        cur = con.cursor()
        cur.execute("CREATE TABLE movie(title, year, score)")
        cur.execute("""
            INSERT INTO movie VALUES
                ('Monty Python and the Holy Grail', 1975, 8.2),
                ('And Now for Something Completely Different', 1971, 7.5)
        """)
        con.commit()
        db_cursor = cur.execute("SELECT * FROM movie")
        assert dataframe_util.is_dbapi_cursor(db_cursor) is True
        assert (
            dataframe_util.determine_data_format(db_cursor)
            is dataframe_util.DataFormat.DBAPI_CURSOR
        )
        converted_df = dataframe_util.convert_anything_to_pandas_df(db_cursor)
        assert isinstance(
            converted_df,
            pd.DataFrame,
        )
        assert converted_df.shape == (2, 3)
        con.close()

    @pytest.mark.require_integration
    def test_verify_duckdb_db_api_integration(self):
        """Test that duckdb cursor can be used as a data source.

        https://duckdb.org/docs/api/python/dbapi
        """
        import duckdb

        con = duckdb.connect(database=":memory:")
        con.execute(
            "CREATE TABLE items (item VARCHAR, value DECIMAL(10, 2), count INTEGER)"
        )
        con.execute("INSERT INTO items VALUES ('jeans', 20.0, 1), ('hammer', 42.2, 2)")
        con.execute("SELECT * FROM items")

        assert dataframe_util.is_dbapi_cursor(con) is True
        assert (
            dataframe_util.determine_data_format(con)
            is dataframe_util.DataFormat.DBAPI_CURSOR
        )
        converted_df = dataframe_util.convert_anything_to_pandas_df(con)
        assert isinstance(
            converted_df,
            pd.DataFrame,
        )
        assert converted_df.shape == (2, 3)
        con.close()

    @pytest.mark.require_integration
    def test_verify_duckdb_relational_api_integration(self):
        """Test that duckdb relational API can be used as a data source.

        https://duckdb.org/docs/api/python/relational_api
        """
        import duckdb

        items = pd.DataFrame([["foo", 1], ["bar", 2]], columns=["name", "value"])
        db_relation = duckdb.sql("SELECT * from items")
        assert dataframe_util.is_duckdb_relation(db_relation) is True
        assert (
            dataframe_util.determine_data_format(db_relation)
            is dataframe_util.DataFormat.DUCKDB_RELATION
        )
        converted_df = dataframe_util.convert_anything_to_pandas_df(db_relation)
        assert isinstance(
            converted_df,
            pd.DataFrame,
        )
        assert converted_df.shape == items.shape

    @pytest.mark.require_integration
    def test_verify_snowpark_integration(self):
        """Integration test snowpark object handling.
        This is in addition to the tests using the mocks to verify that
        the latest version of the library is still supported.
        """
        with create_snowpark_session() as snowpark_session:
            snowpark_df = snowpark_session.sql("SELECT 40+2 as COL1")

            assert dataframe_util.is_snowpark_data_object(snowpark_df) is True
            assert isinstance(
                dataframe_util.convert_anything_to_pandas_df(snowpark_df),
                pd.DataFrame,
            )

            snowpark_cached_result = snowpark_session.sql(
                "SELECT 40+2 as COL1"
            ).cache_result()
            assert (
                dataframe_util.is_snowpark_data_object(snowpark_cached_result) is True
            )
            assert isinstance(
                dataframe_util.convert_anything_to_pandas_df(snowpark_cached_result),
                pd.DataFrame,
            )

            snowpark_row_list = snowpark_session.sql("SELECT 40+2 as COL1").collect()
            assert dataframe_util.is_snowpark_row_list(snowpark_row_list) is True
            assert isinstance(
                dataframe_util.convert_anything_to_pandas_df(snowpark_row_list),
                pd.DataFrame,
            )

    @pytest.mark.require_integration
    def test_verify_snowpandas_integration(self):
        """Integration test snowpark pandas object handling.
        This is in addition to the tests using the mocks to verify that
        the latest version of the library is still supported.
        """
        import modin.pandas as modin_pd

        # Import the Snowpark pandas plugin for modin.
        import snowflake.snowpark.modin.plugin  # noqa: F401

        with create_snowpark_session():
            snowpandas_df = modin_pd.DataFrame([1, 2, 3], columns=["col1"])
            assert dataframe_util.is_snowpandas_data_object(snowpandas_df) is True
            assert isinstance(
                dataframe_util.convert_anything_to_pandas_df(snowpandas_df),
                pd.DataFrame,
            )

            snowpandas_series = snowpandas_df["col1"]
            assert dataframe_util.is_snowpandas_data_object(snowpandas_series) is True
            assert isinstance(
                dataframe_util.convert_anything_to_pandas_df(snowpandas_series),
                pd.DataFrame,
            )

            snowpandas_index = snowpandas_df.index
            assert dataframe_util.is_snowpandas_data_object(snowpandas_index) is True
            assert isinstance(
                dataframe_util.convert_anything_to_pandas_df(snowpandas_index),
                pd.DataFrame,
            )

    @pytest.mark.require_integration
    def test_verify_dask_integration(self):
        """Integration test dask object handling.

        This is in addition to the tests using the mocks to verify that
        the latest version of the library is still supported.
        """
        import dask

        dask_df = dask.datasets.timeseries()

        assert dataframe_util.is_dask_object(dask_df) is True
        assert isinstance(
            dataframe_util.convert_anything_to_pandas_df(dask_df),
            pd.DataFrame,
        )

        dask_series = dask_df["x"]
        assert dataframe_util.is_dask_object(dask_series) is True
        assert isinstance(
            dataframe_util.convert_anything_to_pandas_df(dask_series),
            pd.DataFrame,
        )

        dask_index = dask_df.index
        assert dataframe_util.is_dask_object(dask_index) is True
        assert isinstance(
            dataframe_util.convert_anything_to_pandas_df(dask_index),
            pd.DataFrame,
        )

    @pytest.mark.require_integration
    def test_verify_ray_integration(self):
        """Integration test ray object handling.

        This is in addition to the tests using the mocks to verify that
        the latest version of the library is still supported.
        """
        import ray

        df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
        ray_dataset = ray.data.from_pandas(df)

        assert dataframe_util.is_ray_dataset(ray_dataset) is True
        assert isinstance(
            dataframe_util.convert_anything_to_pandas_df(ray_dataset),
            pd.DataFrame,
        )

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_determine_data_format(
        self,
        name: str,
        input_data: Any,
        metadata: CaseMetadata,
    ):
        """Test that `determine_data_format` correctly determines the
        data format of a variety of data structures/types.
        """
        data_format = dataframe_util.determine_data_format(input_data)
        self.assertEqual(
            data_format,
            metadata.expected_data_format,
            f"{str(input_data)} is expected to be {metadata.expected_data_format} but was {data_format}.",
        )

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_convert_pandas_df_to_data_format(
        self,
        name: str,
        input_data: Any,
        metadata: CaseMetadata,
    ):
        """Test that `convert_pandas_df_to_data_format` correctly converts a
        DataFrame to the specified data format.
        """
        converted_df = dataframe_util.convert_anything_to_pandas_df(input_data)
        self.assertEqual(converted_df.shape[0], metadata.expected_rows)
        self.assertEqual(converted_df.shape[1], metadata.expected_cols)

        if metadata.expected_data_format == dataframe_util.DataFormat.UNKNOWN:
            with self.assertRaises(ValueError):
                dataframe_util.convert_pandas_df_to_data_format(
                    converted_df, metadata.expected_data_format
                )
            # We don't have to do any other tests for unknown data formats.
        else:
            converted_data = dataframe_util.convert_pandas_df_to_data_format(
                converted_df, metadata.expected_data_format
            )

            self.assertEqual(
                type(converted_data),
                type(input_data)
                if metadata.expected_type is None
                else metadata.expected_type,
            )

            if isinstance(converted_data, pd.DataFrame):
                self.assertEqual(converted_data.shape[0], metadata.expected_rows)
                self.assertEqual(converted_data.shape[1], metadata.expected_cols)
            elif (
                # Sets in python are unordered, so we can't compare them this way.
                metadata.expected_data_format != dataframe_util.DataFormat.SET_OF_VALUES
                and metadata.expected_type is None
            ):
                self.assertEqual(str(converted_data), str(input_data))
                pd.testing.assert_frame_equal(
                    converted_df,
                    dataframe_util.convert_anything_to_pandas_df(converted_data),
                )

    def test_convert_pandas_df_to_data_format_with_unknown_data_format(self):
        """Test that `convert_df_to_data_format` raises a ValueError when
        passed an unknown data format.
        """
        with self.assertRaises(ValueError):
            dataframe_util.convert_pandas_df_to_data_format(
                pd.DataFrame({"a": [1, 2, 3]}), dataframe_util.DataFormat.UNKNOWN
            )

    def test_convert_df_with_missing_values(self):
        """Test that `convert_df_to_data_format` correctly converts
        all types of missing values to None.
        """

        # Add dataframe with different missing values:
        df = pd.DataFrame(
            {
                "missing": [None, pd.NA, np.nan, pd.NaT],
            }
        )

        self.assertEqual(
            dataframe_util.convert_pandas_df_to_data_format(
                df, dataframe_util.DataFormat.LIST_OF_VALUES
            ),
            [None, None, None, None],
        )
        self.assertEqual(
            dataframe_util.convert_pandas_df_to_data_format(
                df, dataframe_util.DataFormat.TUPLE_OF_VALUES
            ),
            (None, None, None, None),
        )
        self.assertEqual(
            dataframe_util.convert_pandas_df_to_data_format(
                df, dataframe_util.DataFormat.SET_OF_VALUES
            ),
            {None},
        )
        self.assertEqual(
            dataframe_util.convert_pandas_df_to_data_format(
                df, dataframe_util.DataFormat.LIST_OF_ROWS
            ),
            [
                [None],
                [None],
                [None],
                [None],
            ],
        )
        self.assertEqual(
            dataframe_util.convert_pandas_df_to_data_format(
                df, dataframe_util.DataFormat.LIST_OF_RECORDS
            ),
            [
                {"missing": None},
                {"missing": None},
                {"missing": None},
                {"missing": None},
            ],
        )
        self.assertEqual(
            dataframe_util.convert_pandas_df_to_data_format(
                df, dataframe_util.DataFormat.COLUMN_VALUE_MAPPING
            ),
            {
                "missing": [None, None, None, None],
            },
        )
        self.assertEqual(
            dataframe_util.convert_pandas_df_to_data_format(
                df, dataframe_util.DataFormat.COLUMN_INDEX_MAPPING
            ),
            {"missing": {0: None, 1: None, 2: None, 3: None}},
        )
        self.assertEqual(
            dataframe_util.convert_pandas_df_to_data_format(
                df, dataframe_util.DataFormat.KEY_VALUE_DICT
            ),
            {0: None, 1: None, 2: None, 3: None},
        )

    def test_convert_anything_to_sequence_object_is_indexable(self):
        l1 = ["a", "b", "c"]
        l2 = dataframe_util.convert_anything_to_list(l1)

        # Assert that l1 was shallow copied into l2.
        self.assertFalse(l1 is l2)
        self.assertEqual(l1, l2)

    def test_convert_anything_to_sequence_object_not_indexable(self):
        converted_list = dataframe_util.convert_anything_to_list({"a", "b", "c"})
        self.assertIn("a", converted_list)
        self.assertIn("b", converted_list)
        self.assertIn("c", converted_list)

    def test_convert_anything_to_sequence_enum_is_indexable(self):
        """Test Enums are indexable"""

        class Opt(enum.Enum):
            OPT1 = 1
            OPT2 = 2

        class StrOpt(str, enum.Enum):
            OPT1 = "a"
            OPT2 = "b"

        converted_list = dataframe_util.convert_anything_to_list(Opt)
        self.assertEqual(list(Opt), converted_list)

        converted_list = dataframe_util.convert_anything_to_list(StrOpt)
        self.assertEqual(list(StrOpt), converted_list)

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_convert_anything_to_sequence(
        self,
        name: str,
        input_data: Any,
        metadata: CaseMetadata,
    ):
        """Test that `convert_anything_to_sequence` correctly converts
        a variety of types to a sequence.
        """
        converted_sequence = dataframe_util.convert_anything_to_list(input_data)

        # We convert to a set for the check since some of the formats don't
        # have a guaranteed order.
        assert {str(item) for item in converted_sequence} == {
            str(item) for item in metadata.expected_sequence
        }
        # Check that it is a new object and not the same as the input:
        assert converted_sequence is not input_data


class TestArrowTruncation(DeltaGeneratorTestCase):
    """Test class for the automatic arrow truncation feature."""

    @patch_config_options(
        {"server.maxMessageSize": 3, "server.enableArrowTruncation": True}
    )
    def test_truncate_larger_table(self):
        """Test that `_maybe_truncate_table` correctly truncates a table that is
        larger than the max message size.
        """
        col_data = list(range(200000))
        original_df = pd.DataFrame(
            {
                "col 1": col_data,
                "col 2": col_data,
                "col 3": col_data,
            }
        )

        original_table = pa.Table.from_pandas(original_df)
        truncated_table = dataframe_util._maybe_truncate_table(
            pa.Table.from_pandas(original_df)
        )
        # Should be under the configured 3MB limit:
        self.assertLess(truncated_table.nbytes, 3 * int(1e6))

        # Test that the table should have been truncated
        self.assertLess(truncated_table.nbytes, original_table.nbytes)
        self.assertLess(truncated_table.num_rows, original_table.num_rows)

        # Test that it prints out a caption test:
        el = self.get_delta_from_queue().new_element
        self.assertIn("due to data size limitations", el.markdown.body)
        self.assertTrue(el.markdown.is_caption)

    @patch_config_options(
        {"server.maxMessageSize": 3, "server.enableArrowTruncation": True}
    )
    def test_dont_truncate_smaller_table(self):
        """Test that `_maybe_truncate_table` doesn't truncate smaller tables."""
        col_data = list(range(100))
        original_df = pd.DataFrame(
            {
                "col 1": col_data,
                "col 2": col_data,
                "col 3": col_data,
            }
        )

        original_table = pa.Table.from_pandas(original_df)
        truncated_table = dataframe_util._maybe_truncate_table(
            pa.Table.from_pandas(original_df)
        )

        # Test that the tables are the same:
        self.assertEqual(truncated_table.nbytes, original_table.nbytes)
        self.assertEqual(truncated_table.num_rows, original_table.num_rows)

    @patch_config_options({"server.enableArrowTruncation": False})
    def test_dont_truncate_if_deactivated(self):
        """Test that `_maybe_truncate_table` doesn't do anything
        when server.enableArrowTruncation is decatived
        """
        col_data = list(range(200000))
        original_df = pd.DataFrame(
            {
                "col 1": col_data,
                "col 2": col_data,
                "col 3": col_data,
            }
        )

        original_table = pa.Table.from_pandas(original_df)
        truncated_table = dataframe_util._maybe_truncate_table(
            pa.Table.from_pandas(original_df)
        )

        # Test that the tables are the same:
        self.assertEqual(truncated_table.nbytes, original_table.nbytes)
        self.assertEqual(truncated_table.num_rows, original_table.num_rows)

    @patch_config_options(
        {"server.maxMessageSize": 3, "server.enableArrowTruncation": True}
    )
    def test_st_dataframe_truncates_data(self):
        """Test that `st.dataframe` truncates the data if server.enableArrowTruncation==True."""
        col_data = list(range(200000))
        original_df = pd.DataFrame(
            {
                "col 1": col_data,
                "col 2": col_data,
                "col 3": col_data,
            }
        )
        original_table = pa.Table.from_pandas(original_df)
        st.dataframe(original_df)
        el = self.get_delta_from_queue().new_element
        # Test that table bytes should be smaller than the full table
        self.assertLess(len(el.arrow_data_frame.data), original_table.nbytes)
        # Should be under the configured 3MB limit:
        self.assertLess(len(el.arrow_data_frame.data), 3 * int(1e6))

        # Test that it prints out a caption test:
        el = self.get_delta_from_queue(-2).new_element
        self.assertIn("due to data size limitations", el.markdown.body)
        self.assertTrue(el.markdown.is_caption)
