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

import unittest
import enum
from datetime import date
from decimal import Decimal
from typing import Any
from unittest.mock import patch
from collections import OrderedDict


import numpy as np
import pandas as pd
import pyarrow as pa
import pytest
from pandas.api.types import infer_dtype
from parameterized import parameterized

import streamlit as st
from streamlit import dataframe_util

from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.data_mocks import (
    SHARED_TEST_CASES,
    TestCaseMetadata,
    TestObject,
    TestEnum,
    StrTestEnum,
    data_generator,
)
from tests.streamlit.modin_mocks import DataFrame as ModinDataFrame
from tests.streamlit.modin_mocks import Series as ModinSeries
from tests.streamlit.pyspark_mocks import DataFrame as PysparkDataFrame
from tests.streamlit.snowpandas_mocks import DataFrame as SnowpandasDataFrame
from tests.streamlit.snowpandas_mocks import Series as SnowpandasSeries
from tests.streamlit.snowpark_mocks import DataFrame as SnowparkDataFrame
from tests.streamlit.snowpark_mocks import Row as SnowparkRow
from tests.streamlit.snowpark_mocks import Table as SnowparkTable
from tests.testutil import create_snowpark_session, patch_config_options


class DataframeUtilTest(unittest.TestCase):
    def test_data_frame_with_dtype_values_to_bytes(self):
        df1 = pd.DataFrame(["foo", "bar"])
        df2 = pd.DataFrame(df1.dtypes)

        try:
            dataframe_util.data_frame_to_bytes(df2)
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
        converted_df = dataframe_util.convert_anything_to_pandas_df(input_data)
        self.assertIsInstance(converted_df, pd.DataFrame)
        self.assertEqual(converted_df.shape[0], metadata.expected_rows)
        self.assertEqual(converted_df.shape[1], metadata.expected_cols)

    @parameterized.expand(
        [
            (ModinDataFrame(pd.DataFrame(np.random.randn(2000, 2))),),
            (ModinSeries(pd.Series(np.random.randn(2000))),),
            (PysparkDataFrame(pd.DataFrame(np.random.randn(2000, 2))),),
            (SnowpandasDataFrame(pd.DataFrame(np.random.randn(2000, 2))),),
            (SnowpandasSeries(pd.Series(np.random.randn(2000))),),
            (SnowparkDataFrame(pd.DataFrame(np.random.randn(2000, 2))),),
            (SnowparkTable(pd.DataFrame(np.random.randn(2000, 2))),),
        ]
    )
    def test_convert_anything_to_df_show_warning_for_unevaluated_df(
        self,
        input_data: Any,
    ):
        """Test that `convert_anything_to_df` correctly converts
        a variety unevaluated dataframes and shows a warning if
        the row count is > 1000.
        """
        with patch("streamlit.caption") as mock:
            converted_df = dataframe_util.convert_anything_to_pandas_df(
                input_data, max_unevaluated_rows=1000
            )
            self.assertIsInstance(converted_df, pd.DataFrame)
            mock.assert_called_once()

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

    def test_convert_anything_to_df_supports_key_value_dicts(self):
        """Test that `convert_anything_to_df` correctly converts
        key-value dicts to a dataframe.
        """
        data = {"a": 1, "b": 2}
        df = dataframe_util.convert_anything_to_pandas_df(data)
        pd.testing.assert_frame_equal(df, pd.DataFrame.from_dict(data, orient="index"))

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

        out = dataframe_util.convert_anything_to_pandas_df(original_styler)
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

        out = dataframe_util.convert_anything_to_pandas_df(
            original_styler, ensure_copy=True
        )
        self.assertNotEqual(id(original_styler), id(out))
        self.assertNotEqual(id(original_df), id(out))
        pd.testing.assert_frame_equal(original_df, out)

    def test_convert_anything_to_df_calls_to_pandas_when_available(self):
        class DataFrameIsh:
            def to_pandas(self):
                return pd.DataFrame([])

        converted = dataframe_util.convert_anything_to_pandas_df(DataFrameIsh())
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
            dataframe_util.data_frame_to_bytes(df)
        except Exception as ex:
            self.fail(
                "No exception should have been thrown here. "
                f"Unsupported types of this dataframe should have been automatically fixed: {ex}"
            )

    def test_is_snowpandas_data_object(self):
        df = pd.DataFrame([1, 2, 3])

        self.assertFalse(dataframe_util.is_snowpandas_data_object(df))

        # Our mock objects should be detected as snowpandas data objects:
        self.assertTrue(
            dataframe_util.is_snowpandas_data_object(SnowpandasDataFrame(df))
        )
        self.assertTrue(dataframe_util.is_snowpandas_data_object(SnowpandasSeries(df)))

    def test_is_snowpark_row_list(self):
        class DummyClass:
            """DummyClass for testing purposes"""

        # empty list should not be snowpark dataframe
        self.assertFalse(dataframe_util.is_snowpark_row_list(list()))

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
                    SnowparkRow(),
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

    @pytest.mark.require_snowflake
    def test_is_snowpark_dataframe_integration(self):
        with create_snowpark_session() as snowpark_session:
            self.assertTrue(
                dataframe_util.is_snowpark_data_object(
                    snowpark_session.sql("SELECT 40+2 as COL1")
                )
            )
            self.assertTrue(
                dataframe_util.is_snowpark_data_object(
                    snowpark_session.sql("SELECT 40+2 as COL1").cache_result()
                )
            )
            self.assertTrue(
                dataframe_util.is_snowpark_row_list(
                    snowpark_session.sql("SELECT 40+2 as COL1").collect()
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
        data_format = dataframe_util.determine_data_format(input_data)
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
        converted_df = dataframe_util.convert_anything_to_pandas_df(input_data)
        self.assertEqual(converted_df.shape[0], metadata.expected_rows)
        self.assertEqual(converted_df.shape[1], metadata.expected_cols)

        if metadata.expected_data_format == dataframe_util.DataFormat.UNKNOWN:
            with self.assertRaises(ValueError):
                dataframe_util.convert_df_to_data_format(
                    converted_df, metadata.expected_data_format
                )
            # We don't have to do any other tests for unknown data formats.
        else:
            converted_data = dataframe_util.convert_df_to_data_format(
                converted_df, metadata.expected_data_format
            )

            # Some data formats are converted to DataFrames instead of
            # the original data type/structure.
            if metadata.expected_data_format in [
                dataframe_util.DataFormat.SNOWPARK_OBJECT,
                dataframe_util.DataFormat.PYSPARK_OBJECT,
                dataframe_util.DataFormat.PANDAS_INDEX,
                dataframe_util.DataFormat.PANDAS_STYLER,
                dataframe_util.DataFormat.SNOWPANDAS_OBJECT,
                dataframe_util.DataFormat.MODIN_OBJECT,
                dataframe_util.DataFormat.EMPTY,
            ]:
                assert isinstance(converted_data, pd.DataFrame)
                self.assertEqual(converted_data.shape[0], metadata.expected_rows)
                self.assertEqual(converted_data.shape[1], metadata.expected_cols)
            else:
                self.assertEqual(type(converted_data), type(input_data))
                # Sets in python are unordered, so we can't compare them this way.
                if (
                    metadata.expected_data_format
                    != dataframe_util.DataFormat.SET_OF_VALUES
                ):
                    self.assertEqual(str(converted_data), str(input_data))
                    pd.testing.assert_frame_equal(
                        converted_df,
                        dataframe_util.convert_anything_to_pandas_df(converted_data),
                    )

    def test_convert_df_to_data_format_with_unknown_data_format(self):
        """Test that `convert_df_to_data_format` raises a ValueError when
        passed an unknown data format.
        """
        with self.assertRaises(ValueError):
            dataframe_util.convert_df_to_data_format(
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
            dataframe_util.convert_df_to_data_format(
                df, dataframe_util.DataFormat.LIST_OF_VALUES
            ),
            [None, None, None, None],
        )
        self.assertEqual(
            dataframe_util.convert_df_to_data_format(
                df, dataframe_util.DataFormat.TUPLE_OF_VALUES
            ),
            (None, None, None, None),
        )
        self.assertEqual(
            dataframe_util.convert_df_to_data_format(
                df, dataframe_util.DataFormat.SET_OF_VALUES
            ),
            {None},
        )
        self.assertEqual(
            dataframe_util.convert_df_to_data_format(
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
            dataframe_util.convert_df_to_data_format(
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
            dataframe_util.convert_df_to_data_format(
                df, dataframe_util.DataFormat.COLUMN_VALUE_MAPPING
            ),
            {
                "missing": [None, None, None, None],
            },
        )
        self.assertEqual(
            dataframe_util.convert_df_to_data_format(
                df, dataframe_util.DataFormat.COLUMN_INDEX_MAPPING
            ),
            {"missing": {0: None, 1: None, 2: None, 3: None}},
        )
        self.assertEqual(
            dataframe_util.convert_df_to_data_format(
                df, dataframe_util.DataFormat.KEY_VALUE_DICT
            ),
            {0: None, 1: None, 2: None, 3: None},
        )

    def test_convert_anything_to_sequence_object_is_indexable(self):
        l1 = ["a", "b", "c"]
        l2 = dataframe_util.convert_anything_to_sequence(l1)

        # Assert that l1 was shallow copied into l2.
        self.assertFalse(l1 is l2)
        self.assertEqual(l1, l2)

    def test_convert_anything_to_sequence_object_not_indexable(self):
        l = dataframe_util.convert_anything_to_sequence({"a", "b", "c"})
        self.assertIn("a", l)
        self.assertIn("b", l)
        self.assertIn("c", l)

    def test_convert_anything_to_sequence_enum_is_indexable(self):
        """Test Enums are indexable"""

        class Opt(enum.Enum):
            OPT1 = 1
            OPT2 = 2

        class StrOpt(str, enum.Enum):
            OPT1 = "a"
            OPT2 = "b"

        l = dataframe_util.convert_anything_to_sequence(Opt)
        self.assertEqual(list(Opt), l)

        l = dataframe_util.convert_anything_to_sequence(StrOpt)
        self.assertEqual(list(StrOpt), l)

    @parameterized.expand(
        [
            (None, []),
            # List:
            ([], []),
            (
                ["st.number_input", "st.text_area", "st.text_input"],
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            (
                [1, 2, 3],
                [1, 2, 3],
            ),
            # Reversed list:
            (
                reversed(["st.number_input", "st.text_area", "st.text_input"]),
                ["st.text_input", "st.text_area", "st.number_input"],
            ),
            # Set:
            (set(), []),
            (
                {"st.number_input", "st.text_area", "st.text_input"},
                ["st.text_input", "st.number_input", "st.text_area"],
            ),
            # Tuple:
            ((), []),
            (
                ("st.number_input", "st.text_area", "st.text_input"),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Dict:
            ({}, []),
            (
                {
                    "st.number_input": "number",
                    "st.text_area": "text",
                    "st.text_input": "text",
                },
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Dict keys:
            (
                {
                    "st.number_input": "number",
                    "st.text_area": "text",
                    "st.text_input": "text",
                }.keys(),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Dict values:
            (
                {
                    "st.number_input": "number",
                    "st.text_area": "text",
                    "st.text_input": "text",
                }.values(),
                ["number", "text", "text"],
            ),
            # OrderedDict:
            (
                OrderedDict(
                    [
                        ("st.number_input", "number"),
                        ("st.text_area", "text"),
                        ("st.text_input", "text"),
                    ]
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Enum:
            (
                TestEnum,
                [TestEnum.NUMBER_INPUT, TestEnum.TEXT_AREA, TestEnum.TEXT_INPUT],
            ),
            (StrTestEnum, ["st.number_input", "st.text_area", "st.text_input"]),
            # Generator:
            (data_generator(), ["st.number_input", "st.text_area", "st.text_input"]),
            # Enumerate:
            (
                enumerate(["st.number_input", "st.text_area", "st.text_input"]),
                [0, 1, 2],
            ),
            # String:
            ("abc", ["a", "b", "c"]),
            # Range:
            (range(3), [0, 1, 2]),
            # Pandas Dataframe:
            (
                pd.DataFrame(),
                [],
            ),
            (
                pd.DataFrame(
                    columns=["name", "type"], index=pd.RangeIndex(start=0, step=1)
                ),
                [],
            ),
            (
                pd.DataFrame(["st.number_input", "st.text_area", "st.text_input"]),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            (
                pd.DataFrame(
                    {
                        "widgets": ["st.number_input", "st.text_area", "st.text_input"],
                        "types": ["number", "text", "text"],
                    }
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Pandas Series (pd.Series):
            (
                pd.Series(
                    ["st.number_input", "st.text_area", "st.text_input"], name="widgets"
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Pandas Index (pd.Index):
            (
                pd.Index(["st.number_input", "st.text_area", "st.text_input"]),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Pandas Styler (pd.Styler):
            (
                pd.DataFrame(
                    ["st.number_input", "st.text_area", "st.text_input"]
                ).style,
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Pandas Categorical (pd.Categorical):
            (
                pd.Categorical(["st.number_input", "st.text_area", "st.text_input"]),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Pandas DatetimeIndex (pd.DatetimeIndex):
            (
                pd.DatetimeIndex(
                    ["1/1/2020 10:00:00+00:00", "2/1/2020 11:00:00+00:00"]
                ),
                [
                    pd.Timestamp("2020-01-01 10:00:00+0000", tz="UTC"),
                    pd.Timestamp("2020-02-01 11:00:00+0000", tz="UTC"),
                ],
            ),
            # Pandas DatetimeArrayå:
            (
                pd.arrays.DatetimeArray(
                    pd.DatetimeIndex(
                        ["1/1/2020 10:00:00+00:00", "2/1/2020 11:00:00+00:00"]
                    ),
                ),
                [
                    pd.Timestamp("2020-01-01 10:00:00+0000", tz="UTC"),
                    pd.Timestamp("2020-02-01 11:00:00+0000", tz="UTC"),
                ],
            ),
            # Pandas RangeIndex (pd.RangeIndex):
            (
                pd.RangeIndex(start=0, stop=3, step=1),
                [0, 1, 2],
            ),
            # Numpy array:
            (
                np.array([]),
                [],
            ),
            (
                np.array(["st.number_input", "st.text_area", "st.text_input"]),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Pyarrow Table:
            (
                pa.Table.from_pandas(
                    pd.DataFrame(["st.number_input", "st.text_area", "st.text_input"])
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Snowpark Table:
            (
                SnowparkTable(
                    pd.DataFrame(["st.number_input", "st.text_area", "st.text_input"])
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Snowpark DataFrame:
            (
                SnowparkDataFrame(
                    pd.DataFrame(["st.number_input", "st.text_area", "st.text_input"])
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Snowpark Pandas DataFrame:
            (
                SnowpandasDataFrame(
                    pd.DataFrame(["st.number_input", "st.text_area", "st.text_input"])
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Snowpark Pandas Series:
            (
                SnowpandasSeries(
                    pd.Series(["st.number_input", "st.text_area", "st.text_input"])
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Pyspark Dataframe:
            (
                PysparkDataFrame(
                    pd.DataFrame(["st.number_input", "st.text_area", "st.text_input"])
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Modin Dataframe:
            (
                ModinDataFrame(
                    pd.DataFrame(["st.number_input", "st.text_area", "st.text_input"])
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
            # Modin Series:
            (
                ModinSeries(
                    pd.Series(["st.number_input", "st.text_area", "st.text_input"])
                ),
                ["st.number_input", "st.text_area", "st.text_input"],
            ),
        ]
    )
    def test_convert_anything_to_sequence(
        self, input_data: Any, result_sequence: list[Any]
    ):
        """Test that `convert_anything_to_sequence` correctly converts
        a variety of types to a sequence.
        """
        converted_sequence = dataframe_util.convert_anything_to_sequence(input_data)
        self.assertEquals(set(converted_sequence), set(result_sequence))
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
