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

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.NewSession_pb2 import CustomThemeConfig
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class SetThemeTest(DeltaGeneratorTestCase):
    def test_set_theme_primary_color(self):
        st.set_theme(primary_color="#FF4B4B")
        msg = self.get_message_from_queue()
        assert msg.theme_changed.primary_color == "#FF4B4B"

    def test_set_theme_background_color(self):
        st.set_theme(background_color="#FFFFFF")
        msg = self.get_message_from_queue()
        assert msg.theme_changed.background_color == "#FFFFFF"

    def test_set_theme_secondary_background_color(self):
        st.set_theme(secondary_background_color="#F0F2F6")
        msg = self.get_message_from_queue()
        assert msg.theme_changed.secondary_background_color == "#F0F2F6"

    def test_set_theme_text_color(self):
        st.set_theme(text_color="#31333F")
        msg = self.get_message_from_queue()
        assert msg.theme_changed.text_color == "#31333F"

    def test_set_theme_base_light(self):
        st.set_theme(base="light")
        msg = self.get_message_from_queue()
        assert msg.theme_changed.base == CustomThemeConfig.BaseTheme.LIGHT

    def test_set_theme_base_dark(self):
        st.set_theme(base="dark")
        msg = self.get_message_from_queue()
        assert msg.theme_changed.base == CustomThemeConfig.BaseTheme.DARK

    def test_set_theme_base_invalid(self):
        with pytest.raises(StreamlitAPIException):
            st.set_theme(base="invalid")

    def test_set_theme_multiple_params(self):
        st.set_theme(
            base="dark",
            primary_color="#c08a5b",
            background_color="#f5efe6",
            secondary_background_color="#e8dfd4",
            text_color="#3a312b",
        )
        msg = self.get_message_from_queue()
        assert msg.theme_changed.base == CustomThemeConfig.BaseTheme.DARK
        assert msg.theme_changed.primary_color == "#c08a5b"
        assert msg.theme_changed.background_color == "#f5efe6"
        assert msg.theme_changed.secondary_background_color == "#e8dfd4"
        assert msg.theme_changed.text_color == "#3a312b"

    def test_set_theme_no_params(self):
        """Calling set_theme with no params should not enqueue a message."""
        st.set_theme()
        assert len(self.forward_msg_queue._queue) == 0

    def test_set_theme_successive_calls_enqueue_separate_messages(self):
        """Each set_theme call should enqueue its own message with only
        the specified fields."""
        st.set_theme(primary_color="#FF0000")
        st.set_theme(background_color="#00FF00")

        assert len(self.forward_msg_queue._queue) == 2

        msg1 = self.forward_msg_queue._queue[0]
        assert msg1.theme_changed.primary_color == "#FF0000"
        # background_color should be empty (proto default) in the first message
        assert msg1.theme_changed.background_color == ""

        msg2 = self.forward_msg_queue._queue[1]
        assert msg2.theme_changed.background_color == "#00FF00"
        # primary_color should be empty (proto default) in the second message
        assert msg2.theme_changed.primary_color == ""
