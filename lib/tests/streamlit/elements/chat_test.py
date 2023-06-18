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
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.chat import DISALLOWED_CONTAINERS_ERROR_TEXT
from streamlit.elements.utils import SESSION_STATE_WRITES_NOT_ALLOWED_ERROR_TEXT
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ChatInput_pb2 import ChatInput as ChatInputProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ChatTest(DeltaGeneratorTestCase):
    """Test ability to marshall ChatInput and ChatMessage protos."""

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
            lambda: st.container(),
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
            lambda: st.container(),
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
