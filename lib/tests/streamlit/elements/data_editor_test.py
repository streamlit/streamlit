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

from __future__ import annotations

import datetime
import unittest
from typing import Any, Dict, List, Mapping

import pandas as pd
from parameterized import parameterized

from streamlit.elements.data_editor import (
    _INDEX_IDENTIFIER,
    ColumnConfigMapping,
    _apply_cell_edits,
    _apply_data_specific_configs,
    _apply_dataframe_edits,
    _apply_row_additions,
    _apply_row_deletions,
)
from streamlit.type_util import DataFormat
from tests.delta_generator_test_case import DeltaGeneratorTestCase


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
            "1:1": "foo",
            "1:2": None,
            "2:1": False,
            # TODO: "3:1": "2020-03-20T14:28:23",
        }

        _apply_cell_edits(df, edited_cells)

        self.assertEqual(df.iat[0, 0], 10)
        self.assertEqual(df.iat[1, 0], "foo")
        self.assertEqual(df.iat[1, 1], None)
        self.assertEqual(df.iat[2, 0], False)
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

        _apply_row_additions(df, added_rows)

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
                columns_config[_INDEX_IDENTIFIER]["hidden"],
                hidden,
                f"Data of type {data_format} should be hidden.",
            )
        else:
            self.assertNotIn(_INDEX_IDENTIFIER, columns_config)

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
        self.assertFalse(columns_config["c"]["editable"])
        self.assertFalse(columns_config["d"]["editable"])


class DataEditorTest(DeltaGeneratorTestCase):
    # TODO: Test data_editor command
    pass
