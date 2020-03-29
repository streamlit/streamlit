# Copyright 2018-2020 Streamlit Inc.
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

"""Dataframe dimension parameters test."""

import pandas as pd

from tests import testutil
import streamlit as st


class DeltaGeneratorDataframeTest(testutil.DeltaGeneratorTestCase):
    """Test the metadata in the serialized delta message for the different
    dimension specifier options.
    """

    def test_no_dimensions(self):
        """When no dimension parameters are passed
        """
        self._do_test(lambda fn, df: fn(df), 0, 0)

    def test_with_dimensions(self):
        """When dimension parameter are passed
        """
        self._do_test(lambda fn, df: fn(df, 10, 20), 10, 20)

    def test_with_height_only(self):
        """When only height parameter is passed
        """
        self._do_test(lambda fn, df: fn(df, height=20), 0, 20)

    def test_with_width_only(self):
        """When only width parameter is passed
        """
        self._do_test(lambda fn, df: fn(df, width=20), 20, 0)

    def _do_test(self, fn, expectedWidth, expectedHeight):
        df = pd.DataFrame({"A": [1, 2, 3, 4, 5]})

        fn(st.dataframe, df)
        metadata = self._get_metadata()
        self.assertEqual(metadata.element_dimension_spec.width, expectedWidth)
        self.assertEqual(metadata.element_dimension_spec.height, expectedHeight)

    def _get_metadata(self):
        """Returns the metadata for the most recent element in the
        DeltaGenerator queue
        """
        return self.report_queue._queue[-1].metadata
