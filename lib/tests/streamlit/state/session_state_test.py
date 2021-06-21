# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Session state unit tests."""

from typing import Any
from unittest.mock import patch
import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.state.session_state import get_session_state
from tests import testutil


@patch("streamlit._is_running_with_streamlit", new=True)
class SessionStateUpdateTest(testutil.DeltaGeneratorTestCase):
    def test_widget_creation_updates_state(self):
        state = st.session_state
        assert "c" not in state

        st.checkbox("checkbox", value=True, key="c")

        assert state.c == True

    def test_setting_before_widget_creation(self):
        state = st.session_state
        state.c = True
        assert state.c == True

        c = st.checkbox("checkbox", key="c")
        assert c == True


@patch("streamlit._is_running_with_streamlit", new=True)
class SessionStateTest(testutil.DeltaGeneratorTestCase):
    def test_widget_presence(self):
        state = st.session_state

        assert "foo" not in state

        state.foo = "foo"

        assert "foo" in state
        assert state.foo == "foo"

    def test_widget_serde_roundtrip(self):
        session_state = get_session_state()

        def check_roundtrip(widget_id: str, value: Any):
            metadata = session_state._new_widget_state.widget_metadata[widget_id]
            serializer = metadata.serializer
            deserializer = metadata.deserializer

            assert deserializer(serializer(value)) == value

        cb = st.checkbox("cb", key="cb")
        check_roundtrip("cb", cb)

        cp = st.color_picker("cp", key="cp")
        check_roundtrip("cp", cp)

        date = st.date_input("date", key="date")
        check_roundtrip("date", date)

        multiselect = st.multiselect(
            "multiselect", options=["a", "b", "c"], key="multiselect"
        )
        check_roundtrip("multiselect", multiselect)

        number = st.number_input("number", key="number")
        check_roundtrip("number", number)

        radio = st.radio("radio", options=["a", "b", "c"], key="radio")
        check_roundtrip("radio", radio)

        selectbox = st.selectbox("selectbox", options=["a", "b", "c"], key="selectbox")
        check_roundtrip("selectbox", selectbox)

        select_slider = st.select_slider(
            "select_slider", options=["a", "b", "c"], key="select_slider"
        )
        check_roundtrip("select_slider", select_slider)

        slider = st.slider("slider", key="slider")
        check_roundtrip("slider", slider)

        text_area = st.text_area("text_area", key="text_area")
        check_roundtrip("text_area", text_area)

        text_input = st.text_input("text_input", key="text_input")
        check_roundtrip("text_input", text_input)

        time = st.time_input("time", key="time")
        check_roundtrip("time", time)
