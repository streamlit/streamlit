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

import streamlit as st
from streamlit import config
from streamlit.uploaded_file_manager import UploadedFileRec, UploadedFile
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
        self.assertEqual(c.type, [".png"])

    def test_multiple_types(self):
        """Test that it can be called using an array for type parameter."""
        st.file_uploader("the label", type=["png", ".svg", "jpeg"])

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, [".png", ".svg", ".jpeg"])

    @patch("streamlit.uploaded_file_manager.UploadedFileManager.get_files")
    def test_multiple_files(self, get_files_patch):
        """Test the accept_multiple_files flag"""
        file_recs = [
            UploadedFileRec("id1", "file1", "type", b"123"),
            UploadedFileRec("id2", "file2", "type", b"456"),
        ]

        get_files_patch.return_value = file_recs

        for accept_multiple in [True, False]:
            return_val = st.file_uploader(
                "label", type="png", accept_multiple_files=accept_multiple
            )
            c = self.get_delta_from_queue().new_element.file_uploader
            self.assertEqual(accept_multiple, c.multiple_files)

            # If "accept_multiple_files" is True, then we should get a list of
            # values back. Otherwise, we should just get a single value.

            # Because file_uploader returns unique UploadedFile instances
            # each time it's called, we convert the return value back
            # from UploadedFile -> UploadedFileRec (which implements
            # equals()) to test equality.

            if accept_multiple:
                results = [
                    UploadedFileRec(file.id, file.name, file.type, file.getvalue())
                    for file in return_val
                ]
                self.assertEqual(file_recs, results)
            else:
                results = UploadedFileRec(
                    return_val.id,
                    return_val.name,
                    return_val.type,
                    return_val.getvalue(),
                )
                self.assertEqual(file_recs[0], results)

    def test_max_upload_size_mb(self):
        """Test that the max upload size is the configuration value."""
        st.file_uploader("the label")

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(
            c.max_upload_size_mb, config.get_option("server.maxUploadSize")
        )

    @patch("streamlit.uploaded_file_manager.UploadedFileManager.get_files")
    def test_unique_uploaded_file_instance(self, get_files_patch):
        """We should get a unique UploadedFile instance each time we access
        the file_uploader widget."""
        file_recs = [
            UploadedFileRec("id1", "file1", "type", b"123"),
            UploadedFileRec("id2", "file2", "type", b"456"),
        ]

        get_files_patch.return_value = file_recs

        # These file_uploaders have different labels so that we don't cause
        # a DuplicateKey  error - but because we're patching the get_files
        # function, both file_uploaders will refer to the same files.
        file1: UploadedFile = st.file_uploader("a", accept_multiple_files=False)
        file2: UploadedFile = st.file_uploader("b", accept_multiple_files=False)

        self.assertNotEqual(file1, file2)

        # Seeking in one instance should not impact the position in the other.
        file1.seek(2)
        self.assertEqual(b"3", file1.read())
        self.assertEqual(b"123", file2.read())
