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
from streamlit.errors import (
    StreamlitInvalidHeightError,
    StreamlitInvalidWidthError,
    StreamlitValueError,
)
from streamlit.proto.Table_pb2 import Table as TableProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import (
    HeightConfigFields,
    WidthConfigFields,
)


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

        proto = self.get_delta_from_queue().new_element.table
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.arrow_data.data), df
        )

    def test_pyarrow_table_data(self):
        df = mock_data_frame()
        table = pa.Table.from_pandas(df)
        st.table(table)

        proto = self.get_delta_from_queue().new_element.table
        assert proto.arrow_data.data == convert_arrow_table_to_arrow_bytes(table)

    def test_uuid(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_uuid("FAKE_UUID")
        st.table(styler)

        proto = self.get_delta_from_queue().new_element.table
        assert proto.arrow_data.styler.uuid == "FAKE_UUID"

    def test_caption(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_caption("FAKE_CAPTION")
        st.table(styler)

        proto = self.get_delta_from_queue().new_element.table
        assert proto.arrow_data.styler.caption == "FAKE_CAPTION"

    def test_table_styles(self):
        df = mock_data_frame()
        styler = df.style
        # NOTE: If UUID is not set - a random UUID will be generated.
        styler.set_uuid("FAKE_UUID")
        styler.set_table_styles(
            [{"selector": ".blank", "props": [("background-color", "red")]}]
        )
        st.table(styler)

        proto = self.get_delta_from_queue().new_element.table
        assert (
            proto.arrow_data.styler.styles
            == "#T_FAKE_UUID .blank { background-color: red }"
        )

    def test_cell_styles(self):
        df = mock_data_frame()
        styler = df.style
        # NOTE: If UUID is not set - a random UUID will be generated.
        styler.set_uuid("FAKE_UUID")
        styler.highlight_max(axis=None)
        st.table(styler)

        proto = self.get_delta_from_queue().new_element.table
        assert (
            proto.arrow_data.styler.styles
            == "#T_FAKE_UUID_row1_col2 { background-color: yellow }"
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

        proto = self.get_delta_from_queue().new_element.table
        pd.testing.assert_frame_equal(
            convert_arrow_bytes_to_pandas_df(proto.arrow_data.styler.display_values),
            expected,
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
            (True, TableProto.BorderMode.ALL),
            (False, TableProto.BorderMode.NONE),
            ("horizontal", TableProto.BorderMode.HORIZONTAL),
        ]
    )
    def test_table_border_parameter(self, border, expected):
        """Test that st.table border parameter converts values correctly."""
        df = mock_data_frame()
        st.table(df, border=border)
        proto = self.get_delta_from_queue().new_element.table
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
            ("stretch", WidthConfigFields.USE_STRETCH, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT, "use_content", True),
            (400, WidthConfigFields.PIXEL_WIDTH, "pixel_width", 400),
        ]
    )
    def test_table_width_parameter(
        self, width, expected_field, expected_attr, expected_value
    ):
        """Test that st.table width parameter serializes widthConfig correctly."""
        df = mock_data_frame()
        st.table(df, width=width)
        element = self.get_delta_from_queue().new_element
        assert element.width_config.WhichOneof("width_spec") == expected_field.value
        assert getattr(element.width_config, expected_attr) == expected_value

    @parameterized.expand(
        [
            ("stretch", HeightConfigFields.USE_STRETCH, "use_stretch", True),
            ("content", HeightConfigFields.USE_CONTENT, "use_content", True),
            (300, HeightConfigFields.PIXEL_HEIGHT, "pixel_height", 300),
        ]
    )
    def test_table_height_parameter(
        self, height, expected_field, expected_attr, expected_value
    ):
        """Test that st.table height parameter serializes heightConfig correctly."""
        df = mock_data_frame()
        st.table(df, height=height)
        element = self.get_delta_from_queue().new_element
        assert element.height_config.WhichOneof("height_spec") == expected_field.value
        assert getattr(element.height_config, expected_attr) == expected_value

    def test_table_default_layout_parameters(self):
        """Test that default width/height serialize to stretch/content."""
        df = mock_data_frame()
        st.table(df)

        element = self.get_delta_from_queue().new_element
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch is True

        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.USE_CONTENT.value
        )
        assert element.height_config.use_content is True

    @parameterized.expand(
        [
            ("invalid_string", StreamlitInvalidWidthError),
            (-100, StreamlitInvalidWidthError),
        ]
    )
    def test_table_width_invalid_values(self, width, expected_error):
        """Test that st.table raises error for invalid width values."""
        df = mock_data_frame()

        with pytest.raises(expected_error):
            st.table(df, width=width)

    @parameterized.expand(
        [
            ("invalid_string", StreamlitInvalidHeightError),
            (-100, StreamlitInvalidHeightError),
        ]
    )
    def test_table_height_invalid_values(self, height, expected_error):
        """Test that st.table raises error for invalid height values."""
        df = mock_data_frame()

        with pytest.raises(expected_error):
            st.table(df, height=height)

    def test_table_with_all_parameters(self):
        """Test that st.table works with all parameters specified."""
        df = mock_data_frame()
        st.table(df, border="horizontal", width=400, height=300)
        element = self.get_delta_from_queue().new_element
        proto = element.table
        assert proto.border_mode == TableProto.BorderMode.HORIZONTAL
        assert element.width_config.WhichOneof("width_spec") == "pixel_width"
        assert element.width_config.pixel_width == 400
        assert element.height_config.WhichOneof("height_spec") == "pixel_height"
        assert element.height_config.pixel_height == 300
