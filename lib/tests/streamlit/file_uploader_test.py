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

from mock import patch

import streamlit as st
from streamlit import config
from streamlit.UploadedFileManager import UploadedFile
from streamlit.file_util import get_encoded_file_data
from tests import testutil


class FileUploaderTest(testutil.DeltaGeneratorTestCase):
    def test_just_label(self):
        """Test that it can be called with no other values."""
        st.file_uploader("the label")

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.label, "the label")

    def test_single_type(self):
        """Test that it can be called using a string for type parameter."""
        st.file_uploader("the label", type="png")

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, ["png"])

    def test_multiple_types(self):
        """Test that it can be called using an array for type parameter."""
        st.file_uploader("the label", type=["png", "svg", "jpeg"])

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, ["png", "svg", "jpeg"])

    # Don't test this yet! Feature was not released. Remove "x" from name to
    # turn this back on.
    @patch("streamlit.UploadedFileManager.UploadedFileManager.get_files")
    def xtest_multiple_files(self, get_files_patch):
        """Test the accept_multiple_files flag"""
        files = [UploadedFile("file1", b"123"), UploadedFile("file2", b"456")]
        file_vals = [get_encoded_file_data(file.data).getvalue() for file in files]

        get_files_patch.return_value = files

        for accept_multiple in [True, False]:
            return_val = st.file_uploader(
                "label", type="png", accept_multiple_files=accept_multiple
            )
            c = self.get_delta_from_queue().new_element.file_uploader
            self.assertEqual(accept_multiple, c.multiple_files)

            # If "accept_multiple_files" is True, then we should get a list of values
            # back. Otherwise, we should just get a single value.
            if accept_multiple:
                self.assertEqual(file_vals, [val.getvalue() for val in return_val])
            else:
                self.assertEqual(file_vals[0], return_val.getvalue())

    def test_max_upload_size_mb(self):
        """Test that the max upload size is the configuration value."""
        st.file_uploader("the label")

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(
            c.max_upload_size_mb, config.get_option("server.maxUploadSize")
        )
