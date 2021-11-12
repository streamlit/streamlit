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
from datetime import datetime, timedelta, date

import pytest
from hypothesis import given, strategies as hst

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.report_thread import _StringSet, get_report_ctx
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
from streamlit.uploaded_file_manager import UploadedFileRec
from tests import testutil
import tests.streamlit.state.strategies as stst


identity = lambda x: x


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

        ctx = get_report_ctx()
        assert ctx.session_state["color"] is not color

    @patch("streamlit.warning")
    def test_callbacks_with_experimental_rerun(self, patched_warning):
        def on_change():
            st.experimental_rerun()

        st.checkbox("the checkbox", on_change=on_change)

        session_state = get_session_state()
        widget_ids = list(session_state._new_widget_state.keys())
        wid = widget_ids[0]
        session_state._new_widget_state.set_from_value(wid, True)

        session_state.call_callbacks()
        patched_warning.assert_called_once()


def check_roundtrip(widget_id: str, value: Any) -> None:
    session_state = get_session_state()
    wid = session_state._get_widget_id(widget_id)
    metadata = session_state._new_widget_state.widget_metadata[wid]
    serializer = metadata.serializer
    deserializer = metadata.deserializer

    assert deserializer(serializer(value), "") == value


@patch("streamlit._is_running_with_streamlit", new=True)
class SessionStateSerdeTest(testutil.DeltaGeneratorTestCase):
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

    @patch("streamlit.elements.file_uploader.FileUploaderMixin._get_file_recs")
    def test_file_uploader_serde(self, get_file_recs_patch):
        file_recs = [
            UploadedFileRec(1, "file1", "type", b"123"),
        ]
        get_file_recs_patch.return_value = file_recs

        uploaded_file = st.file_uploader("file_uploader", key="file_uploader")

        # We can't use check_roundtrip here as the return_value of a
        # file_uploader widget isn't a primitive value, so comparing them
        # using == checks for reference equality.
        session_state = get_session_state()
        metadata = session_state.get_metadata_by_key("file_uploader")
        serializer = metadata.serializer
        deserializer = metadata.deserializer

        file_after_serde = deserializer(serializer(uploaded_file), "")

        assert uploaded_file.id == file_after_serde.id
        assert uploaded_file.name == file_after_serde.name
        assert uploaded_file.type == file_after_serde.type
        assert uploaded_file.size == file_after_serde.size
        assert uploaded_file.read() == file_after_serde.read()

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


class SessionStateMethodTests(unittest.TestCase):
    def setUp(self):
        old_state = {"foo": "bar", "baz": "qux", "corge": "grault"}
        new_session_state = {"foo": "bar2"}
        new_widget_state = WStates(
            {
                "baz": Value("qux2"),
                f"{GENERATED_WIDGET_KEY_PREFIX}-foo-None": Value("bar"),
            },
        )
        self.session_state = SessionState(
            old_state, new_session_state, new_widget_state
        )

    def test_compact(self):
        self.session_state.compact_state()
        assert self.session_state._old_state == {
            "foo": "bar2",
            "baz": "qux2",
            "corge": "grault",
            f"{GENERATED_WIDGET_KEY_PREFIX}-foo-None": "bar",
        }
        assert self.session_state._new_session_state == {}
        assert self.session_state._new_widget_state == WStates()

    def test_clear_state(self):
        self.session_state.clear_state()
        assert self.session_state._merged_state == {}

    def test_safe_widget_state(self):
        new_session_state = MagicMock()

        wstate = {"foo": "bar"}
        new_session_state.__getitem__.side_effect = wstate.__getitem__
        new_session_state.keys = lambda: {"foo", "baz"}
        self.session_state = SessionState({}, {}, new_session_state)

        assert self.session_state._safe_widget_state() == wstate

    def test_merged_state(self):
        assert self.session_state._merged_state == {
            "foo": "bar2",
            "baz": "qux2",
            "corge": "grault",
            f"{GENERATED_WIDGET_KEY_PREFIX}-foo-None": "bar",
        }

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
            {f"{GENERATED_WIDGET_KEY_PREFIX}-baz": Serialized(None)},
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
        mock_ctx.widget_ids_this_run = _StringSet()
        mock_ctx.widget_ids_this_run.add("widget_id")

        with patch("streamlit.report_thread.get_report_ctx", return_value=mock_ctx):
            with pytest.raises(StreamlitAPIException) as e:
                self.session_state._key_id_mapping = {"widget_id": "widget_id"}
                self.session_state["widget_id"] = "blah"
            assert "`st.session_state.widget_id` cannot be modified" in str(e.value)

    def test_setitem_disallows_setting_created_form(self):
        mock_ctx = MagicMock()
        mock_ctx.form_ids_this_run = _StringSet()
        mock_ctx.form_ids_this_run.add("form_id")

        with patch("streamlit.report_thread.get_report_ctx", return_value=mock_ctx):
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

    def test_cull_nonexistent(self):
        generated_widget_key = f"{GENERATED_WIDGET_KEY_PREFIX}-removed_widget"

        self.session_state._old_state = {
            "existing_widget": True,
            generated_widget_key: True,
            "val_set_via_state": 5,
        }

        wstates = WStates()
        self.session_state._new_widget_state = wstates

        self.session_state.cull_nonexistent({"existing_widget"})

        assert self.session_state["existing_widget"] == True
        assert generated_widget_key not in self.session_state
        assert self.session_state["val_set_via_state"] == 5

    def test_should_set_frontend_state_value_new_widget(self):
        # The widget is being registered for the first time, so there's no need
        # to have the frontend update with a new value.
        wstates = WStates()
        self.session_state._new_widget_state = wstates

        metadata = WidgetMetadata(
            id=f"{GENERATED_WIDGET_KEY_PREFIX}-0-widget_id_1",
            deserializer=lambda _, __: 0,
            serializer=identity,
            value_type="int_value",
        )
        self.session_state.set_keyed_widget(
            metadata, f"{GENERATED_WIDGET_KEY_PREFIX}-0-widget_id_1", "widget_id_1"
        )
        assert (
            self.session_state.should_set_frontend_state_value(
                f"{GENERATED_WIDGET_KEY_PREFIX}-0-widget_id_1",
                "widget_id_1",
            )
            == False
        )
        assert self.session_state["widget_id_1"] == 0


@patch(
    "streamlit.state.session_state.get_session_state",
    return_value=MagicMock(filtered_state={"foo": "bar"}),
)
class LazySessionStateTests(unittest.TestCase):
    reserved_key = f"{GENERATED_WIDGET_KEY_PREFIX}-some_key"

    def setUp(self):
        self.lazy_session_state = LazySessionState()

    def test_iter(self, _):
        state_iter = iter(self.lazy_session_state)
        assert next(state_iter) == "foo"
        with pytest.raises(StopIteration):
            next(state_iter)

    def test_len(self, _):
        assert len(self.lazy_session_state) == 1

    def test_validate_key(self, _):
        with pytest.raises(StreamlitAPIException) as e:
            self.lazy_session_state._validate_key(self.reserved_key)
        assert "are reserved" in str(e.value)

    def test_to_dict(self, _):
        assert self.lazy_session_state.to_dict() == {"foo": "bar"}

    # NOTE: We only test the error cases of {get, set, del}{item, attr} below
    # since the others are tested in another test class.
    def test_getitem_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            self.lazy_session_state[self.reserved_key]

    def test_setitem_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            self.lazy_session_state[self.reserved_key] = "foo"

    def test_delitem_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            del self.lazy_session_state[self.reserved_key]

    def test_getattr_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            getattr(self.lazy_session_state, self.reserved_key)

    def test_setattr_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            setattr(self.lazy_session_state, self.reserved_key, "foo")

    def test_delattr_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            delattr(self.lazy_session_state, self.reserved_key)


class LazySessionStateAttributeTests(unittest.TestCase):
    """Tests of LazySessionState attribute methods.

    Separate from the others to change patching. Test methods are individually
    patched to avoid issues with mutability.
    """

    def setUp(self):
        self.lazy_session_state = LazySessionState()

    @patch(
        "streamlit.state.session_state.get_session_state",
        return_value=SessionState(new_session_state={"foo": "bar"}),
    )
    def test_delattr(self, _):
        del self.lazy_session_state.foo
        assert "foo" not in self.lazy_session_state

    @patch(
        "streamlit.state.session_state.get_session_state",
        return_value=SessionState(new_session_state={"foo": "bar"}),
    )
    def test_getattr(self, _):
        assert self.lazy_session_state.foo == "bar"

    @patch(
        "streamlit.state.session_state.get_session_state",
        return_value=SessionState(new_session_state={"foo": "bar"}),
    )
    def test_getattr_error(self, _):
        with pytest.raises(AttributeError):
            del self.lazy_session_state.nonexistent

    @patch(
        "streamlit.state.session_state.get_session_state",
        return_value=SessionState(new_session_state={"foo": "bar"}),
    )
    def test_setattr(self, _):
        self.lazy_session_state.corge = "grault2"
        assert self.lazy_session_state.corge == "grault2"


@given(state=stst.session_state())
def test_compact_idempotent(state):
    assert state._compact() == state._compact()._compact()


@given(state=stst.session_state())
def test_compact_len(state):
    assert len(state) >= len(state._compact())


@given(state=stst.session_state())
def test_compact_presence(state):
    assert state.items() == state._compact().items()


@given(m=stst.session_state())
def test_mapping_laws(m):
    assert len(m) == len(m.keys()) == len(m.values()) == len(m.items())
    assert [value for value in m.values()] == [m[key] for key in m.keys()]
    assert [item for item in m.items()] == [(key, m[key]) for key in m.keys()]


@given(
    m=stst.session_state(),
    key=stst.user_key,
    value1=hst.integers(),
    value2=hst.integers(),
)
def test_map_set_set(m, key, value1, value2):
    m[key] = value1
    l1 = len(m)
    m[key] = value2
    assert m[key] == value2
    assert len(m) == l1


@given(m=stst.session_state(), key=stst.user_key, value1=hst.integers())
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
        "$$GENERATED_WIDGET_KEY-e3e70682-c209-4cac-629f-6fbed82c07cd-None", 0
    )
    meta2 = stst.mock_metadata(
        "$$GENERATED_WIDGET_KEY-f728b4fa-4248-5e3a-0a5d-2f346baa9455-0", 0
    )
    m = SessionState()
    m["0"] = 0
    m.set_unkeyed_widget(
        meta1, "$$GENERATED_WIDGET_KEY-e3e70682-c209-4cac-629f-6fbed82c07cd-None"
    )
    m.compact_state()

    m.set_keyed_widget(
        meta2, "$$GENERATED_WIDGET_KEY-f728b4fa-4248-5e3a-0a5d-2f346baa9455-0", "0"
    )
    key = "0"
    value1 = 0

    m[key] = value1
    l1 = len(m)
    del m[key]
    assert key not in m
    assert len(m) == l1 - 1


class SessionStateStatProviderTests(testutil.DeltaGeneratorTestCase):
    def test_session_state_stats(self):
        state = get_session_state()
        stat = state.get_stats()[0]
        assert stat.category_name == "st_session_state"

        init_size = stat.byte_length
        assert init_size < 1500

        state["foo"] = 2
        new_size = state.get_stats()[0].byte_length
        assert new_size > init_size
        assert new_size < 1500

        state["foo"] = 1
        new_size_2 = state.get_stats()[0].byte_length
        assert new_size_2 == new_size

        st.checkbox("checkbox", key="checkbox")
        new_size_3 = state.get_stats()[0].byte_length
        assert new_size_3 > new_size_2
        assert new_size_3 - new_size_2 < 500

        state.compact_state()
        new_size_4 = state.get_stats()[0].byte_length
        assert new_size_4 <= new_size_3
