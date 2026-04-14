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

"""camera_input unit test."""

from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.widgets.camera_input import CameraInputSerde
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.Common_pb2 import FileURLs as FileURLsProto
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility
from streamlit.runtime.uploaded_file_manager import (
    DeletedFile,
    UploadedFile,
    UploadedFileRec,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class CameraInputTest(DeltaGeneratorTestCase):
    def test_just_label(self):
        """Test that it can be called with no other values."""
        st.camera_input("the label")

        c = self.get_delta_from_queue().new_element.camera_input
        assert c.label == "the label"
        assert (
            c.label_visibility.value == LabelVisibility.LabelVisibilityOptions.VISIBLE
        )

    def test_help_tooltip(self):
        """Test that it can be called with help parameter."""
        st.camera_input("the label", help="help_label")

        c = self.get_delta_from_queue().new_element.camera_input
        assert c.help == "help_label"

    @parameterized.expand(
        [
            ("visible", LabelVisibility.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibility.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibility.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility parameter."""
        st.camera_input("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.camera_input
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.camera_input("the label", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.camera_input("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-3).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    @patch("streamlit.elements.widgets.camera_input._get_upload_files")
    def test_not_allowed_file_extension_raise_an_exception_for_camera_input(
        self, get_upload_files_patch
    ):
        rec1 = UploadedFileRec("file1", "file1.png", "type", b"123")

        uploaded_files = [
            UploadedFile(
                rec1, FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
            ),
        ]

        get_upload_files_patch.return_value = uploaded_files
        with pytest.raises(StreamlitAPIException) as e:
            return_val = st.camera_input("label")
            st.write(return_val)
        assert str(e.value) == "Invalid file extension: `.png`. Allowed: ['.jpg']"


class CameraInputWidthTest(DeltaGeneratorTestCase):
    def test_camera_input_with_width_pixels(self):
        """Test that camera_input can be displayed with a specific width in pixels."""
        st.camera_input("Label", width=500)
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 500

    def test_camera_input_with_width_stretch(self):
        """Test that camera_input can be displayed with a width of 'stretch'."""
        st.camera_input("Label", width="stretch")
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_camera_input_with_default_width(self):
        """Test that the default width is used when not specified."""
        st.camera_input("Label")
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
            st.camera_input("the label", width=invalid_width)

    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            st.camera_input(
                label="Label 1",
                key="camera_input_key",
                help="Help 1",
                disabled=False,
                width="stretch",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
            )
            c1 = self.get_delta_from_queue().new_element.camera_input
            id1 = c1.id

            # Second render with different params but same key
            st.camera_input(
                label="Label 2",
                key="camera_input_key",
                help="Help 2",
                disabled=True,
                width=200,
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
            )
            c2 = self.get_delta_from_queue().new_element.camera_input
            id2 = c2.id
            assert id1 == id2


class CameraInputSerdeTest(DeltaGeneratorTestCase):
    """Test CameraInputSerde serialization and deserialization."""

    def test_serialize_with_uploaded_file(self):
        """Test serialization of a captured camera image."""
        serde = CameraInputSerde()

        # Create a mock uploaded file
        rec = UploadedFileRec("file123", "snapshot.jpg", "image/jpeg", b"image_data")
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
        assert file_info.name == "snapshot.jpg"
        assert file_info.size == len(b"image_data")

    def test_serialize_with_none(self):
        """Test serialization when no image is captured."""
        serde = CameraInputSerde()
        result = serde.serialize(None)

        # Should return empty state
        assert len(result.uploaded_file_info) == 0

    def test_serialize_with_deleted_file(self):
        """Test serialization with a deleted file."""
        serde = CameraInputSerde()
        deleted = DeletedFile("file123")
        result = serde.serialize(deleted)

        # Should return empty state for deleted file
        assert len(result.uploaded_file_info) == 0
