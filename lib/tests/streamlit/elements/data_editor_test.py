# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

"""data_editor unit test."""

from __future__ import annotations

import datetime
import json
import unittest
from decimal import Decimal
from typing import Any, Dict, List, Mapping
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pyarrow as pa
from parameterized import parameterized

import streamlit as st
from streamlit.elements.lib.column_config_utils import (
    INDEX_IDENTIFIER,
    ColumnDataKind,
    determine_dataframe_schema,
)
from streamlit.elements.widgets.data_editor import (
    _apply_cell_edits,
    _apply_dataframe_edits,
    _apply_row_additions,
    _apply_row_deletions,
    _check_column_names,
    _check_type_compatibilities,
    _parse_value,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
from streamlit.type_util import (
    DataFormat,
    bytes_to_data_frame,
    is_pandas_version_less_than,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.data_mocks import SHARED_TEST_CASES, TestCaseMetadata


def _get_arrow_schema(df: pd.DataFrame) -> pa.Schema:
    """Get the Arrow schema for a DataFrame."""
    return pa.Table.from_pandas(df).schema


class DataEditorUtilTest(unittest.TestCase):
    @parameterized.expand(
        [
            (None, ColumnDataKind.STRING, None),
            ("hello", ColumnDataKind.STRING, "hello"),
            (123, ColumnDataKind.STRING, "123"),
            (123.1234, ColumnDataKind.STRING, "123.1234"),
            (None, ColumnDataKind.INTEGER, None),
            ("123", ColumnDataKind.INTEGER, 123),
            (123, ColumnDataKind.INTEGER, 123),
            (123.1234, ColumnDataKind.INTEGER, 123),
            (None, ColumnDataKind.FLOAT, None),
            ("123.45", ColumnDataKind.FLOAT, 123.45),
            (123.45, ColumnDataKind.FLOAT, 123.45),
            (123, ColumnDataKind.FLOAT, 123),
            (None, ColumnDataKind.BOOLEAN, None),
            (True, ColumnDataKind.BOOLEAN, True),
            ("true", ColumnDataKind.BOOLEAN, True),
            (None, ColumnDataKind.DATETIME, None),
            (
                "2021-01-01T10:20:30",
                ColumnDataKind.DATETIME,
                pd.Timestamp(
                    "2021-01-01T10:20:30",
                ),
            ),
            (
                "2021-01-01",
                ColumnDataKind.DATETIME,
                pd.Timestamp("2021-01-01T00:00:00"),
            ),
            (
                "2021-01-01T10:20:30Z",
                ColumnDataKind.DATETIME,
                pd.Timestamp("2021-01-01T10:20:30Z"),
            ),
            (
                "2021-01-01T10:20:30.123456",
                ColumnDataKind.DATETIME,
                pd.Timestamp("2021-01-01T10:20:30.123456"),
            ),
            (
                "2021-01-01T10:20:30.123456Z",
                ColumnDataKind.DATETIME,
                pd.Timestamp("2021-01-01T10:20:30.123456Z"),
            ),
            (None, ColumnDataKind.TIME, None),
            ("10:20:30", ColumnDataKind.TIME, datetime.time(10, 20, 30)),
            ("10:20:30.123456", ColumnDataKind.TIME, datetime.time(10, 20, 30, 123456)),
            (
                "2021-01-01T10:20:30.123456Z",
                ColumnDataKind.TIME,
                datetime.time(10, 20, 30, 123456),
            ),
            (
                "1970-01-01T10:20:30.123456Z",
                ColumnDataKind.TIME,
                datetime.time(10, 20, 30, 123456),
            ),
            (None, ColumnDataKind.DATE, None),
            ("2021-01-01", ColumnDataKind.DATE, datetime.date(2021, 1, 1)),
            (
                "2021-01-01T10:20:30.123456Z",
                ColumnDataKind.DATE,
                datetime.date(2021, 1, 1),
            ),
        ]
    )
    def test_parse_value(
        self,
        value: str | int | float | bool | None,
        column_data_kind: ColumnDataKind,
        expected: Any,
    ):
        """Test that _parse_value parses the input to the correct type."""
        result = _parse_value(value, column_data_kind)
        self.assertEqual(result, expected)

    def test_apply_cell_edits(self):
        """Test applying cell edits to a DataFrame."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
                "col3": [True, False, True],
                "col4": [
                    datetime.datetime.now(),
                    datetime.datetime.now(),
                    datetime.datetime.now(),
                ],
                "col5": [
                    Decimal("1.1"),
                    Decimal("-12.3456"),
                    Decimal("123456"),
                ],
            }
        )

        edited_rows: Mapping[int, Mapping[str, str | int | float | bool | None]] = {
            0: {
                "col1": 10,
                "col2": "foo",
                "col3": False,
                "col4": "2020-03-20T14:28:23",
                "col5": "2.3",
            },
            1: {"col2": None},
        }

        _apply_cell_edits(
            df, edited_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        self.assertEqual(df.iat[0, 0], 10)
        self.assertEqual(df.iat[0, 1], "foo")
        self.assertEqual(df.iat[1, 1], None)
        self.assertEqual(df.iat[0, 2], False)
        self.assertEqual(df.iat[0, 3], pd.Timestamp("2020-03-20T14:28:23"))
        self.assertEqual(df.iat[0, 4], Decimal("2.3"))

    def test_apply_row_additions(self):
        """Test applying row additions to a DataFrame."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
                "col3": [True, False, True],
                "col4": [
                    datetime.datetime.now(),
                    datetime.datetime.now(),
                    datetime.datetime.now(),
                ],
            }
        )

        added_rows: List[Dict[str, Any]] = [
            {"col1": 10, "col2": "foo", "col3": False, "col4": "2020-03-20T14:28:23"},
            {"col1": 11, "col2": "bar", "col3": True, "col4": "2023-03-20T14:28:23"},
        ]

        _apply_row_additions(
            df, added_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        self.assertEqual(len(df), 5)

    def test_apply_row_deletions(self):
        """Test applying row deletions to a DataFrame."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
                "col3": [True, False, True],
            }
        )

        deleted_rows: List[int] = [0, 2]

        _apply_row_deletions(df, deleted_rows)

        self.assertEqual(len(df), 1, f"Only one row should be left, but has {len(df)}.")
        self.assertEqual(df.iloc[0].to_list(), [2, "b", False])

    def test_apply_dataframe_edits(self):
        """Test applying edits to a DataFrame."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
                "col3": [True, False, True],
            }
        )

        deleted_rows: List[int] = [0, 2]
        added_rows: List[Dict[str, Any]] = [
            {"col1": 10, "col2": "foo", "col3": False},
            {"col1": 11, "col2": "bar", "col3": True},
        ]

        edited_rows: Mapping[int, Mapping[str, str | int | float | bool | None]] = {
            1: {
                "col1": 123,
            }
        }

        _apply_dataframe_edits(
            df,
            {
                "deleted_rows": deleted_rows,
                "added_rows": added_rows,
                "edited_rows": edited_rows,
            },
            determine_dataframe_schema(df, _get_arrow_schema(df)),
        )

        self.assertEqual(
            df.to_dict(orient="list"),
            {
                "col1": [123, 10, 11],
                "col2": ["b", "foo", "bar"],
                "col3": [False, False, True],
            },
        )


class DataEditorTest(DeltaGeneratorTestCase):
    def test_just_disabled_true(self):
        """Test that it can be called with disabled=True param."""
        st.data_editor(pd.DataFrame(), disabled=True)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.disabled, True)

    def test_just_disabled_false(self):
        """Test that it can be called with disabled=False param."""
        st.data_editor(pd.DataFrame(), disabled=False)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.disabled, False)

    def test_just_width_height(self):
        """Test that it can be called with width and height."""
        st.data_editor(pd.DataFrame(), width=300, height=400)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.width, 300)
        self.assertEqual(proto.height, 400)

    def test_num_rows_fixed(self):
        """Test that it can be called with num_rows fixed."""
        st.data_editor(pd.DataFrame(), num_rows="fixed")

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.editing_mode, ArrowProto.EditingMode.FIXED)

    def test_num_rows_dynamic(self):
        """Test that it can be called with num_rows dynamic."""
        st.data_editor(pd.DataFrame(), num_rows="dynamic")

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.editing_mode, ArrowProto.EditingMode.DYNAMIC)

    def test_column_order_parameter(self):
        """Test that it can be called with column_order."""
        st.data_editor(pd.DataFrame(), column_order=["a", "b"])

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.column_order, ["a", "b"])

    def test_just_use_container_width(self):
        """Test that it can be called with use_container_width."""
        st.data_editor(pd.DataFrame(), use_container_width=True)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.use_container_width, True)

    def test_disable_individual_columns(self):
        """Test that disable can be used to disable individual columns."""
        data_df = pd.DataFrame(
            {
                "a": pd.Series([1, 2]),
                "b": pd.Series(["foo", "bar"]),
                "c": pd.Series([1, 2]),
                "d": pd.Series(["foo", "bar"]),
            }
        )

        st.data_editor(data_df, disabled=["a", "b"])

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.disabled, False)
        self.assertEqual(
            proto.columns,
            json.dumps({"a": {"disabled": True}, "b": {"disabled": True}}),
        )

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""
        st.data_editor(pd.DataFrame())

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.form_id, "")

    def test_hide_index_true(self):
        """Test that it can be called with hide_index=True param."""
        data_df = pd.DataFrame(
            {
                "a": pd.Series([1, 2]),
                "b": pd.Series(["foo", "bar"]),
            }
        )

        st.data_editor(data_df, hide_index=True)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(
            proto.columns,
            json.dumps({INDEX_IDENTIFIER: {"hidden": True}}),
        )

    def test_hide_index_false(self):
        """Test that it can be called with hide_index=False param."""
        data_df = pd.DataFrame(
            {
                "a": pd.Series([1, 2]),
                "b": pd.Series(["foo", "bar"]),
            }
        )

        st.data_editor(data_df, hide_index=False)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(
            proto.columns,
            json.dumps({INDEX_IDENTIFIER: {"hidden": False}}),
        )

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""
        with st.form("form"):
            st.data_editor(pd.DataFrame())

        # 2 elements will be created: form block, widget
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        dataframe_proto = self.get_delta_from_queue(1).new_element.arrow_data_frame
        self.assertEqual(dataframe_proto.form_id, form_proto.form.form_id)

    def test_with_dataframe_data(self):
        """Test that it can be called with a dataframe."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
                "col3": [True, False, True],
            }
        )

        return_df = st.data_editor(df)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        pd.testing.assert_frame_equal(bytes_to_data_frame(proto.data), df)
        pd.testing.assert_frame_equal(return_df, df)

    @parameterized.expand(SHARED_TEST_CASES)
    def test_with_compatible_data(
        self,
        input_data: Any,
        metadata: TestCaseMetadata,
    ):
        """Test that it can be called with compatible data."""
        return_data = st.data_editor(input_data)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        reconstructed_df = bytes_to_data_frame(proto.data)
        self.assertEqual(reconstructed_df.shape[0], metadata.expected_rows)
        self.assertEqual(reconstructed_df.shape[1], metadata.expected_cols)

        # Some data formats are converted to DataFrames instead of
        # the original data type/structure.
        if metadata.expected_data_format in [
            DataFormat.SNOWPARK_OBJECT,
            DataFormat.PYSPARK_OBJECT,
            DataFormat.PANDAS_INDEX,
            DataFormat.PANDAS_STYLER,
            DataFormat.EMPTY,
        ]:
            assert isinstance(return_data, pd.DataFrame)
            self.assertEqual(return_data.shape[0], metadata.expected_rows)
            self.assertEqual(return_data.shape[1], metadata.expected_cols)
        else:
            self.assertEqual(type(return_data), type(input_data))
            # Sets in python are unordered, so we can't compare them this way.
            if metadata.expected_data_format != DataFormat.SET_OF_VALUES:
                self.assertEqual(str(return_data), str(input_data))

    @parameterized.expand(
        [
            (True,),
            (123,),
            ("foo",),
            (datetime.datetime.now(),),
            (st,),
        ]
    )
    def test_with_invalid_data(self, input_data: Any):
        """Test that it raises an exception when called with invalid data."""
        with self.assertRaises(StreamlitAPIException):
            st.data_editor(input_data)

    @parameterized.expand(
        [
            (pd.CategoricalIndex(["a", "b", "c"]),),
            (pd.PeriodIndex(["2020-01-01", "2020-01-02", "2020-01-03"], freq="D"),),
            (pd.TimedeltaIndex(["1 day", "2 days", "3 days"]),),
            (pd.MultiIndex.from_tuples([("a", "b"), ("c", "d"), ("e", "f")]),),
        ]
    )
    def test_with_unsupported_index(self, index: pd.Index):
        """Test that it raises an exception when called with data that has an unsupported index."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
                "col3": [True, False, True],
            }
        )
        df.set_index(index, inplace=True)

        with self.assertRaises(StreamlitAPIException):
            st.data_editor(df)

    @parameterized.expand(
        [
            (pd.RangeIndex(0, 3, 1),),
            (pd.Index([1, 2, -3], dtype="int64"),),
            (pd.Index([1, 2, 3], dtype="uint64"),),
            (pd.Index([1.0, 2.0, 3.0], dtype="float"),),
            (pd.Index(["a", "b", "c"]),),
            (pd.DatetimeIndex(["2020-01-01", "2020-01-02", "2020-01-03"]),),
        ]
    )
    def test_with_supported_index(self, index: pd.Index):
        """Test that supported indices raise no exceptions."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
                "col3": [True, False, True],
            }
        )
        df.set_index(index, inplace=True)
        # This should run without an issue and return a valid dataframe
        return_df = st.data_editor(df)
        self.assertIsInstance(return_df, pd.DataFrame)

    def test_check_type_compatibilities(self):
        """Test that _check_type_compatibilities raises an exception when called with incompatible data."""
        df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})

        schema = {
            INDEX_IDENTIFIER: ColumnDataKind.INTEGER,
            "col1": ColumnDataKind.INTEGER,
            "col2": ColumnDataKind.STRING,
        }

        with self.assertRaises(StreamlitAPIException):
            _check_type_compatibilities(
                df,
                {
                    "col1": {"type_config": {"type": "text"}},
                    "col2": {"type_config": {"type": "text"}},
                },
                schema,
            )

        with self.assertRaises(StreamlitAPIException):
            _check_type_compatibilities(
                df,
                {
                    "col1": {"type_config": {"type": "date"}},
                    "col2": {"type_config": {"type": "text"}},
                },
                schema,
            )

        # This one should work
        _check_type_compatibilities(
            df,
            {
                "col1": {"type_config": {"type": "checkbox"}},
                "col2": {"type_config": {"type": "text"}},
            },
            schema,
        )

    @unittest.skipIf(
        is_pandas_version_less_than("2.0.0") is False,
        "This test only runs if pandas is < 2.0.0",
    )
    def test_with_old_supported_index(self):
        """Test that supported old index types raise no exceptions.

        Int64Index, UInt64Index, Float64Index were deprecated in pandas 2.x, but we
        still support them for older versions of pandas.
        """

        for index in [
            pd.Int64Index([1, 2, -3]),
            pd.UInt64Index([1, 2, 3]),
            pd.Float64Index([1.0, 2.0, 3.0]),
        ]:
            df = pd.DataFrame(
                {
                    "col1": [1, 2, 3],
                    "col2": ["a", "b", "c"],
                    "col3": [True, False, True],
                }
            )
            df.set_index(index, inplace=True)
            # This should run without an issue and return a valid dataframe
            return_df = st.data_editor(df)
            self.assertIsInstance(return_df, pd.DataFrame)

    def test_works_with_multiindex_column_headers(self):
        """Test that it works with multiindex column headers."""
        df = pd.DataFrame(
            index=[0, 1],
            columns=[[2, 3, 4], ["c1", "c2", "c3"]],
            data=np.arange(0, 6, 1).reshape(2, 3),
        )

        return_df = st.data_editor(df)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        pd.testing.assert_frame_equal(bytes_to_data_frame(proto.data), return_df)
        self.assertEqual(return_df.columns.to_list(), ["2_c1", "3_c2", "4_c3"])

    def test_pandas_styler_support(self):
        """Test that it supports Pandas styler styles."""
        df = pd.DataFrame(
            index=[0, 1],
            columns=[[2, 3, 4], ["c1", "c2", "c3"]],
            data=np.arange(0, 6, 1).reshape(2, 3),
        )
        styler = df.style
        styler.highlight_max(axis=None)
        st.data_editor(styler, key="styler_editor")

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(
            proto.styler.styles, "#T_29028a0632row1_col2 { background-color: yellow }"
        )

        # Check that different delta paths lead to different element ids
        st.container().data_editor(styler, width=99)
        # delta path is: [0, 1, 0]
        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(
            proto.styler.styles, "#T_e94cd2b42erow1_col2 { background-color: yellow }"
        )

        st.container().container().data_editor(styler, width=100)
        # delta path is: [0, 2, 0, 0]
        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(
            proto.styler.styles, "#T_9e33af1e69row1_col2 { background-color: yellow }"
        )

    def test_duplicate_column_names_raise_exception(self):
        """Test that duplicate column names raise an exception."""
        # create a dataframe with duplicate columns
        df = pd.DataFrame({"duplicated": [1, 2, 3], "col2": [4, 5, 6]})
        df.rename(columns={"col2": "duplicated"}, inplace=True)

        # StreamlitAPIException should be raised
        with self.assertRaises(StreamlitAPIException):
            _check_column_names(df)

    def test_non_string_column_names_are_converted_to_string(self):
        """Test that non-string column names are converted to string."""
        # create a dataframe with non-string columns
        df = pd.DataFrame(0, ["John", "Sarah", "Jane"], list(range(1, 4)))
        self.assertNotEqual(pd.api.types.infer_dtype(df.columns), "string")
        return_df = st.data_editor(df)
        self.assertEqual(pd.api.types.infer_dtype(return_df.columns), "string")

    def test_index_column_name_raises_exception(self):
        """Test that an index column name raises an exception."""
        # create a dataframe with a column named "_index"
        df = pd.DataFrame({INDEX_IDENTIFIER: [1, 2, 3], "col2": [4, 5, 6]})

        # StreamlitAPIException should be raised
        with self.assertRaises(StreamlitAPIException):
            _check_column_names(df)

    def test_column_names_are_unique(self):
        """Test that unique column names do not raise an exception."""
        # create a dataframe with unique columns
        df = pd.DataFrame({"col1": [1, 2, 3], "col2": [4, 5, 6]})

        # no exception should be raised here
        _check_column_names(df)
