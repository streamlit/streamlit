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

"""file_uploader unit test."""

from unittest.mock import patch

from parameterized import parameterized

import streamlit as st
from streamlit import config
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.uploaded_file_manager import UploadedFile, UploadedFileRec
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
        st.file_uploader("the label", type=["png", ".svg", "jpeg"])

        c = self.get_delta_from_queue().new_element.file_uploader
        self.assertEqual(c.type, [".png", ".svg", ".jpeg"])

    @patch("streamlit.elements.file_uploader._get_file_recs")
    def test_multiple_files(self, get_file_recs_patch):
        """Test the accept_multiple_files flag"""
        # Patch UploadFileManager to return two files
        file_recs = [
            UploadedFileRec(1, "file1", "type", b"123"),
            UploadedFileRec(2, "file2", "type", b"456"),
        ]

        get_file_recs_patch.return_value = file_recs

        for accept_multiple in [True, False]:
            return_val = st.file_uploader(
                "label",
                type="png",
                accept_multiple_files=accept_multiple,
                key=str(accept_multiple),
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

    @patch("streamlit.elements.file_uploader._get_file_recs")
    def test_unique_uploaded_file_instance(self, get_file_recs_patch):
        """We should get a unique UploadedFile instance each time we access
        the file_uploader widget."""

        # Patch UploadFileManager to return two files
        file_recs = [
            UploadedFileRec(1, "file1", "type", b"123"),
            UploadedFileRec(2, "file2", "type", b"456"),
        ]

        get_file_recs_patch.return_value = file_recs

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

    @patch(
        "streamlit.runtime.uploaded_file_manager.UploadedFileManager.remove_orphaned_files"
    )
    @patch("streamlit.elements.file_uploader._get_file_recs")
    def test_remove_orphaned_files(
        self, get_file_recs_patch, remove_orphaned_files_patch
    ):
        """When file_uploader is accessed, it should call
        UploadedFileManager.remove_orphaned_files.
        """
        ctx = get_script_run_ctx()
        ctx.uploaded_file_mgr._file_id_counter = 101

        file_recs = [
            UploadedFileRec(1, "file1", "type", b"123"),
            UploadedFileRec(2, "file2", "type", b"456"),
        ]
        get_file_recs_patch.return_value = file_recs

        st.file_uploader("foo", accept_multiple_files=True, key="1")

        args, kwargs = remove_orphaned_files_patch.call_args
        self.assertEqual(len(args), 0)
        self.assertEqual(kwargs["session_id"], "test session id")
        self.assertEqual(kwargs["newest_file_id"], 100)
        self.assertEqual(kwargs["active_file_ids"], [1, 2])

        # Patch _get_file_recs to return [] instead. remove_orphaned_files
        # should not be called when file_uploader is accessed.
        get_file_recs_patch.return_value = []
        remove_orphaned_files_patch.reset_mock()

        st.file_uploader("foo", key="2")
        remove_orphaned_files_patch.assert_not_called()

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
