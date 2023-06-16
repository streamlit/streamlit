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

"""checkbox unit tests."""

from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Block_pb2 import Block as BlockProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ChatMessageTest(DeltaGeneratorTestCase):
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

        self.assertEqual(message_block.add_block.chat_message.label, "user")
        self.assertEqual(message_block.add_block.chat_message.avatar, "user")
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            BlockProto.ChatMessage.AvatarType.ICON,
        )
        self.assertEqual(message_block.add_block.chat_message.background, "grey")

    def test_assistant_message(self):
        """Test that the assistant message is correct."""
        message = st.chat_message("assistant")

        with message:
            pass

        message_block = self.get_delta_from_queue()

        self.assertEqual(message_block.add_block.chat_message.label, "assistant")
        self.assertEqual(message_block.add_block.chat_message.avatar, "assistant")
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            BlockProto.ChatMessage.AvatarType.ICON,
        )
        self.assertEqual(message_block.add_block.chat_message.background, "")

    def test_emoji_avatar(self):
        """Test that it is possible to set an emoji as avatar."""

        message = st.chat_message("user", avatar="👋")

        with message:
            pass

        message_block = self.get_delta_from_queue()

        self.assertEqual(message_block.add_block.chat_message.label, "user")
        self.assertEqual(message_block.add_block.chat_message.avatar, "👋")
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            BlockProto.ChatMessage.AvatarType.EMOJI,
        )
        self.assertEqual(message_block.add_block.chat_message.background, "grey")

    def test_image_avatar(self):
        """Test that it is possible to set an image as avatar."""

        message = st.chat_message(
            "cat",
            avatar="https://static.streamlit.io/examples/cat.jpg",
        )

        with message:
            pass

        message_block = self.get_delta_from_queue()
        self.assertEqual(message_block.add_block.chat_message.label, "cat")
        self.assertEqual(
            message_block.add_block.chat_message.avatar,
            "https://static.streamlit.io/examples/cat.jpg",
        )
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            BlockProto.ChatMessage.AvatarType.IMAGE,
        )
        self.assertEqual(message_block.add_block.chat_message.background, "")

    def test_setting_background(self):
        """Test that it is possible to set the background color."""

        message = st.chat_message("cat", background=True)

        with message:
            pass

        message_block = self.get_delta_from_queue()
        self.assertEqual(message_block.add_block.chat_message.label, "cat")
        self.assertEqual(message_block.add_block.chat_message.avatar, "")
        self.assertEqual(
            message_block.add_block.chat_message.avatar_type,
            BlockProto.ChatMessage.AvatarType.ICON,
        )
        self.assertEqual(message_block.add_block.chat_message.background, "grey")
