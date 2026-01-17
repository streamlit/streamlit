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

"""Arrow marshalling unit tests."""

import json
from unittest.mock import patch

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.dataframe_util import (
    convert_arrow_bytes_to_pandas_df,
    convert_arrow_table_to_arrow_bytes,
)
from streamlit.elements.lib.column_config_utils import INDEX_IDENTIFIER
from streamlit.errors import StreamlitValueError
from streamlit.proto.Arrow_pb2 import Arrow as ArrowProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def mock_data_frame():
    return pd.DataFrame(
        index=[[0, 1], ["i1", "i2"]],
        columns=[[2, 3, 4], ["c1", "c2", "c3"]],
        data=np.arange(0, 6, 1).reshape(2, 3),
    )


class ArrowTest(DeltaGeneratorTestCase):
    """Test ability to marshall arrow protos."""

    def test_dataframe_data(self):
        df = mock_data_frame()
        st.table(df)

        proto = self.get_delta_from_queue().new_element.arrow_table
        pd.testing.assert_frame_equal(convert_arrow_bytes_to_pandas_df(proto.data), df)

    def test_pyarrow_table_data(self):
        df = mock_data_frame()
        table = pa.Table.from_pandas(df)
        st.table(table)

        proto = self.get_delta_from_queue().new_element.arrow_table
        assert proto.data == convert_arrow_table_to_arrow_bytes(table)

    def test_uuid(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_uuid("FAKE_UUID")
        st.table(styler)

        proto = self.get_delta_from_queue().new_element.arrow_table
        assert proto.styler.uuid == "FAKE_UUID"

    def test_caption(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_caption("FAKE_CAPTION")
        st.table(styler)

        proto = self.get_delta_from_queue().new_element.arrow_table
        assert proto.styler.caption == "FAKE_CAPTION"

    def test_table_styles(self):
        df = mock_data_frame()
        styler = df.style
        # NOTE: If UUID is not set - a random UUID will be generated.
        styler.set_uuid("FAKE_UUID")
        styler.set_table_styles(
            [{"selector": ".blank", "props": [("background-color", "red")]}]
        )
        st.table(styler)

        proto = self.get_delta_from_queue().new_element.arrow_table
        assert proto.styler.styles == "#T_FAKE_UUID .blank { background-color: red }"

    def test_cell_styles(self):
        df = mock_data_frame()
        styler = df.style
        # NOTE: If UUID is not set - a random UUID will be generated.
        styler.set_uuid("FAKE_UUID")
        styler.highlight_max(axis=None)
        st.table(styler)

        proto = self.get_delta_from_queue().new_element.arrow_table
        assert (
            proto.styler.styles == "#T_FAKE_UUID_row1_col2 { background-color: yellow }"
        )

    def test_display_values(self):
        df = pd.DataFrame(
            [[1, 2, 3], [4, 5, 6]],
        )
        styler = df.style.format("{:.2%}")
        st.table(styler)

        expected = pd.DataFrame(
            [["100.00%", "200.00%", "300.00%"], ["400.00%", "500.00%", "600.00%"]],
        )

        proto = self.get_delta_from_queue().new_element.arrow_table
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.styler.display_values), expected
        )

    def test_table_uses_convert_anything_to_df(self):
        """Test that st.table uses convert_anything_to_df to convert input data."""
        df = mock_data_frame()

        with patch(
            "streamlit.dataframe_util.convert_anything_to_pandas_df"
        ) as convert_anything_to_df:
            convert_anything_to_df.return_value = df

            st.table(df)
            convert_anything_to_df.assert_called_once()

    @parameterized.expand(
        [
            (True, ArrowProto.BorderMode.ALL),
            (False, ArrowProto.BorderMode.NONE),
            ("horizontal", ArrowProto.BorderMode.HORIZONTAL),
        ]
    )
    def test_table_border_parameter(self, border, expected):
        """Test that st.table border parameter converts values correctly."""
        df = mock_data_frame()
        st.table(df, border=border)
        proto = self.get_delta_from_queue().new_element.arrow_table
        assert proto.border_mode == expected

    def test_table_border_invalid_value(self):
        """Test that st.table raises StreamlitValueError for invalid border values."""
        df = mock_data_frame()

        with pytest.raises(
            StreamlitValueError,
            match=r"Invalid `border` value.*True, False, 'horizontal'",
        ):
            st.table(df, border="invalid")

    @parameterized.expand(
        [
            (False, ""),
            (True, json.dumps({INDEX_IDENTIFIER: {"hidden": True}})),
        ]
    )
    def test_table_hide_index(self, hide_index, expected):
        """Test that st.table `hide_index` parameter sets the expected index column
        config for different inputs."""
        df = mock_data_frame()
        st.table(df, hide_index=hide_index)
        proto = self.get_delta_from_queue().new_element.arrow_table
        self.assertEqual(proto.columns, expected)

        # Verify data is still present
        pd.testing.assert_frame_equal(convert_arrow_bytes_to_pandas_df(proto.data), df)

    def test_table_hide_index_with_styler(self):
        """Test that hide_index works correctly with pandas Styler."""
        df = mock_data_frame()
        styler = df.style
        styler.set_uuid("THE_FALL_OFF")

        # Test hide_index=True with styler
        st.table(styler, hide_index=True)
        proto = self.get_delta_from_queue().new_element.arrow_table

        expected_config = json.dumps({INDEX_IDENTIFIER: {"hidden": True}})
        self.assertEqual(proto.columns, expected_config)
        self.assertEqual(proto.styler.uuid, "THE_FALL_OFF")

        # Test hide_index=False with styler
        st.table(styler, hide_index=False)
        proto = self.get_delta_from_queue().new_element.arrow_table

        self.assertEqual(proto.columns, "")
        self.assertEqual(proto.styler.uuid, "THE_FALL_OFF")

    def test_table_hide_index_with_multiindex(self):
        """Test that hide_index applies to all index columns in MultiIndex."""
        df = pd.DataFrame(
            {"MDL": [1, 2, 3], "TOS": [4, 5, 6]},
            index=pd.MultiIndex.from_tuples(
                [(1, "a"), (2, "b"), (3, "c")], names=["num", "letter"]
            ),
        )

        # Test hide_index=True hides all index columns
        st.table(df, hide_index=True)
        proto = self.get_delta_from_queue().new_element.arrow_table

        expected_config = json.dumps({INDEX_IDENTIFIER: {"hidden": True}})
        self.assertEqual(proto.columns, expected_config)

        # Verify both index columns are present in data but marked as hidden
        result_df = convert_arrow_bytes_to_pandas_df(proto.data)
        pd.testing.assert_frame_equal(result_df, df)

    def test_table_hide_index_default_behavior(self):
        """Test that hide_index=False is the default and shows the index."""
        df = pd.DataFrame({"KOD": [1, 2, 3]}, index=["x", "y", "z"])

        # Call st.table without hide_index parameter
        st.table(df)
        proto = self.get_delta_from_queue().new_element.arrow_table

        # By default (hide_index=False), no index config should be set
        self.assertEqual(proto.columns, "")

        # Verify index is present in the data
        result_df = convert_arrow_bytes_to_pandas_df(proto.data)
        pd.testing.assert_frame_equal(result_df, df)
