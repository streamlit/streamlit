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


import unittest
from unittest.mock import MagicMock, patch

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
