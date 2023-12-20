# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

"""file_uploader unit test."""

from unittest.mock import patch

from parameterized import parameterized

import streamlit as st
from streamlit import config
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Common_pb2 import FileURLs as FileURLsProto
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.runtime.uploaded_file_manager import (
    DeletedFile,
    UploadedFile,
    UploadedFileRec,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class FileUploaderTest(DeltaGeneratorTestCase):
    def test_just_label(self):
        """Test that it can be called with no other values."""
        st.file_uploader("the label")

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.label, "the label")
        self.assertEqual(
            c.label_visibility.value,
            LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE,
        )
        self.assertEqual(c.disabled, False)

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.file_uploader("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.disabled, True)

    def test_single_type(self):
        """Test that it can be called using a string for type parameter."""
        st.file_uploader("the label", type="png")

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, [".png"])

    def test_multiple_types(self):
        """Test that it can be called using an array for type parameter."""
        st.file_uploader("the label", type=["png", ".svg", "foo"])

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, [".png", ".svg", ".foo"])

    def test_jpg_expansion(self):
        """Test that it adds jpg when passing in just jpeg (and vice versa)."""
        st.file_uploader("the label", type=["png", ".jpg"])

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, [".png", ".jpg", ".jpeg"])

        st.file_uploader("the label", type=["png", ".jpeg"])

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, [".png", ".jpeg", ".jpg"])

    def test_uppercase_expansion(self):
        """Test that it can expand jpg to jpeg even when uppercase."""
        st.file_uploader("the label", type=["png", ".JpG"])

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, [".png", ".jpg", ".jpeg"])

    @patch("streamlit.elements.widgets.file_uploader._get_upload_files")
    def test_multiple_files(self, get_upload_files_patch):
        """Test the accept_multiple_files flag"""
        # Patch UploadFileManager to return two files
        rec1 = UploadedFileRec("file1", "file1", "type", b"123")
        rec2 = UploadedFileRec("file2", "file2", "type", b"456")

        uploaded_files = [
            UploadedFile(
                rec1, FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
            ),
            UploadedFile(
                rec2, FileURLsProto(file_id="file2", delete_url="d1", upload_url="u1")
            ),
        ]

        get_upload_files_patch.return_value = uploaded_files

        for accept_multiple in [True, False]:
            return_val = st.file_uploader(
                "label", type="png", accept_multiple_files=accept_multiple
            )
            c = self.get_delta_from_queue().new_element.file_uploader
            self.assertEqual(accept_multiple, c.multiple_files)

            # If "accept_multiple_files" is True, then we should get a list of
            # values back. Otherwise, we should just get a single value.

            if accept_multiple:
                self.assertEqual(return_val, uploaded_files)

                for actual, expected in zip(return_val, uploaded_files):
                    self.assertEqual(actual.name, expected.name)
                    self.assertEqual(actual.type, expected.type)
                    self.assertEqual(actual.size, expected.size)
                    self.assertEqual(actual.getvalue(), expected.getvalue())
            else:
                first_uploaded_file = uploaded_files[0]
                self.assertEqual(return_val, first_uploaded_file)
                self.assertEqual(return_val.name, first_uploaded_file.name)
                self.assertEqual(return_val.type, first_uploaded_file.type)
                self.assertEqual(return_val.size, first_uploaded_file.size)
                self.assertEqual(return_val.getvalue(), first_uploaded_file.getvalue())

    def test_max_upload_size_mb(self):
        """Test that the max upload size is the configuration value."""
        st.file_uploader("the label")

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(
            c.max_upload_size_mb, config.get_option("server.maxUploadSize")
        )

    @patch("streamlit.elements.widgets.file_uploader._get_upload_files")
    def test_unique_uploaded_file_instance(self, get_upload_files_patch):
        """We should get a unique UploadedFile instance each time we access
        the file_uploader widget."""

        # Patch UploadFileManager to return two files
        rec1 = UploadedFileRec("file1", "file1", "type", b"123")
        rec2 = UploadedFileRec("file2", "file2", "type", b"456")

        uploaded_files = [
            UploadedFile(
                rec1, FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
            ),
            UploadedFile(
                rec2, FileURLsProto(file_id="file2", delete_url="d1", upload_url="u1")
            ),
        ]

        get_upload_files_patch.return_value = uploaded_files

        # These file_uploaders have different labels so that we don't cause
        # a DuplicateKey error - but because we're patching the get_files
        # function, both file_uploaders will refer to the same files.
        file1: UploadedFile = st.file_uploader("a", accept_multiple_files=False)
        file2: UploadedFile = st.file_uploader("b", accept_multiple_files=False)

        self.assertNotEqual(id(file1), id(file2))

        # Seeking in one instance should not impact the position in the other.
        file1.seek(2)
        self.assertEqual(b"3", file1.read())
        self.assertEqual(b"123", file2.read())

    @patch("streamlit.elements.widgets.file_uploader._get_upload_files")
    def test_deleted_files_filtered_out(self, get_upload_files_patch):
        """We should filter out DeletedFile objects for final user value."""

        rec1 = UploadedFileRec("file1", "file1", "type", b"1234")
        rec2 = UploadedFileRec("file2", "file2", "type", b"5678")

        uploaded_files = [
            DeletedFile(file_id="a"),
            UploadedFile(
                rec1, FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
            ),
            DeletedFile(file_id="b"),
            UploadedFile(
                rec2, FileURLsProto(file_id="file2", delete_url="d1", upload_url="u1")
            ),
            DeletedFile(file_id="c"),
        ]

        get_upload_files_patch.return_value = uploaded_files

        result_1: UploadedFile = st.file_uploader("a", accept_multiple_files=False)
        result_2: UploadedFile = st.file_uploader("b", accept_multiple_files=True)

        self.assertEqual(result_1, None)
        self.assertEqual(result_2, [uploaded_files[1], uploaded_files[3]])

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility parameter."""
        st.file_uploader("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.label_visibility.value, proto_value)

    def test_label_visibility_wrong_value(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.file_uploader("the label", label_visibility="wrong_value")
        self.assertEqual(
            str(e.exception),
            "Unsupported label_visibility option 'wrong_value'. Valid values are "
            "'visible', 'hidden' or 'collapsed'.",
        )
