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

"""file_uploader unit test."""


import streamlit as st
from tests import testutil


class CameraInputTest(testutil.DeltaGeneratorTestCase):
    def test_just_label(self):
        """Test that it can be called with no other values."""
        st.camera_input("the label")

        c = self.get_delta_from_queue().new_element.camera_input
        self.assertEqual(c.label, "the label")

    def test_help_tooltip(self):
        """Test that it can be called using a string for type parameter."""
        st.camera_input("the label", help="help_label")

        c = self.get_delta_from_queue().new_element.camera_input
        self.assertEqual(c.help, "help_label")
