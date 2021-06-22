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
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, date, time

import pytest
import tornado.testing

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.state.session_state import (
    GENERATED_WIDGET_KEY_PREFIX,
    get_session_state,
    LazySessionState,
    SessionState,
    Serialized,
    Value,
    WidgetMetadata,
    WStates,
)
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from tests import testutil


identity = lambda x: x


class WStateTests(unittest.TestCase):
    def setUp(self):
        wstates = WStates()
        self.wstates = wstates

        widget_state = WidgetStateProto()
        widget_state.id = "widget_id_1"
        widget_state.int_value = 5
        wstates.set_from_proto(widget_state)
        wstates.set_widget_metadata(
            WidgetMetadata(
                id="widget_id_1",
                deserializer=lambda x: str(x),
                serializer=lambda x: int(x),
                value_type="int_value",
            )
        )

        wstates.set_from_value("widget_id_2", 5)
        wstates.set_widget_metadata(
            WidgetMetadata(
                id="widget_id_2",
                deserializer=identity,
                serializer=identity,
                value_type="int_value",
            )
        )

    def test_getitem_nonexistent(self):
        with pytest.raises(KeyError):
            self.wstates["nonexistent_widget_id"]

    def test_getitem_no_metadata(self):
        del self.wstates.widget_metadata["widget_id_1"]
        with pytest.raises(KeyError):
            self.wstates["widget_id_1"]

    def test_getitem_serialized(self):
        assert isinstance(self.wstates.states["widget_id_1"], Serialized)
        assert self.wstates["widget_id_1"] == "5"
        assert self.wstates.states["widget_id_1"] == Value("5")

    def test_getitem_value(self):
        assert self.wstates["widget_id_2"] == 5

    def test_len(self):
        assert len(self.wstates) == 2

    def test_iter(self):
        wstate_iter = iter(self.wstates)
        assert next(wstate_iter) == "widget_id_1"
        assert next(wstate_iter) == "widget_id_2"
        with pytest.raises(StopIteration):
            next(wstate_iter)

    def test_keys(self):
        assert self.wstates.keys() == {"widget_id_1", "widget_id_2"}

    def test_items(self):
        assert self.wstates.items() == {("widget_id_1", "5"), ("widget_id_2", 5)}

    def test_values(self):
        assert self.wstates.values() == {"5", 5}

    def test_cull_nonexistent(self):
        self.wstates.cull_nonexistent({"widget_id_1"})
        assert "widget_id_1" in self.wstates
        assert "widget_id_2" not in self.wstates

    def test_get_serialized_nonexistent_id(self):
        assert self.wstates.get_serialized("nonexistent_id") is None

    def test_get_serialized_no_metadata(self):
        del self.wstates.widget_metadata["widget_id_2"]
        assert self.wstates.get_serialized("widget_id_2") is None

    def test_get_serialized_already_serialized(self):
        serialized = self.wstates.get_serialized("widget_id_2")
        assert serialized.id == "widget_id_2"
        assert serialized.int_value == 5

    def test_get_serialized(self):
        serialized = self.wstates.get_serialized("widget_id_1")
        assert serialized.id == "widget_id_1"
        assert serialized.int_value == 5

    def test_get_serialized_array_value(self):
        widget_state = WidgetStateProto()
        widget_state.id = "widget_id_1"
        widget_state.int_array_value.data.extend([1, 2, 3, 4])
        self.wstates.set_from_proto(widget_state)
        self.wstates.set_widget_metadata(
            WidgetMetadata(
                id="widget_id_1",
                deserializer=identity,
                serializer=identity,
                value_type="int_array_value",
            )
        )

        serialized = self.wstates.get_serialized("widget_id_1")
        assert serialized.id == "widget_id_1"
        assert list(serialized.int_array_value.data) == [1, 2, 3, 4]

    def test_as_widget_states(self):
        widget_states = self.wstates.as_widget_states()
        assert len(widget_states) == 2
        assert widget_states[0].id == "widget_id_1"
        assert widget_states[0].int_value == 5
        assert widget_states[1].id == "widget_id_2"
        assert widget_states[1].int_value == 5

    def test_call_callback(self):
        metadata = WidgetMetadata(
            id="widget_id_1",
            deserializer=lambda x: str(x),
            serializer=lambda x: int(x),
            value_type="int_value",
            callback=MagicMock(),
            callback_args=(1,),
            callback_kwargs={"y": 2},
        )
        self.wstates.widget_metadata["widget_id_1"] = metadata
        self.wstates.call_callback("widget_id_1")

        metadata.callback.assert_called_once_with(1, y=2)


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
        def check_roundtrip(widget_id: str, value: Any):
            session_state = get_session_state()
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

        date_interval = st.date_input(
            "date_interval",
            value=[datetime.now().date(), datetime.now().date() + timedelta(days=1)],
            key="date_interval",
        )
        check_roundtrip("date_interval", date_interval)

        multiselect = st.multiselect(
            "multiselect", options=["a", "b", "c"], key="multiselect"
        )
        check_roundtrip("multiselect", multiselect)

        multiselect_multiple = st.multiselect(
            "multiselect_multiple",
            options=["a", "b", "c"],
            default=["b", "c"],
            key="multiselect_multiple",
        )
        check_roundtrip("multiselect_multiple", multiselect_multiple)

        number = st.number_input("number", key="number")
        check_roundtrip("number", number)

        number_int = st.number_input("number_int", value=16777217, key="number_int")
        check_roundtrip("number_int", number_int)

        radio = st.radio("radio", options=["a", "b", "c"], key="radio")
        check_roundtrip("radio", radio)

        radio_nondefault = st.radio(
            "radio_nondefault",
            options=["a", "b", "c"],
            index=1,
            key="radio_nondefault",
        )
        check_roundtrip("radio_nondefault", radio_nondefault)

        selectbox = st.selectbox("selectbox", options=["a", "b", "c"], key="selectbox")
        check_roundtrip("selectbox", selectbox)

        select_slider = st.select_slider(
            "select_slider", options=["a", "b", "c"], key="select_slider"
        )
        check_roundtrip("select_slider", select_slider)

        slider = st.slider("slider", key="slider")
        check_roundtrip("slider", slider)

        slider_float = st.slider("slider_float", value=0.5, key="slider_float")
        check_roundtrip("slider_float", slider_float)

        slider_date = st.slider(
            "slider_date",
            value=date.today(),
            key="slider_date",
        )
        check_roundtrip("slider_date", slider_date)

        slider_time = st.slider(
            "slider_time",
            value=datetime.now().time(),
            key="slider_time",
        )
        check_roundtrip("slider_time", slider_time)

        slider_datetime = st.slider(
            "slider_datetime",
            value=datetime.now(),
            key="slider_datetime",
        )
        check_roundtrip("slider_datetime", slider_datetime)

        slider_interval = st.slider(
            "slider_interval",
            value=[-1.0, 1.0],
            key="slider_interval",
        )
        check_roundtrip("slider_interval", slider_interval)

        text_area = st.text_area("text_area", key="text_area")
        check_roundtrip("text_area", text_area)

        text_area_default = st.text_area(
            "text_area_default",
            value="default",
            key="text_area_default",
        )
        check_roundtrip("text_area_default", text_area_default)

        text_input = st.text_input("text_input", key="text_input")
        check_roundtrip("text_input", text_input)

        text_input_default = st.text_input(
            "text_input_default",
            value="default",
            key="text_input_default",
        )
        check_roundtrip("text_input_default", text_input_default)

        time = st.time_input("time", key="time")
        check_roundtrip("time", time)

        time_datetime = st.time_input(
            "datetime",
            value=datetime.now(),
            key="time_datetime",
        )
        check_roundtrip("time_datetime", time_datetime)
