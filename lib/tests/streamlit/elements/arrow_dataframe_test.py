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

"""Arrow DataFrame tests."""

import json
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest as pytest
from pandas.io.formats.style_render import StylerRenderer as Styler

import streamlit as st
from streamlit.elements.lib.column_config_utils import INDEX_IDENTIFIER
from streamlit.errors import StreamlitAPIException
from streamlit.type_util import bytes_to_data_frame, pyarrow_table_to_bytes
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
        pd.testing.assert_frame_equal(bytes_to_data_frame(proto.data), df)

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
        self.assertEqual(proto.data, pyarrow_table_to_bytes(table))

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
            bytes_to_data_frame(proto.styler.display_values), expected
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

    @pytest.mark.require_snowflake
    def test_snowpark_uncollected(self):
        """Tests that data can be read from Snowpark's uncollected Dataframe"""
        with create_snowpark_session() as snowpark_session:
            df = snowpark_session.sql("SELECT 40+2 as COL1")

            st.dataframe(df)

        expected = pd.DataFrame({"COL1": [42]})

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        pd.testing.assert_frame_equal(bytes_to_data_frame(proto.data), expected)

    @pytest.mark.require_snowflake
    def test_snowpark_collected(self):
        """Tests that data can be read from Snowpark's collected Dataframe"""
        with create_snowpark_session() as snowpark_session:
            df = snowpark_session.sql("SELECT 40+2 as COL1").collect()
            st.dataframe(df)

        expected = pd.DataFrame({"COL1": [42]})

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        pd.testing.assert_frame_equal(bytes_to_data_frame(proto.data), expected)


class StArrowTableAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_table(self):
        """Test st.table."""
        from streamlit.type_util import bytes_to_data_frame

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        st.table(df)

        proto = self.get_delta_from_queue().new_element.arrow_table
        pd.testing.assert_frame_equal(bytes_to_data_frame(proto.data), df)
