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


class ChatTest(DeltaGeneratorTestCase):
    """Test ability to marshall ChatInput and ChatMessage protos."""

    def test_label_required(self):
        """Test that label is required"""
        with self.assertRaises(TypeError):
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

        self.assertEqual(message_block.add_block.chat_message.name, expected["name"])
        self.assertEqual(
            message_block.add_block.chat_message.avatar, expected["avatar"]
        )
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            BlockProto.ChatMessage.AvatarType.ICON,
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

        self.assertEqual(message_block.add_block.chat_message.name, "test")
        self.assertEqual(
            message_block.add_block.chat_message.avatar, expected["avatar"]
        )
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            expected["type"],
        )

    def test_throws_invalid_avatar_exception(self):
        """Test that chat_message throws an StreamlitAPIException on invalid avatar input."""
        with pytest.raises(StreamlitAPIException):
            st.chat_message("user", avatar="FOOO")

    def test_chat_input(self):
        """Test that it can be called."""
        st.chat_input("Placeholder")

        c = self.get_delta_from_queue().new_element.chat_input
        self.assertEqual(c.placeholder, "Placeholder")
        self.assertEqual(c.default, "")
        self.assertEqual(c.value, "")
        self.assertEqual(c.set_value, False)
        self.assertEqual(c.max_chars, 0)
        self.assertEqual(c.disabled, False)

    def test_chat_input_disabled(self):
        """Test that it sets disabled correctly."""
        st.chat_input("Placeholder", disabled=True)

        c = self.get_delta_from_queue().new_element.chat_input
        self.assertEqual(c.placeholder, "Placeholder")
        self.assertEqual(c.default, "")
        self.assertEqual(c.value, "")
        self.assertEqual(c.set_value, False)
        self.assertEqual(c.max_chars, 0)
        self.assertEqual(c.disabled, True)

    def test_chat_input_max_chars(self):
        """Test that it sets max chars correctly."""
        st.chat_input("Placeholder", max_chars=100)

        c = self.get_delta_from_queue().new_element.chat_input
        self.assertEqual(c.placeholder, "Placeholder")
        self.assertEqual(c.default, "")
        self.assertEqual(c.value, "")
        self.assertEqual(c.set_value, False)
        self.assertEqual(c.max_chars, 100)
        self.assertEqual(c.accept_file, ChatInput.AcceptFile.NONE)
        self.assertEqual(c.disabled, False)
        self.assertEqual(c.file_type, [])

    def test_chat_not_allowed_in_form(self):
        """Test that it disallows being called in a form."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            st.form("Form Key").chat_input()

        self.assertEqual(
            str(exception_message.value),
            "`st.chat_input()` can't be used in a `st.form()`.",
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

        self.assertNotEqual(
            self.get_message_from_queue().metadata.delta_path[0],
            RootContainerProto.BOTTOM,
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

        self.assertEqual(
            self.get_message_from_queue().metadata.delta_path[0],
            RootContainerProto.BOTTOM,
        )

    def test_session_state_rules(self):
        """Test that it disallows being called in containers (using with syntax)."""
        with self.assertRaises(StreamlitValueAssignmentNotAllowedError):
            st.session_state.my_key = "Foo"
            st.chat_input(key="my_key")

    def test_chat_input_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.chat_input("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        self.assertEqual(el.type, "CachedWidgetWarning")
        self.assertTrue(el.is_warning)

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
        self.assertEqual(c.accept_file, expected)

    def test_chat_input_invalid_accept_file(self):
        with self.assertRaises(StreamlitAPIException) as ex:
            st.chat_input(accept_file="invalid")

        self.assertEqual(
            str(ex.exception),
            "The `accept_file` parameter must be a boolean or 'multiple'.",
        )

    def test_file_type(self):
        """Test that it can be called using string(s) for type parameter."""
        st.chat_input(file_type="png")
        c = self.get_delta_from_queue().new_element.chat_input
        self.assertEqual(c.file_type, [".png"])

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

        self.assertEqual(return_val.files, uploaded_files)
        for actual, expected in zip(return_val.files, uploaded_files):
            self.assertEqual(actual.name, expected.name)
            self.assertEqual(actual.type, expected.type)
            self.assertEqual(actual.size, expected.size)
            self.assertEqual(actual.getvalue(), expected.getvalue())

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

        self.assertNotEqual(id(file0), id(file1))

        # Seeking in one instance should not impact the position in the other.
        file0.seek(2)
        self.assertEqual(b"3", file0.read())
        self.assertEqual(b"123", file1.read())

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
        self.assertTrue(is_custom_dict(value))

        value = st.chat_input("Placeholder", accept_file="multiple")
        self.assertTrue(is_custom_dict(value))
