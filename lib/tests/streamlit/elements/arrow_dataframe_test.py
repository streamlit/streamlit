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

"""Arrow DataFrame tests."""

import json
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest
from pandas.io.formats.style_render import StylerRenderer as Styler
from parameterized import parameterized

import streamlit as st
from streamlit.dataframe_util import (
    convert_arrow_bytes_to_pandas_df,
    convert_arrow_table_to_arrow_bytes,
)
from streamlit.elements.lib.column_config_utils import INDEX_IDENTIFIER
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.testutil import create_snowpark_session


def mock_data_frame():
    return pd.DataFrame(
        index=[[0, 1], ["i1", "i2"]],
        columns=[[2, 3, 4], ["c1", "c2", "c3"]],
        data=np.arange(0, 6, 1).reshape(2, 3),
    )


class ArrowDataFrameProtoTest(DeltaGeneratorTestCase):
    """Test ability to marshall arrow protos."""

    def test_dataframe_data(self):
        df = mock_data_frame()
        st.dataframe(df)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        pd.testing.assert_frame_equal(convert_arrow_bytes_to_pandas_df(proto.data), df)

    def test_column_order_parameter(self):
        """Test that it can be called with column_order."""
        st.dataframe(pd.DataFrame(), column_order=["a", "b"])

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.column_order, ["a", "b"])

    def test_empty_column_order_parameter(self):
        """Test that an empty column_order is correctly added."""
        st.dataframe(pd.DataFrame(), column_order=[])

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.column_order, [])

    def test_pyarrow_table_data(self):
        df = mock_data_frame()
        table = pa.Table.from_pandas(df)
        st.dataframe(table)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.data, convert_arrow_table_to_arrow_bytes(table))

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

        st.dataframe(data_df, hide_index=False)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(
            proto.columns,
            json.dumps({INDEX_IDENTIFIER: {"hidden": False}}),
        )

    def test_uuid(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_uuid("FAKE_UUID")
        st.dataframe(styler)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.styler.uuid, "FAKE_UUID")

    def test_caption(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_caption("FAKE_CAPTION")
        st.dataframe(styler)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(proto.styler.caption, "FAKE_CAPTION")

    def test_cell_styles(self):
        df = mock_data_frame()
        styler = df.style
        # NOTE: If UUID is not set - a random UUID will be generated.
        styler.set_uuid("FAKE_UUID")
        styler.highlight_max(axis=None)
        st.dataframe(styler)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(
            proto.styler.styles, "#T_FAKE_UUIDrow1_col2 { background-color: yellow }"
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
        with self.assertRaises(StreamlitAPIException):
            st.dataframe(df.style.format("{:03d}"))
        pd.reset_option("styler.render.max_elements")

    @patch(
        "streamlit.type_util.is_pandas_version_less_than",
        MagicMock(return_value=False),
    )
    @patch.object(Styler, "_translate")
    def test_pandas_version_1_3_0_and_above(self, mock_styler_translate):
        """Tests that `styler._translate` is called with correct arguments in Pandas >= 1.3.0"""
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

    @pytest.mark.require_snowflake
    def test_snowpark_uncollected(self):
        """Tests that data can be read from Snowpark's uncollected Dataframe"""
        with create_snowpark_session() as snowpark_session:
            df = snowpark_session.sql("SELECT 42 as COL1")

            st.dataframe(df)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(convert_arrow_bytes_to_pandas_df(proto.data).iat[0, 0], 42)

    @pytest.mark.require_snowflake
    def test_snowpark_collected(self):
        """Tests that data can be read from Snowpark's collected Dataframe"""
        with create_snowpark_session() as snowpark_session:
            df = snowpark_session.sql("SELECT 42 as COL1").collect()

            st.dataframe(df)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(convert_arrow_bytes_to_pandas_df(proto.data).iat[0, 0], 42)

    def test_dataframe_on_select_initial_returns(self):
        """Test st.dataframe returns an empty selection as initial result."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        selection = st.dataframe(df, on_select="rerun", key="selectable_df")

        self.assertEqual(selection.selection.rows, [])
        self.assertEqual(selection.selection.columns, [])

        # Check that the selection state is added to the session state:
        self.assertEqual(st.session_state.selectable_df.selection.rows, [])
        self.assertEqual(st.session_state.selectable_df.selection.columns, [])

    def test_dataframe_with_invalid_on_select(self):
        """Test that an exception is thrown if the on_select parameter is invalid."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        with self.assertRaises(StreamlitAPIException):
            st.dataframe(df, on_select="invalid")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form_on_select_rerun(self):
        """Test that form id is marshalled correctly inside of a form."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        with st.form("form"):
            st.dataframe(df, on_select="rerun")

        # 2 elements will be created: form block, dataframe
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        plotly_proto = self.get_delta_from_queue(1).new_element.arrow_data_frame
        self.assertEqual(plotly_proto.form_id, form_proto.form.form_id)

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_selectable_df_disallows_callbacks_inside_form(self):
        """Test that an exception is thrown if a callback is defined with a
        selectable dataframe inside a form."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        with self.assertRaises(StreamlitAPIException):
            with st.form("form"):
                st.dataframe(df, on_select=lambda: None)

    def test_selectable_df_throws_exception_with_modified_sessions_state(self):
        """Test that an exception is thrown if the session state is modified."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        st.session_state.selectable_df = {
            "selection": {"rows": [1], "columns": ["col1"]},
        }
        with self.assertRaises(StreamlitAPIException):
            st.dataframe(df, on_select="rerun", key="selectable_df")

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when selections are activated and
        it is used inside a cached function."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        st.cache_data(lambda: st.dataframe(df, on_select="rerun"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        self.assertEqual(el.type, "CachedWidgetWarning")
        self.assertTrue(el.is_warning)

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
        self.assertEqual(el.selection_mode, proto_value)

    @parameterized.expand(
        [
            (("multi-row", "multi-column"), [1, 3]),
            ({"single-row", "single-column"}, [0, 2]),
            ({"single-row", "multi-column"}, [0, 3]),
            (("multi-row", "single-column"), [1, 2]),
            ("single-row", [0]),
            ("multi-column", [3]),
        ]
    )
    def test_selection_mode_parsing(self, input_modes, expected_modes):
        """Test that the selection_mode parameter is parsed correctly."""

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])
        st.dataframe(df, on_select="rerun", selection_mode=input_modes)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.arrow_data_frame.selection_mode, expected_modes)

    def test_selection_mode_parsing_invalid(self):
        """Test that an exception is thrown if the selection_mode parameter is invalid."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        # Should throw an exception of the selection mode is parsed wrongly
        with self.assertRaises(
            StreamlitAPIException,
            msg="Should show exception if an unknown selection mode is selected",
        ):
            st.dataframe(
                df, on_select="rerun", selection_mode=["invalid", "single-row"]
            )

        with self.assertRaises(
            StreamlitAPIException,
            msg="Should show exception if single & multi row mode is selected",
        ):
            st.dataframe(
                df, on_select="rerun", selection_mode=["single-row", "multi-row"]
            )

        with self.assertRaises(
            StreamlitAPIException,
            msg="Should show exception if single & multi column mode is selected",
        ):
            st.dataframe(
                df, on_select="rerun", selection_mode=["single-column", "multi-column"]
            )

        # If selections are deactivated, the selection mode list should be empty
        # even if the selection_mode parameter is set.
        st.dataframe(
            df, on_select="ignore", selection_mode=["single-row", "multi-column"]
        )
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.selection_mode, [])


class StArrowTableAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_table(self):
        """Test st.table."""
        from streamlit.dataframe_util import convert_arrow_bytes_to_pandas_df

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        st.table(df)

        proto = self.get_delta_from_queue().new_element.arrow_table
        pd.testing.assert_frame_equal(convert_arrow_bytes_to_pandas_df(proto.data), df)
