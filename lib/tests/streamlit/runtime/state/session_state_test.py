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

"""Session state unit tests."""
import unittest
from copy import deepcopy
from datetime import date, datetime, timedelta
from typing import Any, List, Tuple
from unittest.mock import MagicMock, patch

import pytest
from hypothesis import given
from hypothesis import strategies as hst

import streamlit as st
import tests.streamlit.runtime.state.strategies as stst
from streamlit.errors import StreamlitAPIException
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.proto.WidgetStates_pb2 import WidgetStates as WidgetStatesProto
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import SessionState, get_session_state
from streamlit.runtime.state.common import GENERATED_WIDGET_ID_PREFIX
from streamlit.runtime.state.session_state import (
    Serialized,
    Value,
    WidgetMetadata,
    WStates,
)
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from streamlit.testing.script_interactions import InteractiveScriptTests
from tests.delta_generator_test_case import DeltaGeneratorTestCase

identity = lambda x: x


def _raw_session_state() -> SessionState:
    """Return the SessionState instance within the current ScriptRunContext's
    SafeSessionState wrapper.
    """
    return get_session_state()._state


class WStateTests(unittest.TestCase):
    def setUp(self):
        wstates = WStates()
        self.wstates = wstates

        widget_state = WidgetStateProto()
        widget_state.id = "widget_id_1"
        widget_state.int_value = 5
        wstates.set_widget_from_proto(widget_state)
        wstates.set_widget_metadata(
            WidgetMetadata(
                id="widget_id_1",
                deserializer=lambda x, s: str(x),
                serializer=lambda x: int(x),
                value_type="int_value",
            )
        )

        wstates.set_from_value("widget_id_2", 5)
        wstates.set_widget_metadata(
            WidgetMetadata(
                id="widget_id_2",
                deserializer=lambda x, s: x,
                serializer=identity,
                value_type="int_value",
            )
        )

    def test_get_from_json_value(self):
        widget_state = WidgetStateProto()
        widget_state.id = "widget_id_3"
        widget_state.json_value = '{"foo":5}'

        self.wstates.set_widget_from_proto(widget_state)
        self.wstates.set_widget_metadata(
            WidgetMetadata(
                id="widget_id_3",
                deserializer=lambda x, s: x,
                serializer=identity,
                value_type="json_value",
            )
        )

        assert self.wstates["widget_id_3"] == {"foo": 5}

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

    def test_remove_stale_widgets(self):
        self.wstates.remove_stale_widgets({"widget_id_1"})
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
        self.wstates.set_widget_from_proto(widget_state)
        self.wstates.set_widget_metadata(
            WidgetMetadata(
                id="widget_id_1",
                deserializer=lambda x, s: x,
                serializer=identity,
                value_type="int_array_value",
            )
        )

        serialized = self.wstates.get_serialized("widget_id_1")
        assert serialized.id == "widget_id_1"
        assert list(serialized.int_array_value.data) == [1, 2, 3, 4]

    def test_get_serialized_json_value(self):
        self.wstates.set_from_value("widget_id_3", {"foo": 5})
        self.wstates.set_widget_metadata(
            WidgetMetadata(
                id="widget_id_3",
                deserializer=lambda x, s: x,
                serializer=identity,
                value_type="json_value",
            )
        )

        serialized = self.wstates.get_serialized("widget_id_3")
        assert serialized.id == "widget_id_3"
        assert serialized.json_value == '{"foo": 5}'

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
            deserializer=lambda x, s: str(x),
            serializer=lambda x: int(x),
            value_type="int_value",
            callback=MagicMock(),
            callback_args=(1,),
            callback_kwargs={"y": 2},
        )
        self.wstates.widget_metadata["widget_id_1"] = metadata
        self.wstates.call_callback("widget_id_1")

        metadata.callback.assert_called_once_with(1, y=2)


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class SessionStateUpdateTest(DeltaGeneratorTestCase):
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


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class SessionStateTest(DeltaGeneratorTestCase):
    def test_widget_presence(self):
        state = st.session_state

        assert "foo" not in state

        state.foo = "foo"

        assert "foo" in state
        assert state.foo == "foo"

    def test_widget_outputs_dont_alias(self):
        color = st.select_slider(
            "Select a color of the rainbow",
            options=[
                ["red", "orange"],
                ["yellow", "green"],
                ["blue", "indigo"],
                ["violet"],
            ],
            key="color",
        )

        ctx = get_script_run_ctx()
        assert ctx.session_state["color"] is not color

    @patch("streamlit.warning")
    def test_callbacks_with_experimental_rerun(self, patched_warning):
        """Calling 'experimental_rerun' from within a widget callback
        is disallowed and results in a warning.
        """

        # A mock on_changed handler for our checkbox. It will call
        # `st.experimental_rerun`, which should result in a warning
        # being printed to the user's app.
        mock_on_checkbox_changed = MagicMock(side_effect=st.experimental_rerun)

        st.checkbox("the checkbox", on_change=mock_on_checkbox_changed)

        session_state = _raw_session_state()

        # Pretend that the checkbox has a new state value
        checkbox_state = WidgetStateProto()
        checkbox_state.id = list(session_state._new_widget_state.keys())[0]
        checkbox_state.bool_value = True
        widget_states = WidgetStatesProto()
        widget_states.widgets.append(checkbox_state)

        # Tell session_state to call our callbacks.
        session_state.on_script_will_rerun(widget_states)

        mock_on_checkbox_changed.assert_called_once()
        patched_warning.assert_called_once()


class SessionStateInteractionTest(InteractiveScriptTests):
    def test_updates(self):
        script = self.script_from_filename(__file__, "linked_sliders.py")
        sr = script.run()
        assert sr.get("slider")[0].value == -100.0
        assert sr.get("markdown")[0].value == "Celsius `-100.0`"
        assert sr.get("slider")[1].value == -148.0
        assert sr.get("markdown")[1].value == "Fahrenheit `-148.0`"

        # Both sliders update when first is changed
        sr2 = sr.get("slider")[0].set_value(0.0).run()
        assert sr2.get("slider")[0].value == 0.0
        assert sr2.get("markdown")[0].value == "Celsius `0.0`"
        assert sr2.get("slider")[1].value == 32.0
        assert sr2.get("markdown")[1].value == "Fahrenheit `32.0`"

        # Both sliders update when second is changed
        sr3 = sr2.get("slider")[1].set_value(212.0).run()
        assert sr3.get("slider")[0].value == 100.0
        assert sr3.get("markdown")[0].value == "Celsius `100.0`"
        assert sr3.get("slider")[1].value == 212.0
        assert sr3.get("markdown")[1].value == "Fahrenheit `212.0`"

        # Sliders update when one is changed repeatedly
        sr4 = sr3.get("slider")[0].set_value(0.0).run()
        assert sr4.get("slider")[0].value == 0.0
        assert sr4.get("slider")[1].value == 32.0
        sr5 = sr4.get("slider")[0].set_value(100.0).run()
        assert sr5.get("slider")[0].value == 100.0
        assert sr5.get("slider")[1].value == 212.0


def check_roundtrip(widget_id: str, value: Any) -> None:
    session_state = _raw_session_state()
    wid = session_state._get_widget_id(widget_id)
    metadata = session_state._new_widget_state.widget_metadata[wid]
    serializer = metadata.serializer
    deserializer = metadata.deserializer

    assert deserializer(serializer(value), "") == value


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class SessionStateSerdeTest(DeltaGeneratorTestCase):
    def test_checkbox_serde(self):
        cb = st.checkbox("cb", key="cb")
        check_roundtrip("cb", cb)

    def test_color_picker_serde(self):
        cp = st.color_picker("cp", key="cp")
        check_roundtrip("cp", cp)

    def test_date_input_serde(self):
        date = st.date_input("date", key="date")
        check_roundtrip("date", date)

        date_interval = st.date_input(
            "date_interval",
            value=[datetime.now().date(), datetime.now().date() + timedelta(days=1)],
            key="date_interval",
        )
        check_roundtrip("date_interval", date_interval)

    @patch("streamlit.elements.file_uploader._get_file_recs")
    def test_file_uploader_serde(self, get_file_recs_patch):
        file_recs = [
            UploadedFileRec(1, "file1", "type", b"123"),
        ]
        get_file_recs_patch.return_value = file_recs

        uploaded_file = st.file_uploader("file_uploader", key="file_uploader")
        check_roundtrip("file_uploader", uploaded_file)

    def test_multiselect_serde(self):
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

    def test_number_input_serde(self):
        number = st.number_input("number", key="number")
        check_roundtrip("number", number)

        number_int = st.number_input("number_int", value=16777217, key="number_int")
        check_roundtrip("number_int", number_int)

    def test_radio_input_serde(self):
        radio = st.radio("radio", options=["a", "b", "c"], key="radio")
        check_roundtrip("radio", radio)

        radio_nondefault = st.radio(
            "radio_nondefault",
            options=["a", "b", "c"],
            index=1,
            key="radio_nondefault",
        )
        check_roundtrip("radio_nondefault", radio_nondefault)

    def test_selectbox_serde(self):
        selectbox = st.selectbox("selectbox", options=["a", "b", "c"], key="selectbox")
        check_roundtrip("selectbox", selectbox)

    def test_select_slider_serde(self):
        select_slider = st.select_slider(
            "select_slider", options=["a", "b", "c"], key="select_slider"
        )
        check_roundtrip("select_slider", select_slider)

        select_slider_range = st.select_slider(
            "select_slider_range",
            options=["a", "b", "c"],
            value=["a", "b"],
            key="select_slider_range",
        )
        check_roundtrip("select_slider_range", select_slider_range)

    def test_slider_serde(self):
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

    def test_text_area_serde(self):
        text_area = st.text_area("text_area", key="text_area")
        check_roundtrip("text_area", text_area)

        text_area_default = st.text_area(
            "text_area_default",
            value="default",
            key="text_area_default",
        )
        check_roundtrip("text_area_default", text_area_default)

    def test_text_input_serde(self):
        text_input = st.text_input("text_input", key="text_input")
        check_roundtrip("text_input", text_input)

        text_input_default = st.text_input(
            "text_input_default",
            value="default",
            key="text_input_default",
        )
        check_roundtrip("text_input_default", text_input_default)

    def test_time_input_serde(self):
        time = st.time_input("time", key="time")
        check_roundtrip("time", time)

        time_datetime = st.time_input(
            "datetime",
            value=datetime.now(),
            key="time_datetime",
        )
        check_roundtrip("time_datetime", time_datetime)


def _compact_copy(state: SessionState) -> SessionState:
    """Return a compacted copy of the given SessionState."""
    state_copy = deepcopy(state)
    state_copy._compact_state()
    return state_copy


def _sorted_items(state: SessionState) -> List[Tuple[str, Any]]:
    """Return all key-value pairs in the SessionState.
    The returned list is sorted by key for easier comparison.
    """
    return [(key, state[key]) for key in sorted(state._keys())]


class SessionStateMethodTests(unittest.TestCase):
    def setUp(self):
        old_state = {"foo": "bar", "baz": "qux", "corge": "grault"}
        new_session_state = {"foo": "bar2"}
        new_widget_state = WStates(
            {
                "baz": Value("qux2"),
                f"{GENERATED_WIDGET_ID_PREFIX}-foo-None": Value("bar"),
            },
        )
        self.session_state = SessionState(
            old_state, new_session_state, new_widget_state
        )

    def test_compact(self):
        self.session_state._compact_state()
        assert self.session_state._old_state == {
            "foo": "bar2",
            "baz": "qux2",
            "corge": "grault",
            f"{GENERATED_WIDGET_ID_PREFIX}-foo-None": "bar",
        }
        assert self.session_state._new_session_state == {}
        assert self.session_state._new_widget_state == WStates()

    def test_clear_state(self):
        # Sanity test
        keys = {"foo", "baz", "corge", f"{GENERATED_WIDGET_ID_PREFIX}-foo-None"}
        self.assertEqual(keys, self.session_state._keys())

        # Clear state
        self.session_state.clear()

        # Keys should be empty
        self.assertEqual(set(), self.session_state._keys())

    def test_filtered_state(self):
        assert self.session_state.filtered_state == {
            "foo": "bar2",
            "baz": "qux2",
            "corge": "grault",
        }

    def test_filtered_state_resilient_to_missing_metadata(self):
        old_state = {"foo": "bar", "corge": "grault"}
        new_session_state = {}
        new_widget_state = WStates(
            {f"{GENERATED_WIDGET_ID_PREFIX}-baz": Serialized(WidgetStateProto())},
        )
        self.session_state = SessionState(
            old_state, new_session_state, new_widget_state
        )

        assert self.session_state.filtered_state == {
            "foo": "bar",
            "corge": "grault",
        }

    def is_new_state_value(self):
        assert self.session_state.is_new_state_value("foo")
        assert not self.session_state.is_new_state_value("corge")

    def test_getitem(self):
        assert self.session_state["foo"] == "bar2"

    def test_getitem_error(self):
        with pytest.raises(KeyError):
            self.session_state["nonexistent"]

    def test_setitem(self):
        assert not self.session_state.is_new_state_value("corge")
        self.session_state["corge"] = "grault2"
        assert self.session_state["corge"] == "grault2"
        assert self.session_state.is_new_state_value("corge")

    def test_setitem_disallows_setting_created_widget(self):
        mock_ctx = MagicMock()
        mock_ctx.widget_ids_this_run = {"widget_id"}

        with patch(
            "streamlit.runtime.scriptrunner.get_script_run_ctx", return_value=mock_ctx
        ):
            with pytest.raises(StreamlitAPIException) as e:
                self.session_state._key_id_mapping = {"widget_id": "widget_id"}
                self.session_state["widget_id"] = "blah"
            assert "`st.session_state.widget_id` cannot be modified" in str(e.value)

    def test_setitem_disallows_setting_created_form(self):
        mock_ctx = MagicMock()
        mock_ctx.form_ids_this_run = {"form_id"}

        with patch(
            "streamlit.runtime.scriptrunner.get_script_run_ctx", return_value=mock_ctx
        ):
            with pytest.raises(StreamlitAPIException) as e:
                self.session_state["form_id"] = "blah"
            assert "`st.session_state.form_id` cannot be modified" in str(e.value)

    def test_delitem(self):
        del self.session_state["foo"]
        assert "foo" not in self.session_state

    def test_delitem_errors(self):
        for key in ["_new_session_state", "_new_widget_state", "_old_state"]:
            with pytest.raises(KeyError):
                del self.session_state[key]

        with pytest.raises(KeyError):
            del self.session_state["nonexistent"]

    def test_widget_changed(self):
        assert self.session_state._widget_changed("foo")
        self.session_state._new_widget_state.set_from_value("foo", "bar")
        assert not self.session_state._widget_changed("foo")

    def test_remove_stale_widgets(self):
        generated_widget_key = f"{GENERATED_WIDGET_ID_PREFIX}-removed_widget"

        self.session_state._old_state = {
            "existing_widget": True,
            generated_widget_key: True,
            "val_set_via_state": 5,
        }

        wstates = WStates()
        self.session_state._new_widget_state = wstates

        self.session_state._remove_stale_widgets({"existing_widget"})

        assert self.session_state["existing_widget"] == True
        assert generated_widget_key not in self.session_state
        assert self.session_state["val_set_via_state"] == 5

    def test_should_set_frontend_state_value_new_widget(self):
        # The widget is being registered for the first time, so there's no need
        # to have the frontend update with a new value.
        wstates = WStates()
        self.session_state._new_widget_state = wstates

        WIDGET_VALUE = 123

        metadata = WidgetMetadata(
            id=f"{GENERATED_WIDGET_ID_PREFIX}-0-widget_id_1",
            deserializer=lambda _, __: WIDGET_VALUE,
            serializer=identity,
            value_type="int_value",
        )
        wsr = self.session_state.register_widget(
            metadata=metadata,
            user_key="widget_id_1",
        )
        assert not wsr.value_changed
        assert self.session_state["widget_id_1"] == WIDGET_VALUE

    def test_detect_unserializable(self):
        self.session_state.check_serializable()

        def nested():
            return lambda x: x

        lam_func = nested()
        self.session_state["unserializable"] = lam_func
        with pytest.raises(Exception):
            self.session_state.check_serializable()


@given(state=stst.session_state())
def test_compact_idempotent(state):
    assert _compact_copy(state) == _compact_copy(_compact_copy(state))


@given(state=stst.session_state())
def test_compact_len(state):
    assert len(state) >= len(_compact_copy(state))


@given(state=stst.session_state())
def test_compact_presence(state):
    assert _sorted_items(state) == _sorted_items(_compact_copy(state))


@given(
    m=stst.session_state(),
    key=stst.USER_KEY,
    value1=hst.integers(),
    value2=hst.integers(),
)
def test_map_set_set(m, key, value1, value2):
    m[key] = value1
    l1 = len(m)
    m[key] = value2
    assert m[key] == value2
    assert len(m) == l1


@given(m=stst.session_state(), key=stst.USER_KEY, value1=hst.integers())
def test_map_set_del(m, key, value1):
    m[key] = value1
    l1 = len(m)
    del m[key]
    assert key not in m
    assert len(m) == l1 - 1


@given(state=stst.session_state())
def test_key_wid_lookup_equiv(state):
    k_wid_map = state._key_id_mapping
    for k, wid in k_wid_map.items():
        assert state[k] == state[wid]


def test_map_set_del_3837_regression():
    """A regression test for `test_map_set_del` that involves too much setup
    to conveniently use the hypothesis `example` decorator."""

    meta1 = stst.mock_metadata(
        "   $$GENERATED_WIDGET_ID-e3e70682-c209-4cac-629f-6fbed82c07cd-None", 0
    )
    meta2 = stst.mock_metadata(
        "$$GENERATED_WIDGET_ID-f728b4fa-4248-5e3a-0a5d-2f346baa9455-0", 0
    )
    m = SessionState()
    m["0"] = 0
    m.register_widget(metadata=meta1, user_key=None)
    m._compact_state()

    m.register_widget(metadata=meta2, user_key="0")
    key = "0"
    value1 = 0

    m[key] = value1
    l1 = len(m)
    del m[key]
    assert key not in m
    assert len(m) == l1 - 1


class SessionStateStatProviderTests(DeltaGeneratorTestCase):
    def test_session_state_stats(self):
        # TODO: document the values used here. They're somewhat arbitrary -
        #  we don't care about actual byte values, but rather that our
        #  SessionState isn't getting unexpectedly massive.
        state = _raw_session_state()
        stat = state.get_stats()[0]
        assert stat.category_name == "st_session_state"

        init_size = stat.byte_length
        assert init_size < 2500

        state["foo"] = 2
        new_size = state.get_stats()[0].byte_length
        assert new_size > init_size
        assert new_size < 2500

        state["foo"] = 1
        new_size_2 = state.get_stats()[0].byte_length
        assert new_size_2 == new_size

        st.checkbox("checkbox", key="checkbox")
        new_size_3 = state.get_stats()[0].byte_length
        assert new_size_3 > new_size_2
        assert new_size_3 - new_size_2 < 2500

        state._compact_state()
        new_size_4 = state.get_stats()[0].byte_length
        assert new_size_4 <= new_size_3
