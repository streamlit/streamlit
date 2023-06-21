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

"""chat input and message unit tests."""

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.chat import DISALLOWED_CONTAINERS_ERROR_TEXT
from streamlit.elements.utils import SESSION_STATE_WRITES_NOT_ALLOWED_ERROR_TEXT
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ChatInput_pb2 import ChatInput as ChatInputProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ChatTest(DeltaGeneratorTestCase):
    """Test ability to marshall ChatInput and ChatMessage protos."""

    def test_label_required(self):
        """Test that label is required"""
        with self.assertRaises(TypeError):
            st.chat_message()

    def test_nesting_is_disallowed(self):
        """Test that it is not allowed to be nested."""
        with self.assertRaises(StreamlitAPIException):
            with st.chat_message("user"):
                with st.chat_message("assistant"):
                    st.write("hello")

    def test_user_message(self):
        """Test that the user message is correct."""
        message = st.chat_message("user")

        with message:
            pass

        message_block = self.get_delta_from_queue()

        self.assertEqual(message_block.add_block.chat_message.name, "user")
        self.assertEqual(message_block.add_block.chat_message.avatar, "user")
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            BlockProto.ChatMessage.AvatarType.ICON,
        )

    def test_assistant_message(self):
        """Test that the assistant message is correct."""
        message = st.chat_message("assistant")

        with message:
            pass

        message_block = self.get_delta_from_queue()

        self.assertEqual(message_block.add_block.chat_message.name, "assistant")
        self.assertEqual(message_block.add_block.chat_message.avatar, "assistant")
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            BlockProto.ChatMessage.AvatarType.ICON,
        )

    def test_emoji_avatar(self):
        """Test that it is possible to set an emoji as avatar."""

        message = st.chat_message("user", avatar="👋")

        with message:
            pass

        message_block = self.get_delta_from_queue()

        self.assertEqual(message_block.add_block.chat_message.name, "user")
        self.assertEqual(message_block.add_block.chat_message.avatar, "👋")
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            BlockProto.ChatMessage.AvatarType.EMOJI,
        )

    def test_image_avatar(self):
        """Test that it is possible to set an image as avatar."""

        message = st.chat_message(
            "cat",
            avatar="https://static.streamlit.io/examples/cat.jpg",
        )

        with message:
            pass

        message_block = self.get_delta_from_queue()
        self.assertEqual(message_block.add_block.chat_message.name, "cat")
        self.assertEqual(
            message_block.add_block.chat_message.avatar,
            "https://static.streamlit.io/examples/cat.jpg",
        )
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            BlockProto.ChatMessage.AvatarType.IMAGE,
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
        self.assertEqual(c.position, ChatInputProto.Position.BOTTOM)

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
        self.assertEqual(c.position, ChatInputProto.Position.BOTTOM)

    def test_chat_input_max_chars(self):
        """Test that it sets max chars correctly."""
        st.chat_input("Placeholder", max_chars=100)

        c = self.get_delta_from_queue().new_element.chat_input
        self.assertEqual(c.placeholder, "Placeholder")
        self.assertEqual(c.default, "")
        self.assertEqual(c.value, "")
        self.assertEqual(c.set_value, False)
        self.assertEqual(c.max_chars, 100)
        self.assertEqual(c.disabled, False)
        self.assertEqual(c.position, ChatInputProto.Position.BOTTOM)

    @parameterized.expand(
        [
            lambda: st.columns(2)[0],
            lambda: st.tabs(["Tab1", "Tab2"])[0],
            lambda: st.expander("Expand Me"),
            lambda: st.form("Form Key"),
            lambda: st.sidebar,
        ]
    )
    def test_chat_not_allowed_in_containers(self, container_call):
        """Test that it disallows being called in containers."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            container_call().chat_input("Placeholder")

        self.assertEqual(
            DISALLOWED_CONTAINERS_ERROR_TEXT,
            str(exception_message.value),
        )

    @parameterized.expand(
        [
            lambda: st.columns(2)[0],
            lambda: st.tabs(["Tab1", "Tab2"])[0],
            lambda: st.expander("Expand Me"),
            lambda: st.form("Form Key"),
            lambda: st.sidebar,
        ]
    )
    def test_chat_not_allowed_in_with_containers(self, container_call):
        """Test that it disallows being called in containers (using with syntax)."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            with container_call():
                st.chat_input("Placeholder")

        self.assertEqual(
            DISALLOWED_CONTAINERS_ERROR_TEXT,
            str(exception_message.value),
        )

    def test_session_state_rules(self):
        """Test that it disallows being called in containers (using with syntax)."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            st.session_state.my_key = "Foo"
            st.chat_input("Placeholder", key="my_key")

        self.assertEqual(
            SESSION_STATE_WRITES_NOT_ALLOWED_ERROR_TEXT,
            str(exception_message.value),
        )
