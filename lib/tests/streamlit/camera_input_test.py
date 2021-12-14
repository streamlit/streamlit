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

"""file_uploader unit test."""

from unittest.mock import patch

import pytest

import streamlit as st
from streamlit.uploaded_file_manager import UploadedFileRec, UploadedFile
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

    @patch("streamlit.elements.camera_input.CameraInputMixin._get_file_recs")
    def test_unique_uploaded_file_instance(self, get_file_recs_patch):
        """We should get a unique UploadedFile instance each time we access
        the camera widget."""

        # Patch UploadFileManager to return 1 file
        file_recs = [
            UploadedFileRec(1, "file1", "type", b"123")
        ]

        get_file_recs_patch.return_value = file_recs

        # These canmera_inputs have different labels so that we don't cause
        # a DuplicateKey error - but because we're patching the get_files
        # function, both camera_inputs will refer to the same files.
        file1: UploadedFile = st.camera_input("a", help="Same help")
        file2: UploadedFile = st.camera_input("b", help="Same help")

        self.assertNotEqual(file1, file2)
