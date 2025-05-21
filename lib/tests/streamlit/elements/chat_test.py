# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""chat input and message unit tests."""

from unittest.mock import patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.widgets.chat import ChatInputValue
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidWidthError,
    StreamlitValueAssignmentNotAllowedError,
)
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ChatInput_pb2 import ChatInput
from streamlit.proto.Common_pb2 import FileURLs as FileURLsProto
from streamlit.proto.RootContainer_pb2 import RootContainer as RootContainerProto
from streamlit.runtime.uploaded_file_manager import (
    UploadedFile,
    UploadedFileRec,
)
from streamlit.type_util import is_custom_dict
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class ChatTest(DeltaGeneratorTestCase):
    """Test ability to marshall ChatInput and ChatMessage protos."""

    def test_label_required(self):
        """Test that label is required"""
        with pytest.raises(TypeError):
            st.chat_message()

    def test_nesting_is_allowed(self):
        """Test that it is allowed to be nested."""
        with st.chat_message("user"), st.chat_message("assistant"):
            st.write("hello")

    @parameterized.expand(
        [
            ("user", {"name": "user", "avatar": "user"}),
            ("assistant", {"name": "assistant", "avatar": "assistant"}),
            ("ai", {"name": "ai", "avatar": "assistant"}),
            ("human", {"name": "human", "avatar": "user"}),
        ]
    )
    def test_message_name(self, message_name, expected):
        """Test that message's name param maps to the correct value and avatar."""
        message = st.chat_message(message_name)

        with message:
            pass

        message_block = self.get_delta_from_queue()

        assert message_block.add_block.chat_message.name == expected["name"]
        assert message_block.add_block.chat_message.avatar == expected["avatar"]
        assert (
            message_block.add_block.chat_message.avatar_type
            == BlockProto.ChatMessage.AvatarType.ICON
        )

    @parameterized.expand(
        [
            ("👋", {"avatar": "👋", "type": BlockProto.ChatMessage.AvatarType.EMOJI}),
            (
                "http://not.a.real.url",
                {
                    "avatar": "http://not.a.real.url",
                    "type": BlockProto.ChatMessage.AvatarType.IMAGE,
                },
            ),
        ]
    )
    def test_non_str_avatar_type(self, avatar, expected):
        """Test that it is possible to set an emoji and an image as avatar."""
        message = st.chat_message("test", avatar=avatar)

        with message:
            pass

        message_block = self.get_delta_from_queue()

        assert message_block.add_block.chat_message.name == "test"
        assert message_block.add_block.chat_message.avatar == expected["avatar"]
        assert message_block.add_block.chat_message.avatar_type == expected["type"]

    def test_throws_invalid_avatar_exception(self):
        """Test that chat_message throws an StreamlitAPIException on invalid avatar input."""
        with pytest.raises(StreamlitAPIException):
            st.chat_message("user", avatar="FOOO")

    def test_chat_input(self):
        """Test that it can be called."""
        st.chat_input("Placeholder")

        c = self.get_delta_from_queue().new_element.chat_input
        assert c.placeholder == "Placeholder"
        assert c.default == ""
        assert c.value == ""
        assert not c.set_value
        assert c.max_chars == 0
        assert not c.disabled

    def test_chat_input_disabled(self):
        """Test that it sets disabled correctly."""
        st.chat_input("Placeholder", disabled=True)

        c = self.get_delta_from_queue().new_element.chat_input
        assert c.placeholder == "Placeholder"
        assert c.default == ""
        assert c.value == ""
        assert not c.set_value
        assert c.max_chars == 0
        assert c.disabled

    def test_chat_input_max_chars(self):
        """Test that it sets max chars correctly."""
        st.chat_input("Placeholder", max_chars=100)

        c = self.get_delta_from_queue().new_element.chat_input
        assert c.placeholder == "Placeholder"
        assert c.default == ""
        assert c.value == ""
        assert not c.set_value
        assert c.max_chars == 100
        assert c.accept_file == ChatInput.AcceptFile.NONE
        assert not c.disabled
        assert c.file_type == []

    def test_chat_not_allowed_in_form(self):
        """Test that it disallows being called in a form."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            st.form("Form Key").chat_input()

        assert (
            str(exception_message.value)
            == "`st.chat_input()` can't be used in a `st.form()`."
        )

    @parameterized.expand(
        [
            lambda: st.columns(2)[0],
            lambda: st.tabs(["Tab1", "Tab2"])[0],
            lambda: st.expander("Expand Me"),
            lambda: st.chat_message("user"),
            lambda: st.sidebar,
            lambda: st.container(),
        ]
    )
    def test_chat_selects_inline_postion(self, container_call):
        """Test that it selects inline position when nested in any of layout containers."""
        container_call().chat_input()

        assert (
            self.get_message_from_queue().metadata.delta_path[0]
            != RootContainerProto.BOTTOM
        )

    @parameterized.expand(
        [
            lambda: st,
            lambda: st._main,
        ]
    )
    def test_chat_selects_bottom_position(self, container_call):
        """Test that it selects bottom position when called in the main dg."""
        container_call().chat_input()

        assert (
            self.get_message_from_queue().metadata.delta_path[0]
            == RootContainerProto.BOTTOM
        )

    def test_session_state_rules(self):
        """Test that it disallows being called in containers (using with syntax)."""
        with pytest.raises(StreamlitValueAssignmentNotAllowedError):
            st.session_state.my_key = "Foo"
            st.chat_input(key="my_key")

    def test_chat_input_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.chat_input("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    @parameterized.expand(
        [
            (False, ChatInput.AcceptFile.NONE),
            (True, ChatInput.AcceptFile.SINGLE),
            ("multiple", ChatInput.AcceptFile.MULTIPLE),
        ]
    )
    def test_chat_input_accept_file(self, accept_file, expected):
        st.chat_input(accept_file=accept_file)
        c = self.get_delta_from_queue().new_element.chat_input
        assert c.accept_file == expected

    def test_chat_input_invalid_accept_file(self):
        with pytest.raises(StreamlitAPIException) as ex:
            st.chat_input(accept_file="invalid")

        assert (
            str(ex.value)
            == "The `accept_file` parameter must be a boolean or 'multiple'."
        )

    def test_file_type(self):
        """Test that it can be called using string(s) for type parameter."""
        st.chat_input(file_type="png")
        c = self.get_delta_from_queue().new_element.chat_input
        assert c.file_type == [".png"]

    @patch("streamlit.elements.widgets.chat.ChatInputSerde.deserialize")
    def test_multiple_files(self, deserialize_patch):
        rec0 = UploadedFileRec("file0", "name0", "type", b"123")
        rec1 = UploadedFileRec("file1", "name1", "type", b"456")

        uploaded_files = [
            UploadedFile(
                rec0, FileURLsProto(file_id="file0", delete_url="d0", upload_url="u0")
            ),
            UploadedFile(
                rec1, FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
            ),
        ]

        deserialize_patch.return_value = ChatInputValue(
            text="placeholder", files=uploaded_files
        )

        return_val = st.chat_input(accept_file="multiple")

        assert return_val.files == uploaded_files
        for actual, expected in zip(return_val.files, uploaded_files):
            assert actual.name == expected.name
            assert actual.type == expected.type
            assert actual.size == expected.size
            assert actual.getvalue() == expected.getvalue()

    @patch("streamlit.elements.widgets.chat.ChatInputSerde.deserialize")
    def test_unique_uploaded_file_instance(self, deserialize_patch):
        """We should get a unique UploadedFile instance each time we access
        the chat_input widget."""

        # Patch UploadFileManager to return two files
        rec0 = UploadedFileRec("file0", "name0", "type", b"123")
        rec1 = UploadedFileRec("file1", "name1", "type", b"456")

        uploaded_files = [
            UploadedFile(
                rec0, FileURLsProto(file_id="file0", delete_url="d0", upload_url="u0")
            ),
            UploadedFile(
                rec1, FileURLsProto(file_id="file1", delete_url="d1", upload_url="u1")
            ),
        ]

        deserialize_patch.return_value = ChatInputValue(
            text="placeholder", files=uploaded_files
        )

        # These file_uploaders have different labels so that we don't cause
        # a DuplicateKey error - but because we're patching the get_files
        # function, both file_uploaders will refer to the same files.
        file0 = st.chat_input(key="key0", accept_file=True).files[0]
        file1 = st.chat_input(key="key1", accept_file=True).files[0]

        assert id(file0) != id(file1)

        # Seeking in one instance should not impact the position in the other.
        file0.seek(2)
        assert file0.read() == b"3"
        assert file1.read() == b"123"

    @patch("streamlit.elements.widgets.chat.ChatInputSerde.deserialize")
    def test_chat_input_value_is_custom_dict(self, deserialize_patch):
        """Test that ChatInputValue is a custom dict."""
        files = [
            UploadedFile(
                UploadedFileRec("file0", "name0", "type", b"123"),
                FileURLsProto(file_id="file0", delete_url="d0", upload_url="u0"),
            ),
        ]
        deserialize_patch.return_value = ChatInputValue(text="placeholder", files=files)

        value = st.chat_input("Placeholder", accept_file=True)
        assert is_custom_dict(value)

        value = st.chat_input("Placeholder", accept_file="multiple")
        assert is_custom_dict(value)

    def test_chat_message_width_config_default(self):
        """Test that default width is 'stretch' for chat_message."""
        with st.chat_message("user"):
            pass

        message_block = self.get_delta_from_queue()
        assert (
            message_block.add_block.chat_message.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert message_block.add_block.chat_message.width_config.use_stretch

    def test_chat_message_width_config_pixel(self):
        """Test that pixel width works properly for chat_message."""
        with st.chat_message("user", width=300):
            pass

        message_block = self.get_delta_from_queue()
        assert (
            message_block.add_block.chat_message.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert message_block.add_block.chat_message.width_config.pixel_width == 300

    def test_chat_message_width_config_content(self):
        """Test that 'content' width works properly for chat_message."""
        with st.chat_message("user", width="content"):
            pass

        message_block = self.get_delta_from_queue()
        assert (
            message_block.add_block.chat_message.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert message_block.add_block.chat_message.width_config.use_content

    def test_chat_message_width_config_stretch(self):
        """Test that 'stretch' width works properly for chat_message."""
        with st.chat_message("user", width="stretch"):
            pass

        message_block = self.get_delta_from_queue()
        assert (
            message_block.add_block.chat_message.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert message_block.add_block.chat_message.width_config.use_stretch

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_chat_message_invalid_width(self, width):
        """Test that invalid width values raise exceptions for chat_message."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.chat_message("user", width=width)

    def test_chat_input_width_config_default(self):
        """Test that default width is 'stretch' for chat_input."""
        st.chat_input("Placeholder")

        c = self.get_delta_from_queue().new_element.chat_input
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_chat_input_width_config_pixel(self):
        """Test that pixel width works properly for chat_input."""
        st.chat_input("Placeholder", width=300)

        c = self.get_delta_from_queue().new_element.chat_input
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 300

    def test_chat_input_width_config_stretch(self):
        """Test that 'stretch' width works properly for chat_input."""
        st.chat_input("Placeholder", width="stretch")

        c = self.get_delta_from_queue().new_element.chat_input
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    @parameterized.expand(
        [
            "invalid",
            "content",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_chat_input_invalid_width(self, width):
        """Test that invalid width values raise exceptions for chat_input."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.chat_input("Placeholder", width=width)
