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

"""data_editor unit test."""

from __future__ import annotations

import copy
import datetime
import json
import unittest
from decimal import Decimal
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit import dataframe_util
from streamlit.dataframe_util import (
    DataFormat,
    convert_arrow_bytes_to_pandas_df,
    is_pandas_version_less_than,
)
from streamlit.elements.lib.column_config_utils import (
    INDEX_IDENTIFIER,
    ColumnDataKind,
    determine_dataframe_schema,
)
from streamlit.elements.widgets.data_editor import (
    DataEditorSerde,
    DataEditorState,
    _apply_cell_edits,
    _apply_dataframe_edits,
    _apply_row_additions,
    _apply_row_deletions,
    _canonical_arrow_type,
    _check_column_names,
    _check_type_compatibilities,
    _compute_data_editor_signature,
    _has_pending_edits,
    _parse_value,
    _validate_edited_dataframe_compatibility,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Dataframe_pb2 import Dataframe as DataframeProto
from streamlit.proto.WidgetStates_pb2 import WidgetStates
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)
from streamlit.runtime.scriptrunner_utils.script_requests import RerunData
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.data_test_cases import SHARED_TEST_CASES, CaseMetadata
from tests.streamlit.elements.layout_test_utils import (
    HeightConfigFields,
    WidthConfigFields,
)

if TYPE_CHECKING:
    from collections.abc import Mapping


def _get_arrow_schema(df: pd.DataFrame) -> pa.Schema:
    """Get the Arrow schema for a DataFrame."""
    return pa.Table.from_pandas(df).schema


def _get_data_editor_signature(
    df: pd.DataFrame,
    *,
    data_format: DataFormat = DataFormat.PANDAS_DATAFRAME,
    disabled: bool | list[str | int] = False,
    include_row_count: bool = True,
    include_index_values: bool = True,
    disabled_columns: tuple[str | int, ...] = (),
) -> str:
    """Get the data editor schema signature for tests."""
    arrow_schema = _get_arrow_schema(df)
    return _compute_data_editor_signature(
        data_df=df,
        data_format=data_format,
        arrow_schema=arrow_schema,
        dataframe_schema=determine_dataframe_schema(df, arrow_schema),
        disabled=disabled,
        include_row_count=include_row_count,
        include_index_values=include_index_values,
        disabled_columns=disabled_columns,
    )


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
            (
                100000,
                ColumnDataKind.TIMEDELTA,
                pd.Timedelta(100000),
            ),
            (
                [1, 2, 3],
                ColumnDataKind.LIST,
                [1, 2, 3],
            ),
            (
                ("1", "2", "3"),
                ColumnDataKind.LIST,
                ["1", "2", "3"],
            ),
            (
                "foo",
                ColumnDataKind.LIST,
                ["foo"],
            ),
            (
                ["foo"],
                ColumnDataKind.EMPTY,
                ["foo"],
            ),
            # Scalar values with EMPTY data kind should remain scalars (fix for #13305, #13307)
            (
                None,
                ColumnDataKind.EMPTY,
                None,
            ),
            (
                42,
                ColumnDataKind.EMPTY,
                42,
            ),
            (
                "text",
                ColumnDataKind.EMPTY,
                "text",
            ),
            (
                3.14,
                ColumnDataKind.EMPTY,
                3.14,
            ),
            (
                True,
                ColumnDataKind.EMPTY,
                True,
            ),
            # Invalid / edge-case inputs that should normalize to None or pass through.
            ("not_a_number", ColumnDataKind.INTEGER, None),
            ("not-a-date", ColumnDataKind.DATETIME, None),
            (float("nan"), ColumnDataKind.DATETIME, None),
            ("anything", ColumnDataKind.UNKNOWN, "anything"),
            ([1, 2, 3], ColumnDataKind.INTEGER, None),
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
        assert result == expected

    def test_data_editor_serde_serialize_round_trips(self):
        """``DataEditorSerde.serialize`` produces JSON containing all editing-state keys."""
        state = DataEditorState(
            {
                "edited_rows": {0: {"col1": 1}},
                "added_rows": [],
                "deleted_rows": [],
            }
        )
        decoded = json.loads(DataEditorSerde().serialize(state))
        assert decoded == {
            "edited_rows": {"0": {"col1": 1}},
            "added_rows": [],
            "deleted_rows": [],
        }

    def test_data_editor_serde_deserialize_none_returns_empty_state(self):
        """A None ui_value should produce an empty editing state."""
        result = DataEditorSerde().deserialize(None)
        assert isinstance(result, DataEditorState)
        assert result == {
            "edited_rows": {},
            "added_rows": [],
            "deleted_rows": [],
        }

    def test_data_editor_serde_deserialize_partial_payload_fills_defaults(self):
        """Missing payload keys are filled with empty defaults and row keys become ints."""
        payload = json.dumps({"edited_rows": {"0": {"col1": 1}}})
        assert DataEditorSerde().deserialize(payload) == {
            "edited_rows": {0: {"col1": 1}},
            "added_rows": [],
            "deleted_rows": [],
        }

    def test_data_editor_serde_converts_string_keys_to_int(self):
        """String row position keys from JSON are converted to ints."""
        payload = json.dumps(
            {
                "edited_rows": {"5": {"col1": 1}, "10": {"col1": 2}},
                "added_rows": [],
                "deleted_rows": [],
            }
        )
        result = DataEditorSerde().deserialize(payload)
        assert result["edited_rows"] == {5: {"col1": 1}, 10: {"col1": 2}}

    def test_data_editor_serde_returns_typed_state_class(self):
        """``deserialize`` returns a typed ``DataEditorState`` with attribute access."""
        result = DataEditorSerde().deserialize(
            json.dumps(
                {
                    "edited_rows": {"0": {"col1": 1}},
                    "added_rows": [{"col1": 2}],
                    "deleted_rows": [1],
                }
            )
        )

        assert isinstance(result, DataEditorState)
        assert result.edited_rows == {0: {"col1": 1}}
        assert result["added_rows"] == [{"col1": 2}]
        assert result.deleted_rows == [1]

    def test_data_editor_state_is_read_only(self):
        """Pending edit state rejects top-level and nested-dict mutation.

        It also keeps its typed class through deepcopy, since Session State
        deep-copies widget values. List fields are ordinary lists and are not
        frozen (same as other list-bearing widget states).
        """
        result = DataEditorSerde().deserialize(None)

        with pytest.raises(TypeError, match="Widget state is read-only"):
            result["edited_rows"] = {}
        with pytest.raises(TypeError, match="Widget state is read-only"):
            result.edited_rows = {}  # type: ignore[misc]
        with pytest.raises(TypeError, match="Widget state is read-only"):
            result["edited_rows"][0] = {"col1": 1}

        # Read access still works, and deepcopy preserves the concrete type.
        assert result.edited_rows == {}
        assert isinstance(copy.deepcopy(result), DataEditorState)

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
                    Decimal(123456),
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

        assert df.iat[0, 0] == 10
        assert df.iat[0, 1] == "foo"
        # pandas 3.x uses NA instead of None for missing values in string columns
        assert pd.isna(df.iat[1, 1])
        assert not df.iat[0, 2]
        assert df.iat[0, 3] == pd.Timestamp("2020-03-20T14:28:23")
        assert df.iat[0, 4] == Decimal("2.3")

    def test_apply_cell_edits_empty_columns(self):
        """Test applying cell edits to empty (None-only) columns.

        Regression test for issues #13305 and #13307 where scalar values
        were incorrectly wrapped in lists when editing empty columns.
        """
        # Create DataFrame with None values in all columns
        df = pd.DataFrame(
            {
                "number_col": [None],
                "text_col": [None],
                "list_col": [None],
            }
        )

        edited_rows: Mapping[
            int, Mapping[str, str | int | float | bool | list[str] | None]
        ] = {
            0: {
                "number_col": 42,
                "text_col": "hello",
                "list_col": ["a", "b"],
            },
        }

        _apply_cell_edits(
            df, edited_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        # Scalar values should remain scalars, not be wrapped in lists
        assert df.iat[0, 0] == 42
        assert not isinstance(df.iat[0, 0], list)

        assert df.iat[0, 1] == "hello"
        assert not isinstance(df.iat[0, 1], list)

        # List values should remain lists
        assert df.iat[0, 2] == ["a", "b"]
        assert isinstance(df.iat[0, 2], list)

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
                "col5": [["x"], ["y"], ["z"]],
            }
        )

        added_rows: list[dict[str, Any]] = [
            {
                "col1": 10,
                "col2": "foo",
                "col3": False,
                "col4": "2020-03-20T14:28:23",
                "col5": ["x", "y"],
            },
            {
                "col1": 11,
                "col2": "bar",
                "col3": True,
                "col4": "2023-03-20T14:28:23",
                "col5": ["z"],
            },
        ]

        _apply_row_additions(
            df, added_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        assert len(df) == 5
        assert df.loc[3, "col5"] == ["x", "y"]
        assert df.loc[4, "col5"] == ["z"]
        assert pd.api.types.is_bool_dtype(df["col3"])

    def test_apply_row_deletions(self):
        """Test applying row deletions to a DataFrame."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
                "col3": [True, False, True],
            }
        )

        deleted_rows: list[int] = [0, 2]

        _apply_row_deletions(df, deleted_rows)

        assert len(df) == 1, f"Only one row should be left, but has {len(df)}."
        assert df.iloc[0].to_list() == [2, "b", False]

    def test_apply_dataframe_edits(self):
        """Test applying edits to a DataFrame."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
                "col3": [True, False, True],
            }
        )

        deleted_rows: list[int] = [0, 2]
        added_rows: list[dict[str, Any]] = [
            {"col1": 10, "col2": "foo", "col3": False},
            {"col1": 11, "col2": "bar", "col3": True},
        ]

        edited_rows: dict[int, dict[str, str | int | float | bool | None]] = {
            1: {
                "col1": 123,
            }
        }

        _apply_dataframe_edits(
            df,
            DataEditorState(
                {
                    "deleted_rows": deleted_rows,
                    "added_rows": added_rows,
                    "edited_rows": edited_rows,
                }
            ),
            determine_dataframe_schema(df, _get_arrow_schema(df)),
        )

        assert df.to_dict(orient="list") == {
            "col1": [123, 10, 11],
            "col2": ["b", "foo", "bar"],
            "col3": [False, False, True],
        }

    def test_apply_dataframe_edits_handles_index_changes(self):
        """Test applying edits to a DataFrame correctly handles index changes.

        See: https://github.com/streamlit/streamlit/issues/8854
        """
        df = pd.DataFrame(
            {
                "A": [1, 2, 3, 4, 5],
                "B": [10, 20, 30, 40, 50],
            }
        ).set_index("A")

        deleted_rows: list[int] = [4]
        added_rows: list[dict[str, Any]] = [{"_index": 5, "B": 123}]
        edited_rows: dict[int, Any] = {}

        _apply_dataframe_edits(
            df,
            DataEditorState(
                {
                    "deleted_rows": deleted_rows,
                    "added_rows": added_rows,
                    "edited_rows": edited_rows,
                }
            ),
            determine_dataframe_schema(df, _get_arrow_schema(df)),
        )

        assert df.to_dict(orient="list") == {"B": [10, 20, 30, 40, 123]}

    def test_apply_row_additions_range_index(self):
        """Test adding rows to a DataFrame with a RangeIndex."""
        df = pd.DataFrame({"col1": [1, 2]}, index=pd.RangeIndex(0, 2, 1))
        added_rows: list[dict[str, Any]] = [
            {"col1": 10},
            {"col1": 11},
        ]

        _apply_row_additions(
            df, added_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        expected_df = pd.DataFrame(
            {"col1": [1, 2, 10, 11]}, index=pd.RangeIndex(0, 4, 1)
        )
        pd.testing.assert_frame_equal(df, expected_df, check_dtype=False)

    def test_apply_row_additions_int_index_non_contiguous(self):
        """Test adding rows to a DataFrame with a non-contiguous integer index."""
        df = pd.DataFrame({"col1": [1, 3]}, index=pd.Index([0, 2], dtype="int64"))
        added_rows: list[dict[str, Any]] = [
            {"col1": 10},
            {"col1": 11},
        ]

        _apply_row_additions(
            df, added_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        expected_df = pd.DataFrame(
            {"col1": [1, 3, 10, 11]}, index=pd.Index([0, 2, 3, 4], dtype="int64")
        )
        pd.testing.assert_frame_equal(df, expected_df, check_dtype=False)

    def test_apply_row_additions_empty_df(self):
        """Test adding rows to an empty DataFrame."""
        df = pd.DataFrame(
            {"col1": pd.Series(dtype="int")}, index=pd.RangeIndex(0, 0, 1)
        )
        assert df.empty
        added_rows: list[dict[str, Any]] = [
            {"col1": 10},
            {"col1": 11},
        ]

        _apply_row_additions(
            df, added_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        expected_df = pd.DataFrame({"col1": [10, 11]}, index=pd.RangeIndex(0, 2, 1))
        pd.testing.assert_frame_equal(df, expected_df, check_dtype=False)

    @patch("streamlit.elements.widgets.data_editor._LOGGER")
    def test_apply_row_additions_other_index_no_value_logs_warning(self, mock_logger):
        """Test adding to non-auto-increment index without value logs warning."""
        df = pd.DataFrame(
            {"col1": [1, 2]},
            index=pd.to_datetime(["2023-01-01", "2023-01-02"]),
        )
        added_rows: list[dict[str, Any]] = [
            {"col1": 10},  # No _index provided
        ]
        original_len = len(df)

        _apply_row_additions(
            df, added_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        # Verify row was NOT added
        assert len(df) == original_len
        # Verify warning was logged
        mock_logger.warning.assert_called_once()
        assert "Cannot automatically add row" in mock_logger.warning.call_args[0][0]

    def test_apply_row_additions_other_index_with_value(self):
        """Test adding to non-auto-increment index with provided value."""
        index = pd.to_datetime(["2023-01-01", "2023-01-02"])
        df = pd.DataFrame({"col1": [1, 2]}, index=index)
        added_rows: list[dict[str, Any]] = [
            {"_index": "2023-01-03", "col1": 10},
        ]

        _apply_row_additions(
            df, added_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        expected_index = pd.to_datetime(["2023-01-01", "2023-01-02", "2023-01-03"])
        expected_df = pd.DataFrame({"col1": [1, 2, 10]}, index=expected_index)
        pd.testing.assert_frame_equal(df, expected_df, check_dtype=False)

    @patch("streamlit.elements.widgets.data_editor._LOGGER")
    def test_apply_row_additions_existing_index_is_skipped(self, mock_logger):
        """Test that an added row cannot overwrite an existing index value."""
        df = pd.DataFrame(
            {
                "role": ["viewer", "viewer"],
                "balance": [100, 200],
            },
            index=["victim@corp.com", "other@corp.com"],
        )
        original_df = df.copy()
        added_rows: list[dict[str, Any]] = [
            {
                "_index": "victim@corp.com",
                "role": "admin",
                "balance": 0,
            },
        ]

        _apply_row_additions(
            df, added_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        pd.testing.assert_frame_equal(df, original_df)
        mock_logger.warning.assert_called_once_with(
            "Cannot add row because its index value already exists. "
            "Row addition skipped."
        )

    @patch("streamlit.elements.widgets.data_editor._LOGGER")
    def test_apply_row_additions_skips_only_duplicate_in_batch(self, mock_logger):
        """Test that a duplicate index is skipped while other additions still apply."""
        df = pd.DataFrame(
            {
                "role": ["viewer", "viewer"],
                "balance": [100, 200],
            },
            index=["victim@corp.com", "other@corp.com"],
        )
        added_rows: list[dict[str, Any]] = [
            {"_index": "victim@corp.com", "role": "admin", "balance": 0},
            {"_index": "new@corp.com", "role": "viewer", "balance": 300},
        ]

        _apply_row_additions(
            df, added_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        # The colliding row is skipped, but the unique row is still added.
        expected_df = pd.DataFrame(
            {
                "role": ["viewer", "viewer", "viewer"],
                "balance": [100, 200, 300],
            },
            index=["victim@corp.com", "other@corp.com", "new@corp.com"],
        )
        pd.testing.assert_frame_equal(df, expected_df, check_dtype=False)
        mock_logger.warning.assert_called_once_with(
            "Cannot add row because its index value already exists. "
            "Row addition skipped."
        )

    def test_apply_dataframe_edits_delete_then_re_add_same_index(self):
        """Test re-adding a deleted index value succeeds (deletions run first)."""
        df = pd.DataFrame(
            {
                "role": ["viewer", "viewer"],
                "balance": [100, 200],
            },
            index=["victim@corp.com", "other@corp.com"],
        )

        # Delete the first row and re-add a row reusing its index value in the
        # same batch. Deletions run before additions, so the re-added label is
        # no longer present and the addition must not be rejected as a duplicate.
        _apply_dataframe_edits(
            df,
            DataEditorState(
                {
                    "deleted_rows": [0],
                    "added_rows": [
                        {"_index": "victim@corp.com", "role": "admin", "balance": 0},
                    ],
                    "edited_rows": {},
                }
            ),
            determine_dataframe_schema(df, _get_arrow_schema(df)),
        )

        expected_df = pd.DataFrame(
            {
                "role": ["viewer", "admin"],
                "balance": [200, 0],
            },
            index=["other@corp.com", "victim@corp.com"],
        )
        pd.testing.assert_frame_equal(df, expected_df, check_dtype=False)

    def test_apply_row_additions_range_index_with_value(self):
        r"""Test adding row to RangeIndex with explicit _index provided
        (should still auto-increment)."""
        # This tests the `index_type != \"range\"` condition in the first branch.
        df = pd.DataFrame({"col1": [1, 2]}, index=pd.RangeIndex(0, 2, 1))
        added_rows: list[dict[str, Any]] = [
            {"_index": 99, "col1": 10},  # Provide an index value
        ]

        _apply_row_additions(
            df, added_rows, determine_dataframe_schema(df, _get_arrow_schema(df))
        )

        # Even though _index=99 was provided, it should auto-increment the RangeIndex.
        expected_df = pd.DataFrame({"col1": [1, 2, 10]}, index=pd.RangeIndex(0, 3, 1))
        pd.testing.assert_frame_equal(df, expected_df, check_dtype=False)

    def test_apply_dataframe_edits_delete_and_add_range_index(self):
        """Test applying edits involving deletion and addition on a RangeIndex."""
        # Initial DF with RangeIndex
        df = pd.DataFrame({"col1": [1, 2, 3, 4]}, index=pd.RangeIndex(0, 4, 1))

        # Delete row at index 1 (value 2)
        deleted_rows: list[int] = [1]
        # Add a new row
        added_rows: list[dict[str, Any]] = [
            {"col1": 10},
        ]
        # No cell edits for this test
        edited_rows: dict[int, Any] = {}

        # Expected state after edits:
        # - Row 1 (value 2) deleted.
        # - Index becomes integer index [0, 2, 3].
        # - New row added with index max+1 = 4.
        # - Final index: integer index [0, 2, 3, 4]
        # - Final values: [1, 3, 4, 10]
        expected_df = pd.DataFrame(
            {"col1": [1, 3, 4, 10]}, index=pd.Index([0, 2, 3, 4], dtype="int64")
        )

        _apply_dataframe_edits(
            df,
            DataEditorState(
                {
                    "deleted_rows": deleted_rows,
                    "added_rows": added_rows,
                    "edited_rows": edited_rows,
                }
            ),
            determine_dataframe_schema(df, _get_arrow_schema(df)),
        )

        # Check dtypes=False because deletion/addition might change column dtypes
        pd.testing.assert_frame_equal(df, expected_df, check_dtype=False)

    def test_apply_dataframe_edits_string_index_delete_and_edit(self):
        """Test applying edits with string index: delete last two rows and edit first row index.

        Related issue: https://github.com/streamlit/streamlit/pull/11448
        """
        # Create DataFrame with 10 rows and string index
        df = pd.DataFrame(
            {"col1": list(range(10)), "col2": [f"value_{i}" for i in range(10)]},
            index=[f"row_{i}" for i in range(10)],
        )

        # Delete the last two rows (indices 8 and 9)
        deleted_rows: list[int] = [8, 9]
        # Edit the index value of the first row (row 0)
        edited_rows: dict[int, dict[str, str | int | float | bool | None]] = {
            0: {
                INDEX_IDENTIFIER: "edited_row_0",
            }
        }
        # No row additions for this test
        added_rows: list[dict[str, Any]] = []

        _apply_dataframe_edits(
            df,
            DataEditorState(
                {
                    "deleted_rows": deleted_rows,
                    "added_rows": added_rows,
                    "edited_rows": edited_rows,
                }
            ),
            determine_dataframe_schema(df, _get_arrow_schema(df)),
        )

        # Expected results:
        # - Rows 8 and 9 should be deleted (original rows with values 8,9)
        # - Index of first row should be changed from "row_0" to "edited_row_0"
        # - Should have 8 rows remaining (0-7, with 8-9 deleted)
        assert len(df) == 8

        # Check that the index was properly edited
        assert df.index[0] == "edited_row_0"

        # Check that the remaining indices are correct (excluding the edited first one)
        expected_remaining_indices = ["edited_row_0"] + [
            f"row_{i}" for i in range(1, 8)
        ]
        assert df.index.tolist() == expected_remaining_indices

        # Check that the data values are correct
        expected_col1_values = list(range(8))  # 0-7, since rows 8-9 were deleted
        expected_col2_values = [f"value_{i}" for i in range(8)]
        assert df["col1"].tolist() == expected_col1_values
        assert df["col2"].tolist() == expected_col2_values


class DataEditorSignatureTest(unittest.TestCase):
    def test_signature_stable_when_only_values_change(self):
        df1 = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
        df2 = pd.DataFrame({"a": [10, 20], "b": ["foo", "bar"]})

        assert _get_data_editor_signature(df1) == _get_data_editor_signature(df2)

    @parameterized.expand(
        [
            ("column_name", pd.DataFrame({"renamed": [1, 2]})),
            ("arrow_type", pd.DataFrame({"a": [1.0, 2.5]})),
            ("index_type", pd.DataFrame({"a": [1, 2]}, index=["x", "y"])),
            ("row_count", pd.DataFrame({"a": [1, 2, 3]})),
        ]
    )
    def test_signature_changes_for_schema_changes(
        self, _name: str, changed_df: pd.DataFrame
    ):
        df = pd.DataFrame({"a": [1, 2]})

        assert _get_data_editor_signature(df) != _get_data_editor_signature(changed_df)

    @parameterized.expand(
        [
            (False, True),
            (False, ["a"]),
            (["a"], ["b"]),
        ]
    )
    def test_signature_changes_for_disabled_config(
        self, disabled1: bool | list[str], disabled2: bool | list[str]
    ):
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})

        assert _get_data_editor_signature(
            df, disabled=disabled1
        ) != _get_data_editor_signature(df, disabled=disabled2)

    def test_signature_stable_for_disabled_false_and_empty_list(self):
        """An empty ``disabled`` list means the same as ``disabled=False``
        (nothing disabled), so both must produce the same signature to avoid
        needless widget resets when toggling between them."""
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})

        assert _get_data_editor_signature(
            df, disabled=False
        ) == _get_data_editor_signature(df, disabled=[])

    def test_signature_changes_when_column_disabled_via_config(self):
        """A column disabled via column_config must change the signature even
        when the top-level ``disabled`` argument is unchanged."""
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})

        assert _get_data_editor_signature(df) != _get_data_editor_signature(
            df, disabled_columns=("a",)
        )

    def test_signature_changes_when_disabled_column_set_changes(self):
        """Changing which columns are disabled via config must change the
        signature."""
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})

        assert _get_data_editor_signature(
            df, disabled_columns=("a",)
        ) != _get_data_editor_signature(df, disabled_columns=("b",))

    def test_signature_can_exclude_row_count(self):
        df1 = pd.DataFrame({"a": [1, 2]})
        df2 = pd.DataFrame({"a": [1, 2, 3]})

        assert _get_data_editor_signature(
            df1, include_row_count=False
        ) == _get_data_editor_signature(df2, include_row_count=False)

    def test_signature_treats_string_arrow_variants_as_equal(self):
        """A ``string`` and ``large_string`` field are the same to the editor, so
        the signature (and thus widget identity) must not distinguish them.
        Otherwise a committed frame that serializes as ``string`` would churn the
        identity of a baseline that serialized as ``large_string``."""
        df = pd.DataFrame({"b": ["x", "y"]})
        dataframe_schema = determine_dataframe_schema(df, _get_arrow_schema(df))

        def signature(field_type: pa.DataType) -> str:
            return _compute_data_editor_signature(
                data_df=df,
                data_format=DataFormat.PANDAS_DATAFRAME,
                arrow_schema=pa.schema([pa.field("b", field_type, nullable=True)]),
                dataframe_schema=dataframe_schema,
                disabled=False,
                include_row_count=True,
            )

        assert signature(pa.string()) == signature(pa.large_string())

    def test_signature_can_exclude_index_values(self):
        """Excluding index values keeps the signature stable across index-label
        changes (used by commit_edits editors, whose committed result may
        renumber rows)."""
        df1 = pd.DataFrame({"a": [1, 2]}, index=["x", "y"])
        df2 = pd.DataFrame({"a": [1, 2]}, index=["p", "q"])

        assert _get_data_editor_signature(
            df1, include_index_values=False
        ) == _get_data_editor_signature(df2, include_index_values=False)

    def test_signature_stable_across_range_to_integer_index_downcast(self) -> None:
        """A RangeIndex baseline and a pandas < 3.0 integer-Index result must
        share the commit_edits schema signature.

        Arrow only materializes ``__index_level_0__`` for the integer Index;
        hashing that field would churn the widget id and orphan the next edit.
        """
        baseline = pd.DataFrame({"a": [1, 2]})
        assert isinstance(baseline.index, pd.RangeIndex)

        # Simulate the pandas < 3.0 ``.loc`` append downcast (and force it on
        # pandas 3+ where RangeIndex may be preserved).
        edited = baseline.copy()
        edited.loc[len(edited)] = 3
        if isinstance(edited.index, pd.RangeIndex):
            edited.index = pd.Index(list(edited.index))
        # Older pandas may use Int64Index rather than a plain Index.
        assert not isinstance(edited.index, pd.RangeIndex)
        assert pd.api.types.is_integer_dtype(edited.index.dtype)

        assert _get_data_editor_signature(
            baseline, include_row_count=False, include_index_values=False
        ) == _get_data_editor_signature(
            edited, include_row_count=False, include_index_values=False
        )
        # Including index values / row count must still distinguish them so
        # non-commit keyed editors keep noticing structural changes.
        assert _get_data_editor_signature(baseline) != _get_data_editor_signature(
            edited
        )

    def test_signature_hashes_meaningful_index_values(self):
        df = pd.DataFrame({"a": [1, 2, 3]}, index=["x", "y", "z"])
        reordered_df = df.iloc[::-1]

        assert _get_data_editor_signature(df) != _get_data_editor_signature(
            reordered_df
        )

    def test_signature_ignores_default_range_index_values(self):
        df1 = pd.DataFrame({"a": [1, 2]})
        df2 = pd.DataFrame({"a": [10, 20]})

        assert _get_data_editor_signature(df1) == _get_data_editor_signature(df2)

    def test_signature_distinguishes_column_name_boundaries(self):
        """Column names that concatenate to the same characters but are split
        differently must yield different signatures, so adjacent names cannot be
        silently merged across their boundary."""
        df1 = pd.DataFrame([[1, 2]], columns=["a", "bc"])
        df2 = pd.DataFrame([[1, 2]], columns=["ab", "c"])

        assert _get_data_editor_signature(df1) != _get_data_editor_signature(df2)


class DataEditorStableIdTest(DeltaGeneratorTestCase):
    def _get_id(self, df: pd.DataFrame, **kwargs: Any) -> str:
        # Patch element ID registration so the same key can be reused across
        # multiple calls within a single test without raising a duplicate error.
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.data_editor(df, **kwargs)
        return self.get_delta_from_queue().new_element.dataframe.id

    def test_keyed_fixed_editor_id_stable_when_only_values_change(self):
        id1 = self._get_id(pd.DataFrame({"a": [1, 2], "b": ["x", "y"]}), key="editor")
        id2 = self._get_id(
            pd.DataFrame({"a": [10, 20], "b": ["foo", "bar"]}), key="editor"
        )

        assert id1 == id2

    @parameterized.expand(
        [
            ("columns", pd.DataFrame({"renamed": [1, 2]})),
            ("dtypes", pd.DataFrame({"a": [1.0, 2.0]})),
            ("row_count", pd.DataFrame({"a": [1, 2, 3]})),
        ]
    )
    def test_keyed_fixed_editor_id_changes_for_schema_changes(
        self, _name: str, changed_df: pd.DataFrame
    ):
        id1 = self._get_id(pd.DataFrame({"a": [1, 2]}), key="editor")
        id2 = self._get_id(changed_df, key="editor")

        assert id1 != id2

    def test_keyed_fixed_editor_id_changes_when_column_config_disables_column(self):
        """Disabling a column via column_config must reset the widget identity
        so pending edits to the now read-only column do not survive."""
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})

        id1 = self._get_id(df, key="editor")
        id2 = self._get_id(
            df,
            key="editor",
            column_config={"a": st.column_config.Column(disabled=True)},
        )

        assert id1 != id2

    def test_keyed_fixed_editor_id_ignores_cosmetic_params(self):
        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})

        id1 = self._get_id(
            df,
            key="editor",
            width=300,
            height=200,
            column_order=["a", "b"],
            column_config={"a": "A"},
            row_height=25,
            placeholder="Empty",
        )
        id2 = self._get_id(
            df,
            key="editor",
            width=500,
            height=400,
            column_order=["b", "a"],
            column_config={"a": "Renamed A"},
            row_height=35,
            placeholder="Nothing here",
        )

        assert id1 == id2

    def test_unkeyed_editor_id_changes_when_values_change(self):
        id1 = self._get_id(pd.DataFrame({"a": [1, 2]}))
        id2 = self._get_id(pd.DataFrame({"a": [10, 20]}))

        assert id1 != id2

    @parameterized.expand(["dynamic", "add", "delete"])
    def test_keyed_non_fixed_editor_id_changes_when_values_change(self, num_rows: str):
        id1 = self._get_id(pd.DataFrame({"a": [1, 2]}), key="editor", num_rows=num_rows)
        id2 = self._get_id(
            pd.DataFrame({"a": [10, 20]}), key="editor", num_rows=num_rows
        )

        assert id1 != id2

    def test_keyed_editor_id_changes_when_num_rows_mode_changes(self):
        df = pd.DataFrame({"a": [1, 2]})

        id1 = self._get_id(df, key="editor", num_rows="fixed")
        id2 = self._get_id(df, key="editor", num_rows="dynamic")

        assert id1 != id2

    @parameterized.expand(["fixed", "dynamic", "add", "delete"])
    def test_commit_edits_editor_id_stable_when_row_count_changes(self, num_rows: str):
        """A commit_edits editor must keep a stable identity across row-count
        changes (for every num_rows mode) so that a committed result -- which
        may change the row count -- does not orphan the next edit."""

        def commit(source, edited, edits):  # type: ignore[no-untyped-def]
            return edited

        id1 = self._get_id(
            pd.DataFrame({"a": [1, 2]}),
            key="editor",
            num_rows=num_rows,
            commit_edits=commit,
        )
        id2 = self._get_id(
            pd.DataFrame({"a": [1, 2, 3, 4]}),
            key="editor",
            num_rows=num_rows,
            commit_edits=commit,
        )

        assert id1 == id2

    def test_commit_edits_editor_id_stable_when_index_labels_change(self):
        """A commit_edits editor must keep a stable identity when only the
        index labels change, since a commit can renumber rows."""

        def commit(source, edited, edits):  # type: ignore[no-untyped-def]
            return edited

        id1 = self._get_id(
            pd.DataFrame({"a": [1, 2]}, index=["x", "y"]),
            key="editor",
            num_rows="dynamic",
            commit_edits=commit,
        )
        id2 = self._get_id(
            pd.DataFrame({"a": [1, 2]}, index=["p", "q"]),
            key="editor",
            num_rows="dynamic",
            commit_edits=commit,
        )

        assert id1 == id2

    def test_commit_edits_editor_id_changes_for_schema_changes(self):
        """A commit_edits editor must still reset its identity when the schema
        (columns/dtypes) changes, since edits are positional to that schema."""

        def commit(source, edited, edits):  # type: ignore[no-untyped-def]
            return edited

        id1 = self._get_id(
            pd.DataFrame({"a": [1, 2]}),
            key="editor",
            num_rows="dynamic",
            commit_edits=commit,
        )
        id2 = self._get_id(
            pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
            key="editor",
            num_rows="dynamic",
            commit_edits=commit,
        )

        assert id1 != id2


class DataEditorTest(DeltaGeneratorTestCase):
    def test_default_params(self):
        """Test that it can be called with a dataframe."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        st.data_editor(df)

        # Get the element from the queue
        el = self.get_delta_from_queue().new_element
        proto = el.dataframe
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.arrow_data.data), df
        )

        # Test default width configuration (should be 'stretch')
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

        # Test other default values
        assert proto.editing_mode == DataframeProto.EditingMode.FIXED
        assert proto.selection_mode == []
        assert not proto.disabled
        assert proto.column_order == []
        assert proto.row_height == 0
        assert proto.form_id == ""
        assert proto.columns == "{}"
        # ID should be set
        assert proto.id != ""
        # Row height should not be set if not specified
        assert not proto.HasField("row_height")
        assert not proto.HasField("placeholder")

    def test_just_disabled_true(self):
        """Test that it can be called with disabled=True param."""
        st.data_editor(pd.DataFrame(), disabled=True)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.disabled

    def test_just_disabled_false(self):
        """Test that it can be called with disabled=False param."""
        st.data_editor(pd.DataFrame(), disabled=False)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert not proto.disabled

    def test_just_width_height(self):
        """Test that it can be called with width and height."""
        st.data_editor(pd.DataFrame(), width=300, height=400)

        # Get the element from the queue
        el = self.get_delta_from_queue().new_element

        # Test width configuration (should be pixel width)
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.width_config.pixel_width == 300

        assert el.height_config.WhichOneof("height_spec") == "pixel_height"
        assert el.height_config.pixel_height == 400

    @parameterized.expand(
        [
            ("fixed", DataframeProto.EditingMode.FIXED),
            ("dynamic", DataframeProto.EditingMode.DYNAMIC),
            ("add", DataframeProto.EditingMode.ADD_ONLY),
            ("delete", DataframeProto.EditingMode.DELETE_ONLY),
        ]
    )
    def test_num_rows_parameter(self, num_rows_value: str, expected_mode: int):
        """Test that it can be called with the given num_rows value."""
        st.data_editor(pd.DataFrame(), num_rows=num_rows_value)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.editing_mode == expected_mode

    def test_column_order_parameter(self):
        """Test that it can be called with column_order."""
        st.data_editor(pd.DataFrame(), column_order=["a", "b"])

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.column_order == ["a", "b"]

    def test_row_height_parameter(self):
        """Test that it can be called with row_height."""
        st.data_editor(pd.DataFrame(), row_height=100)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.row_height == 100

    def test_placeholder_parameter(self):
        """Test that it can be called with placeholder."""
        st.data_editor(pd.DataFrame(), placeholder="N/A")

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.placeholder == "N/A"

    def test_just_use_container_width(self):
        """Test that use_container_width parameter works and shows deprecation warning."""
        with patch(
            "streamlit.elements.widgets.data_editor.show_deprecation_warning"
        ) as mock_warning:
            st.data_editor(pd.DataFrame(), use_container_width=True)

            # Check deprecation warning is shown
            mock_warning.assert_called_once()
            assert "use_container_width" in mock_warning.call_args[0][0]

        el = self.get_delta_from_queue().new_element
        # When use_container_width=True, it should set width='stretch'
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

    def test_use_container_width_false(self):
        """Test use_container_width=False sets width='content'."""
        with patch(
            "streamlit.elements.widgets.data_editor.show_deprecation_warning"
        ) as mock_warning:
            st.data_editor(pd.DataFrame({"a": [1, 2, 3]}), use_container_width=False)

            # Check deprecation warning is shown
            mock_warning.assert_called_once()

        el = self.get_delta_from_queue().new_element
        # When use_container_width=False, it should set width='content'
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_use_container_width_false_with_integer_width(self):
        """Test use_container_width=False with integer width preserves the integer."""
        with patch("streamlit.elements.widgets.data_editor.show_deprecation_warning"):
            st.data_editor(pd.DataFrame(), width=400, use_container_width=False)

        el = self.get_delta_from_queue().new_element
        # When use_container_width=False with integer width, keep the integer width
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.width_config.pixel_width == 400

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

        proto = self.get_delta_from_queue().new_element.dataframe
        assert not proto.disabled
        assert proto.columns == json.dumps(
            {"a": {"disabled": True}, "b": {"disabled": True}}
        )

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""
        st.data_editor(pd.DataFrame())

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.form_id == ""

    def test_hide_index_true(self):
        """Test that it can be called with hide_index=True param."""
        data_df = pd.DataFrame(
            {
                "a": pd.Series([1, 2]),
                "b": pd.Series(["foo", "bar"]),
            }
        )

        st.data_editor(data_df, hide_index=True)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.columns == json.dumps({INDEX_IDENTIFIER: {"hidden": True}})

    def test_hide_index_false(self):
        """Test that it can be called with hide_index=False param."""
        data_df = pd.DataFrame(
            {
                "a": pd.Series([1, 2]),
                "b": pd.Series(["foo", "bar"]),
            }
        )

        st.data_editor(data_df, hide_index=False)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.columns == json.dumps({INDEX_IDENTIFIER: {"hidden": False}})

    @patch("streamlit.elements.widgets.data_editor._LOGGER")
    def test_hide_index_true_dynamic_non_range_index_logs_warning(
        self, mock_logger: MagicMock
    ):
        """Test that hide_index=True with dynamic rows and non-range index logs a warning."""
        df = pd.DataFrame({"a": [1, 2]}, index=["row_0", "row_1"])

        st.data_editor(df, hide_index=True, num_rows="dynamic")

        mock_logger.warning.assert_called_once()
        warning_message = mock_logger.warning.call_args[0][0]
        assert "hide_index=True" in warning_message
        # The warning message includes the mode via a format placeholder
        assert "num_rows" in warning_message

    @patch("streamlit.elements.widgets.data_editor._LOGGER")
    def test_hide_index_true_add_only_non_range_index_logs_warning(
        self, mock_logger: MagicMock
    ):
        """Test that hide_index=True with add-only rows and non-range index logs a warning."""
        df = pd.DataFrame({"a": [1, 2]}, index=["row_0", "row_1"])

        st.data_editor(df, hide_index=True, num_rows="add")

        mock_logger.warning.assert_called_once()
        warning_message = mock_logger.warning.call_args[0][0]
        assert "hide_index=True" in warning_message
        assert "num_rows" in warning_message

    @patch("streamlit.elements.widgets.data_editor._LOGGER")
    def test_hide_index_true_delete_only_non_range_index_no_warning(
        self, mock_logger: MagicMock
    ):
        """Test that hide_index=True with delete-only mode does not log a warning.

        Unlike dynamic and add modes, delete-only mode doesn't need index values
        for adding rows, so hiding the index should work without issues.
        """
        df = pd.DataFrame({"a": [1, 2]}, index=["row_0", "row_1"])

        st.data_editor(df, hide_index=True, num_rows="delete")

        mock_logger.warning.assert_not_called()

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""
        with st.form("form"):
            st.data_editor(pd.DataFrame())

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        dataframe_proto = self.get_delta_from_queue(1).new_element.dataframe
        assert dataframe_proto.form_id == form_proto.form.form_id

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

        proto = self.get_delta_from_queue().new_element.dataframe
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.arrow_data.data), df
        )
        pd.testing.assert_frame_equal(return_df, df)

    @parameterized.expand(SHARED_TEST_CASES)
    def test_with_compatible_data(
        self,
        name: str,
        input_data: Any,
        metadata: CaseMetadata,
    ):
        """Test that it can be called with compatible data."""
        if metadata.expected_data_format == DataFormat.UNKNOWN:
            # We can skip formats where the expected format is unknown
            # since these cases are not expected to work.
            return

        return_data = st.data_editor(input_data)

        proto = self.get_delta_from_queue().new_element.dataframe
        reconstructed_df = convert_arrow_bytes_to_pandas_df(proto.arrow_data.data)
        assert reconstructed_df.shape[0] == metadata.expected_rows
        assert reconstructed_df.shape[1] == metadata.expected_cols

        expected_type = (
            type(input_data)
            if metadata.expected_type is None
            else metadata.expected_type
        )
        # For pyarrow arrays, use isinstance check since pandas 3.x may return
        # LargeStringArray instead of StringArray for string columns
        if metadata.expected_data_format == DataFormat.PYARROW_ARRAY:
            import pyarrow as pa

            assert isinstance(return_data, pa.Array)
        else:
            assert type(return_data) is expected_type

        if isinstance(return_data, pd.DataFrame):
            assert return_data.shape[0] == metadata.expected_rows
            assert return_data.shape[1] == metadata.expected_cols
        elif (
            # Sets in python are unordered, so we can't compare them this way.
            metadata.expected_data_format != DataFormat.SET_OF_VALUES
            and metadata.expected_type is None
        ):
            assert str(return_data) == str(input_data)

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
        with pytest.raises(StreamlitAPIException):
            st.data_editor(input_data)

    def test_disables_columns_when_incompatible(self):
        """Test that Arrow incompatible columns are disabled (configured as non-editable)."""
        data_df = pd.DataFrame(
            {
                "a": pd.Series([1, 2]),
                "b": pd.Series(["foo", "bar"]),
                "c": pd.Series([1, "foo"]),  # Incompatible
                "d": pd.Series([1 + 2j, 3 + 4j]),  # Incompatible
            }
        )
        st.data_editor(data_df)

        proto = self.get_delta_from_queue().new_element.dataframe
        columns_config = json.loads(proto.columns)

        assert "a" not in columns_config
        assert "b" not in columns_config
        assert columns_config["c"]["disabled"]
        assert columns_config["d"]["disabled"]

    @parameterized.expand(
        [
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

        with pytest.raises(StreamlitAPIException):
            st.data_editor(df)

    @parameterized.expand(
        [
            (pd.RangeIndex(0, 3, 1),),
            (pd.Index([1, 2, -3], dtype="int64"),),
            (pd.Index([1, 2, 3], dtype="uint64"),),
            (pd.Index([1.0, 2.0, 3.0], dtype="float"),),
            (pd.Index(["a", "b", "c"]),),
            (pd.DatetimeIndex(["2020-01-01", "2020-01-02", "2020-01-03"]),),
            (pd.CategoricalIndex(["a", "b", "c"], categories=["a", "b", "c"]),),
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
        assert isinstance(return_df, pd.DataFrame)

    def test_check_type_compatibilities(self):
        """Test that _check_type_compatibilities raises an exception when called with incompatible data."""
        df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})

        schema = {
            INDEX_IDENTIFIER: ColumnDataKind.INTEGER,
            "col1": ColumnDataKind.INTEGER,
            "col2": ColumnDataKind.STRING,
        }

        with pytest.raises(StreamlitAPIException):
            _check_type_compatibilities(
                df,
                {
                    "col1": {"type_config": {"type": "text"}},
                    "col2": {"type_config": {"type": "text"}},
                },
                schema,
            )

        with pytest.raises(StreamlitAPIException):
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
            assert isinstance(return_df, pd.DataFrame)

    def test_works_with_multiindex_column_headers(self):
        """Test that it works with multiindex column headers."""
        df = pd.DataFrame(
            index=[0, 1],
            columns=[[2, 3, 4], ["c1", "c2", "c3"]],
            data=np.arange(0, 6, 1).reshape(2, 3),
        )

        return_df = st.data_editor(df)

        proto = self.get_delta_from_queue().new_element.dataframe
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.arrow_data.data), return_df
        )
        assert return_df.columns.to_list() == ["2_c1", "3_c2", "4_c3"]

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

        proto = self.get_delta_from_queue().new_element.dataframe
        assert (
            proto.arrow_data.styler.styles
            == "#T_be55047acf_row1_col2 { background-color: yellow }"
        )

        # Check that different delta paths lead to different element ids
        st.container().data_editor(styler, width=99)
        # delta path is: [0, 1, 0]
        proto = self.get_delta_from_queue().new_element.dataframe
        assert (
            proto.arrow_data.styler.styles
            == "#T_f74f894054_row1_col2 { background-color: yellow }"
        )

        st.container().container().data_editor(styler, width=100)
        # delta path is: [0, 2, 0, 0]
        proto = self.get_delta_from_queue().new_element.dataframe
        assert (
            proto.arrow_data.styler.styles
            == "#T_8b1f1a9d3a_row1_col2 { background-color: yellow }"
        )

    def test_duplicate_column_names_raise_exception(self):
        """Test that duplicate column names raise an exception."""
        # create a dataframe with duplicate columns
        df = pd.DataFrame({"duplicated": [1, 2, 3], "col2": [4, 5, 6]})
        df.rename(columns={"col2": "duplicated"}, inplace=True)

        # StreamlitAPIException should be raised
        with pytest.raises(StreamlitAPIException):
            _check_column_names(df)

    def test_non_string_column_names_are_converted_to_string(self):
        """Test that non-string column names are converted to string."""
        # create a dataframe with non-string columns
        df = pd.DataFrame(0, ["John", "Sarah", "Jane"], list(range(1, 4)))
        assert pd.api.types.infer_dtype(df.columns) != "string"
        return_df = st.data_editor(df)
        assert pd.api.types.infer_dtype(return_df.columns) == "string"

    def test_index_column_name_raises_exception(self):
        """Test that an index column name raises an exception."""
        # create a dataframe with a column named "_index"
        df = pd.DataFrame({INDEX_IDENTIFIER: [1, 2, 3], "col2": [4, 5, 6]})

        # StreamlitAPIException should be raised
        with pytest.raises(StreamlitAPIException):
            _check_column_names(df)

    def test_column_names_are_unique(self):
        """Test that unique column names do not raise an exception."""
        # create a dataframe with unique columns
        df = pd.DataFrame({"col1": [1, 2, 3], "col2": [4, 5, 6]})

        # no exception should be raised here
        _check_column_names(df)

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.data_editor(pd.DataFrame()))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-3).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_width_content(self):
        """Test that width='content' sets widthConfig correctly."""
        st.data_editor(pd.DataFrame({"a": [1, 2, 3]}), width="content")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_width_stretch_explicit(self):
        """Test that width='stretch' sets widthConfig correctly."""
        st.data_editor(pd.DataFrame({"a": [1, 2, 3]}), width="stretch")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

    def test_height_auto_default(self):
        """Test that default height='auto' doesn't set heightConfig."""
        st.data_editor(pd.DataFrame({"a": [1, 2, 3]}))

        el = self.get_delta_from_queue().new_element
        # height="auto" is the default and shouldn't set heightConfig
        assert el.height_config.WhichOneof("height_spec") is None

    def test_height_integer(self):
        """Test that integer height sets heightConfig correctly."""
        st.data_editor(pd.DataFrame({"a": [1, 2, 3]}), height=500)

        el = self.get_delta_from_queue().new_element
        assert el.height_config.WhichOneof("height_spec") == "pixel_height"
        assert el.height_config.pixel_height == 500

    def test_height_stretch(self):
        """Test that height='stretch' sets heightConfig correctly."""
        st.data_editor(pd.DataFrame({"a": [1, 2, 3]}), height="stretch")

        el = self.get_delta_from_queue().new_element
        assert (
            el.height_config.WhichOneof("height_spec")
            == HeightConfigFields.USE_STRETCH.value
        )
        assert el.height_config.use_stretch is True

    def test_height_content(self):
        """Test that height='content' sets heightConfig correctly."""
        st.data_editor(pd.DataFrame({"a": [1, 2, 3]}), height="content")

        el = self.get_delta_from_queue().new_element
        assert (
            el.height_config.WhichOneof("height_spec")
            == HeightConfigFields.USE_CONTENT.value
        )
        assert el.height_config.use_content is True


# The edit payload used across the commit-flow tests: change cell (row 0, col "a").
_CELL_EDIT: dict[str, Any] = {
    "edited_rows": {0: {"a": 5}},
    "added_rows": [],
    "deleted_rows": [],
}


def _make_edit_widget_state(widget_id: str, edit: dict[str, Any]) -> WidgetStates:
    """Build a WidgetStates proto carrying a single data editor edit payload."""
    widget_states = WidgetStates()
    widget = widget_states.widgets.add()
    widget.id = widget_id
    widget.string_value = json.dumps(edit)
    return widget_states


class HasPendingEditsTest(unittest.TestCase):
    """Tests for the _has_pending_edits helper."""

    @parameterized.expand(
        [
            ("empty", {"edited_rows": {}, "added_rows": [], "deleted_rows": []}, False),
            (
                "edited",
                {"edited_rows": {0: {"a": 1}}, "added_rows": [], "deleted_rows": []},
                True,
            ),
            (
                "added",
                {"edited_rows": {}, "added_rows": [{"a": 1}], "deleted_rows": []},
                True,
            ),
            (
                "deleted",
                {"edited_rows": {}, "added_rows": [], "deleted_rows": [1]},
                True,
            ),
        ]
    )
    def test_has_pending_edits(
        self, _name: str, state_dict: dict[str, Any], expected: bool
    ) -> None:
        """_has_pending_edits is True for any non-empty edit collection."""
        assert _has_pending_edits(DataEditorState(state_dict)) is expected


class ValidateEditedDataframeCompatibilityTest(unittest.TestCase):
    """Tests for the _validate_edited_dataframe_compatibility helper."""

    @staticmethod
    def _baseline(df: pd.DataFrame) -> tuple[pa.Schema, Any]:
        """Return the baseline Arrow schema and dataframe schema for a df."""
        arrow_schema = _get_arrow_schema(df)
        return arrow_schema, determine_dataframe_schema(df, arrow_schema)

    def _validate(self, result: Any, baseline: pd.DataFrame) -> tuple[Any, pa.Table]:
        arrow_schema, dataframe_schema = self._baseline(baseline)
        return _validate_edited_dataframe_compatibility(
            result,
            baseline_df=baseline,
            baseline_arrow_schema=arrow_schema,
            baseline_dataframe_schema=dataframe_schema,
        )

    def test_accepts_value_only_change(self) -> None:
        """A result that only changes values is compatible."""
        baseline = pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})
        result = pd.DataFrame({"a": [9, 8], "b": ["p", "q"]})

        validated, arrow_table = self._validate(result, baseline)
        assert validated is result
        assert isinstance(arrow_table, pa.Table)

    def test_accepts_row_addition(self) -> None:
        """A result with additional rows is compatible."""
        validated, _ = self._validate(
            pd.DataFrame({"a": [1, 2, 3]}), pd.DataFrame({"a": [1, 2]})
        )
        assert len(validated) == 3

    def test_accepts_row_deletion(self) -> None:
        """A result with fewer rows is compatible."""
        validated, _ = self._validate(
            pd.DataFrame({"a": [1, 2]}), pd.DataFrame({"a": [1, 2, 3]})
        )
        assert len(validated) == 2

    def test_accepts_index_label_change(self) -> None:
        """A result that only changes index labels is compatible."""
        baseline = pd.DataFrame({"a": [1, 2]}, index=pd.Index(["x", "y"]))
        result = pd.DataFrame({"a": [1, 2]}, index=pd.Index(["p", "q"]))

        validated, _ = self._validate(result, baseline)
        assert list(validated.index) == ["p", "q"]

    @parameterized.expand(
        [
            (
                "non_dataframe",
                [1, 2, 3],
                pd.DataFrame({"a": [1, 2]}),
                "must return a pandas.DataFrame",
            ),
            (
                "reordered_columns",
                pd.DataFrame({"a": [1, 2], "b": [3, 4]})[["b", "a"]],
                pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
                "column order",
            ),
            (
                "added_column",
                pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
                pd.DataFrame({"a": [1, 2]}),
                "column order",
            ),
            (
                "removed_column",
                pd.DataFrame({"a": [1, 2]}),
                pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
                "column order",
            ),
            (
                "changed_dtype",
                pd.DataFrame({"a": [1.0, 2.0]}),
                pd.DataFrame({"a": [1, 2]}),
                "column data types",
            ),
            (
                "changed_index_structure",
                pd.DataFrame(
                    {"a": [1, 2]},
                    index=pd.DatetimeIndex(["2020-01-01", "2020-01-02"]),
                ),
                pd.DataFrame({"a": [1, 2]}),
                "index structure",
            ),
            (
                "unsupported_index",
                pd.DataFrame(
                    {"a": [3, 4]}, index=pd.interval_range(start=0, periods=2)
                ),
                pd.DataFrame(
                    {"a": [1, 2]}, index=pd.interval_range(start=0, periods=2)
                ),
                "not supported",
            ),
        ]
    )
    def test_rejects_incompatible_result(
        self, _name: str, result: Any, baseline: pd.DataFrame, message_substring: str
    ) -> None:
        """An editing-incompatible result is rejected with a descriptive error."""
        with pytest.raises(StreamlitAPIException) as exc:
            self._validate(result, baseline)
        assert message_substring in str(exc.value)

    def test_changed_dtype_message_names_column(self) -> None:
        """The dtype-mismatch message names the offending column and both types
        so the cause is not misattributed."""
        with pytest.raises(StreamlitAPIException) as exc:
            self._validate(pd.DataFrame({"a": ["x", "y"]}), pd.DataFrame({"a": [1, 2]}))
        message = str(exc.value)
        assert "'a'" in message
        assert "expected int64" in message
        assert "got string" in message

    def test_accepts_equivalent_string_arrow_variants(self) -> None:
        """A large_string baseline and a string result (as produced by a partial
        row addition) are the same to the editor and must be accepted."""
        baseline = pd.DataFrame(
            {"a": [1, 2], "b": pd.array(["x", "y"], dtype="string")}
        )
        # A partial row addition downcasts the untouched string column from
        # large_string to string; returning that frame must still validate.
        result = baseline.copy(deep=True)
        result.loc[len(result)] = {"a": 3}
        # Some pandas versions downcast the RangeIndex to an integer Index when a
        # row is added via .loc. Leave that as-is: RangeIndex / integer Index
        # equivalence is part of the compatibility contract under test here.

        validated, _ = self._validate(result, baseline)
        assert len(validated) == 3

    def test_accepts_range_index_downcast_to_integer_index(self) -> None:
        """A RangeIndex baseline and an integer Index result (pandas < 3.0 row
        addition) are editing-compatible, including the ``__index_level_0__``
        Arrow field that only appears for the plain Index."""
        baseline = pd.DataFrame({"a": [1, 2]})
        # Simulate the pandas < 3.0 .loc enlargement downcast without depending
        # on the installed pandas version.
        result = pd.DataFrame(
            {"a": [1, 2, 3]}, index=pd.Index([0, 1, 2], dtype="int64")
        )

        validated, arrow_table = self._validate(result, baseline)
        assert len(validated) == 3
        assert isinstance(arrow_table, pa.Table)
        # The result may carry `__index_level_0__`; validation must still pass.


class CanonicalArrowTypeTest(unittest.TestCase):
    """Tests for the _canonical_arrow_type helper."""

    def test_collapses_string_variants(self) -> None:
        """string and large_string collapse to the same canonical name."""
        assert _canonical_arrow_type(pa.string()) == _canonical_arrow_type(
            pa.large_string()
        )

    def test_collapses_binary_variants(self) -> None:
        """binary and large_binary collapse to the same canonical name."""
        assert _canonical_arrow_type(pa.binary()) == _canonical_arrow_type(
            pa.large_binary()
        )

    def test_collapses_list_variants_recursively(self) -> None:
        """list and large_list (including their value types) collapse together."""
        assert _canonical_arrow_type(pa.list_(pa.string())) == _canonical_arrow_type(
            pa.large_list(pa.large_string())
        )

    def test_preserves_distinct_numeric_types(self) -> None:
        """Genuinely different types keep distinct canonical names."""
        assert _canonical_arrow_type(pa.int64()) != _canonical_arrow_type(pa.float64())


class DataEditorCommitEditsValidationTest(DeltaGeneratorTestCase):
    """Call-time validation of commit_edits with exact exception messages."""

    @staticmethod
    def _commit(source: pd.DataFrame, edited: pd.DataFrame, edits: Any) -> pd.DataFrame:
        return source

    def test_requires_key(self) -> None:
        """commit_edits without a key raises with the documented message."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.data_editor(pd.DataFrame({"a": [1]}), commit_edits=self._commit)
        assert str(exc.value) == (
            "st.data_editor: commit_edits requires a stable widget identity. "
            "Pass a key= argument so edit state can be preserved across reruns."
        )

    def test_cannot_combine_with_on_change(self) -> None:
        """commit_edits combined with on_change raises with the documented message."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.data_editor(
                pd.DataFrame({"a": [1]}),
                key="editor",
                on_change=lambda: None,
                commit_edits=self._commit,
            )
        assert str(exc.value) == (
            "st.data_editor: commit_edits cannot be combined with on_change. "
            "Use commit_edits alone for transactional write-back."
        )

    def test_not_supported_inside_form(self) -> None:
        """commit_edits inside a form raises with the documented message."""
        with pytest.raises(StreamlitAPIException) as exc, st.form("form"):
            st.data_editor(
                pd.DataFrame({"a": [1]}), key="editor", commit_edits=self._commit
            )
        assert str(exc.value) == (
            "st.data_editor: commit_edits is not supported inside forms."
        )

    def test_not_supported_with_styler(self) -> None:
        """commit_edits with a Styler input raises with the documented message."""
        styler = pd.DataFrame({"a": [1]}).style
        with pytest.raises(StreamlitAPIException) as exc:
            st.data_editor(styler, key="editor", commit_edits=self._commit)
        assert str(exc.value) == (
            "st.data_editor: commit_edits does not support pandas.Styler input."
        )

    def test_not_supported_with_async_callback(self) -> None:
        """commit_edits with an async callback raises with the documented message."""

        async def commit(
            source: pd.DataFrame, edited: pd.DataFrame, edits: Any
        ) -> pd.DataFrame:
            return source

        with pytest.raises(StreamlitAPIException) as exc:
            st.data_editor(pd.DataFrame({"a": [1]}), key="editor", commit_edits=commit)
        assert str(exc.value) == (
            "st.data_editor: commit_edits does not support async callbacks."
        )

    def test_not_supported_with_async_callable_object(self) -> None:
        """An instance with async ``__call__`` is rejected like an async function."""

        class AsyncCommit:
            async def __call__(
                self, source: pd.DataFrame, edited: pd.DataFrame, edits: Any
            ) -> pd.DataFrame:
                return source

        with pytest.raises(StreamlitAPIException) as exc:
            st.data_editor(
                pd.DataFrame({"a": [1]}),
                key="editor",
                commit_edits=AsyncCommit(),
            )
        assert str(exc.value) == (
            "st.data_editor: commit_edits does not support async callbacks."
        )


class DataEditorCommitEditsProtoTest(DeltaGeneratorTestCase):
    """Tests for the commit_edits/clear_edits proto flags."""

    def test_commit_edits_flag_set_when_provided(self) -> None:
        """proto.commit_edits is True when a callback is provided."""
        st.data_editor(
            pd.DataFrame({"a": [1, 2]}),
            key="editor",
            commit_edits=lambda source, edited, edits: source,
        )
        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.commit_edits is True
        assert proto.clear_edits is False

    def test_commit_edits_flag_unset_by_default(self) -> None:
        """proto.commit_edits and clear_edits are unset without a callback."""
        st.data_editor(pd.DataFrame({"a": [1, 2]}), key="editor")
        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.commit_edits is False
        assert proto.clear_edits is False


class DataEditorCommitEditsFlowTest(DeltaGeneratorTestCase):
    """Tests for the commit_edits commit flow (edit -> rerun -> commit)."""

    def _render(self, data: Any, **kwargs: Any) -> tuple[Any, DataframeProto]:
        """Render a data editor and return its call result and dataframe proto."""
        result = st.data_editor(data, **kwargs)
        return result, self.get_delta_from_queue().new_element.dataframe

    def _simulate_edit_rerun(self, widget_id: str, edit: dict[str, Any]) -> None:
        """Simulate the rerun triggered by a submitted edit batch.

        Injects the edit into widget state so it differs from the previous run,
        and resets the per-run element-id registry so the editor can be
        re-rendered with the same key.
        """
        self.script_run_ctx.session_state.on_script_will_rerun(
            _make_edit_widget_state(widget_id, edit)
        )
        self.script_run_ctx.shared.reset()
        self.clear_queue()

    def test_no_pending_edits_does_not_invoke_callback(self) -> None:
        """Without pending edits, the callback is not called and clear_edits stays unset."""
        calls: list[Any] = []

        def commit(
            source: pd.DataFrame, edited: pd.DataFrame, edits: Any
        ) -> pd.DataFrame:
            calls.append(edits)
            return source

        result, proto = self._render(
            pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
            key="editor",
            commit_edits=commit,
        )
        assert calls == []
        assert proto.clear_edits is False
        assert result["a"].tolist() == [1, 2]

    def test_pending_edits_invoke_callback_and_commit(self) -> None:
        """A submitted edit invokes the callback and renders the committed result."""
        received: dict[str, Any] = {}

        def commit(
            source: pd.DataFrame, edited: pd.DataFrame, edits: Any
        ) -> pd.DataFrame:
            received["source"] = source.copy()
            received["edited"] = edited.copy()
            received["edits"] = edits
            committed = source.copy()
            committed["a"] *= 10
            return committed

        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
        _, proto1 = self._render(df, key="editor", commit_edits=commit)
        self._simulate_edit_rerun(proto1.id, _CELL_EDIT)
        result, proto2 = self._render(df, key="editor", commit_edits=commit)

        # The callback received the baseline source and the edited copy.
        assert received["source"]["a"].tolist() == [1, 2]
        assert received["edited"]["a"].tolist() == [5, 2]

        # The edits object supports both attribute and item access.
        edits = received["edits"]
        assert isinstance(edits, DataEditorState)
        assert edits.edited_rows == {0: {"a": 5}}
        assert edits["edited_rows"] == {0: {"a": 5}}

        # On success the committed frame is rendered and clear_edits is set.
        assert proto2.clear_edits is True
        rendered = convert_arrow_bytes_to_pandas_df(proto2.arrow_data.data)
        assert rendered["a"].tolist() == [10, 20]
        assert result["a"].tolist() == [10, 20]

    def test_reject_by_returning_source_is_success(self) -> None:
        """Returning the source dataframe is a successful commit (edits cleared)."""
        calls: list[Any] = []

        def commit(
            source: pd.DataFrame, edited: pd.DataFrame, edits: Any
        ) -> pd.DataFrame:
            calls.append(edits)
            return source

        df = pd.DataFrame({"a": [1, 2]})
        _, proto1 = self._render(df, key="editor", commit_edits=commit)
        self._simulate_edit_rerun(proto1.id, _CELL_EDIT)
        result, proto2 = self._render(df, key="editor", commit_edits=commit)

        assert len(calls) == 1
        assert proto2.clear_edits is True
        assert result["a"].tolist() == [1, 2]

    def test_callback_exception_preserves_edits(self) -> None:
        """A raising callback surfaces the exception and preserves the edits."""

        def commit(
            source: pd.DataFrame, edited: pd.DataFrame, edits: Any
        ) -> pd.DataFrame:
            raise ValueError("commit failed")

        df = pd.DataFrame({"a": [1, 2]})
        _, proto1 = self._render(df, key="editor", commit_edits=commit)
        self._simulate_edit_rerun(proto1.id, _CELL_EDIT)
        result, proto2 = self._render(df, key="editor", commit_edits=commit)

        assert proto2.clear_edits is False
        assert result["a"].tolist() == [1, 2]
        exception_types = [
            delta.new_element.exception.type
            for delta in self.get_all_deltas_from_queue()
            if delta.new_element.HasField("exception")
        ]
        assert "ValueError" in exception_types
        stored = self.script_run_ctx.session_state["editor"]
        assert stored["edited_rows"] == {0: {"a": 5}}

    def test_validation_failure_preserves_edits(self) -> None:
        """An incompatible callback result surfaces the exception and preserves edits."""

        def commit(
            source: pd.DataFrame, edited: pd.DataFrame, edits: Any
        ) -> pd.DataFrame:
            # Reordered columns are not editing-compatible.
            return source[["b", "a"]]

        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
        _, proto1 = self._render(df, key="editor", commit_edits=commit)
        self._simulate_edit_rerun(proto1.id, _CELL_EDIT)
        result, proto2 = self._render(df, key="editor", commit_edits=commit)

        assert proto2.clear_edits is False
        assert list(result.columns) == ["a", "b"]
        assert any(
            delta.new_element.HasField("exception")
            for delta in self.get_all_deltas_from_queue()
        )
        stored = self.script_run_ctx.session_state["editor"]
        assert stored["edited_rows"] == {0: {"a": 5}}

    def test_serialization_failure_after_commit_preserves_edits(self) -> None:
        """If serializing the committed frame fails, edits are preserved.

        Regression guard: ``clear_edits`` must not be set if the Arrow
        serialization of the committed frame raises. Otherwise the frontend
        would wipe the preserved edits even though the baseline (not the
        committed frame) is rendered.
        """

        def commit(
            source: pd.DataFrame, edited: pd.DataFrame, edits: Any
        ) -> pd.DataFrame:
            committed = source.copy()
            committed["a"] *= 10
            return committed

        df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
        _, proto1 = self._render(df, key="editor", commit_edits=commit)
        self._simulate_edit_rerun(proto1.id, _CELL_EDIT)

        real_convert = dataframe_util.convert_arrow_table_to_arrow_bytes
        call_count = {"n": 0}

        def failing_convert(table: pa.Table) -> bytes:
            call_count["n"] += 1
            # The first call serializes the baseline frame; fail only on the
            # second call, which serializes the committed frame on the success
            # path (right before clear_edits would be set).
            if call_count["n"] >= 2:
                raise RuntimeError("arrow serialization failed")
            return real_convert(table)

        with patch.object(
            dataframe_util,
            "convert_arrow_table_to_arrow_bytes",
            side_effect=failing_convert,
        ):
            result, proto2 = self._render(df, key="editor", commit_edits=commit)

        # The failure is treated as a failed commit: edits preserved, clear_edits
        # unset, baseline rendered, and the exception surfaced.
        assert proto2.clear_edits is False
        assert result["a"].tolist() == [1, 2]
        assert any(
            delta.new_element.HasField("exception")
            for delta in self.get_all_deltas_from_queue()
        )
        stored = self.script_run_ctx.session_state["editor"]
        assert stored["edited_rows"] == {0: {"a": 5}}

    @parameterized.expand([("stop", StopException), ("rerun", RerunException)])
    def test_control_flow_exception_propagates(
        self, _name: str, exc_type: type[BaseException]
    ) -> None:
        """A ScriptControlException from the callback propagates and preserves edits."""

        def commit(
            source: pd.DataFrame, edited: pd.DataFrame, edits: Any
        ) -> pd.DataFrame:
            if exc_type is RerunException:
                raise RerunException(RerunData())
            raise StopException()

        df = pd.DataFrame({"a": [1, 2]})
        _, proto1 = self._render(df, key="editor", commit_edits=commit)
        self._simulate_edit_rerun(proto1.id, _CELL_EDIT)

        with pytest.raises(exc_type):
            st.data_editor(df, key="editor", commit_edits=commit)

        stored = self.script_run_ctx.session_state["editor"]
        assert stored["edited_rows"] == {0: {"a": 5}}

    def test_no_retry_when_widget_unchanged(self) -> None:
        """A pending edit that is unchanged this run does not re-invoke the callback."""
        calls: list[Any] = []

        def commit(
            source: pd.DataFrame, edited: pd.DataFrame, edits: Any
        ) -> pd.DataFrame:
            calls.append(edits)
            return source

        df = pd.DataFrame({"a": [1, 2]})
        _, proto1 = self._render(df, key="editor", commit_edits=commit)
        widget_id = proto1.id

        # First edit submission commits.
        self._simulate_edit_rerun(widget_id, _CELL_EDIT)
        self._render(df, key="editor", commit_edits=commit)
        assert len(calls) == 1

        # Re-sending the same (unchanged) edit on an unrelated rerun does nothing.
        self._simulate_edit_rerun(widget_id, _CELL_EDIT)
        _, proto3 = self._render(df, key="editor", commit_edits=commit)
        assert len(calls) == 1
        assert proto3.clear_edits is False

    def test_return_type_preserved_for_list_input(self) -> None:
        """Commit mode returns the committed data in the original (list) input type."""

        def commit(
            source: pd.DataFrame, edited: pd.DataFrame, edits: Any
        ) -> pd.DataFrame:
            return source

        data = [{"a": 1}, {"a": 2}]
        _, proto1 = self._render(data, key="editor", commit_edits=commit)
        self._simulate_edit_rerun(proto1.id, _CELL_EDIT)
        result, proto2 = self._render(data, key="editor", commit_edits=commit)

        assert isinstance(result, list)
        assert proto2.clear_edits is True


class DataEditorCommitEditsMetricsTest(DeltaGeneratorTestCase):
    """Tests that commit_edits usage is tracked in command telemetry."""

    def test_commit_edits_tracked_as_argument(self) -> None:
        """commit_edits is captured as a tracked argument for the data_editor command."""
        self.script_run_ctx.gather_usage_stats = True
        self.script_run_ctx.command_tracking_deactivated = False

        st.data_editor(
            pd.DataFrame({"a": [1, 2]}),
            key="editor",
            commit_edits=lambda source, edited, edits: source,
        )

        commands = [
            command
            for command in self.script_run_ctx.shared.tracked_commands
            if command.name.endswith("data_editor")
        ]
        assert len(commands) == 1
        assert "commit_edits" in {arg.k for arg in commands[0].args}
