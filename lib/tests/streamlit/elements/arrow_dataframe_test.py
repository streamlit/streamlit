# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Arrow DataFrame tests."""

import enum
import json
from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from pandas.io.formats.style_render import StylerRenderer as Styler
from parameterized import parameterized

import streamlit as st
from streamlit.dataframe_util import (
    convert_arrow_bytes_to_pandas_df,
    is_pandas_version_less_than,
)
from streamlit.elements.lib.column_config_utils import INDEX_IDENTIFIER
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.data_test_cases import SHARED_TEST_CASES, CaseMetadata
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


def mock_data_frame():
    return pd.DataFrame(
        index=[[0, 1], ["i1", "i2"]],
        columns=[[2, 3, 4], ["c1", "c2", "c3"]],
        data=np.arange(0, 6, 1).reshape(2, 3),
    )


class ArrowDataFrameProtoTest(DeltaGeneratorTestCase):
    """Test ability to marshall arrow protos."""

    def test_default_params(self):
        """Test that it can be called with a dataframe."""
        df = pd.DataFrame({"a": [1, 2, 3]})
        st.dataframe(df)

        el = self.get_delta_from_queue().new_element
        proto = el.arrow_data_frame
        pd.testing.assert_frame_equal(convert_arrow_bytes_to_pandas_df(proto.data), df)

        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

        # Since dataframe and data editor share the same proto, we also test for
        # properties only relevant for an editable dataframe.
        assert proto.height == 0
        assert proto.editing_mode == ArrowProto.EditingMode.READ_ONLY
        assert proto.selection_mode == []
        assert not proto.disabled
        assert proto.column_order == []
        assert proto.form_id == ""
        assert proto.columns == "{}"
        # ID should not be set:
        assert proto.id == ""
        # Row height is marked optional should not be set if not specified
        assert not proto.HasField("row_height")
        assert proto.row_height == 0

    def test_dataframe_only_data(self):
        df = mock_data_frame()
        st.dataframe(df)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        pd.testing.assert_frame_equal(convert_arrow_bytes_to_pandas_df(proto.data), df)

    def test_column_order_parameter(self):
        """Test that it can be called with column_order."""
        st.dataframe(pd.DataFrame(), column_order=["a", "b"])

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        assert proto.column_order == ["a", "b"]

    def test_empty_column_order_parameter(self):
        """Test that an empty column_order is correctly added."""
        st.dataframe(pd.DataFrame(), column_order=[])

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        assert proto.column_order == []

    @parameterized.expand(SHARED_TEST_CASES)
    def test_with_compatible_data(
        self,
        name: str,
        input_data: Any,
        metadata: CaseMetadata,
    ):
        """Test that it can be called with compatible data."""
        st.dataframe(input_data)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        reconstructed_df = convert_arrow_bytes_to_pandas_df(proto.data)
        assert reconstructed_df.shape[0] == metadata.expected_rows
        assert reconstructed_df.shape[1] == metadata.expected_cols

    def test_hide_index_true(self):
        """Test that it can be called with hide_index=True param."""
        data_df = pd.DataFrame(
            {
                "a": pd.Series([1, 2]),
                "b": pd.Series(["foo", "bar"]),
            }
        )

        st.dataframe(data_df, hide_index=True)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        assert proto.columns == json.dumps({INDEX_IDENTIFIER: {"hidden": True}})

    def test_hide_index_false(self):
        """Test that it can be called with hide_index=False param."""
        data_df = pd.DataFrame(
            {
                "a": pd.Series([1, 2]),
                "b": pd.Series(["foo", "bar"]),
            }
        )

        st.dataframe(data_df, hide_index=False)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        assert proto.columns == json.dumps({INDEX_IDENTIFIER: {"hidden": False}})

    def test_row_height_parameter(self):
        """Test that it can be called with row_height."""
        st.dataframe(pd.DataFrame(), row_height=100)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        assert proto.row_height == 100

    def test_uuid(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_uuid("FAKE_UUID")
        st.dataframe(styler)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        assert proto.styler.uuid == "FAKE_UUID"

    def test_caption(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_caption("FAKE_CAPTION")
        st.dataframe(styler)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        assert proto.styler.caption == "FAKE_CAPTION"

    def test_cell_styles(self):
        df = mock_data_frame()
        styler = df.style
        # NOTE: If UUID is not set - a random UUID will be generated.
        styler.set_uuid("FAKE_UUID")
        styler.highlight_max(axis=None)
        st.dataframe(styler)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        assert (
            proto.styler.styles == "#T_FAKE_UUID_row1_col2 { background-color: yellow }"
        )

    def test_display_values(self):
        df = pd.DataFrame(
            [[1, 2, 3], [4, 5, 6]],
        )
        styler = df.style.format("{:.2%}")
        st.dataframe(styler)

        expected = pd.DataFrame(
            [["100.00%", "200.00%", "300.00%"], ["400.00%", "500.00%", "600.00%"]],
        )

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.styler.display_values), expected
        )

    def test_throw_exception_if_data_exceeds_styler_config(self):
        """Test that an exception is thrown if the dataframe exceeds the styler.render.max_elements config."""
        pd.set_option("styler.render.max_elements", 5000)
        # big example with default styler.render.max_elements
        df = pd.DataFrame(list(range(5001)))
        with pytest.raises(StreamlitAPIException):
            st.dataframe(df.style.format("{:03d}"))
        pd.reset_option("styler.render.max_elements")

    @patch.object(Styler, "_translate")
    def test_styler_translate_gets_called(self, mock_styler_translate):
        """Tests that `styler._translate` is called with correct arguments."""
        df = mock_data_frame()
        styler = df.style.set_uuid("FAKE_UUID")

        st.dataframe(styler)
        mock_styler_translate.assert_called_once_with(False, False)

    def test_dataframe_uses_convert_anything_to_df(self):
        """Test that st.altair_chart uses convert_anything_to_df to convert input data."""
        df = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T

        with patch(
            "streamlit.dataframe_util.convert_anything_to_pandas_df"
        ) as convert_anything_to_df:
            convert_anything_to_df.return_value = df

            st.dataframe(df)
            convert_anything_to_df.assert_called_once()

    def test_dataframe_on_select_initial_returns(self):
        """Test st.dataframe returns an empty selection as initial result."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        selection = st.dataframe(df, on_select="rerun", key="selectable_df")

        assert selection.selection.rows == []
        assert selection.selection.columns == []
        assert selection.selection.cells == []

        # Check that the selection state is added to the session state:
        assert st.session_state.selectable_df.selection.rows == []
        assert st.session_state.selectable_df.selection.columns == []
        assert st.session_state.selectable_df.selection.cells == []

    def test_dataframe_with_invalid_on_select(self):
        """Test that an exception is thrown if the on_select parameter is invalid."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        with pytest.raises(StreamlitAPIException):
            st.dataframe(df, on_select="invalid")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form_on_select_rerun(self):
        """Test that form id is marshalled correctly inside of a form."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        with st.form("form"):
            st.dataframe(df, on_select="rerun")

        # 2 elements will be created: form block, dataframe
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        arrow_proto = self.get_delta_from_queue(1).new_element.arrow_data_frame
        assert arrow_proto.form_id == form_proto.form.form_id

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_selectable_df_disallows_callbacks_inside_form(self):
        """Test that an exception is thrown if a callback is defined with a
        selectable dataframe inside a form."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        with pytest.raises(StreamlitAPIException), st.form("form"):
            st.dataframe(df, on_select=lambda: None)

    def test_selectable_df_throws_exception_with_modified_sessions_state(self):
        """Test that an exception is thrown if the session state is modified."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        st.session_state.selectable_df = {
            "selection": {"rows": [1], "columns": ["col1"]},
        }
        with pytest.raises(StreamlitAPIException):
            st.dataframe(df, on_select="rerun", key="selectable_df")

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when selections are activated and
        it is used inside a cached function."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        st.cache_data(lambda: st.dataframe(df, on_select="rerun"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    @parameterized.expand(
        [
            ("rerun", [1]),
            ("ignore", []),
            (lambda: None, [1]),
        ]
    )
    def test_dataframe_valid_on_select(self, on_select, proto_value):
        """Test that the on_select parameter is parsed correctly."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        st.dataframe(df, on_select=on_select)

        el = self.get_delta_from_queue().new_element.arrow_data_frame
        assert el.selection_mode == proto_value

    @parameterized.expand(
        [
            (
                ("multi-row", "multi-column"),
                [
                    ArrowProto.SelectionMode.MULTI_ROW,
                    ArrowProto.SelectionMode.MULTI_COLUMN,
                ],
            ),
            (
                {"single-row", "single-column"},
                [
                    ArrowProto.SelectionMode.SINGLE_ROW,
                    ArrowProto.SelectionMode.SINGLE_COLUMN,
                ],
            ),
            (
                {"single-row", "multi-column"},
                [
                    ArrowProto.SelectionMode.SINGLE_ROW,
                    ArrowProto.SelectionMode.MULTI_COLUMN,
                ],
            ),
            (
                ("multi-row", "single-column", "single-cell"),
                [
                    ArrowProto.SelectionMode.MULTI_ROW,
                    ArrowProto.SelectionMode.SINGLE_COLUMN,
                    ArrowProto.SelectionMode.SINGLE_CELL,
                ],
            ),
            ("single-row", [ArrowProto.SelectionMode.SINGLE_ROW]),
            ("multi-column", [ArrowProto.SelectionMode.MULTI_COLUMN]),
            ("single-cell", [ArrowProto.SelectionMode.SINGLE_CELL]),
            ("multi-cell", [ArrowProto.SelectionMode.MULTI_CELL]),
        ]
    )
    def test_selection_mode_parsing(self, input_modes, expected_modes):
        """Test that the selection_mode parameter is parsed correctly."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        st.dataframe(df, on_select="rerun", selection_mode=input_modes)

        el = self.get_delta_from_queue().new_element
        assert el.arrow_data_frame.selection_mode == expected_modes

    @parameterized.expand(
        [
            (["invalid", "single-row"],),
            (["single-row", "multi-row"],),
            (["single-column", "multi-column"],),
            (["single-cell", "multi-cell"],),
        ]
    )
    def test_selection_mode_parsing_invalid(self, invalid_modes):
        """Test that an exception is thrown if the selection_mode parameter is invalid."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        with pytest.raises(StreamlitAPIException):
            st.dataframe(df, on_select="rerun", selection_mode=invalid_modes)

    def test_selection_mode_deactivated(self):
        """Test that selection modes are ignored when selections are deactivated."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        st.dataframe(
            df, on_select="ignore", selection_mode=["single-row", "multi-column"]
        )
        el = self.get_delta_from_queue().new_element
        assert len(el.arrow_data_frame.selection_mode) == 0

    def test_use_right_display_values(self):
        """Test that _use_display_values gets correct value for "display_value" instead of the original one."""

        class Status(str, enum.Enum):
            success = "Success status"

        df = pd.DataFrame({"pipeline": ["Success"], "status": [Status.success]})

        def apply_color(v: Status) -> str:
            return "color: red" if v == Status.success else ""

        if is_pandas_version_less_than("2.2.0"):
            styler = df.style.applymap(apply_color, subset=["status"])
        else:
            styler = df.style.map(apply_color, subset=["status"])

        st.dataframe(styler)

        expected = pd.DataFrame(
            {"pipeline": ["Success"], "status": ["Success status"]},
        )

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.styler.display_values), expected
        )

    def test_use_container_width_true_shows_deprecation_warning(self):
        """Test that use_container_width=True shows deprecation warning and sets width='stretch'."""
        with patch("streamlit.elements.arrow.show_deprecation_warning") as mock_warning:
            st.dataframe(pd.DataFrame({"a": [1, 2, 3]}), use_container_width=True)

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

    def test_use_container_width_false_shows_deprecation_warning(self):
        """Test that use_container_width=False shows deprecation warning and sets width='content'."""
        with patch("streamlit.elements.arrow.show_deprecation_warning") as mock_warning:
            st.dataframe(pd.DataFrame({"a": [1, 2, 3]}), use_container_width=False)

            # Check deprecation warning is shown
            mock_warning.assert_called_once()
            assert "use_container_width" in mock_warning.call_args[0][0]

        el = self.get_delta_from_queue().new_element
        # When use_container_width=False, it should set width='content'
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_use_container_width_false_with_integer_width(self):
        """Test use_container_width=False with integer width preserves the integer."""
        with patch("streamlit.elements.arrow.show_deprecation_warning") as mock_warning:
            st.dataframe(
                pd.DataFrame({"a": [1, 2, 3]}), width=400, use_container_width=False
            )

            # Check deprecation warning is shown
            mock_warning.assert_called_once()

        el = self.get_delta_from_queue().new_element
        # When use_container_width=False and width is integer, preserve integer width
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.width_config.pixel_width == 400

    @pytest.mark.usefixtures("benchmark")
    def test_pandas_styler_performance(self):
        """Performance benchmark for using styled dataframes with st.dataframe."""

        def large_styler_df() -> None:
            # Create a large DF with random numbers:
            df = pd.DataFrame(np.random.rand(10000, 10), columns=list("ABCDEFGHIJ"))
            # Format all numbers with pandas styler:
            styler = df.style.format("{:.2f}")
            st.dataframe(styler)

        self.benchmark(large_styler_df)


class StArrowTableAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_table(self):
        """Test st.table."""
        from streamlit.dataframe_util import convert_arrow_bytes_to_pandas_df

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        st.table(df)

        proto = self.get_delta_from_queue().new_element.arrow_table
        pd.testing.assert_frame_equal(convert_arrow_bytes_to_pandas_df(proto.data), df)
