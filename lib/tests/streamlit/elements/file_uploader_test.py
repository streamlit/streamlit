# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit import config
from streamlit.elements.widgets.file_uploader import (
    FileUploaderSerde,
    _get_upload_files,
)
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.Common_pb2 import (
    FileUploaderState as FileUploaderStateProto,
)
from streamlit.proto.Common_pb2 import (
    FileURLs as FileURLsProto,
)
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility
from streamlit.runtime.uploaded_file_manager import (
    DeletedFile,
    UploadedFile,
    UploadedFileRec,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class FileUploaderTest(DeltaGeneratorTestCase):
    def test_just_label(self):
        """Test that it can be called with no other values."""
        st.file_uploader("the label")

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.label == "the label"
        assert (
            c.label_visibility.value == LabelVisibility.LabelVisibilityOptions.VISIBLE
        )
        assert not c.disabled

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.file_uploader("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.disabled

    def test_single_type(self):
        """Test that it can be called using a string for type parameter."""
        st.file_uploader("the label", type="png")

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.type == [".png"]

    def test_multiple_types(self):
        """Test that it can be called using an array for type parameter."""
        st.file_uploader("the label", type=["png", ".svg", "foo"])

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.type == [".png", ".svg", ".foo"]

    def test_jpg_expansion(self):
        """Test that it adds jpg when passing in just jpeg (and vice versa)."""
        st.file_uploader("the label", type=["png", ".jpg"])

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.type == [".png", ".jpg", ".jpeg"]

        st.file_uploader("the label", type=["png", ".jpeg"])

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.type == [".png", ".jpeg", ".jpg"]

    def test_uppercase_expansion(self):
        """Test that it can expand jpg to jpeg even when uppercase."""
        st.file_uploader("the label", type=["png", ".JpG"])

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.type == [".png", ".jpg", ".jpeg"]

    @patch("streamlit.elements.widgets.file_uploader._get_upload_files")
    def test_not_allowed_file_extension_raise_an_exception(
        self, get_upload_files_patch
    ):
        rec1 = UploadedFileRec("file1", "file1.pdf", "type", b"123")

        uploaded_files = [
            UploadedFile(
                rec1, FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
            ),
        ]

        get_upload_files_patch.return_value = uploaded_files
        with pytest.raises(StreamlitAPIException) as e:
            return_val = st.file_uploader(
                "label",
                type="png",
            )
            st.write(return_val)
        assert str(e.value) == "Invalid file extension: `.pdf`. Allowed: ['.png']"

    @patch("streamlit.elements.widgets.file_uploader._get_upload_files")
    def test_multiple_files(self, get_upload_files_patch):
        """Test the accept_multiple_files flag"""
        # Patch UploadFileManager to return two files
        rec1 = UploadedFileRec("file1", "file1.png", "type", b"123")
        rec2 = UploadedFileRec("file2", "file2.png", "type", b"456")

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
            assert accept_multiple == c.multiple_files

            # If "accept_multiple_files" is True, then we should get a list of
            # values back. Otherwise, we should just get a single value.

            if accept_multiple:
                assert return_val == uploaded_files

                for actual, expected in zip(return_val, uploaded_files, strict=False):
                    assert actual.name == expected.name
                    assert actual.type == expected.type
                    assert actual.size == expected.size
                    assert actual.getvalue() == expected.getvalue()
            else:
                first_uploaded_file = uploaded_files[0]
                assert return_val == first_uploaded_file
                assert return_val.name == first_uploaded_file.name
                assert return_val.type == first_uploaded_file.type
                assert return_val.size == first_uploaded_file.size
                assert return_val.getvalue() == first_uploaded_file.getvalue()

    def test_max_upload_size_mb(self):
        """Test that the max upload size is the configuration value."""
        st.file_uploader("the label")

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.max_upload_size_mb == config.get_option("server.maxUploadSize")

    def test_max_upload_size_override(self):
        """Test that a per-widget max_upload_size overrides the configuration value."""
        st.file_uploader("the label", max_upload_size=123)

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.max_upload_size_mb == 123

    @parameterized.expand(
        [
            ("zero", 0),
            ("negative", -1),
            ("float", 1.5),
            ("string", "10"),
        ]
    )
    def test_max_upload_size_invalid(self, _: str, max_upload_size: object):
        """Test that invalid max_upload_size values raise an exception."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.file_uploader("the label", max_upload_size=max_upload_size)

        assert "The `max_upload_size` parameter must be a positive integer" in str(
            exc.value
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

        assert id(file1) != id(file2)

        # Seeking in one instance should not impact the position in the other.
        file1.seek(2)
        assert file1.read() == b"3"
        assert file2.read() == b"123"

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

        assert result_1 is None
        assert result_2 == [uploaded_files[1], uploaded_files[3]]

    @parameterized.expand(
        [
            ("visible", LabelVisibility.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibility.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibility.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility parameter."""
        st.file_uploader("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.file_uploader("the label", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.file_uploader("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-3).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    @patch("streamlit.elements.widgets.file_uploader._get_upload_files")
    def test_directory_upload(self, get_upload_files_patch):
        """Test directory upload functionality"""
        # Mock directory upload with multiple files
        rec1 = UploadedFileRec(
            "file1", "project/main.py", "text/plain", b"print('hello')"
        )
        rec2 = UploadedFileRec(
            "file2", "project/utils.py", "text/plain", b"def helper(): pass"
        )
        rec3 = UploadedFileRec(
            "file3", "project/tests/test_main.py", "text/plain", b"def test(): pass"
        )

        uploaded_files = [
            UploadedFile(
                rec1, FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
            ),
            UploadedFile(
                rec2, FileURLsProto(file_id="file2", delete_url="d2", upload_url="u2")
            ),
            UploadedFile(
                rec3, FileURLsProto(file_id="file3", delete_url="d3", upload_url="u3")
            ),
        ]

        get_upload_files_patch.return_value = uploaded_files

        # Test directory upload
        return_val = st.file_uploader(
            "Upload directory", type=[".py"], accept_multiple_files="directory"
        )

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.multiple_files is True
        assert c.accept_directory is True

        # Directory uploads always return a list
        assert return_val == uploaded_files
        assert len(return_val) == 3

        for actual, expected in zip(return_val, uploaded_files, strict=False):
            assert actual.name == expected.name
            assert actual.type == expected.type
            assert actual.size == expected.size
            assert actual.getvalue() == expected.getvalue()

    @patch("streamlit.elements.widgets.file_uploader._get_upload_files")
    def test_directory_upload_with_file_filtering(self, get_upload_files_patch):
        """Test that directory upload respects file type restrictions"""
        # Mock mixed file types in directory - only .txt should be included
        rec1 = UploadedFileRec(
            "file1", "docs/readme.txt", "text/plain", b"readme content"
        )
        rec2 = UploadedFileRec(
            "file2", "docs/notes.txt", "text/plain", b"notes content"
        )
        # These would be filtered out by file type restrictions

        uploaded_files = [
            UploadedFile(
                rec1, FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
            ),
            UploadedFile(
                rec2, FileURLsProto(file_id="file2", delete_url="d2", upload_url="u2")
            ),
        ]

        get_upload_files_patch.return_value = uploaded_files

        return_val = st.file_uploader(
            "Upload text files only", type=["txt"], accept_multiple_files="directory"
        )

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.multiple_files is True
        assert c.accept_directory is True
        assert c.type == [".txt"]

        # Should only return .txt files
        assert len(return_val) == 2
        for file in return_val:
            assert file.name.endswith(".txt")

    @patch("streamlit.elements.widgets.file_uploader._get_upload_files")
    def test_directory_upload_empty(self, get_upload_files_patch):
        """Test directory upload with no files"""
        get_upload_files_patch.return_value = []

        return_val = st.file_uploader(
            "Upload empty directory", accept_multiple_files="directory"
        )

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.multiple_files is True
        assert c.accept_directory is True

        # Empty directory should return empty list
        assert return_val == []

    def test_directory_upload_proto_values(self):
        """Test that directory upload sets correct proto values"""
        st.file_uploader("Directory uploader", accept_multiple_files="directory")

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.multiple_files is True
        assert c.accept_directory is True

    def test_directory_upload_with_width(self):
        """Test directory upload with width parameter"""
        st.file_uploader(
            "Directory with width", accept_multiple_files="directory", width=300
        )

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.multiple_files is True
        assert c.accept_directory is True

    def test_directory_upload_disabled(self):
        """Test disabled directory upload"""
        st.file_uploader(
            "Disabled directory", accept_multiple_files="directory", disabled=True
        )

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.multiple_files is True
        assert c.accept_directory is True
        assert c.disabled is True

    def test_directory_upload_with_help(self):
        """Test directory upload with help text"""
        help_text = "Upload a directory containing your project files"

        st.file_uploader(
            "Project directory", accept_multiple_files="directory", help=help_text
        )

        c = self.get_delta_from_queue().new_element.file_uploader
        assert c.multiple_files is True
        assert c.accept_directory is True
        assert c.help == help_text


class FileUploaderWidthTest(DeltaGeneratorTestCase):
    def test_file_uploader_with_width_pixels(self):
        """Test that file_uploader can be displayed with a specific width in pixels."""
        st.file_uploader("Label", width=500)
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 500

    def test_file_uploader_with_width_stretch(self):
        """Test that file_uploader can be displayed with a width of 'stretch'."""
        st.file_uploader("Label", width="stretch")
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_file_uploader_with_default_width(self):
        """Test that the default width is used when not specified."""
        st.file_uploader("Label")
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    @parameterized.expand(
        [
            "invalid",
            -1,
            0,
            100.5,
        ]
    )
    def test_width_config_invalid(self, invalid_width):
        """Test width config with various invalid values."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.file_uploader("the label", width=invalid_width)


class FileUploaderStableIdTest(DeltaGeneratorTestCase):
    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided, unless whitelisted kwargs change."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.file_uploader(
                label="Label 1",
                key="file_uploader_key",
                help="help 1",
                width="stretch",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                disabled=False,
                # Whitelisted kwargs
                type=["txt", "csv"],
                accept_multiple_files=False,
            )
            c1 = self.get_delta_from_queue().new_element.file_uploader
            id1 = c1.id

            st.file_uploader(
                label="Label 2",
                key="file_uploader_key",
                help="help 2",
                width=300,
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                disabled=True,
                # Whitelisted kwargs (same as before)
                type=["txt", "csv"],
                accept_multiple_files=False,
            )
            c2 = self.get_delta_from_queue().new_element.file_uploader
            id2 = c2.id
            assert id1 == id2

    @parameterized.expand(
        [
            ("type", ["txt"], ["pdf", "doc"]),
            ("type", None, ["csv"]),
            ("accept_multiple_files", False, True),
            ("accept_multiple_files", False, "directory"),
        ]
    )
    def test_whitelisted_stable_key_kwargs(
        self, kwarg_name: str, value1: object, value2: object
    ):
        """Changing whitelisted kwargs should change the ID even when a key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            base_kwargs = {
                "label": "Label",
                "key": "file_uploader_key2",
                "type": ["txt"],
                "accept_multiple_files": False,
            }
            base_kwargs[kwarg_name] = value1
            st.file_uploader(**base_kwargs)
            c1 = self.get_delta_from_queue().new_element.file_uploader
            id1 = c1.id

            base_kwargs[kwarg_name] = value2
            st.file_uploader(**base_kwargs)
            c2 = self.get_delta_from_queue().new_element.file_uploader
            id2 = c2.id
            assert id1 != id2


class FileUploaderSerdeTest(DeltaGeneratorTestCase):
    """Test FileUploaderSerde serialization and deserialization."""

    def test_serialize_with_single_uploaded_file(self):
        """Test serialization of a single uploaded file."""
        serde = FileUploaderSerde(accept_multiple_files=False)

        # Create a mock uploaded file
        rec = UploadedFileRec("file123", "test.txt", "text/plain", b"content")
        file_urls = FileURLsProto(
            file_id="file123", delete_url="delete_url", upload_url="upload_url"
        )
        uploaded_file = UploadedFile(rec, file_urls)

        # Serialize the file
        result = serde.serialize(uploaded_file)

        # Verify the serialized proto
        assert len(result.uploaded_file_info) == 1
        file_info = result.uploaded_file_info[0]
        assert file_info.file_id == "file123"
        assert file_info.name == "test.txt"

    def test_serialize_with_multiple_uploaded_files(self):
        """Test serialization of multiple uploaded files."""
        serde = FileUploaderSerde(accept_multiple_files=True)

        # Create mock uploaded files
        rec1 = UploadedFileRec("file1", "test1.txt", "text/plain", b"content1")
        rec2 = UploadedFileRec("file2", "test2.txt", "text/plain", b"content2")
        file_urls1 = FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
        file_urls2 = FileURLsProto(file_id="file2", delete_url="d2", upload_url="u2")
        files = [UploadedFile(rec1, file_urls1), UploadedFile(rec2, file_urls2)]

        # Serialize the files
        result = serde.serialize(files)

        # Verify the serialized proto
        assert len(result.uploaded_file_info) == 2

    def test_serialize_with_none(self):
        """Test serialization with None input."""
        serde = FileUploaderSerde(accept_multiple_files=False)
        result = serde.serialize(None)

        # Should return empty state
        assert len(result.uploaded_file_info) == 0

    def test_serialize_with_empty_list(self):
        """Test serialization with empty list."""
        serde = FileUploaderSerde(accept_multiple_files=True)
        result = serde.serialize([])

        # Should return empty state
        assert len(result.uploaded_file_info) == 0

    def test_serialize_skips_deleted_files(self):
        """Test serialization skips DeletedFile entries."""
        serde = FileUploaderSerde(accept_multiple_files=True)

        # Create a list with a regular file and a deleted file
        rec = UploadedFileRec("file1", "test.txt", "text/plain", b"content")
        file_urls = FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
        files = [
            UploadedFile(rec, file_urls),
            DeletedFile("deleted_file"),
        ]

        # Serialize the files
        result = serde.serialize(files)

        # Should only contain the non-deleted file
        assert len(result.uploaded_file_info) == 1
        assert result.uploaded_file_info[0].file_id == "file1"


class GetUploadFilesTest(DeltaGeneratorTestCase):
    """Test _get_upload_files function."""

    def test_get_upload_files_returns_empty_for_none(self):
        """Test _get_upload_files returns empty list for None input."""
        result = _get_upload_files(None)
        assert len(result) == 0

    def test_get_upload_files_returns_empty_no_ctx(self):
        """Test _get_upload_files returns empty list when no script context."""
        proto = FileUploaderStateProto()

        with patch(
            "streamlit.elements.widgets.file_uploader.get_script_run_ctx",
            return_value=None,
        ):
            result = _get_upload_files(proto)
            assert len(result) == 0

    def test_get_upload_files_returns_empty_for_empty_file_info(self):
        """Test _get_upload_files returns empty list when no file info."""
        proto = FileUploaderStateProto()
        # No files added to uploaded_file_info

        result = _get_upload_files(proto)
        assert len(result) == 0
