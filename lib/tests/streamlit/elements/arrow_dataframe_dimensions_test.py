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

"""Arrow Dataframe dimension parameters test."""

import pandas as pd

import streamlit as st
from tests import testutil


class ArrowDataFrameDimensionsTest(testutil.DeltaGeneratorTestCase):
    """Test the metadata in the serialized delta message for the different
    dimension specifier options.
    """

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

        fn(st._arrow_dataframe, df)
        arrow_data_frame = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(arrow_data_frame.width, expectedWidth)
        self.assertEqual(arrow_data_frame.height, expectedHeight)

    def _get_metadata(self):
        """Returns the metadata for the most recent element in the
        DeltaGenerator queue
        """
        return self.forward_msg_queue._queue[-1].metadata
