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
import unittest
from typing import Any, Dict, List, Mapping
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pyarrow as pa
from parameterized import parameterized

import streamlit as st
from streamlit.elements.data_editor import (
    _apply_cell_edits,
    _apply_data_specific_configs,
    _apply_dataframe_edits,
    _apply_row_additions,
    _apply_row_deletions,
)
from streamlit.elements.lib.column_config_utils import (
    INDEX_IDENTIFIER,
    ColumnConfigMapping,
    determine_dataframe_schema,
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
    def test_parse_value(self):
        # TODO: test parse_value
        pass

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
            }
        )

        edited_cells: Mapping[str, str | int | float | bool | None] = {
            "0:1": 10,
            "0:2": "foo",
            "1:2": None,
            "0:3": False,
            # TODO: "3:1": "2020-03-20T14:28:23",
        }

        _apply_cell_edits(
            df, edited_cells, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        self.assertEqual(df.iat[0, 0], 10)
        self.assertEqual(df.iat[0, 1], "foo")
        self.assertEqual(df.iat[1, 1], None)
        self.assertEqual(df.iat[0, 2], False)
        # TODO: self.assertEqual(df.iat[3, 0], None)

    def test_apply_row_additions(self):
        """Test applying row additions to a DataFrame."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
                "col3": [True, False, True],
                # TODO: Add datetime column
            }
        )

        added_rows: List[Dict[str, Any]] = [
            {"1": 10, "2": "foo", "3": False},
            {"1": 11, "2": "bar", "3": True},
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
            {"1": 10, "2": "foo", "3": False},
            {"1": 11, "2": "bar", "3": True},
        ]
        edited_cells: Mapping[str, str | int | float | bool | None] = {
            "1:1": 123,
        }

        _apply_dataframe_edits(
            df,
            {
                "deleted_rows": deleted_rows,
                "added_rows": added_rows,
                "edited_cells": edited_cells,
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

    @parameterized.expand(
        [
            (DataFormat.SET_OF_VALUES, True),
            (DataFormat.TUPLE_OF_VALUES, True),
            (DataFormat.LIST_OF_VALUES, True),
            (DataFormat.NUMPY_LIST, True),
            (DataFormat.NUMPY_MATRIX, True),
            (DataFormat.LIST_OF_RECORDS, True),
            (DataFormat.LIST_OF_ROWS, True),
            (DataFormat.COLUMN_VALUE_MAPPING, True),
            # Some data formats which should not hide the index:
            (DataFormat.PANDAS_DATAFRAME, False),
            (DataFormat.PANDAS_SERIES, False),
            (DataFormat.PANDAS_INDEX, False),
            (DataFormat.KEY_VALUE_DICT, False),
            (DataFormat.PYARROW_TABLE, False),
            (DataFormat.PANDAS_STYLER, False),
            (DataFormat.COLUMN_INDEX_MAPPING, False),
            (DataFormat.COLUMN_SERIES_MAPPING, False),
        ]
    )
    def test_apply_data_specific_configs_hides_index(
        self, data_format: DataFormat, hidden: bool
    ):
        """Test that the index is hidden for some data formats."""
        columns_config: ColumnConfigMapping = {}
        data_df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
        _apply_data_specific_configs(columns_config, data_df, data_format)

        if hidden:
            self.assertEqual(
                columns_config[INDEX_IDENTIFIER]["hidden"],
                hidden,
                f"Data of type {data_format} should be hidden.",
            )
        else:
            self.assertNotIn(INDEX_IDENTIFIER, columns_config)

    @parameterized.expand(
        [
            (DataFormat.SET_OF_VALUES, True),
            (DataFormat.TUPLE_OF_VALUES, True),
            (DataFormat.LIST_OF_VALUES, True),
            (DataFormat.NUMPY_LIST, True),
            (DataFormat.KEY_VALUE_DICT, True),
            # Most other data formats which should not rename the first column:
            (DataFormat.PANDAS_DATAFRAME, False),
            (DataFormat.PANDAS_SERIES, False),
            (DataFormat.PANDAS_INDEX, False),
            (DataFormat.PYARROW_TABLE, False),
            (DataFormat.PANDAS_STYLER, False),
            (DataFormat.COLUMN_INDEX_MAPPING, False),
            (DataFormat.COLUMN_SERIES_MAPPING, False),
            (DataFormat.LIST_OF_RECORDS, False),
            (DataFormat.LIST_OF_ROWS, False),
            (DataFormat.COLUMN_VALUE_MAPPING, False),
        ]
    )
    def test_apply_data_specific_configs_renames_column(
        self, data_format: DataFormat, renames: bool
    ):
        """Test that the column names are changed for some data formats."""
        data_df = pd.DataFrame([1, 2, 3])
        _apply_data_specific_configs({}, data_df, data_format)
        if renames:
            self.assertEqual(
                data_df.columns[0],
                "value",
                f"Data of type {data_format} should be renamed to 'value'",
            )
        else:
            self.assertEqual(
                data_df.columns[0],
                0,
                f"Data of type {data_format} should not be renamed.",
            )

    def test_apply_data_specific_configs_disables_columns(self):
        """Test that Arrow incompatible columns are disabled (configured as non-editable)."""
        columns_config: ColumnConfigMapping = {}
        data_df = pd.DataFrame(
            {
                "a": pd.Series([1, 2]),
                "b": pd.Series(["foo", "bar"]),
                "c": pd.Series([1, "foo"]),  # Incompatible
                "d": pd.Series([1 + 2j, 3 + 4j]),  # Incompatible
            }
        )

        _apply_data_specific_configs(
            columns_config, data_df, DataFormat.PANDAS_DATAFRAME
        )
        self.assertNotIn("a", columns_config)
        self.assertNotIn("b", columns_config)
        self.assertTrue(columns_config["c"]["disabled"])
        self.assertTrue(columns_config["d"]["disabled"])


class DataEditorTest(DeltaGeneratorTestCase):
    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.experimental_data_editor(pd.DataFrame(), disabled=True)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.disabled, True)

    def test_just_width_height(self):
        """Test that it can be called with width and height."""
        st.experimental_data_editor(pd.DataFrame(), width=300, height=400)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.width, 300)
        self.assertEqual(proto.height, 400)

    def test_num_rows_fixed(self):
        """Test that it can be called with num_rows fixed."""
        st.experimental_data_editor(pd.DataFrame(), num_rows="fixed")

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.editing_mode, ArrowProto.EditingMode.FIXED)

    def test_num_rows_dynamic(self):
        """Test that it can be called with num_rows dynamic."""
        st.experimental_data_editor(pd.DataFrame(), num_rows="dynamic")

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.editing_mode, ArrowProto.EditingMode.DYNAMIC)

    def test_just_use_container_width(self):
        """Test that it can be called with use_container_width."""
        st.experimental_data_editor(pd.DataFrame(), use_container_width=True)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.use_container_width, True)

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""
        st.experimental_data_editor(pd.DataFrame())

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.form_id, "")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""
        with st.form("form"):
            st.experimental_data_editor(pd.DataFrame())

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

        return_df = st.experimental_data_editor(df)

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
        return_data = st.experimental_data_editor(input_data)

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
            st.experimental_data_editor(input_data)

    @parameterized.expand(
        [
            (pd.CategoricalIndex(["a", "b", "c"]),),
            (pd.DatetimeIndex(["2020-01-01", "2020-01-02", "2020-01-03"]),),
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
            st.experimental_data_editor(df)

    @parameterized.expand(
        [
            (pd.RangeIndex(0, 3, 1),),
            (pd.Index([1, 2, -3], dtype="int64"),),
            (pd.Index([1, 2, 3], dtype="uint64"),),
            (pd.Index([1.0, 2.0, 3.0], dtype="float"),),
            (pd.Index(["a", "b", "c"]),),
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
        return_df = st.experimental_data_editor(df)
        self.assertIsInstance(return_df, pd.DataFrame)

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
            return_df = st.experimental_data_editor(df)
            self.assertIsInstance(return_df, pd.DataFrame)

    def test_pandas_styler_support(self):
        """Test that it supports Pandas styler styles."""
        df = pd.DataFrame(
            index=[0, 1],
            columns=[[2, 3, 4], ["c1", "c2", "c3"]],
            data=np.arange(0, 6, 1).reshape(2, 3),
        )
        styler = df.style
        # NOTE: If UUID is not set - a random UUID will be generated.
        styler.set_uuid("FAKE_UUID")
        styler.highlight_max(axis=None)
        st.experimental_data_editor(styler)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(
            proto.styler.styles, "#T_FAKE_UUIDrow1_col2 { background-color: yellow }"
        )
