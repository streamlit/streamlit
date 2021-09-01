# Copyright 2018-2021 Streamlit Inc.
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

"""download_button unit test."""

import streamlit as st

from parameterized import parameterized
from tests import testutil


class DownloadButtonTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall download_button protos."""

    @parameterized.expand([("hello world",), (b"byteshere",)])
    def test_just_label(self, data):
        """Test that it can be called with label and string or bytes data."""
        st.download_button("the label", data=data)

        c = self.get_delta_from_queue().new_element.download_button
        self.assertEqual(c.label, "the label")

    def test_url_exist(self):
        """Test that file url exist in proto."""
        st.download_button("the label", data="juststring")

        c = self.get_delta_from_queue().new_element.download_button
        self.assertTrue("/media/" in c.url)
