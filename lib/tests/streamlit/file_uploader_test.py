# -*- coding: utf-8 -*-
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

"""file_uploader unit test."""

from tests import testutil
import streamlit as st
from streamlit import config


class FileUploaderTest(testutil.DeltaGeneratorTestCase):
    def test_just_label(self):
        """Test that it can be called with no other values."""
        st.file_uploader("the label")

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.progress, 0.0)

    def test_string_typel(self):
        """Test that it can be called using a string for type parameter."""
        st.file_uploader("the label", type="png")

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, ["png"])
        self.assertEqual(c.progress, 0.0)

    def test_several_types(self):
        """Test that it can be called using an array for type parameter."""
        st.file_uploader("the label", type=["png", "svg", "jpeg"])

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, ["png", "svg", "jpeg"])
        self.assertEqual(c.progress, 0.0)

    def test_max_upload_size_mb(self):
        """Test that the max upload size is the configuration value."""
        st.file_uploader("the label")

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(
            c.max_upload_size_mb, config.get_option("server.maxUploadSize")
        )
        self.assertEqual(c.progress, 0.0)
