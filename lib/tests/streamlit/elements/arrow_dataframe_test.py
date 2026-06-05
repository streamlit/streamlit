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
from streamlit.elements.arrow import (
    DataframeSelectionSerde,
    _validate_selection_state,
    parse_selection_mode,
)
from streamlit.elements.lib.column_config_utils import (
    INDEX_IDENTIFIER,
    ButtonClickSerde,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Dataframe_pb2 import Dataframe as DataframeProto
from streamlit.testing.v1 import AppTest
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
        proto = el.dataframe
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.arrow_data.data), df
        )

        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

        # Since dataframe and data editor share the same proto, we also test for
        # properties only relevant for an editable dataframe.
        assert proto.editing_mode == DataframeProto.EditingMode.READ_ONLY
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
        assert not proto.HasField("placeholder")

    def test_dataframe_only_data(self):
        df = mock_data_frame()
        st.dataframe(df)

        proto = self.get_delta_from_queue().new_element.dataframe
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.arrow_data.data), df
        )

    def test_column_order_parameter(self):
        """Test that it can be called with column_order."""
        st.dataframe(pd.DataFrame(), column_order=["a", "b"])

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.column_order == ["a", "b"]

    def test_empty_column_order_parameter(self):
        """Test that an empty column_order is correctly added."""
        st.dataframe(pd.DataFrame(), column_order=[])

        proto = self.get_delta_from_queue().new_element.dataframe
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

        proto = self.get_delta_from_queue().new_element.dataframe
        reconstructed_df = convert_arrow_bytes_to_pandas_df(proto.arrow_data.data)
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

        st.dataframe(data_df, hide_index=False)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.columns == json.dumps({INDEX_IDENTIFIER: {"hidden": False}})

    def test_row_height_parameter(self):
        """Test that it can be called with row_height."""
        st.dataframe(pd.DataFrame(), row_height=100)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.row_height == 100

    def test_placeholder_parameter(self):
        """Test that it can be called with placeholder."""
        st.dataframe(pd.DataFrame(), placeholder="-")

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.placeholder == "-"

    def test_uuid(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_uuid("FAKE_UUID")
        st.dataframe(styler)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.arrow_data.styler.uuid == "FAKE_UUID"

    def test_caption(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_caption("FAKE_CAPTION")
        st.dataframe(styler)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.arrow_data.styler.caption == "FAKE_CAPTION"

    def test_cell_styles(self):
        df = mock_data_frame()
        styler = df.style
        # NOTE: If UUID is not set - a random UUID will be generated.
        styler.set_uuid("FAKE_UUID")
        styler.highlight_max(axis=None)
        st.dataframe(styler)

        proto = self.get_delta_from_queue().new_element.dataframe
        assert (
            proto.arrow_data.styler.styles
            == "#T_FAKE_UUID_row1_col2 { background-color: yellow }"
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

        proto = self.get_delta_from_queue().new_element.dataframe
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.arrow_data.styler.display_values),
            expected,
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

        df = pd.DataFrame([[1, 2], [3, 4], [5, 6]], columns=["col1", "col2"])
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
        arrow_proto = self.get_delta_from_queue(1).new_element.dataframe
        assert arrow_proto.form_id == form_proto.form.form_id

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_selectable_df_disallows_callbacks_inside_form(self):
        """Test that an exception is thrown if a callback is defined with a
        selectable dataframe inside a form."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        with pytest.raises(StreamlitAPIException), st.form("form"):
            st.dataframe(df, on_select=lambda: None)

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when selections are activated and
        it is used inside a cached function."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        st.cache_data(lambda: st.dataframe(df, on_select="rerun"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-3).new_element.exception
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

        el = self.get_delta_from_queue().new_element.dataframe
        assert el.selection_mode == proto_value

    @parameterized.expand(
        [
            (
                ("multi-row", "multi-column"),
                [
                    DataframeProto.SelectionMode.MULTI_ROW,
                    DataframeProto.SelectionMode.MULTI_COLUMN,
                ],
            ),
            (
                {"single-row", "single-column"},
                [
                    DataframeProto.SelectionMode.SINGLE_ROW,
                    DataframeProto.SelectionMode.SINGLE_COLUMN,
                ],
            ),
            (
                {"single-row", "multi-column"},
                [
                    DataframeProto.SelectionMode.SINGLE_ROW,
                    DataframeProto.SelectionMode.MULTI_COLUMN,
                ],
            ),
            (
                ("multi-row", "single-column", "single-cell"),
                [
                    DataframeProto.SelectionMode.MULTI_ROW,
                    DataframeProto.SelectionMode.SINGLE_COLUMN,
                    DataframeProto.SelectionMode.SINGLE_CELL,
                ],
            ),
            ("single-row", [DataframeProto.SelectionMode.SINGLE_ROW]),
            (
                "single-row-required",
                [DataframeProto.SelectionMode.SINGLE_ROW_REQUIRED],
            ),
            (
                ("single-row-required", "multi-column"),
                [
                    DataframeProto.SelectionMode.SINGLE_ROW_REQUIRED,
                    DataframeProto.SelectionMode.MULTI_COLUMN,
                ],
            ),
            ("multi-column", [DataframeProto.SelectionMode.MULTI_COLUMN]),
            ("single-cell", [DataframeProto.SelectionMode.SINGLE_CELL]),
            ("multi-cell", [DataframeProto.SelectionMode.MULTI_CELL]),
        ]
    )
    def test_selection_mode_parsing(self, input_modes, expected_modes):
        """Test that the selection_mode parameter is parsed correctly."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        st.dataframe(df, on_select="rerun", selection_mode=input_modes)

        el = self.get_delta_from_queue().new_element
        # Use set comparison since the order of modes is not guaranteed
        assert set(el.dataframe.selection_mode) == set(expected_modes)

    @parameterized.expand(
        [
            (["invalid", "single-row"],),
            (["single-row", "multi-row"],),
            (["single-row-required", "single-row"],),
            (["single-row-required", "multi-row"],),
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
        assert len(el.dataframe.selection_mode) == 0

    def test_selection_mode_iterator_is_not_consumed(self) -> None:
        """Test that iterator-based selection modes are consumed only once."""
        df = pd.DataFrame([[1, 2], [3, 4], [5, 6]], columns=["col1", "col2"])
        selection_mode_iter = iter(["multi-row"])

        st.dataframe(
            df,
            on_select="rerun",
            selection_mode=selection_mode_iter,
            selection_default={"selection": {"rows": [0, 2]}},
        )

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.selection_mode == [DataframeProto.SelectionMode.MULTI_ROW]
        assert proto.selection_mode != []
        assert proto.selection_default == json.dumps(
            {"selection": {"rows": [0, 2], "columns": [], "cells": []}}
        )

    def test_selection_default_sets_proto(self) -> None:
        """Test that selection_default is validated and stored in the proto."""
        df = pd.DataFrame([[1, 2], [3, 4], [5, 6]], columns=["col1", "col2"])
        st.dataframe(
            df,
            on_select="rerun",
            selection_mode="multi-row",
            selection_default={"selection": {"rows": [0, 2, 5]}},
        )

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.selection_default == json.dumps(
            {"selection": {"rows": [0, 2], "columns": [], "cells": []}}
        )
        assert proto.selection_default != json.dumps(
            {"selection": {"rows": [0, 2, 5], "columns": [], "cells": []}}
        )

    def test_selection_default_returns_default_on_first_render(self) -> None:
        """Test that selection_default is reflected in the Python return value on first render."""
        df = pd.DataFrame([[1, 2], [3, 4], [5, 6]], columns=["col1", "col2"])
        result = st.dataframe(
            df,
            on_select="rerun",
            selection_mode="multi-row",
            selection_default={"selection": {"rows": [0, 2]}},
        )
        assert result["selection"]["rows"] == [0, 2]
        assert result["selection"]["columns"] == []
        assert result["selection"]["cells"] == []

    def test_selection_default_requires_on_select(self) -> None:
        """Test that selection_default requires on_select to be activated."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        with pytest.raises(StreamlitAPIException):
            st.dataframe(df, selection_default={"selection": {"rows": [0]}})

    def test_row_selection_auto_hides_range_index(self):
        """Test that a RangeIndex is auto-hidden when row selection is enabled.

        When selections are activated (on_select != "ignore") and the
        selection_mode is a single row-selection mode ("single-row" or
        "multi-row"), a dataframe with a default RangeIndex should have its
        index column hidden automatically.
        """

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        st.dataframe(df, on_select="rerun", selection_mode="multi-row")

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.columns == json.dumps({INDEX_IDENTIFIER: {"hidden": True}})

    def test_row_selections_shows_custom_index(self):
        """Test that a custom index is shown when row selection is enabled."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"], index=["a", "b"])
        st.dataframe(df, on_select="rerun", selection_mode="multi-row")
        proto = self.get_delta_from_queue().new_element.dataframe
        assert "hidden" not in proto.columns

    def test_combined_selection_modes_auto_hides_range_index(self):
        """Test that RangeIndex is auto-hidden when row selection is combined with other modes.

        When selection_mode is a list containing a row-selection mode (e.g.,
        ["multi-row", "multi-column"]), the RangeIndex should still be auto-hidden.
        """
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        st.dataframe(
            df, on_select="rerun", selection_mode=["multi-row", "multi-column"]
        )

        proto = self.get_delta_from_queue().new_element.dataframe
        assert proto.columns == json.dumps({INDEX_IDENTIFIER: {"hidden": True}})

    def test_column_only_selection_does_not_hide_range_index(self):
        """Test that RangeIndex is not hidden when only column selection is enabled."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        st.dataframe(df, on_select="rerun", selection_mode="multi-column")

        proto = self.get_delta_from_queue().new_element.dataframe
        # Index should not be hidden when only column selection is active
        assert proto.columns == "{}"

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

        proto = self.get_delta_from_queue().new_element.dataframe
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.arrow_data.styler.display_values),
            expected,
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


class DataframeSelectionsStableIdTest(DeltaGeneratorTestCase):
    """Tests for element ID stability when selections are enabled."""

    def test_stable_id_with_key_and_selections(self):
        """Test that the element ID is stable when data changes but key and selection_mode remain the same.

        When selections are enabled and a key is provided, the element ID should remain
        stable across data changes to preserve selection state. This test verifies that
        changing data, column_config, column_order, and other non-whitelisted parameters
        does not change the element ID.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            df1 = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
            st.dataframe(
                df1,
                key="selectable_df",
                height=200,
                width=300,
                column_order=["a", "b"],
                hide_index=True,
                # Whitelisted parameters
                on_select="rerun",
                selection_mode="multi-row",
            )
            c1 = self.get_delta_from_queue().new_element.dataframe
            id1 = c1.id

            # Second render with different data and params but same key and selection_mode
            df2 = pd.DataFrame({"x": [10, 20], "y": [30, 40], "z": [50, 60]})
            st.dataframe(
                df2,
                key="selectable_df",
                height=400,
                width=500,
                column_order=["x", "y", "z"],
                hide_index=False,
                # Whitelisted parameters
                on_select="rerun",
                selection_mode="multi-row",
            )
            c2 = self.get_delta_from_queue().new_element.dataframe
            id2 = c2.id

            # ID should be stable since key and selection_mode are the same
            assert id1 == id2

    def test_unstable_id_without_key_and_selections(self):
        """Test that the element ID changes when data changes and no key is provided.

        Without a key, the element ID is derived from all parameters including the data.
        This test verifies that changing data or other parameters causes the element ID
        to change, demonstrating that the key_as_main_identity feature is required for
        ID stability.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render without a key
            df1 = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
            st.dataframe(
                df1,
                height=200,
                on_select="rerun",
                selection_mode="multi-row",
            )
            c1 = self.get_delta_from_queue().new_element.dataframe
            id1 = c1.id

            # Second render with different data but no key
            df2 = pd.DataFrame({"x": [10, 20], "y": [30, 40]})
            st.dataframe(
                df2,
                height=200,
                on_select="rerun",
                selection_mode="multi-row",
            )
            c2 = self.get_delta_from_queue().new_element.dataframe
            id2 = c2.id

            # ID should change since no key is provided and data is different
            assert id1 != id2

    @parameterized.expand(
        [
            ("selection_mode_single_to_multi", "single-row", "multi-row"),
            ("selection_mode_row_to_column", "multi-row", "multi-column"),
            (
                "selection_mode_single_to_list",
                "single-row",
                ["multi-row", "multi-column"],
            ),
        ]
    )
    def test_whitelisted_stable_key_kwargs(
        self, name: str, value1: object, value2: object
    ):
        """Test that changing selection_mode changes the ID even when a key is provided.

        The selection_mode parameter is whitelisted, meaning changes to it should
        result in a new element ID to ensure the widget state is reset when the
        selection mode fundamentally changes.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})

            st.dataframe(
                df,
                key="selectable_df_whitelisted",
                on_select="rerun",
                selection_mode=value1,
            )
            c1 = self.get_delta_from_queue().new_element.dataframe
            id1 = c1.id

            st.dataframe(
                df,
                key="selectable_df_whitelisted",
                on_select="rerun",
                selection_mode=value2,
            )
            c2 = self.get_delta_from_queue().new_element.dataframe
            id2 = c2.id

            # ID should change since selection_mode is whitelisted
            assert id1 != id2


class TestValidateSelectionState:
    """Tests for _validate_selection_state function."""

    def test_valid_row_selection(self) -> None:
        """Test that valid row indices are preserved."""
        value = {"selection": {"rows": [0, 2, 4], "columns": [], "cells": []}}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"multi-row"},
        )
        assert result["selection"]["rows"] == [0, 2, 4]
        assert result["selection"]["columns"] == []
        assert result["selection"]["cells"] == []

    def test_invalid_row_indices_filtered(self) -> None:
        """Test that row indices outside valid range are filtered out."""
        value = {"selection": {"rows": [0, 10, 20], "columns": [], "cells": []}}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1"],
            selection_mode_set={"multi-row"},
        )
        # Only row 0 is valid (0 <= 0 < 5)
        assert result["selection"]["rows"] == [0]

    def test_negative_row_indices_filtered(self) -> None:
        """Test that negative row indices are filtered out."""
        value = {"selection": {"rows": [-1, 0, 2], "columns": [], "cells": []}}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1"],
            selection_mode_set={"multi-row"},
        )
        assert result["selection"]["rows"] == [0, 2]

    def test_valid_column_selection(self) -> None:
        """Test that valid column names are preserved."""
        value = {"selection": {"rows": [], "columns": ["col1", "col3"], "cells": []}}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2", "col3"],
            selection_mode_set={"multi-column"},
        )
        assert result["selection"]["columns"] == ["col1", "col3"]

    def test_invalid_column_names_filtered(self) -> None:
        """Test that non-existent column names are filtered out."""
        value = {
            "selection": {"rows": [], "columns": ["col1", "nonexistent"], "cells": []}
        }
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"multi-column"},
        )
        assert result["selection"]["columns"] == ["col1"]

    @parameterized.expand(
        [
            (
                "single_row",
                {"rows": [1, 2, 3], "columns": [], "cells": []},
                ["col1"],
                {"single-row"},
                "rows",
                [1],
            ),
            (
                "single_column",
                {"rows": [], "columns": ["col1", "col2"], "cells": []},
                ["col1", "col2", "col3"],
                {"single-column"},
                "columns",
                ["col1"],
            ),
        ]
    )
    def test_single_mode_limits_selection(
        self,
        _name: str,
        selection: dict[str, Any],
        column_names: list[str],
        mode_set: set[str],
        field: str,
        expected: list[Any],
    ) -> None:
        """Test that single-selection mode limits to first item only."""
        value = {"selection": selection}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=column_names,
            selection_mode_set=mode_set,
        )
        assert result["selection"][field] == expected

    def test_cell_selection_validation(self) -> None:
        """Test that cell selections are validated correctly in single-cell mode."""
        value = {"selection": {"rows": [], "columns": [], "cells": [[0, "col1"]]}}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"single-cell"},
        )
        assert result["selection"]["cells"] == [(0, "col1")]

    def test_invalid_cell_selections_filtered(self) -> None:
        """Test that invalid cell selections are filtered out."""
        value = {
            "selection": {
                "rows": [],
                "columns": [],
                "cells": [
                    [0, "col1"],  # Valid
                    [10, "col1"],  # Invalid row
                    [0, "nonexistent"],  # Invalid column
                ],
            }
        }
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"single-cell"},
        )
        assert result["selection"]["cells"] == [(0, "col1")]

    def test_single_cell_mode_limits_selection(self) -> None:
        """Test that single-cell mode limits selection to first cell."""
        value = {
            "selection": {
                "rows": [],
                "columns": [],
                "cells": [[0, "col1"], [1, "col2"]],
            }
        }
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"single-cell"},
        )
        assert result["selection"]["cells"] == [(0, "col1")]

    @parameterized.expand(
        [
            (
                "rows_ignored_without_row_mode",
                {"rows": [0, 1], "columns": [], "cells": []},
                {"multi-column"},
                "rows",
            ),
            (
                "columns_ignored_without_column_mode",
                {"rows": [], "columns": ["col1"], "cells": []},
                {"multi-row"},
                "columns",
            ),
        ]
    )
    def test_selection_ignored_without_mode(
        self,
        _name: str,
        selection: dict[str, Any],
        mode_set: set[str],
        field: str,
    ) -> None:
        """Test that selections are ignored when corresponding mode is not active."""
        value = {"selection": selection}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1"],
            selection_mode_set=mode_set,
        )
        assert result["selection"][field] == []

    @parameterized.expand(
        [
            ("string", "hello"),
            ("int", 42),
            ("list", [1, 2]),
            ("none", None),
            ("bool", True),
        ]
    )
    def test_non_dict_value_raises_error(self, _name: str, invalid_value: Any) -> None:
        """Test that non-dict value raises StreamlitAPIException with clear message."""
        with pytest.raises(StreamlitAPIException, match="must be a dictionary"):
            _validate_selection_state(
                invalid_value,
                num_rows=5,
                column_names=["col1"],
                selection_mode_set={"multi-row"},
            )

    @parameterized.expand(
        [
            ("string", "rows"),
            ("int", 123),
            ("list", [0, 1]),
            ("none", None),
        ]
    )
    def test_non_dict_selection_raises_error(
        self, _name: str, invalid_selection: Any
    ) -> None:
        """Test that non-dict 'selection' value raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException, match="must be a dictionary"):
            _validate_selection_state(
                {"selection": invalid_selection},
                num_rows=5,
                column_names=["col1"],
                selection_mode_set={"multi-row"},
            )

    @parameterized.expand(
        [
            (
                "rows",
                {"rows": "not-a-list", "columns": [], "cells": []},
                {"multi-row"},
                "rows",
            ),
            (
                "columns",
                {"rows": [], "columns": 42, "cells": []},
                {"multi-column"},
                "columns",
            ),
            (
                "cells",
                {"rows": [], "columns": [], "cells": True},
                {"multi-cell"},
                "cells",
            ),
        ]
    )
    def test_non_list_field_ignored_gracefully(
        self,
        _name: str,
        selection: dict[str, Any],
        mode_set: set[str],
        field: str,
    ) -> None:
        """Test that non-list field values are ignored without crashing."""
        value = {"selection": selection}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1"],
            selection_mode_set=mode_set,
        )
        assert result["selection"][field] == []

    def test_missing_selection_key_raises_error(self) -> None:
        """Test that missing 'selection' key raises StreamlitAPIException."""
        value: dict[str, Any] = {"invalid": {}}
        with pytest.raises(StreamlitAPIException) as exc_info:
            _validate_selection_state(
                value,
                num_rows=5,
                column_names=["col1"],
                selection_mode_set={"multi-row"},
            )
        assert "selection" in str(exc_info.value)

    def test_empty_selection_returns_empty(self) -> None:
        """Test that empty selection returns empty validated selection."""
        value = {"selection": {"rows": [], "columns": [], "cells": []}}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1"],
            selection_mode_set={"multi-row", "multi-column"},
        )
        assert result["selection"]["rows"] == []
        assert result["selection"]["columns"] == []
        assert result["selection"]["cells"] == []

    def test_duplicate_row_indices_deduplicated(self) -> None:
        """Test that duplicate row indices are deduplicated while preserving order."""
        value = {"selection": {"rows": [2, 0, 2, 1, 0], "columns": [], "cells": []}}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1"],
            selection_mode_set={"multi-row"},
        )
        assert result["selection"]["rows"] == [2, 0, 1]

    def test_duplicate_column_names_deduplicated(self) -> None:
        """Test that duplicate column names are deduplicated while preserving order."""
        value = {
            "selection": {
                "rows": [],
                "columns": ["col2", "col1", "col2", "col1"],
                "cells": [],
            }
        }
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"multi-column"},
        )
        assert result["selection"]["columns"] == ["col2", "col1"]

    def test_duplicate_cells_deduplicated(self) -> None:
        """Test that duplicate cells are deduplicated while preserving order."""
        value = {
            "selection": {
                "rows": [],
                "columns": [],
                "cells": [[0, "col1"], [1, "col2"], [0, "col1"]],
            }
        }
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"single-cell"},
        )
        # Single-cell mode: only first unique cell is kept
        assert result["selection"]["cells"] == [(0, "col1")]

    def test_non_string_column_names_filtered(self) -> None:
        """Test that non-string column names are filtered out."""
        value = {
            "selection": {
                "rows": [],
                "columns": [123, ["bad"], None, "col1"],
                "cells": [],
            }
        }
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"multi-column"},
        )
        # Only the valid string column name should remain
        assert result["selection"]["columns"] == ["col1"]

    def test_non_string_cell_column_name_filtered(self) -> None:
        """Test that non-string column names in cells are filtered out."""
        value = {
            "selection": {
                "rows": [],
                "columns": [],
                "cells": [[0, 123], [1, "col1"]],
            }
        }
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1"],
            selection_mode_set={"single-cell"},
        )
        # Cell with non-string column name should be filtered out
        assert result["selection"]["cells"] == [(1, "col1")]

    def test_combined_selection_modes(self) -> None:
        """Test validation with multiple selection modes active."""
        value = {
            "selection": {
                "rows": [0, 1],
                "columns": ["col1"],
                "cells": [[2, "col2"]],
            }
        }
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"multi-row", "multi-column", "single-cell"},
        )
        assert result["selection"]["rows"] == [0, 1]
        assert result["selection"]["columns"] == ["col1"]
        assert result["selection"]["cells"] == [(2, "col2")]

    def test_single_row_required_auto_selects_first_row(self) -> None:
        """Test that single-row-required mode auto-selects row 0 when selection is empty."""
        value = {"selection": {"rows": [], "columns": [], "cells": []}}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"single-row-required"},
        )
        assert result["selection"]["rows"] == [0]
        assert result["selection"]["columns"] == []
        assert result["selection"]["cells"] == []

    def test_single_row_required_does_not_override_valid_selection(self) -> None:
        """Test that single-row-required mode preserves existing valid selection."""
        value = {"selection": {"rows": [2], "columns": [], "cells": []}}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"single-row-required"},
        )
        assert result["selection"]["rows"] == [2]

    def test_single_row_required_empty_dataframe(self) -> None:
        """Test that single-row-required mode returns empty selection for empty dataframe."""
        value = {"selection": {"rows": [], "columns": [], "cells": []}}
        result = _validate_selection_state(
            value,
            num_rows=0,
            column_names=["col1", "col2"],
            selection_mode_set={"single-row-required"},
        )
        assert result["selection"]["rows"] == []

    def test_single_row_required_limits_to_single_row(self) -> None:
        """Test that single-row-required mode limits selection to a single row."""
        value = {"selection": {"rows": [0, 1, 2], "columns": [], "cells": []}}
        result = _validate_selection_state(
            value,
            num_rows=5,
            column_names=["col1", "col2"],
            selection_mode_set={"single-row-required"},
        )
        assert result["selection"]["rows"] == [0]


class TestButtonClickSerde:
    """Tests for ButtonClickSerde serialization and deserialization."""

    def test_serialize_none_returns_empty_proto(self) -> None:
        """Test that serializing None returns empty StringTriggerValue."""
        serde = ButtonClickSerde()
        result = serde.serialize(None)
        assert result.data == ""

    def test_serialize_click_state(self) -> None:
        """Test that serializing click state returns StringTriggerValue with JSON data."""
        serde = ButtonClickSerde()
        result = serde.serialize({"row": 5, "label": "Click me"})
        assert result.data == '{"row": 5, "label": "Click me"}'

    @pytest.mark.parametrize(
        ("ui_value", "expected"),
        [
            (None, None),
            ("", None),
            ('{"row": 3, "label": "Delete"}', {"row": 3, "label": "Delete"}),
        ],
        ids=["none", "empty_string", "valid_json"],
    )
    def test_deserialize(
        self, ui_value: str | None, expected: dict[str, object] | None
    ) -> None:
        """Test deserialize returns None for empty input and parsed dict for valid JSON."""
        serde = ButtonClickSerde()
        assert serde.deserialize(ui_value) == expected

    @pytest.mark.parametrize(
        "ui_value",
        [
            "not json",  # Invalid JSON syntax
            '"just a string"',  # Valid JSON but wrong shape (string not dict)
            '{"row": "0", "label": "x"}',  # row is string instead of int
            '{"row": true, "label": "x"}',  # row is bool (bool is subclass of int)
            '{"row": 0}',  # Missing label
            '{"label": "x"}',  # Missing row
            "[]",  # Array instead of dict
        ],
        ids=[
            "invalid_json",
            "json_string_not_dict",
            "row_string_not_int",
            "row_bool_not_int",
            "missing_label",
            "missing_row",
            "array_not_dict",
        ],
    )
    def test_deserialize_malformed_payload_raises(self, ui_value: str) -> None:
        """Test deserialize raises for malformed payloads with wrong shape or types."""
        import json

        from streamlit.errors import StreamlitAPIException

        serde = ButtonClickSerde()
        with pytest.raises((StreamlitAPIException, json.JSONDecodeError)):
            serde.deserialize(ui_value)

    def test_roundtrip_preserves_state(self) -> None:
        """Test that serialization roundtrip preserves the click state."""
        serde = ButtonClickSerde()
        original = {"row": 0, "label": ":material/edit: Edit"}
        serialized = serde.serialize(original)
        deserialized = serde.deserialize(serialized.data)
        assert deserialized == original

    def test_deserialize_returns_read_only_attribute_dictionary(self) -> None:
        """Test that the click value supports attribute access and is read-only."""
        serde = ButtonClickSerde()
        result = serde.deserialize('{"row": 2, "label": "Delete"}')

        # Attribute access must work in addition to key access.
        assert result is not None
        assert result.row == 2  # type: ignore[attr-defined]
        assert result.label == "Delete"  # type: ignore[attr-defined]
        assert result["row"] == 2

        # The dict is read-only; mutating it must raise.
        with pytest.raises(TypeError):
            result["row"] = 99  # type: ignore[index]


_EMPTY_SELECTION = {"rows": [], "columns": [], "cells": []}


@pytest.mark.parametrize(
    ("kwargs", "ui_value", "expected_rows"),
    [
        # ``selection_default`` is used when no UI value is provided.
        (
            {"selection_default": {"selection": {**_EMPTY_SELECTION, "rows": [3]}}},
            None,
            [3],
        ),
        # No UI value and no default => empty selection.
        ({}, None, []),
        # ``is_required_row_mode`` auto-selects row 0 when nothing is selected.
        ({"is_required_row_mode": True, "num_rows": 5}, None, [0]),
        # ``is_required_row_mode`` does not override an explicit selection.
        (
            {"is_required_row_mode": True, "num_rows": 5},
            '{"selection": {"rows": [2], "columns": [], "cells": []}}',
            [2],
        ),
        # ``is_required_row_mode`` with empty dataframe must NOT auto-select row 0.
        ({"is_required_row_mode": True, "num_rows": 0}, None, []),
    ],
    ids=[
        "default_used_when_ui_none",
        "empty_when_no_default",
        "required_row_mode_auto_selects_first",
        "required_row_mode_preserves_selection",
        "required_row_mode_skips_when_empty_df",
    ],
)
def test_dataframe_selection_serde_deserialize_rows(
    kwargs: dict[str, Any],
    ui_value: str | None,
    expected_rows: list[int],
) -> None:
    """``DataframeSelectionSerde.deserialize`` resolves ``selection.rows`` across configurations."""
    serde = DataframeSelectionSerde(**kwargs)
    assert serde.deserialize(ui_value)["selection"]["rows"] == expected_rows


def test_dataframe_selection_serde_deserialize_returns_attribute_dictionary() -> None:
    """``deserialize`` wraps the result in a read-only ``ReadOnlyAttributeDictionary``."""
    result = DataframeSelectionSerde().deserialize(None)

    # Attribute access must work for users (regression: #14454).
    assert result.selection.rows == []  # type: ignore[attr-defined]
    # The dict is read-only; mutating the top-level mapping must raise.
    with pytest.raises(TypeError):
        result["selection"] = {"rows": [99], "columns": [], "cells": []}  # type: ignore[index]


def test_dataframe_selection_serde_returns_empty_when_no_default() -> None:
    """``DataframeSelectionSerde.deserialize`` returns the empty selection when neither UI value nor default exists."""
    assert DataframeSelectionSerde().deserialize(None)["selection"] == _EMPTY_SELECTION


def test_dataframe_selection_serde_fills_missing_keys() -> None:
    """``DataframeSelectionSerde.deserialize`` adds missing ``rows``/``columns``/``cells`` keys."""
    result = DataframeSelectionSerde().deserialize('{"selection": {}}')

    assert result["selection"] == _EMPTY_SELECTION


def test_dataframe_selection_serde_replaces_state_without_selection_key() -> None:
    """``DataframeSelectionSerde.deserialize`` resets to empty state when ``selection`` key is missing."""
    result = DataframeSelectionSerde().deserialize('{"foo": "bar"}')

    assert result == {"selection": _EMPTY_SELECTION}


def test_dataframe_selection_serde_converts_cells_to_tuples() -> None:
    """JSON cells (lists) are converted to tuples after deserialization."""
    result = DataframeSelectionSerde().deserialize(
        '{"selection": {"rows": [], "columns": [], "cells": [[1, "col1"]]}}'
    )

    assert result["selection"]["cells"] == [(1, "col1")]


def test_dataframe_selection_serde_serialize_roundtrip() -> None:
    """``serialize`` produces JSON parseable by ``deserialize`` to the equivalent state."""
    serde = DataframeSelectionSerde()
    state = {"selection": {"rows": [1], "columns": ["c1"], "cells": []}}

    result = serde.deserialize(serde.serialize(state))  # type: ignore[arg-type]

    assert result["selection"] == {"rows": [1], "columns": ["c1"], "cells": []}


def test_parse_selection_mode_with_invalid_mode_raises() -> None:
    """``parse_selection_mode`` raises ``StreamlitAPIException`` for unknown modes."""
    with pytest.raises(StreamlitAPIException, match="Invalid selection mode"):
        parse_selection_mode("not-a-real-mode")  # type: ignore[arg-type]


def test_parse_selection_mode_accepts_iterable_of_modes() -> None:
    """``parse_selection_mode`` maps user-facing mode names to the corresponding proto values."""
    result = parse_selection_mode(["multi-row", "multi-column"])

    assert result == {
        DataframeProto.SelectionMode.MULTI_ROW,
        DataframeProto.SelectionMode.MULTI_COLUMN,
    }


def test_programmatic_selection_returns_attribute_dictionary() -> None:
    """Test that programmatic selection via session state returns AttributeDictionary.

    Regression test for #14454: When setting dataframe selection state
    programmatically via st.session_state, the returned value must be an
    AttributeDictionary so users can access selection attributes (e.g.,
    event.selection) without getting an AttributeError.
    """

    def script() -> None:
        import pandas as pd

        import streamlit as st

        df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})

        if "run_count" not in st.session_state:
            st.session_state["run_count"] = 0
        st.session_state["run_count"] += 1

        # Programmatically set selection on second run
        if st.session_state["run_count"] == 2:
            st.session_state["df_key"] = {
                "selection": {"rows": [1], "columns": [], "cells": []}
            }

        result = st.dataframe(
            df, key="df_key", on_select="rerun", selection_mode="multi-row"
        )
        # Attribute access would raise AttributeError if result is a plain dict.
        st.text(f"rows: {result.selection.rows}")

    at = AppTest.from_function(script).run()
    assert at.text[0].value == "rows: []"

    at = at.run()
    assert at.text[0].value == "rows: [1]"

    # Third run without modifying session state: selection should persist
    # as AttributeDictionary (verifies the fix applies across subsequent reruns).
    at = at.run()
    assert at.text[0].value == "rows: [1]"


def test_selection_state_is_read_only() -> None:
    """Test that dataframe selection state is read-only.

    When users try to modify the selection state via nested assignment
    (e.g., st.session_state.key.selection = {...}), a TypeError should be
    raised with a helpful error message guiding them to use full assignment.
    """
    df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
    result = st.dataframe(
        df, key="df_key", on_select="rerun", selection_mode="multi-row"
    )

    # Verify the result is read-only and raises TypeError on modification attempts
    with pytest.raises(TypeError, match="Widget state is read-only"):
        result.selection = {"rows": [0]}

    with pytest.raises(TypeError, match="Widget state is read-only"):
        result["selection"] = {"rows": [0]}

    # Verify nested access is also read-only (both attribute and bracket style)
    with pytest.raises(TypeError, match="Widget state is read-only"):
        result.selection.rows = [0]

    with pytest.raises(TypeError, match="Widget state is read-only"):
        result["selection"]["rows"] = [0]

    # Verify read access still works
    assert result.selection.rows == []
    assert result.selection.columns == []
    assert result.selection.cells == []
