# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Arrow DataGrid tests."""

from unittest.mock import patch

import numpy as np
import pandas as pd
import pyarrow as pa
from streamlit.type_util import (
    bytes_to_data_frame,
    is_pandas_version_less_than,
    pyarrow_table_to_bytes,
)
from tests import testutil

import streamlit as st

# TODO(lukasmasuch): These tests are mostly copied from the existing arrow tests.
# Once we add support for clicks and selections, there will be a lot of changes to these tests.


# In Pandas 1.3.0, Styler functionality was moved under StylerRenderer.
if is_pandas_version_less_than("1.3.0"):
    from pandas.io.formats.style import Styler
else:
    from pandas.io.formats.style_render import StylerRenderer as Styler


def mock_data_frame():
    return pd.DataFrame(
        index=[[0, 1], ["i1", "i2"]],
        columns=[[2, 3, 4], ["c1", "c2", "c3"]],
        data=np.arange(0, 6, 1).reshape(2, 3),
    )


class ArrowDataGridDimensionsTest(testutil.DeltaGeneratorTestCase):
    """Test the interactive table component."""

    def test_no_dimensions(self):
        """When no dimension parameters are passed"""
        self._do_test(lambda fn, df: fn(df), 0, 0)

    def test_with_dimensions(self):
        """When dimension parameter are passed"""
        self._do_test(lambda fn, df: fn(df, 10, 20), 10, 20)

    def test_with_height_only(self):
        """When only height parameter is passed"""
        self._do_test(lambda fn, df: fn(df, height=20), 0, 20)

    def test_with_width_only(self):
        """When only width parameter is passed"""
        self._do_test(lambda fn, df: fn(df, width=20), 20, 0)

    def _do_test(self, fn, expectedWidth, expectedHeight):
        df = pd.DataFrame({"A": [1, 2, 3, 4, 5]})

        fn(st.experimental_data_grid, df)
        metadata = self._get_metadata()
        self.assertEqual(metadata.element_dimension_spec.width, expectedWidth)
        self.assertEqual(metadata.element_dimension_spec.height, expectedHeight)

    def _get_metadata(self):
        """Returns the metadata for the most recent element in the
        DeltaGenerator queue
        """
        return self.forward_msg_queue._queue[-1].metadata


class ArrowDataGridProtoTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall arrow protos."""

    def test_dataframe_data(self):
        df = mock_data_frame()
        st.experimental_data_grid(df)

        proto = self.get_delta_from_queue().new_element.data_grid
        pd.testing.assert_frame_equal(bytes_to_data_frame(proto.data), df)

    def test_pyarrow_table_data(self):
        df = mock_data_frame()
        table = pa.Table.from_pandas(df)
        st.experimental_data_grid(table)

        proto = self.get_delta_from_queue().new_element.data_grid
        self.assertEqual(proto.data, pyarrow_table_to_bytes(table))

    def test_uuid(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_uuid("FAKE_UUID")
        st.experimental_data_grid(styler)

        proto = self.get_delta_from_queue().new_element.data_grid
        self.assertEqual(proto.styler.uuid, "FAKE_UUID")

    def test_caption(self):
        df = mock_data_frame()
        styler = df.style
        styler.set_caption("FAKE_CAPTION")
        st.experimental_data_grid(styler)

        proto = self.get_delta_from_queue().new_element.data_grid
        self.assertEqual(proto.styler.caption, "FAKE_CAPTION")

    def test_cell_styles(self):
        df = mock_data_frame()
        styler = df.style
        # NOTE: If UUID is not set - a random UUID will be generated.
        styler.set_uuid("FAKE_UUID")
        styler.highlight_max(axis=None)
        st.experimental_data_grid(styler)

        proto = self.get_delta_from_queue().new_element.data_grid
        self.assertEqual(
            proto.styler.styles, "#T_FAKE_UUIDrow1_col2 { background-color: yellow }"
        )

    def test_display_values(self):
        df = pd.DataFrame(
            [[1, 2, 3], [4, 5, 6]],
        )
        styler = df.style.format("{:.2%}")
        st.experimental_data_grid(styler)

        expected = pd.DataFrame(
            [["100.00%", "200.00%", "300.00%"], ["400.00%", "500.00%", "600.00%"]],
        )

        proto = self.get_delta_from_queue().new_element.data_grid
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.styler.display_values), expected
        )

    @patch("streamlit.type_util.is_pandas_version_less_than", return_value=True)
    @patch.object(Styler, "_translate")
    def test_pandas_version_below_1_3_0(self, mock_styler_translate, _):
        """Tests that `styler._translate` is called without arguments in Pandas < 1.3.0"""
        df = mock_data_frame()
        styler = df.style.set_uuid("FAKE_UUID")

        st.experimental_data_grid(styler)
        mock_styler_translate.assert_called_once_with()

    @patch("streamlit.type_util.is_pandas_version_less_than", return_value=False)
    @patch.object(Styler, "_translate")
    def test_pandas_version_1_3_0_and_above(self, mock_styler_translate, _):
        """Tests that `styler._translate` is called with correct arguments in Pandas >= 1.3.0"""
        df = mock_data_frame()
        styler = df.style.set_uuid("FAKE_UUID")

        st.experimental_data_grid(styler)
        mock_styler_translate.assert_called_once_with(False, False)
