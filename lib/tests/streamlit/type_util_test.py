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

import enum
import unittest
from collections import namedtuple
from datetime import date
from decimal import Decimal
from typing import Any
from unittest.mock import patch

import numpy as np
import pandas as pd
import plotly.graph_objs as go
import pytest
from pandas.api.types import infer_dtype
from parameterized import parameterized

from streamlit import errors, type_util
from streamlit.errors import StreamlitAPIException
from tests.streamlit.data_mocks import (
    BASE_TYPES_DF,
    DATETIME_TYPES_DF,
    INTERVAL_TYPES_DF,
    LIST_TYPES_DF,
    NUMBER_TYPES_DF,
    PERIOD_TYPES_DF,
    SHARED_TEST_CASES,
    SPECIAL_TYPES_DF,
    UNSUPPORTED_TYPES_DF,
    TestCaseMetadata,
    TestObject,
)
from tests.streamlit.snowpark_mocks import DataFrame as SnowparkDataFrame
from tests.streamlit.snowpark_mocks import Row as SnowparkRow
from tests.testutil import create_snowpark_session, patch_config_options


class TypeUtilTest(unittest.TestCase):
    def test_list_is_plotly_chart(self):
        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])
        data = [trace0, trace1]

        res = type_util.is_plotly_chart(data)
        self.assertTrue(res)

    def test_data_dict_is_plotly_chart(self):
        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])
        d = {"data": [trace0, trace1]}

        res = type_util.is_plotly_chart(d)
        self.assertTrue(res)

    def test_dirty_data_dict_is_not_plotly_chart(self):
        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])
        d = {"data": [trace0, trace1], "foo": "bar"}  # Illegal property!

        res = type_util.is_plotly_chart(d)
        self.assertFalse(res)

    def test_layout_dict_is_not_plotly_chart(self):
        d = {
            # Missing a component with a graph object!
            "layout": {"width": 1000}
        }

        res = type_util.is_plotly_chart(d)
        self.assertFalse(res)

    def test_fig_is_plotly_chart(self):
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])

        # Plotly 3.7 needs to read the config file at /home/.plotly when
        # creating an image. So let's mock that part of the Figure creation:
        with patch("plotly.offline.offline._get_jconfig") as mock:
            mock.return_value = {}
            fig = go.Figure(data=[trace1])

        res = type_util.is_plotly_chart(fig)
        self.assertTrue(res)

    def test_is_namedtuple(self):
        Boy = namedtuple("Boy", ("name", "age"))
        John = Boy("John", "29")

        res = type_util.is_namedtuple(John)
        self.assertTrue(res)

    def test_to_bytes(self):
        bytes_obj = b"some bytes"
        self.assertTrue(type_util.is_bytes_like(bytes_obj))
        self.assertIsInstance(type_util.to_bytes(bytes_obj), bytes)

        bytearray_obj = bytearray("a bytearray string", "utf-8")
        self.assertTrue(type_util.is_bytes_like(bytearray_obj))
        self.assertIsInstance(type_util.to_bytes(bytearray_obj), bytes)

        string_obj = "a normal string"
        self.assertFalse(type_util.is_bytes_like(string_obj))
        with self.assertRaises(RuntimeError):
            type_util.to_bytes(string_obj)  # type: ignore

    def test_data_frame_with_dtype_values_to_bytes(self):
        df1 = pd.DataFrame(["foo", "bar"])
        df2 = pd.DataFrame(df1.dtypes)

        try:
            type_util.data_frame_to_bytes(df2)
        except Exception as ex:
            self.fail(f"Converting dtype dataframes to Arrow should not fail: {ex}")

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_convert_anything_to_df(
        self,
        input_data: Any,
        metadata: TestCaseMetadata,
    ):
        """Test that `convert_anything_to_df` correctly converts
        a variety of types to a DataFrame.
        """
        converted_df = type_util.convert_anything_to_df(input_data)
        self.assertEqual(converted_df.shape[0], metadata.expected_rows)
        self.assertEqual(converted_df.shape[1], metadata.expected_cols)

    def test_convert_anything_to_df_ensure_copy(self):
        """Test that `convert_anything_to_df` creates a copy of the original
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

        converted_df = type_util.convert_anything_to_df(orginal_df, ensure_copy=True)
        # Apply a change
        converted_df["integer"] = [4, 5, 6]
        # Ensure that the original dataframe is not changed
        self.assertEqual(orginal_df["integer"].to_list(), [1, 2, 3])

        converted_df = type_util.convert_anything_to_df(orginal_df, ensure_copy=False)
        # Apply a change
        converted_df["integer"] = [4, 5, 6]
        # The original dataframe should be changed here since ensure_copy is False
        self.assertEqual(orginal_df["integer"].to_list(), [4, 5, 6])

    def test_convert_anything_to_df_supports_key_value_dicts(self):
        """Test that `convert_anything_to_df` correctly converts
        key-value dicts to a dataframe.
        """
        data = {"a": 1, "b": 2}
        df = type_util.convert_anything_to_df(data)
        pd.testing.assert_frame_equal(df, pd.DataFrame.from_dict(data, orient="index"))

    def test_convert_anything_to_df_passes_styler_through(self):
        """Test that `convert_anything_to_df` correctly passes Stylers through."""
        original_df = pd.DataFrame(
            {
                "integer": [1, 2, 3],
                "float": [1.0, 2.1, 3.2],
                "string": ["foo", "bar", None],
            },
            index=[1.0, "foo", 3],
        )

        original_styler = original_df.style.highlight_max(axis=0)

        out = type_util.convert_anything_to_df(original_styler, allow_styler=True)
        self.assertEqual(original_styler, out)
        self.assertEqual(id(original_df), id(out.data))

    def test_convert_anything_to_df_clones_stylers(self):
        """Test that `convert_anything_to_df` correctly clones Stylers."""
        original_df = pd.DataFrame(
            {
                "integer": [1, 2, 3],
                "float": [1.0, 2.1, 3.2],
                "string": ["foo", "bar", None],
            },
            index=[1.0, "foo", 3],
        )

        original_styler = original_df.style.highlight_max(axis=0)

        out = type_util.convert_anything_to_df(
            original_styler, allow_styler=True, ensure_copy=True
        )
        self.assertNotEqual(original_styler, out)
        self.assertNotEqual(id(original_df), id(out.data))
        pd.testing.assert_frame_equal(original_df, out.data)

    def test_convert_anything_to_df_converts_stylers(self):
        """Test that `convert_anything_to_df` correctly converts Stylers to DF, without cloning the
        data.
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

        out = type_util.convert_anything_to_df(original_styler, allow_styler=False)
        self.assertNotEqual(id(original_styler), id(out))
        self.assertEqual(id(original_df), id(out))
        pd.testing.assert_frame_equal(original_df, out)

    def test_convert_anything_to_df_converts_stylers_and_clones_data(self):
        """Test that `convert_anything_to_df` correctly converts Stylers to DF, cloning the data."""
        original_df = pd.DataFrame(
            {
                "integer": [1, 2, 3],
                "float": [1.0, 2.1, 3.2],
                "string": ["foo", "bar", None],
            },
            index=[1.0, "foo", 3],
        )

        original_styler = original_df.style.highlight_max(axis=0)

        out = type_util.convert_anything_to_df(
            original_styler, allow_styler=False, ensure_copy=True
        )
        self.assertNotEqual(id(original_styler), id(out))
        self.assertNotEqual(id(original_df), id(out))
        pd.testing.assert_frame_equal(original_df, out)

    @parameterized.expand(
        [
            ([1, 2, 3],),
            (["foo", "bar", "baz"],),
            (np.array([1, 2, 3, 4]),),
            (pd.Series([1, 2, 3]),),
        ]
    )
    def test_check_python_comparable(self, sequence):
        """Test that `check_python_comparable` not raises exception
        when elements of sequence returns bool when compared."""

        # Just check that it should not raise any exception
        type_util.check_python_comparable(sequence)

    @parameterized.expand(
        [
            (np.array([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]), "ndarray"),
            ([pd.Series([1, 2, 3]), pd.Series([4, 5, 6])], "Series"),
        ]
    )
    def test_check_python_comparable_exception(self, sequence, type_str):
        """Test that `check_python_comparable` raises an exception if ndarray."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            type_util.check_python_comparable(sequence)
        self.assertEqual(
            (
                "Invalid option type provided. Options must be comparable, returning a "
                f"boolean when used with *==*. \n\nGot **{type_str}**, which cannot be "
                "compared. Refactor your code to use elements of comparable types as "
                "options, e.g. use indices instead."
            ),
            str(exception_message.value),
        )

    def test_convert_anything_to_df_calls_to_pandas_when_available(self):
        class DataFrameIsh:
            def to_pandas(self):
                return pd.DataFrame([])

        converted = type_util.convert_anything_to_df(DataFrameIsh())
        assert isinstance(converted, pd.DataFrame)
        assert converted.empty

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
            type_util.is_colum_type_arrow_incompatible(column),
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
        fixed_df = type_util.fix_arrow_incompatible_column_types(df)
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

        fixed_df = type_util.fix_arrow_incompatible_column_types(df)
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

        fixed_df = type_util.fix_arrow_incompatible_column_types(df)

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
            type_util.data_frame_to_bytes(df)
        except Exception as ex:
            self.fail(
                "No exception should have been thrown here. "
                f"Unsupported types of this dataframe should have been automatically fixed: {ex}"
            )

    @parameterized.expand(
        [
            (BASE_TYPES_DF,),
            (DATETIME_TYPES_DF,),
            (INTERVAL_TYPES_DF,),
            (LIST_TYPES_DF,),
            (PERIOD_TYPES_DF,),
            (NUMBER_TYPES_DF,),
            (SPECIAL_TYPES_DF,),
            (UNSUPPORTED_TYPES_DF,),
        ]
    )
    def test_data_frame_to_bytes(
        self,
        input_df: pd.DataFrame,
    ):
        """Test that `data_frame_to_bytes` correctly converts
        DataFrames with a variety of types to Arrow.
        """
        try:
            type_util.data_frame_to_bytes(input_df)
        except Exception as ex:
            self.fail(
                "No exception should have been thrown here. "
                f"Unsupported types of this dataframe should have been automatically fixed: {ex}"
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
        self.assertFalse(type_util.is_snowpark_data_object(df))

        # if snowflake.snowpark.dataframe.DataFrame def is_snowpark_data_object should return true
        self.assertTrue(type_util.is_snowpark_data_object(SnowparkDataFrame()))

        # any object should not be snowpark dataframe
        self.assertFalse(type_util.is_snowpark_data_object("any text"))
        self.assertFalse(type_util.is_snowpark_data_object(123))

        class DummyClass:
            """DummyClass for testing purposes"""

        self.assertFalse(type_util.is_snowpark_data_object(DummyClass()))

        # empty list should not be snowpark dataframe
        self.assertFalse(type_util.is_snowpark_data_object(list()))

        # list with items should not be snowpark dataframe
        self.assertFalse(
            type_util.is_snowpark_data_object(
                [
                    "any text",
                ]
            )
        )
        self.assertFalse(
            type_util.is_snowpark_data_object(
                [
                    123,
                ]
            )
        )
        self.assertFalse(
            type_util.is_snowpark_data_object(
                [
                    DummyClass(),
                ]
            )
        )
        self.assertFalse(
            type_util.is_snowpark_data_object(
                [
                    df,
                ]
            )
        )

        # list with SnowparkRow should be SnowparkDataframe
        self.assertTrue(
            type_util.is_snowpark_data_object(
                [
                    SnowparkRow(),
                ]
            )
        )

    @pytest.mark.require_snowflake
    def test_is_snowpark_dataframe_integration(self):
        with create_snowpark_session() as snowpark_session:
            self.assertTrue(
                type_util.is_snowpark_data_object(
                    snowpark_session.sql("SELECT 40+2 as COL1")
                )
            )
            self.assertTrue(
                type_util.is_snowpark_data_object(
                    snowpark_session.sql("SELECT 40+2 as COL1").collect()
                )
            )
            self.assertTrue(
                type_util.is_snowpark_data_object(
                    snowpark_session.sql("SELECT 40+2 as COL1").cache_result()
                )
            )

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_determine_data_format(
        self,
        input_data: Any,
        metadata: TestCaseMetadata,
    ):
        """Test that `determine_data_format` correctly determines the
        data format of a variety of data structures/types.
        """
        data_format = type_util.determine_data_format(input_data)
        self.assertEqual(
            data_format,
            metadata.expected_data_format,
            f"{str(input_data)} is expected to be {metadata.expected_data_format} but was {data_format}.",
        )

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_convert_df_to_data_format(
        self,
        input_data: Any,
        metadata: TestCaseMetadata,
    ):
        """Test that `convert_df_to_data_format` correctly converts a
        DataFrame to the specified data format.
        """
        converted_df = type_util.convert_anything_to_df(input_data)
        self.assertEqual(converted_df.shape[0], metadata.expected_rows)
        self.assertEqual(converted_df.shape[1], metadata.expected_cols)

        if metadata.expected_data_format == type_util.DataFormat.UNKNOWN:
            with self.assertRaises(ValueError):
                type_util.convert_df_to_data_format(
                    converted_df, metadata.expected_data_format
                )
            # We don't have to do any other tests for unknown data formats.
        else:
            converted_data = type_util.convert_df_to_data_format(
                converted_df, metadata.expected_data_format
            )

            # Some data formats are converted to DataFrames instead of
            # the original data type/structure.
            if metadata.expected_data_format in [
                type_util.DataFormat.SNOWPARK_OBJECT,
                type_util.DataFormat.PYSPARK_OBJECT,
                type_util.DataFormat.PANDAS_INDEX,
                type_util.DataFormat.PANDAS_STYLER,
                type_util.DataFormat.EMPTY,
            ]:
                assert isinstance(converted_data, pd.DataFrame)
                self.assertEqual(converted_data.shape[0], metadata.expected_rows)
                self.assertEqual(converted_data.shape[1], metadata.expected_cols)
            else:
                self.assertEqual(type(converted_data), type(input_data))
                # Sets in python are unordered, so we can't compare them this way.
                if metadata.expected_data_format != type_util.DataFormat.SET_OF_VALUES:
                    self.assertEqual(str(converted_data), str(input_data))
                    pd.testing.assert_frame_equal(
                        converted_df, type_util.convert_anything_to_df(converted_data)
                    )

    def test_convert_df_to_data_format_with_unknown_data_format(self):
        """Test that `convert_df_to_data_format` raises a ValueError when
        passed an unknown data format.
        """
        with self.assertRaises(ValueError):
            type_util.convert_df_to_data_format(
                pd.DataFrame({"a": [1, 2, 3]}), type_util.DataFormat.UNKNOWN
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
            type_util.convert_df_to_data_format(
                df, type_util.DataFormat.LIST_OF_VALUES
            ),
            [None, None, None, None],
        )
        self.assertEqual(
            type_util.convert_df_to_data_format(
                df, type_util.DataFormat.TUPLE_OF_VALUES
            ),
            (None, None, None, None),
        )
        self.assertEqual(
            type_util.convert_df_to_data_format(df, type_util.DataFormat.SET_OF_VALUES),
            {None},
        )
        self.assertEqual(
            type_util.convert_df_to_data_format(df, type_util.DataFormat.LIST_OF_ROWS),
            [
                [None],
                [None],
                [None],
                [None],
            ],
        )
        self.assertEqual(
            type_util.convert_df_to_data_format(
                df, type_util.DataFormat.LIST_OF_RECORDS
            ),
            [
                {"missing": None},
                {"missing": None},
                {"missing": None},
                {"missing": None},
            ],
        )
        self.assertEqual(
            type_util.convert_df_to_data_format(
                df, type_util.DataFormat.COLUMN_VALUE_MAPPING
            ),
            {
                "missing": [None, None, None, None],
            },
        )
        self.assertEqual(
            type_util.convert_df_to_data_format(
                df, type_util.DataFormat.COLUMN_INDEX_MAPPING
            ),
            {"missing": {0: None, 1: None, 2: None, 3: None}},
        )
        self.assertEqual(
            type_util.convert_df_to_data_format(
                df, type_util.DataFormat.KEY_VALUE_DICT
            ),
            {0: None, 1: None, 2: None, 3: None},
        )


class TestEnumCoercion:
    """Test class for Enum Coercion feature."""

    @pytest.fixture
    def EnumAOrig(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()

        EnumA.__qualname__ = "__main__.EnumA"
        return EnumA

    @pytest.fixture
    def EnumAEqual(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()

        EnumA.__qualname__ = "__main__.EnumA"
        return EnumA

    @pytest.fixture
    def EnumADiffMembers(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            D = enum.auto()

        EnumA.__qualname__ = "__main__.EnumA"
        return EnumA

    @pytest.fixture
    def EnumADiffValues(self):
        class EnumA(enum.Enum):
            A = "1"
            B = "2"
            C = "3"

        EnumA.__qualname__ = "__main__.EnumA"
        return EnumA

    @pytest.fixture
    def EnumAExtraMembers(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()
            D = enum.auto()

        EnumA.__qualname__ = "__main__.EnumA"
        return EnumA

    @pytest.fixture
    def EnumADiffQualname(self):
        class EnumA(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()

        EnumA.__qualname__ = "foobar.EnumA"
        return EnumA

    @pytest.fixture
    def EnumB(self):
        class EnumB(enum.Enum):
            A = enum.auto()
            B = enum.auto()
            C = enum.auto()

        EnumB.__qualname__ = "__main__.EnumB"
        return EnumB

    def test_enum_uniqueness(
        self,
        EnumAOrig,
        EnumAEqual,
        EnumADiffMembers,
        EnumADiffValues,
        EnumADiffQualname,
        EnumB,
        EnumAExtraMembers,
    ):
        """A preliminary check, to ensure testing the others makes sense."""
        assert all(
            EnumAOrig.A not in enum
            for enum in (
                EnumAEqual,
                EnumADiffMembers,
                EnumADiffValues,
                EnumADiffQualname,
                EnumAExtraMembers,
                EnumB,
            )
        )
        assert EnumAOrig.A.value == EnumAEqual.A.value
        assert EnumAOrig.__qualname__ == EnumAEqual.__qualname__

    def test_coerce_enum_coercable(
        self,
        EnumAOrig,
        EnumAEqual,
        EnumADiffValues,
    ):
        assert type_util.coerce_enum(EnumAOrig.A, EnumAEqual) is EnumAEqual.A
        # Different values are coercable by default
        assert type_util.coerce_enum(EnumAOrig.A, EnumADiffValues) is EnumADiffValues.A

    def test_coerce_enum_not_coercable(
        self,
        EnumAOrig,
        EnumADiffMembers,
        EnumAExtraMembers,
        EnumADiffQualname,
        EnumB,
    ):
        # Things that are not coercable
        assert type_util.coerce_enum(EnumAOrig.A, EnumADiffMembers) is EnumAOrig.A
        assert type_util.coerce_enum(EnumAOrig.A, EnumAExtraMembers) is EnumAOrig.A
        assert type_util.coerce_enum(EnumAOrig.A, EnumB) is EnumAOrig.A
        assert type_util.coerce_enum(EnumAOrig.A, EnumADiffQualname) is EnumAOrig.A

    def test_coerce_enum_noop(self, EnumAOrig):
        assert type_util.coerce_enum(EnumAOrig.A, EnumAOrig) is EnumAOrig.A

    def test_coerce_enum_errors(self, EnumAOrig, EnumAEqual):
        with pytest.raises(ValueError, match="Expected an EnumMeta"):
            type_util.coerce_enum(EnumAOrig.A, EnumAEqual.A)
        with pytest.raises(ValueError, match="Expected an Enum"):
            type_util.coerce_enum(EnumAOrig, EnumAEqual)

    @patch_config_options({"runner.enumCoercion": "off"})
    def test_coerce_enum_config_off(self, EnumAOrig, EnumAEqual):
        assert type_util.coerce_enum(EnumAOrig.A, EnumAEqual) is EnumAOrig.A

    @patch_config_options({"runner.enumCoercion": "nameAndValue"})
    def test_coerce_enum_config_name_and_value(
        self, EnumAOrig, EnumAEqual, EnumADiffValues
    ):
        assert type_util.coerce_enum(EnumAOrig.A, EnumAEqual) is EnumAEqual.A
        assert type_util.coerce_enum(EnumAOrig.A, EnumADiffValues) is EnumAOrig.A

    @patch_config_options({"runner.enumCoercion": "badValue"})
    def test_coerce_enum_bad_config_value(self, EnumAOrig, EnumAEqual):
        with pytest.raises(errors.StreamlitAPIException):
            type_util.coerce_enum(EnumAOrig.A, EnumAEqual)
