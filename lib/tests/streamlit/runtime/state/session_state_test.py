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

"""Session state unit tests."""

from __future__ import annotations

import json
import unittest
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from hypothesis import given, settings
from hypothesis import strategies as hst

import streamlit as st
import tests.streamlit.runtime.state.strategies as stst
from streamlit.components.v2.bidi_component.main import _make_trigger_id
from streamlit.errors import (
    StreamlitAPIException,
    UnserializableSessionStateError,
)
from streamlit.proto.Common_pb2 import (
    ChatInputValue as ChatInputValueProto,
)
from streamlit.proto.Common_pb2 import (
    FileUploaderState as FileUploaderStateProto,
)
from streamlit.proto.Common_pb2 import (
    FileURLs as FileURLsProto,
)
from streamlit.proto.Common_pb2 import (
    StringTriggerValue as StringTriggerValueProto,
)
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState
from streamlit.runtime.scriptrunner_utils.shared_run_state import SharedRunState
from streamlit.runtime.state import SessionState, get_session_state
from streamlit.runtime.state.common import GENERATED_ELEMENT_ID_PREFIX, WidgetMetadata
from streamlit.runtime.state.session_state import (
    KeyIdMapper,
    Serialized,
    SessionStateStatProvider,
    Value,
    WStates,
    _is_stale_widget,
    _sanitize_url_array,
)
from streamlit.runtime.stats import CACHE_MEMORY_FAMILY, CacheStat
from streamlit.runtime.uploaded_file_manager import UploadedFile, UploadedFileRec
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.testutil import patch_config_options


def identity(x):
    return x


def _raw_session_state() -> SessionState:
    """Return the SessionState instance within the current ScriptRunContext's
    SafeSessionState wrapper.
    """
    return get_session_state()._state


def _create_test_widget_metadata(
    widget_id: str,
    value_type: str = "string_value",
    deserializer=None,
    serializer=None,
    formatted_options: list[str] | None = None,
    clearable: bool = False,
    max_array_length: int | None = None,
) -> WidgetMetadata:
    """Helper to create widget metadata for query param binding tests."""
    return WidgetMetadata(
        id=widget_id,
        deserializer=deserializer or (lambda x: x if x is not None else "default"),
        serializer=serializer or (lambda x: x),
        value_type=value_type,
        bind="query-params",
        formatted_options=formatted_options,
        clearable=clearable,
        max_array_length=max_array_length,
    )


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
                deserializer=str,
                serializer=int,
                value_type="int_value",
            )
        )

        wstates.set_from_value("widget_id_2", 5)
        wstates.set_widget_metadata(
            WidgetMetadata(
                id="widget_id_2",
                deserializer=lambda x: x,
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
                deserializer=lambda x: x,
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
        self.wstates.remove_stale_widgets({"widget_id_1"}, None)
        assert "widget_id_1" in self.wstates
        assert "widget_id_2" not in self.wstates

    def test_remove_stale_widgets_fragment_run(self):
        widget_data = [
            ("widget_id_1", "my_fragment_id"),
            ("widget_id_2", "my_fragment_id"),
            ("widget_id_3", "some_other_fragment_id"),
        ]
        for widget_id, fragment_id in widget_data:
            widget_state1 = WidgetStateProto()
            widget_state1.id = widget_id
            widget_state1.int_value = 7
            self.wstates.set_widget_from_proto(widget_state1)
            self.wstates.set_widget_metadata(
                WidgetMetadata(
                    id=widget_id,
                    deserializer=lambda x: x,
                    serializer=identity,
                    value_type="int_value",
                    fragment_id=fragment_id,
                )
            )

        self.wstates.remove_stale_widgets({"widget_id_1"}, {"my_fragment_id"})
        assert "widget_id_1" in self.wstates  # Active widget in fragment, not removed
        assert "widget_id_2" not in self.wstates  # Stale widget in fragment, removed
        assert "widget_id_3" in self.wstates  # Unrelated widget, not removed

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
                deserializer=lambda x: x,
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
                deserializer=lambda x: x,
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
            deserializer=str,
            serializer=int,
            value_type="int_value",
            callback=MagicMock(),
            callback_args=(1,),
            callback_kwargs={"y": 2},
        )
        self.wstates.widget_metadata["widget_id_1"] = metadata
        self.wstates.call_callback("widget_id_1")

        metadata.callback.assert_called_once_with(1, y=2)

    def test_call_callback_with_no_callback_returns_none(self):
        """``call_callback`` returns None for widgets without a registered callback."""
        # widget_id_1 has metadata but no callback
        assert self.wstates.call_callback("widget_id_1") is None

    def test_call_callback_unknown_widget_raises(self):
        """``call_callback`` raises ``RuntimeError`` for an unknown widget ID."""
        with pytest.raises(RuntimeError, match=r"Widget unknown not found\."):
            self.wstates.call_callback("unknown")

    def test_get_serialized_file_uploader_state_value(self):
        """``get_serialized`` returns a widget proto for ``file_uploader_state_value``."""
        uploaded_state = FileUploaderStateProto()
        self.wstates.set_from_value("file_widget_id", uploaded_state)
        self.wstates.set_widget_metadata(
            WidgetMetadata(
                id="file_widget_id",
                deserializer=lambda x: x,
                serializer=identity,
                value_type="file_uploader_state_value",
            )
        )

        serialized = self.wstates.get_serialized("file_widget_id")
        assert serialized is not None
        assert serialized.id == "file_widget_id"
        assert serialized.WhichOneof("value") == "file_uploader_state_value"

    def test_get_serialized_string_trigger_value(self):
        """``get_serialized`` returns a widget proto for ``string_trigger_value``."""
        trigger_state = StringTriggerValueProto()
        trigger_state.data = "submit"
        self.wstates.set_from_value("trigger_widget_id", trigger_state)
        self.wstates.set_widget_metadata(
            WidgetMetadata(
                id="trigger_widget_id",
                deserializer=lambda x: x,
                serializer=identity,
                value_type="string_trigger_value",
            )
        )

        serialized = self.wstates.get_serialized("trigger_widget_id")
        assert serialized is not None
        assert serialized.string_trigger_value.data == "submit"

    def test_get_serialized_chat_input_value(self):
        """``get_serialized`` returns a widget proto for ``chat_input_value``."""
        chat_value = ChatInputValueProto()
        chat_value.data = "hello"
        self.wstates.set_from_value("chat_widget_id", chat_value)
        self.wstates.set_widget_metadata(
            WidgetMetadata(
                id="chat_widget_id",
                deserializer=lambda x: x,
                serializer=identity,
                value_type="chat_input_value",
            )
        )

        serialized = self.wstates.get_serialized("chat_widget_id")
        assert serialized is not None
        assert serialized.chat_input_value.data == "hello"

    def test_wstates_repr_includes_class_and_field_names(self):
        """``repr(WStates)`` includes the class name and field names so it is
        useful for debugging.
        """
        result = repr(self.wstates)
        assert "WStates" in result
        assert "states" in result

    def test_fragment_callback_warning(self):
        """Test that a warning is logged when modifying elements during a fragment callback."""
        # Create a mock script run context with in_fragment_callback=True
        # Patch get_script_run_ctx to return our mock context
        with patch("streamlit.delta_generator.logger.get_logger") as mock_get_logger:
            # Setup mock logger
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger

            def script():
                import streamlit as st

                def callback():
                    st.session_state["message"] = "ran callback"
                    st.write("Hello")

                @st.fragment
                def test_fragment():
                    st.checkbox("cb", on_change=callback)

                test_fragment()

            at = AppTest.from_function(script).run()
            at.checkbox[0].check().run()
            assert at.session_state["message"] == "ran callback"

            # Verify the warning was logged
            mock_logger.warning.assert_called()
            warning_msg = mock_logger.warning.call_args[0]

            assert any("fragment rerun" in msg for msg in warning_msg), (
                "Expected fragment rerun in warning message"
            )
            assert any(
                "callback that displays one or more elements" in msg
                for msg in warning_msg
            ), "Expected callback display elements warning message"
            assert any("not officially supported" in msg for msg in warning_msg), (
                "Expected 'not officially supported' in warning message"
            )
            assert any(
                "replace the existing elements at the top of your app" in msg
                for msg in warning_msg
            ), "Expected elements replacement warning in message"

    def test_no_warning_without_element_update_fragment_callback(self):
        """Test that no warning is logged when modifying session state without st.write in a fragment callback."""

        with patch("streamlit.delta_generator.logger.get_logger") as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger

            def script():
                import streamlit as st

                def callback():
                    st.session_state["message"] = "ran callback"

                @st.fragment
                def test_fragment():
                    st.checkbox("cb", on_change=callback)

                test_fragment()

            at = AppTest.from_function(script).run()
            at.checkbox[0].check().run()
            assert at.session_state["message"] == "ran callback"

            # Verify no warning was logged
            mock_logger.warning.assert_not_called()

    def test_no_warning_outside_fragment_callback(self):
        """Test that no warning is logged when not in a fragment callback context."""

        with patch("streamlit.delta_generator.logger.get_logger") as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger

            def script():
                import streamlit as st

                def callback():
                    st.session_state["message"] = "ran callback"

                def test_fragment():
                    st.checkbox("cb", on_change=callback)

                test_fragment()

            at = AppTest.from_function(script).run()
            at.checkbox[0].check().run()
            assert at.session_state["message"] == "ran callback"

            # Verify no warning was logged
            mock_logger.warning.assert_not_called()


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class SessionStateUpdateTest(DeltaGeneratorTestCase):
    def test_widget_creation_updates_state(self):
        state = st.session_state
        assert "c" not in state

        st.checkbox("checkbox", value=True, key="c")

        assert state.c is True

    def test_setting_before_widget_creation(self):
        state = st.session_state
        state.c = True
        assert state.c is True

        c = st.checkbox("checkbox", key="c")
        assert c is True


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


def test_callbacks_with_rerun():
    """Calling 'rerun' from within a widget callback
    is disallowed and results in a warning.
    """

    def script():
        import streamlit as st

        def callback():
            st.session_state["message"] = "ran callback"
            st.rerun()

        st.checkbox("cb", on_change=callback)

    at = AppTest.from_function(script).run()
    at.checkbox[0].check().run()
    assert at.session_state["message"] == "ran callback"
    warning = at.warning[0]
    assert "no-op" in warning.value


def test_fragment_callback_flag_resets_on_rerun_exception() -> None:
    """Ensure fragment callback context flag is cleared on RerunException.

    This guards against leaving `ctx.in_fragment_callback` stuck to True if
    a callback raises, which could contaminate subsequent runs.
    """
    from streamlit.runtime.scriptrunner import RerunException

    ss = SessionState()
    wid = "w-frag"

    # A callback that raises RerunException
    def cb() -> None:
        raise RerunException(None)

    meta = WidgetMetadata(
        id=wid,
        deserializer=lambda v: v,
        serializer=lambda v: v,
        value_type="int_value",
        callbacks={"change": cb},
        fragment_id="frag-1",
    )

    ss._set_widget_metadata(meta)
    ss._old_state[wid] = 1
    ss._new_widget_state.set_from_value(wid, 2)  # ensure _widget_changed is True

    mock_ctx = MagicMock()
    # Self-contained: initialize ThreadState so this test doesn't depend on
    # test ordering or another fixture having seeded the ContextVar.
    ThreadState.initialize(in_fragment_callback=False)

    with patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=mock_ctx,
    ):
        # Callbacks internally catch RerunException and log a warning.
        ss._call_callbacks()

    assert ThreadState.get().in_fragment_callback is False


def test_updates():
    at = AppTest.from_file("test_data/linked_sliders.py").run()
    assert at.slider.values == [-100.0, -148.0]
    assert at.markdown.values == ["Celsius `-100.0`", "Fahrenheit `-148.0`"]

    # Both sliders update when first is changed
    at.slider[0].set_value(0.0).run()
    assert at.slider.values == [0.0, 32.0]
    assert at.markdown.values == ["Celsius `0.0`", "Fahrenheit `32.0`"]

    # Both sliders update when second is changed
    at.slider[1].set_value(212.0).run()
    assert at.slider.values == [100.0, 212.0]
    assert at.markdown.values == ["Celsius `100.0`", "Fahrenheit `212.0`"]

    # Sliders update when one is changed repeatedly
    at.slider[0].set_value(0.0).run()
    assert at.slider.values == [0.0, 32.0]
    at.slider[0].set_value(100.0).run()
    assert at.slider.values == [100.0, 212.0]


def test_serializable_check():
    """When the config option is on, adding unserializable data to session
    state should result in an exception.
    """
    with patch_config_options({"runner.enforceSerializableSessionState": True}):

        def script():
            import streamlit as st

            def unserializable_data():
                return lambda x: x

            st.session_state.unserializable = unserializable_data()

        at = AppTest.from_function(script).run()
        assert at.exception
        assert "pickle" in at.exception[0].value


def test_serializable_check_off():
    """When the config option is off, adding unserializable data to session
    state should work without errors.
    """
    with patch_config_options({"runner.enforceSerializableSessionState": False}):

        def script():
            import streamlit as st

            def unserializable_data():
                return lambda x: x

            st.session_state.unserializable = unserializable_data()

        at = AppTest.from_function(script).run()
        assert not at.exception


def check_roundtrip(widget_id: str, value: Any) -> None:
    session_state = _raw_session_state()
    wid = session_state._get_widget_id(widget_id)
    metadata = session_state._new_widget_state.widget_metadata[wid]
    serializer = metadata.serializer
    deserializer = metadata.deserializer

    assert deserializer(serializer(value)) == value


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

    def test_feedback_serde(self):
        feedback = st.feedback("stars", key="feedback")
        check_roundtrip("feedback", feedback)

    @patch("streamlit.elements.widgets.file_uploader._get_upload_files")
    def test_file_uploader_serde(self, get_upload_files_patch):
        file_rec = UploadedFileRec("file1", "file1", "type", b"123")
        uploaded_files = [
            UploadedFile(
                file_rec, FileURLsProto(file_id="1", delete_url="d1", upload_url="u1")
            )
        ]

        get_upload_files_patch.return_value = uploaded_files

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


def _sorted_items(state: SessionState) -> list[tuple[str, Any]]:
    """Return all key-value pairs in the SessionState.
    The returned list is sorted by key for easier comparison.
    """
    return [(key, state[key]) for key in sorted(state._keys())]


class SessionStateMethodTests(unittest.TestCase):
    def setUp(self):
        self.old_state = {"foo": "bar", "baz": "qux", "corge": "grault"}
        self.new_session_state = {"foo": "bar2"}
        new_widget_state = WStates(
            {
                "baz": Value("qux2"),
                f"{GENERATED_ELEMENT_ID_PREFIX}-foo-None": Value("bar"),
            },
        )
        self.session_state = SessionState(
            self.old_state, self.new_session_state, new_widget_state
        )

    def test_compact(self):
        self.session_state._compact_state()
        assert self.session_state._old_state == {
            "foo": "bar2",
            "baz": "qux2",
            "corge": "grault",
            f"{GENERATED_ELEMENT_ID_PREFIX}-foo-None": "bar",
        }
        assert self.session_state._new_session_state == {}
        assert self.session_state._new_widget_state == WStates()

    # https://github.com/streamlit/streamlit/issues/7206
    def test_ignore_key_error_within_compact_state(self):
        wstates = WStates()

        widget_state = WidgetStateProto()
        widget_state.id = "widget_id_1"
        widget_state.int_value = 5
        wstates.set_widget_from_proto(widget_state)
        session_state = SessionState(self.old_state, self.new_session_state, wstates)
        # KeyError should be thrown from grabbing a key with no metadata
        # but _compact_state catches it so no KeyError should be thrown
        session_state._compact_state()
        with pytest.raises(KeyError):
            wstates["baz"]

    def test_clear_state(self):
        # Sanity test
        keys = {"foo", "baz", "corge", f"{GENERATED_ELEMENT_ID_PREFIX}-foo-None"}
        assert keys == self.session_state._keys()

        # Clear state
        self.session_state.clear()

        # Keys should be empty
        assert set() == self.session_state._keys()

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
            {f"{GENERATED_ELEMENT_ID_PREFIX}-baz": Serialized(WidgetStateProto())},
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
        mock_ctx.shared = SharedRunState()
        mock_ctx.shared.widget_ids_this_run.check_and_add("widget_id")

        with patch(
            "streamlit.runtime.state.session_state.get_script_run_ctx",
            return_value=mock_ctx,
        ):
            with pytest.raises(StreamlitAPIException) as e:
                self.session_state._key_id_mapper.set_key_id_mapping(
                    {"widget_id": "widget_id"}
                )
                self.session_state["widget_id"] = "blah"
            assert "`st.session_state.widget_id` cannot be modified" in str(e.value)

    def test_setitem_disallows_setting_created_form(self):
        mock_ctx = MagicMock()
        mock_ctx.shared = SharedRunState()
        mock_ctx.shared.form_ids_this_run.check_and_add("form_id")

        with patch(
            "streamlit.runtime.state.session_state.get_script_run_ctx",
            return_value=mock_ctx,
        ):
            with pytest.raises(StreamlitAPIException) as e:
                self.session_state["form_id"] = "blah"
            assert "`st.session_state.form_id` cannot be modified" in str(e.value)

    def test_reset_state_value(self):
        """Test that reset_state_value correctly sets a new state value.

        This test verifies that:
        1. A non-existent key can be set using reset_state_value
        2. The value is correctly stored in the session state
        3. The key is properly marked as a new state value
        """
        assert "corge" not in self.session_state._new_session_state
        self.session_state.reset_state_value("corge", "grault2")
        assert self.session_state["corge"] == "grault2"
        assert self.session_state.is_new_state_value("corge")

    def test_reset_state_value_allows_setting_created_widget(self):
        mock_ctx = MagicMock()
        mock_ctx.shared = SharedRunState()
        mock_ctx.shared.widget_ids_this_run.check_and_add("widget_id")

        with patch(
            "streamlit.runtime.state.session_state.get_script_run_ctx",
            return_value=mock_ctx,
        ):
            self.session_state._key_id_mapper.set_key_id_mapping(
                {"widget_id": "widget_id"}
            )
            # This would normally fail with setitem, but reset_state_value bypasses this check.
            self.session_state.reset_state_value("widget_id", "blah")
            assert self.session_state["widget_id"] == "blah"

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

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MagicMock(fragment_ids_this_run=None),
    )
    def test_remove_stale_widgets(self, mock_ctx: MagicMock):
        existing_widget_key = f"{GENERATED_ELEMENT_ID_PREFIX}-existing_widget"
        generated_widget_key = f"{GENERATED_ELEMENT_ID_PREFIX}-removed_widget"

        self.session_state._old_state = {
            existing_widget_key: True,
            generated_widget_key: True,
            "val_set_via_state": 5,
        }

        wstates = WStates()
        wstates.set_widget_metadata(
            WidgetMetadata(
                id=existing_widget_key,
                deserializer=str,
                serializer=bool,
                value_type="bool_value",
            )
        )
        wstates.set_widget_metadata(
            WidgetMetadata(
                id=generated_widget_key,
                deserializer=str,
                serializer=bool,
                value_type="bool_value",
            )
        )
        self.session_state._new_widget_state = wstates

        self.session_state._remove_stale_widgets({existing_widget_key})

        assert self.session_state[existing_widget_key] is True
        assert generated_widget_key not in self.session_state
        assert self.session_state["val_set_via_state"] == 5

    def test_should_set_frontend_state_value_new_widget(self):
        # The widget is being registered for the first time, so there's no need
        # to have the frontend update with a new value.
        wstates = WStates()
        self.session_state._new_widget_state = wstates

        WIDGET_VALUE = 123

        metadata = WidgetMetadata(
            id=f"{GENERATED_ELEMENT_ID_PREFIX}-0-widget_id_1",
            deserializer=lambda _: WIDGET_VALUE,
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
        # Doesn't error when only serializable data is present
        self.session_state._check_serializable()

        def nested():
            return lambda x: x

        lam_func = nested()
        self.session_state["unserializable"] = lam_func
        with pytest.raises(UnserializableSessionStateError):
            self.session_state._check_serializable()


@given(state=stst.session_state())
@settings(deadline=400)
def test_compact_idempotent(state):
    assert _compact_copy(state) == _compact_copy(_compact_copy(state))


@given(state=stst.session_state())
@settings(deadline=400)
def test_compact_len(state):
    assert len(state) >= len(_compact_copy(state))


@given(state=stst.session_state())
@settings(deadline=400)
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
def test_key_wid_lookup_equiv(state: SessionState):
    k_wid_map = state._key_id_mapper._key_id_mapping
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


class IsStaleWidgetTests(unittest.TestCase):
    def test_is_stale_widget_metadata_is_None(self):
        assert _is_stale_widget(None, {}, {})

    def test_is_stale_widget_active_id(self):
        metadata = WidgetMetadata(
            id="widget_id_1",
            deserializer=str,
            serializer=int,
            value_type="int_value",
        )
        assert not _is_stale_widget(metadata, {"widget_id_1"}, {})

    def test_is_stale_widget_unrelated_fragment(self):
        metadata = WidgetMetadata(
            id="widget_id_1",
            deserializer=str,
            serializer=int,
            value_type="int_value",
            fragment_id="my_fragment",
        )
        assert not _is_stale_widget(metadata, {"widget_id_2"}, {"some_other_fragment"})

    def test_is_stale_widget_actually_stale_fragment(self):
        metadata = WidgetMetadata(
            id="widget_id_1",
            deserializer=str,
            serializer=int,
            value_type="int_value",
            fragment_id="my_fragment",
        )
        assert _is_stale_widget(metadata, {"widget_id_2"}, {"my_fragment"})

    def test_is_stale_widget_actually_stale_no_fragment(self):
        metadata = WidgetMetadata(
            id="widget_id_1",
            deserializer=str,
            serializer=int,
            value_type="int_value",
            fragment_id="my_fragment",
        )
        assert _is_stale_widget(metadata, {"widget_id_2"}, {})


class SessionStateStatProviderTests(DeltaGeneratorTestCase):
    def test_session_state_stats_use_fast_proxy_by_default(self):
        state = _raw_session_state()

        with patch(
            "streamlit.runtime.stats.safe_sizeof",
            side_effect=AssertionError("safe_sizeof should not be called"),
        ):
            stat = state.get_stats()[CACHE_MEMORY_FAMILY][0]
            assert stat.category_name == "st_session_state"
            assert stat.byte_length == 0

            state["foo"] = 2
            assert state.get_stats()[CACHE_MEMORY_FAMILY][0].byte_length == 1

            st.checkbox("checkbox", key="checkbox")
            assert state.get_stats()[CACHE_MEMORY_FAMILY][0].byte_length == 2

    def test_session_state_stats(self):
        # TODO: document the values used here. They're somewhat arbitrary -
        #  we don't care about actual byte values, but rather that our
        #  SessionState isn't getting unexpectedly massive.
        with patch_config_options({"server.enableExpensiveMemoryStats": True}):
            state = _raw_session_state()
            stat = state.get_stats()[CACHE_MEMORY_FAMILY][0]
            assert stat.category_name == "st_session_state"

            # The expected size of the session state in bytes.
            # It composes of the session_state's fields.
            expected_session_state_size_bytes = 3000

            init_size = stat.byte_length
            assert init_size < expected_session_state_size_bytes

            state["foo"] = 2
            new_size = state.get_stats()[CACHE_MEMORY_FAMILY][0].byte_length
            assert new_size > init_size
            assert new_size < expected_session_state_size_bytes

            state["foo"] = 1
            new_size_2 = state.get_stats()[CACHE_MEMORY_FAMILY][0].byte_length
            assert new_size_2 == new_size

            st.checkbox("checkbox", key="checkbox")
            new_size_3 = state.get_stats()[CACHE_MEMORY_FAMILY][0].byte_length
            assert new_size_3 > new_size_2
            assert new_size_3 - new_size_2 < expected_session_state_size_bytes

            state._compact_state()
            new_size_4 = state.get_stats()[CACHE_MEMORY_FAMILY][0].byte_length
            assert new_size_4 <= new_size_3


def test_session_state_repr_includes_class_and_field_names() -> None:
    """``repr(SessionState())`` includes the class name and at least one
    field name so it is useful for debugging.
    """
    result = repr(SessionState())
    # Class name and a known dataclass field should appear.
    assert "SessionState" in result
    assert "_new_widget_state" in result


def test_session_state_stat_provider_returns_empty_for_no_sessions() -> None:
    """``SessionStateStatProvider.get_stats`` returns an empty mapping with no sessions."""
    session_mgr = MagicMock()
    session_mgr.list_active_sessions.return_value = []

    provider = SessionStateStatProvider(_session_mgr=session_mgr)

    assert provider.get_stats() == {}
    assert provider.stats_families == (CACHE_MEMORY_FAMILY,)


def test_session_state_stat_provider_aggregates_session_stats() -> None:
    """``SessionStateStatProvider.get_stats`` aggregates stats across sessions."""
    session_info_1 = MagicMock()
    session_info_1.session.session_state.get_stats.return_value = {
        CACHE_MEMORY_FAMILY: [CacheStat("st_session_state", "k1", 100)],
    }
    session_info_2 = MagicMock()
    session_info_2.session.session_state.get_stats.return_value = {
        CACHE_MEMORY_FAMILY: [CacheStat("st_session_state", "k2", 200)],
    }
    session_mgr = MagicMock()
    session_mgr.list_active_sessions.return_value = [session_info_1, session_info_2]

    provider = SessionStateStatProvider(_session_mgr=session_mgr)

    result = provider.get_stats()
    assert CACHE_MEMORY_FAMILY in result
    assert sum(stat.byte_length for stat in result[CACHE_MEMORY_FAMILY]) == 300


class KeyIdMapperTest(unittest.TestCase):
    def test_key_id_mapping(self):
        key_id_mapper = KeyIdMapper()
        key_id_mapper.set_key_id_mapping({"key": "wid"})
        assert key_id_mapper.get_id_from_key("key") == "wid"
        assert key_id_mapper.get_key_from_id("wid") == "key"

    def test_key_id_mapping_errors(self):
        key_id_mapper = KeyIdMapper()
        key_id_mapper.set_key_id_mapping({"key": "wid"})
        assert key_id_mapper.get_id_from_key("nonexistent") is None
        with pytest.raises(KeyError):
            key_id_mapper.get_key_from_id("nonexistent")

    def test_key_id_mapping_clear(self):
        key_id_mapper = KeyIdMapper()
        key_id_mapper.set_key_id_mapping({"key": "wid"})
        assert key_id_mapper.get_id_from_key("key") == "wid"
        assert key_id_mapper.get_key_from_id("wid") == "key"
        key_id_mapper.clear()
        assert key_id_mapper.get_id_from_key("key") is None
        with pytest.raises(KeyError):
            key_id_mapper.get_key_from_id("wid")

    def test_key_id_mapping_delete(self):
        key_id_mapper = KeyIdMapper()
        key_id_mapper.set_key_id_mapping({"key": "wid"})
        assert key_id_mapper.get_id_from_key("key") == "wid"
        assert key_id_mapper.get_key_from_id("wid") == "key"
        del key_id_mapper["key"]
        assert key_id_mapper.get_id_from_key("key") is None
        with pytest.raises(KeyError):
            key_id_mapper.get_key_from_id("wid")

    def test_key_id_mapping_set_key_id_mapping(self):
        key_id_mapper = KeyIdMapper()
        key_id_mapper.set_key_id_mapping({"key": "wid"})
        key_id_mapper["key2"] = "wid2"
        assert key_id_mapper.get_id_from_key("key") == "wid"
        assert key_id_mapper.get_key_from_id("wid") == "key"
        assert key_id_mapper.get_id_from_key("key2") == "wid2"
        assert key_id_mapper.get_key_from_id("wid2") == "key2"

    def test_key_id_mapping_update(self):
        key_id_mapper = KeyIdMapper()
        key_id_mapper.set_key_id_mapping({"key": "wid"})
        assert key_id_mapper.get_id_from_key("key") == "wid"
        assert key_id_mapper.get_key_from_id("wid") == "key"

        key_id_mapper2 = KeyIdMapper()
        key_id_mapper2.set_key_id_mapping({"key2": "wid2"})
        key_id_mapper.update(key_id_mapper2)
        assert key_id_mapper.get_id_from_key("key2") == "wid2"
        assert key_id_mapper.get_key_from_id("wid2") == "key2"

        key_id_mapper3 = KeyIdMapper()
        key_id_mapper3.set_key_id_mapping({"key": "wid3"})
        key_id_mapper.update(key_id_mapper3)
        assert key_id_mapper.get_id_from_key("key") == "wid3"
        assert key_id_mapper.get_key_from_id("wid3") == "key"
        assert key_id_mapper.get_id_from_key("key2") == "wid2"
        assert key_id_mapper.get_key_from_id("wid2") == "key2"
        assert key_id_mapper.get_id_from_key("key") == "wid3"
        assert key_id_mapper.get_key_from_id("wid") == "key"


# region Multiple callbacks


def test_per_key_callbacks_only_fire_for_changed_keys() -> None:
    """Test that per-key callbacks only fire for changed keys."""
    calls: list[str] = []

    def cb_a() -> None:
        calls.append("a")

    def cb_b() -> None:
        calls.append("b")

    ss = SessionState()
    wid = "w-json"
    meta = WidgetMetadata(
        id=wid,
        deserializer=lambda v: v,
        serializer=lambda v: v,
        value_type="json_value",
        callbacks={"a": cb_a, "b": cb_b},
    )

    # Register metadata
    ss._set_widget_metadata(meta)

    # Old state: {value: {a:1, b:2}}
    ss._old_state[wid] = {"value": {"a": 1, "b": 2}}
    # New state: {value: {a:1, b:3}}
    ss._new_widget_state.set_from_value(wid, {"value": {"a": 1, "b": 3}})

    ss._call_callbacks()
    assert calls == ["b"]


def test_json_trigger_aggregator_routes_to_named_callback() -> None:
    """Test that JSON trigger values are routed to the correct named callback.

    This test verifies that for widgets using `json_trigger_value`, the
    `event` field in the JSON payload is used to look up and execute the
    corresponding callback from the `callbacks` dictionary.
    """
    called: list[str] = []

    def cb_click() -> None:
        called.append("click")

    def cb_submit() -> None:
        called.append("submit")

    ss = SessionState()
    wid = "w-trig"
    meta = WidgetMetadata(
        id=wid,
        # Convert JSON string from proto into a dict
        deserializer=lambda s: json.loads(s) if s else None,
        serializer=lambda v: v,
        value_type="json_trigger_value",
        callbacks={"click": cb_click, "submit": cb_submit},
    )

    ss._set_widget_metadata(meta)

    # Emulate serialized proto received from frontend
    ws = WidgetStateProto(id=wid)
    ws.json_trigger_value = json.dumps({"event": "submit"})
    ss._new_widget_state.set_widget_from_proto(ws)

    ss._call_callbacks()
    assert called == ["submit"]


def _dummy_serializer(x):
    return x


def _dummy_deserializer(x):
    return x


def test_json_trigger_value_gets_reset():
    """Ensure json_trigger_value fields are cleared to None after _reset_triggers."""
    ss = SessionState()

    widget_id = "comp__event"

    meta = WidgetMetadata(
        id=widget_id,
        deserializer=_dummy_deserializer,
        serializer=_dummy_serializer,
        value_type="json_trigger_value",
        callbacks=None,
        callback_args=None,
        callback_kwargs=None,
        fragment_id=None,
    )

    # Register metadata and set initial trigger payload
    ss._set_widget_metadata(meta)
    payload = {"clicked": True}
    ss._new_widget_state[widget_id] = Value(json.dumps(payload))
    ss._old_state[widget_id] = payload

    # Act
    ss._reset_triggers()

    # Assert: value should now be None in both new and old state mappings
    # `_reset_triggers()` sets the new state to `Value(None)`
    new_value = ss._new_widget_state.states[widget_id]
    assert isinstance(new_value, Value)
    assert new_value.value is None
    assert ss._old_state[widget_id] is None


# endregion Multiple callbacks


def test_filtered_state_excludes_trigger_widgets() -> None:
    """Test that filtered_state excludes trigger widgets from session state.

    Trigger widgets should not appear when users access st.session_state,
    even though they exist internally for handling events.
    """

    session_state = SessionState()

    # Create some regular session state entries
    session_state["regular_key"] = "regular_value"
    session_state["user_counter"] = 42

    # Simulate trigger widgets being registered (this would normally happen
    # through the bidi_component registration process)
    component_id = "my_component_123"
    click_trigger_id = _make_trigger_id(component_id, "click")
    change_trigger_id = _make_trigger_id(component_id, "change")

    # Add trigger widgets to internal widget state
    session_state._new_widget_state.states[click_trigger_id] = Value(True)
    session_state._new_widget_state.states[change_trigger_id] = Value(None)

    # Add metadata for the trigger widgets
    click_metadata = WidgetMetadata(
        id=click_trigger_id,
        deserializer=lambda x: x or False,
        serializer=lambda x: x,
        value_type="json_trigger_value",
    )
    change_metadata = WidgetMetadata(
        id=change_trigger_id,
        deserializer=lambda x: x,
        serializer=lambda x: x,
        value_type="json_trigger_value",
    )

    session_state._new_widget_state.widget_metadata[click_trigger_id] = click_metadata
    session_state._new_widget_state.widget_metadata[change_trigger_id] = change_metadata

    # Get filtered state (what users see via st.session_state)
    filtered = session_state.filtered_state

    # Regular keys should be present
    assert "regular_key" in filtered
    assert "user_counter" in filtered
    assert filtered["regular_key"] == "regular_value"
    assert filtered["user_counter"] == 42

    # Trigger widgets should be filtered out
    assert click_trigger_id not in filtered
    assert change_trigger_id not in filtered

    # Verify the trigger widgets still exist internally
    assert click_trigger_id in session_state._new_widget_state.states
    assert change_trigger_id in session_state._new_widget_state.states


def test_filtered_state_includes_keyed_widgets() -> None:
    """Test that filtered_state includes regular keyed widgets.

    Regular widgets with user keys should still appear in session state,
    even after adding trigger widget filtering.
    """
    session_state = SessionState()

    # Create a regular widget with a user key
    widget_id = "$$ID-my_button-my_key"
    user_key = "my_key"

    # Set up key mapping
    session_state._key_id_mapper[user_key] = widget_id

    # Add widget state
    session_state._new_widget_state.states[widget_id] = Value(False)

    # Add metadata
    metadata = WidgetMetadata(
        id=widget_id,
        deserializer=lambda x: x or False,
        serializer=lambda x: x,
        value_type="bool_value",
    )
    session_state._new_widget_state.widget_metadata[widget_id] = metadata

    # Get filtered state
    filtered = session_state.filtered_state

    # The widget should appear under its user key
    assert user_key in filtered
    assert filtered[user_key] is False


def test_filtered_state_excludes_internal_keyed_widgets() -> None:
    """Test that filtered_state excludes keyed widgets that are internal.

    If a trigger widget somehow had a user key, it should still be
    filtered out because it has the internal key prefix.
    """
    session_state = SessionState()

    # Create a trigger widget that hypothetically has a user key
    component_id = "my_component_123"
    trigger_id = _make_trigger_id(component_id, "click")
    user_key = "trigger_key"  # This shouldn't happen in practice

    # Set up key mapping
    session_state._key_id_mapper[user_key] = trigger_id

    # Add widget state
    session_state._new_widget_state.states[trigger_id] = Value(True)

    # Add metadata
    metadata = WidgetMetadata(
        id=trigger_id,
        deserializer=lambda x: x or False,
        serializer=lambda x: x,
        value_type="json_trigger_value",
    )
    session_state._new_widget_state.widget_metadata[trigger_id] = metadata

    # Get filtered state
    filtered = session_state.filtered_state

    # The trigger widget should be filtered out even if it has a user key
    assert user_key not in filtered
    assert trigger_id not in filtered


def test_session_state_iteration_excludes_trigger_widgets() -> None:
    """Test that iterating over session state excludes trigger widgets.

    When users iterate over st.session_state, trigger widgets should
    not appear in the iteration.
    """
    session_state = SessionState()

    # Add regular session state
    session_state["regular_key"] = "value"

    # Add trigger widget
    component_id = "my_component_123"
    trigger_id = _make_trigger_id(component_id, "click")
    session_state._new_widget_state.states[trigger_id] = Value(True)

    # Add metadata for trigger widget
    metadata = WidgetMetadata(
        id=trigger_id,
        deserializer=lambda x: x or False,
        serializer=lambda x: x,
        value_type="json_trigger_value",
    )
    session_state._new_widget_state.widget_metadata[trigger_id] = metadata

    # Get all keys that would be visible to users
    visible_keys = list(session_state.filtered_state.keys())

    # Only regular keys should be visible
    assert "regular_key" in visible_keys
    assert trigger_id not in visible_keys
    assert (
        len([k for k in visible_keys if k.startswith("$$STREAMLIT_INTERNAL_KEY")]) == 0
    )


# Query Parameter Binding Tests
@dataclass
class MockScriptRunCtx:
    """Mock script run context for testing."""

    fragment_ids_this_run: list[str] | None = None


class HandleQueryParamBindingTest(DeltaGeneratorTestCase):
    """Tests for _handle_query_param_binding method."""

    def setUp(self) -> None:
        super().setUp()
        self.session_state = SessionState()
        self.query_params = self.session_state.query_params
        ThreadState.update(active_script_hash="main_hash")

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_url_seeds_widget_on_initial_load(self, mock_ctx: MagicMock) -> None:
        """Test that URL value seeds widget state on initial load."""
        self.query_params.set_initial_query_params("my_widget=url_value")

        metadata = _create_test_widget_metadata("$$ID-hash-my_widget")

        seeded = self.session_state._handle_query_param_binding(
            metadata, "my_widget", "$$ID-hash-my_widget"
        )

        assert seeded is True
        assert self.query_params.is_bound("my_widget")
        assert (
            self.session_state._new_widget_state["$$ID-hash-my_widget"] == "url_value"
        )
        assert self.session_state._new_session_state["my_widget"] == "url_value"

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_no_url_param_returns_false(self, mock_ctx: MagicMock) -> None:
        """Test that missing URL param returns False (no seeding)."""
        self.query_params.set_initial_query_params("")

        metadata = _create_test_widget_metadata("$$ID-hash-my_widget")

        seeded = self.session_state._handle_query_param_binding(
            metadata, "my_widget", "$$ID-hash-my_widget"
        )

        assert seeded is False
        assert self.query_params.is_bound("my_widget")

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_frontend_value_takes_priority(self, mock_ctx: MagicMock) -> None:
        """Test that user interaction (frontend value) wins over URL."""
        self.query_params.set_initial_query_params("my_widget=url_value")

        self.session_state._new_widget_state.set_from_value(
            "$$ID-hash-my_widget", "user_value"
        )

        metadata = _create_test_widget_metadata("$$ID-hash-my_widget")

        seeded = self.session_state._handle_query_param_binding(
            metadata, "my_widget", "$$ID-hash-my_widget"
        )

        assert seeded is False
        assert (
            self.session_state._new_widget_state["$$ID-hash-my_widget"] == "user_value"
        )

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_session_state_wins_on_rerun(self, mock_ctx: MagicMock) -> None:
        """Test that session_state value wins on subsequent reruns."""
        self.query_params.set_initial_query_params("my_widget=url_value")

        self.session_state._old_state["$$ID-hash-my_widget"] = "old_value"
        self.session_state._new_session_state["my_widget"] = "code_value"

        metadata = _create_test_widget_metadata("$$ID-hash-my_widget")

        seeded = self.session_state._handle_query_param_binding(
            metadata, "my_widget", "$$ID-hash-my_widget"
        )

        assert seeded is False
        assert self.session_state._new_session_state["my_widget"] == "code_value"

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_url_wins_on_initial_load_even_with_session_state(
        self, mock_ctx: MagicMock
    ) -> None:
        """Test that URL wins on initial load even if session_state was set."""
        self.query_params.set_initial_query_params("my_widget=url_value")

        self.session_state._new_session_state["my_widget"] = "developer_default"

        metadata = _create_test_widget_metadata("$$ID-hash-my_widget")

        seeded = self.session_state._handle_query_param_binding(
            metadata, "my_widget", "$$ID-hash-my_widget"
        )

        assert seeded is True
        assert self.session_state._new_session_state["my_widget"] == "url_value"


class RegisterWidgetQueryParamProgrammaticSyncTest(DeltaGeneratorTestCase):
    """Programmatic session_state updates sync bound widgets to the URL."""

    def setUp(self) -> None:
        super().setUp()
        self.session_state = SessionState()
        self.query_params = self.session_state.query_params

    def _page_info_msg_count(self) -> int:
        return sum(
            1 for m in self.forward_msg_queue._queue if m.HasField("page_info_changed")
        )

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_programmatic_set_syncs_query_params_and_forward_msg(
        self, mock_ctx: MagicMock
    ) -> None:
        widget_id = "$$ID-hash-my_widget"
        metadata = _create_test_widget_metadata(widget_id)
        self.query_params.set_initial_query_params("")

        self.session_state.register_widget(metadata, user_key="my_widget")
        self.session_state._compact_state()
        self.session_state._new_session_state["my_widget"] = "arbitrary value"
        self.clear_queue()

        self.session_state.register_widget(metadata, user_key="my_widget")

        assert self.query_params.get("my_widget") == "arbitrary value"
        assert self._page_info_msg_count() == 1
        msg = self.get_message_from_queue(-1)
        assert "my_widget=arbitrary+value" in msg.page_info_changed.query_string

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_programmatic_reset_to_default_sends_forward_msg(
        self, mock_ctx: MagicMock
    ) -> None:
        widget_id = "$$ID-hash-my_widget"
        metadata = _create_test_widget_metadata(widget_id)
        self.query_params.set_initial_query_params("")

        self.session_state.register_widget(metadata, user_key="my_widget")
        self.session_state._compact_state()
        self.query_params.set_with_no_forward_msg("my_widget", "stale")
        self.session_state._new_session_state["my_widget"] = "default"
        self.clear_queue()

        self.session_state.register_widget(metadata, user_key="my_widget")

        assert "my_widget" not in self.query_params._query_params
        assert self._page_info_msg_count() == 1

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_programmatic_set_skips_forward_msg_when_url_already_matches(
        self, mock_ctx: MagicMock
    ) -> None:
        widget_id = "$$ID-hash-my_widget"
        metadata = _create_test_widget_metadata(widget_id)
        self.query_params.set_initial_query_params("")

        self.session_state.register_widget(metadata, user_key="my_widget")
        self.session_state._compact_state()
        self.query_params.set_with_no_forward_msg("my_widget", "same")
        self.session_state._new_session_state["my_widget"] = "same"
        self.clear_queue()

        self.session_state.register_widget(metadata, user_key="my_widget")

        assert self._page_info_msg_count() == 0

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_ui_driven_value_does_not_trigger_programmatic_url_sync(
        self, mock_ctx: MagicMock
    ) -> None:
        widget_id = "$$ID-hash-my_widget"
        metadata = _create_test_widget_metadata(widget_id)
        self.query_params.set_initial_query_params("")

        self.session_state.register_widget(metadata, user_key="my_widget")
        self.session_state._compact_state()
        self.session_state._new_widget_state.set_from_value(widget_id, "from_ui")
        self.clear_queue()

        self.session_state.register_widget(metadata, user_key="my_widget")

        assert self._page_info_msg_count() == 0

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_programmatic_float_scalar_matches_url_string_form(
        self, mock_ctx: MagicMock
    ) -> None:
        widget_id = "$$ID-hash-num"
        metadata = _create_test_widget_metadata(
            widget_id,
            value_type="double_value",
            deserializer=lambda x: float(x) if x is not None else 0.0,
            serializer=lambda x: float(x),
        )
        self.query_params.set_initial_query_params("")

        self.session_state.register_widget(metadata, user_key="num")
        self.session_state._compact_state()
        # Scalar double_value uses str() in set_corrected_value, not whole-number collapse.
        self.query_params.set_with_no_forward_msg("num", "5.0")
        self.session_state._new_session_state["num"] = 5.0
        self.clear_queue()

        self.session_state.register_widget(metadata, user_key="num")

        assert self._page_info_msg_count() == 0

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_programmatic_bool_coercion_matches_url(self, mock_ctx: MagicMock) -> None:
        widget_id = "$$ID-hash-bool"
        metadata = _create_test_widget_metadata(
            widget_id,
            value_type="bool_value",
            deserializer=lambda x: x if x is not None else False,
            serializer=lambda x: bool(x),
        )
        self.query_params.set_initial_query_params("")

        self.session_state.register_widget(metadata, user_key="flag")
        self.session_state._compact_state()
        self.query_params.set_with_no_forward_msg("flag", "true")
        self.session_state._new_session_state["flag"] = True
        self.clear_queue()

        self.session_state.register_widget(metadata, user_key="flag")

        assert self._page_info_msg_count() == 0

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_programmatic_string_array_coercion_matches_url(
        self, mock_ctx: MagicMock
    ) -> None:
        widget_id = "$$ID-hash-arr"
        metadata = _create_test_widget_metadata(
            widget_id,
            value_type="string_array_value",
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: list(x),
        )
        self.query_params.set_initial_query_params("")

        self.session_state.register_widget(metadata, user_key="arr")
        self.session_state._compact_state()
        self.query_params.set_with_no_forward_msg("arr", ["a", "b"])
        self.session_state._new_session_state["arr"] = ["a", "b"]
        self.clear_queue()

        self.session_state.register_widget(metadata, user_key="arr")

        assert self._page_info_msg_count() == 0

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_initial_load_preseeding_does_not_sync_url(
        self, mock_ctx: MagicMock
    ) -> None:
        """Session state pre-seeded before first register must not push to URL.

        The widget_id is absent from _old_state (never compacted), so
        the programmatic-sync branch must not fire on first render.
        """
        widget_id = "$$ID-hash-my_widget"
        metadata = _create_test_widget_metadata(widget_id)
        self.query_params.set_initial_query_params("")

        self.session_state._new_session_state["my_widget"] = "preseed_value"
        self.session_state.register_widget(metadata, user_key="my_widget")

        assert "my_widget" not in self.query_params._query_params
        assert self._page_info_msg_count() == 0

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_url_seeded_initial_load_does_not_trigger_programmatic_sync(
        self, mock_ctx: MagicMock
    ) -> None:
        """URL-seeded initial load must not emit a redundant page_info_changed.

        _seed_widget_from_url writes the URL value into _new_session_state,
        so the not url_value_seeded guard in Branch 1b is the only protection.
        """
        widget_id = "$$ID-hash-my_widget"
        metadata = _create_test_widget_metadata(widget_id)
        self.query_params.set_initial_query_params("my_widget=url_value")
        self.clear_queue()

        with patch.object(self.query_params, "set_corrected_value") as mock_set:
            self.session_state.register_widget(metadata, user_key="my_widget")
            mock_set.assert_not_called()

        assert self._page_info_msg_count() == 0


class RegisterWidgetUnbindTest(DeltaGeneratorTestCase):
    """Tests for register_widget cleaning up stale bindings when bind is removed."""

    def setUp(self) -> None:
        super().setUp()
        self.session_state = SessionState()
        self.query_params = self.session_state.query_params

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_register_widget_unbinds_when_bind_removed(
        self, mock_ctx: MagicMock
    ) -> None:
        """Test that re-registering a widget without bind clears the stale binding."""
        widget_id = "$$ID-hash-my_widget"

        # Simulate first run with bind="query-params"
        bound_metadata = _create_test_widget_metadata(widget_id)
        self.session_state.register_widget(bound_metadata, user_key="my_widget")

        self.query_params.set_with_no_forward_msg("my_widget", "42")
        assert self.query_params.is_bound("my_widget")

        # Simulate second run with bind=None (developer removed bind)
        unbound_metadata = WidgetMetadata(
            id=widget_id,
            deserializer=lambda x: x if x is not None else "default",
            serializer=lambda x: x,
            value_type="string_value",
            bind=None,
        )
        self.session_state.register_widget(unbound_metadata, user_key="my_widget")

        assert not self.query_params.is_bound("my_widget")
        assert "my_widget" not in self.query_params._query_params

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_register_widget_without_bind_is_noop_when_never_bound(
        self, mock_ctx: MagicMock
    ) -> None:
        """Test that registering a widget that was never bound does nothing extra."""
        widget_id = "$$ID-hash-plain"
        metadata = WidgetMetadata(
            id=widget_id,
            deserializer=lambda x: x if x is not None else "default",
            serializer=lambda x: x,
            value_type="string_value",
            bind=None,
        )

        self.session_state.register_widget(metadata, user_key="plain")

        assert not self.query_params.is_bound("plain")
        assert len(self.query_params._bindings_by_widget) == 0


class RemoveStaleWidgetsPreservationTest(DeltaGeneratorTestCase):
    """Tests for preserving bound values during stale-widget cleanup."""

    def setUp(self) -> None:
        super().setUp()
        self.session_state = SessionState()
        self.query_params = self.session_state.query_params

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_preserves_bound_widget_value_when_metadata_and_binding_are_gone(
        self, mock_ctx: MagicMock
    ) -> None:
        """Preserve stale bound keyed values in realistic MPA cleanup order."""
        widget_id = "$$ID-hash-my_widget"
        metadata = _create_test_widget_metadata(widget_id)

        # Run 1 on source page: bind and set a non-default value.
        self.session_state.register_widget(metadata, user_key="my_widget")
        self.session_state._new_widget_state.set_from_value(widget_id, "custom_value")

        # Compaction stores under widget_id in _old_state and clears _new_widget_state.
        self.session_state._compact_state()
        assert widget_id in self.session_state._old_state
        assert "my_widget" not in self.session_state._old_state
        # On page transitions, current-run metadata may not contain stale widgets.
        self.session_state._new_widget_state.widget_metadata.clear()
        assert widget_id not in self.session_state._new_widget_state.widget_metadata

        # MPA filtering unbinds stale page widgets before stale cleanup runs.
        self.query_params.unbind_widget(widget_id)
        assert self.query_params.get_binding_for_widget(widget_id) is None

        # Cleanup should still preserve value under user key.
        self.session_state._remove_stale_widgets(set())
        assert widget_id not in self.session_state._old_state
        assert self.session_state._old_state["my_widget"] == "custom_value"

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_does_not_preserve_unbound_widget_value(self, mock_ctx: MagicMock) -> None:
        """Unbound stale keyed widgets should not preserve user-key value."""
        widget_id = "$$ID-hash-my_widget"
        metadata = WidgetMetadata(
            id=widget_id,
            deserializer=lambda x: x if x is not None else "default",
            serializer=lambda x: x,
            value_type="string_value",
            bind=None,
        )

        self.session_state.register_widget(metadata, user_key="my_widget")
        self.session_state._new_widget_state.set_from_value(widget_id, "custom_value")
        self.session_state._compact_state()
        self.session_state._remove_stale_widgets(set())

        assert widget_id not in self.session_state._old_state
        assert "my_widget" not in self.session_state._old_state

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_preserves_current_value_from_new_widget_state(
        self, mock_ctx: MagicMock
    ) -> None:
        """When _old_state has a stale value but _new_widget_state has the current
        value (from user interaction after compaction), preservation should capture
        the more recent _new_widget_state value, not the stale _old_state value."""
        widget_id = "$$ID-hash-my_widget"
        metadata = _create_test_widget_metadata(widget_id)

        # Run 1: register with default.
        self.session_state.register_widget(metadata, user_key="my_widget")

        # Compact (stores default in _old_state).
        self.session_state._compact_state()
        assert self.session_state._old_state[widget_id] == "default"

        # User interaction updates _new_widget_state (simulates set_widgets_from_proto).
        self.session_state._new_widget_state.set_from_value(widget_id, "user_value")
        self.session_state._set_widget_metadata(metadata)

        # Stale cleanup (MPA page change) — _old_state has "default" but
        # _new_widget_state has "user_value". Preservation should capture
        # "user_value".
        self.session_state._remove_stale_widgets(set())

        assert widget_id not in self.session_state._old_state
        assert self.session_state._old_state["my_widget"] == "user_value"

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_prunes_unmapped_bound_widget_ids(self, mock_ctx: MagicMock) -> None:
        """Stale bound-intent IDs without a key mapping are pruned."""
        kept_widget_id = "$$ID-hash-kept"
        stale_widget_id = "$$ID-hash-stale"
        self.session_state._set_key_widget_mapping(kept_widget_id, "kept")
        self.session_state._query_param_bound_widget_ids.update(
            {kept_widget_id, stale_widget_id}
        )

        self.session_state._remove_stale_widgets(set())

        assert self.session_state._query_param_bound_widget_ids == {kept_widget_id}


class RegisterWidgetUrlSyncTest(DeltaGeneratorTestCase):
    """Tests for URL sync in register_widget for bound widgets."""

    def setUp(self) -> None:
        super().setUp()
        self.session_state = SessionState()
        self.query_params = self.session_state.query_params

    def _setup_remount_state(self, value: str = "custom_value") -> WidgetMetadata:
        """Create remount state where value persists but URL param is missing."""
        self.session_state._old_state["my_widget"] = value
        self.session_state._set_key_widget_mapping("$$ID-hash-my_widget", "my_widget")
        return _create_test_widget_metadata("$$ID-hash-my_widget")

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_syncs_persisted_value_to_url_when_param_missing(
        self, mock_ctx: MagicMock
    ) -> None:
        """Remount with persisted non-default value restores missing URL param."""
        metadata = self._setup_remount_state("custom_value")
        self.session_state.register_widget(metadata, user_key="my_widget")

        assert self.query_params._query_params["my_widget"] == "custom_value"

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_skips_url_sync_when_param_already_present(
        self, mock_ctx: MagicMock
    ) -> None:
        """Skip redundant URL writes when param already exists."""
        self.query_params.set_with_no_forward_msg("my_widget", "custom_value")
        metadata = self._setup_remount_state("custom_value")

        with patch.object(
            self.query_params, "set_corrected_value"
        ) as mock_set_corrected:
            self.session_state.register_widget(metadata, user_key="my_widget")
            mock_set_corrected.assert_not_called()

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_skips_url_sync_for_default_value(self, mock_ctx: MagicMock) -> None:
        """Default value should remain collapsed from URL."""
        metadata = self._setup_remount_state("default")
        self.session_state.register_widget(metadata, user_key="my_widget")

        assert "my_widget" not in self.query_params._query_params

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_removes_stale_param_when_value_is_default(
        self, mock_ctx: MagicMock
    ) -> None:
        """Stale URL param for a default-valued widget is cleaned up.

        The backend's _query_params is not updated on same-page reruns, so it
        can hold entries the frontend already cleared.  register_widget must
        remove these to prevent _send_query_param_msg from re-broadcasting
        stale params when another widget's sync fires.
        """
        self.query_params.set_with_no_forward_msg("my_widget", "old_non_default")
        metadata = self._setup_remount_state("default")
        self.session_state.register_widget(metadata, user_key="my_widget")

        assert "my_widget" not in self.query_params._query_params

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_syncs_url_when_session_state_set(self, mock_ctx: MagicMock) -> None:
        """Programmatic st.session_state set this run syncs to URL."""
        metadata = self._setup_remount_state("old_value")
        self.session_state._new_session_state["my_widget"] = "programmatic_value"

        with patch.object(
            self.query_params, "set_corrected_value"
        ) as mock_set_corrected:
            self.session_state.register_widget(metadata, user_key="my_widget")
            mock_set_corrected.assert_called_once_with(
                "my_widget", "programmatic_value", "string_value"
            )

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_skips_url_sync_for_compacted_programmatic_set(
        self, mock_ctx: MagicMock
    ) -> None:
        """Value from a previous programmatic set (compacted under widget ID only)
        should not sync to URL.  Only values preserved under user keys by
        _remove_stale_widgets trigger URL restore."""
        widget_id = "$$ID-hash-my_widget"
        self.session_state._old_state[widget_id] = "programmatic_value"
        self.session_state._set_key_widget_mapping(widget_id, "my_widget")
        metadata = _create_test_widget_metadata(widget_id)

        with patch.object(
            self.query_params, "set_corrected_value"
        ) as mock_set_corrected:
            self.session_state.register_widget(metadata, user_key="my_widget")
            mock_set_corrected.assert_not_called()

        assert "my_widget" not in self.query_params._query_params


class RegisterWidgetValueChangedTest(DeltaGeneratorTestCase):
    """Tests for widget_value_changed when bound values are restored."""

    def setUp(self) -> None:
        super().setUp()
        self.session_state = SessionState()
        self.query_params = self.session_state.query_params

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_value_changed_true_when_bound_value_restored(
        self, mock_ctx: MagicMock
    ) -> None:
        """When a preserved bound value is restored to URL, value_changed
        should be True so the frontend proto carries the correct value."""
        self.session_state._old_state["my_widget"] = "custom_value"
        self.session_state._set_key_widget_mapping("$$ID-hash-my_widget", "my_widget")
        metadata = _create_test_widget_metadata("$$ID-hash-my_widget")

        result = self.session_state.register_widget(metadata, user_key="my_widget")

        assert result.value == "custom_value"
        assert result.value_changed is True

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_value_changed_false_when_no_restore_needed(
        self, mock_ctx: MagicMock
    ) -> None:
        """On normal same-page rerun with param already present, value_changed
        should be False (no restore needed)."""
        self.session_state._old_state["my_widget"] = "custom_value"
        self.session_state._set_key_widget_mapping("$$ID-hash-my_widget", "my_widget")
        self.query_params.set_with_no_forward_msg("my_widget", "custom_value")
        metadata = _create_test_widget_metadata("$$ID-hash-my_widget")

        result = self.session_state.register_widget(metadata, user_key="my_widget")

        assert result.value == "custom_value"
        assert result.value_changed is False


class ConditionalRemountBoundBehaviorTest(DeltaGeneratorTestCase):
    """Tests conditional remount behavior for bound vs unbound widgets."""

    def setUp(self) -> None:
        super().setUp()
        self.session_state = SessionState()
        self.query_params = self.session_state.query_params

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_bound_conditional_remount_restores_value_and_url(
        self, mock_ctx: MagicMock
    ) -> None:
        """Bound remount restores persisted value and re-syncs URL."""
        widget_id = "$$ID-hash-my_widget"
        metadata = _create_test_widget_metadata(widget_id)

        # Initial mount and user-set value.
        self.session_state.register_widget(metadata, user_key="my_widget")
        self.session_state._new_widget_state.set_from_value(widget_id, "custom_value")
        self.query_params.set_with_no_forward_msg("my_widget", "custom_value")

        self.session_state._compact_state()
        self.session_state._remove_stale_widgets(set())

        assert "my_widget" in self.session_state._old_state
        assert "my_widget" not in self.query_params._query_params

        remounted = self.session_state.register_widget(metadata, user_key="my_widget")
        assert remounted.value == "custom_value"
        assert self.query_params._query_params["my_widget"] == "custom_value"

    @patch(
        "streamlit.runtime.state.session_state.get_script_run_ctx",
        return_value=MockScriptRunCtx(),
    )
    def test_unbound_conditional_remount_still_resets(
        self, mock_ctx: MagicMock
    ) -> None:
        """Unbound remount behavior remains reset to default."""
        widget_id = "$$ID-hash-my_widget"
        metadata = WidgetMetadata(
            id=widget_id,
            deserializer=lambda x: x if x is not None else "default",
            serializer=lambda x: x,
            value_type="string_value",
            bind=None,
        )

        self.session_state.register_widget(metadata, user_key="my_widget")
        self.session_state._new_widget_state.set_from_value(widget_id, "custom_value")

        self.session_state._compact_state()
        self.session_state._remove_stale_widgets(set())

        assert "my_widget" not in self.session_state._old_state

        remounted = self.session_state.register_widget(metadata, user_key="my_widget")
        assert remounted.value == "default"
        assert "my_widget" not in self.query_params._query_params


class SeedWidgetFromUrlTest(DeltaGeneratorTestCase):
    """Tests for _seed_widget_from_url method."""

    def setUp(self) -> None:
        super().setUp()
        self.session_state = SessionState()
        self.query_params = self.session_state.query_params

    def test_seed_widget_parses_bool_value(self) -> None:
        """Test that boolean URL values are parsed correctly."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="bool_value",
            deserializer=lambda x: x if x is not None else False,
        )

        seeded = self.session_state._seed_widget_from_url(
            metadata, "my_checkbox", "widget_1", "true"
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] is True

    def test_seed_widget_parses_int_value(self) -> None:
        """Test that integer URL values are parsed correctly."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="int_value",
            deserializer=lambda x: x if x is not None else 0,
        )

        seeded = self.session_state._seed_widget_from_url(
            metadata, "my_number", "widget_1", "42"
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] == 42

    def test_seed_widget_clears_invalid_value(self) -> None:
        """Test that invalid URL values are cleared."""
        self.query_params._query_params["my_bool"] = "invalid"

        def bool_deserializer(x):
            if x is None:
                return False
            if isinstance(x, bool):
                return x
            raise ValueError("not a bool")

        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="bool_value",
            deserializer=bool_deserializer,
        )

        seeded = self.session_state._seed_widget_from_url(
            metadata, "my_bool", "widget_1", "invalid"
        )

        assert seeded is False
        assert "my_bool" not in self.query_params._query_params

    def test_seed_widget_clears_invalid_value_that_falls_back_to_default(self) -> None:
        """Test that invalid URL values are cleared when deserializer falls back."""
        self.query_params._query_params["color"] = "invalid"

        def color_deserializer(value):
            default = "#000000"
            if value is None:
                return default
            return value if value.startswith("#") else default

        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_value",
            deserializer=color_deserializer,
            serializer=lambda x: x,
        )

        seeded = self.session_state._seed_widget_from_url(
            metadata, "color", "widget_1", "invalid"
        )

        assert seeded is False
        assert "color" not in self.query_params._query_params

    def test_seed_widget_clears_valid_value_that_equals_default(self) -> None:
        """Test that valid URL values matching the default are cleared from the URL."""
        self.query_params._query_params["my_bool"] = "false"

        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="bool_value",
            deserializer=lambda x: x if x is not None else False,
            serializer=bool,
        )

        seeded = self.session_state._seed_widget_from_url(
            metadata, "my_bool", "widget_1", "false"
        )

        assert seeded is False
        assert "my_bool" not in self.query_params._query_params

    def test_seed_widget_clears_when_all_options_filtered(self) -> None:
        """Test that URL is cleared when all options are invalid."""
        self.query_params._query_params["tags"] = ["InvalidA", "InvalidB"]

        def filter_deserializer(values):
            if values is None:
                return []
            valid = {"Apple", "Banana", "Cherry"}
            if isinstance(values, list):
                return [v for v in values if v in valid]
            return [values] if values in valid else []

        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            deserializer=filter_deserializer,
            serializer=lambda x: x,
        )

        seeded = self.session_state._seed_widget_from_url(
            metadata, "tags", "widget_1", ["InvalidA", "InvalidB"]
        )

        assert seeded is False
        assert "tags" not in self.query_params._query_params

    def test_seed_widget_with_empty_url_and_clearable_true(self) -> None:
        """Test that empty URL values matching the default are cleared, even for clearable widgets."""
        self.query_params._query_params["tags"] = ""

        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            deserializer=lambda x: x if x is not None else [],
            clearable=True,
        )

        # Empty string from URL (e.g., ?tags=) — default is also [], so param is cleared
        seeded = self.session_state._seed_widget_from_url(
            metadata, "tags", "widget_1", ""
        )

        assert seeded is False
        assert "tags" not in self.query_params._query_params

    def test_seed_widget_with_empty_url_and_clearable_true_non_empty_default(
        self,
    ) -> None:
        """Test that empty URL seeds widget when clearable=True and default is non-empty."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            deserializer=lambda x: x if x is not None else ["Python"],
            clearable=True,
        )

        # Empty string from URL (e.g., ?tags=) — default is ["Python"], so [] differs
        seeded = self.session_state._seed_widget_from_url(
            metadata, "tags", "widget_1", ""
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] == []

    def test_seed_widget_with_empty_url_and_clearable_false(self) -> None:
        """Test that empty URL values are ignored and cleared when clearable=False."""
        # First, set the URL param so we can verify it gets cleared
        self.query_params._query_params["toggle"] = ""

        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="bool_value",
            deserializer=lambda x: x if x is not None else False,
            clearable=False,
        )

        # Empty string from URL (e.g., ?toggle=)
        seeded = self.session_state._seed_widget_from_url(
            metadata, "toggle", "widget_1", ""
        )

        assert seeded is False
        assert "widget_1" not in self.session_state._new_widget_state
        # URL param should be cleared (not left as stale ?toggle=)
        assert "toggle" not in self.query_params._query_params

    def test_seed_widget_with_empty_list_and_clearable_true(self) -> None:
        """Test that empty list [''] matching the default is cleared, even for clearable widgets."""
        self.query_params._query_params["items"] = [""]

        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="int_array_value",
            deserializer=lambda x: x if x is not None else [],
            clearable=True,
        )

        # Empty list from URL parsing (e.g., ?items=) — default is also [], so param is cleared
        seeded = self.session_state._seed_widget_from_url(
            metadata, "items", "widget_1", [""]
        )

        assert seeded is False
        assert "items" not in self.query_params._query_params

    def test_seed_widget_with_empty_list_and_clearable_false(self) -> None:
        """Test that empty list [''] is ignored and cleared when clearable=False."""
        # First, set the URL param so we can verify it gets cleared
        self.query_params._query_params["range"] = [""]

        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="double_array_value",
            deserializer=lambda x: x if x is not None else [0.0, 100.0],
            clearable=False,
        )

        # Empty list from URL parsing (e.g., ?range=)
        seeded = self.session_state._seed_widget_from_url(
            metadata, "range", "widget_1", [""]
        )

        assert seeded is False
        assert "widget_1" not in self.session_state._new_widget_state
        # URL param should be cleared (not left as stale ?range=)
        assert "range" not in self.query_params._query_params

    def test_formatted_options_rejects_invalid_option(self) -> None:
        """Test that invalid option is rejected when formatted_options is set."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            formatted_options=["Small", "Medium", "Large"],
        )
        self.query_params._query_params["size"] = "Random"

        seeded = self.session_state._seed_widget_from_url(
            metadata, "size", "widget_1", "Random"
        )

        assert seeded is False
        assert "widget_1" not in self.session_state._new_widget_state
        assert "size" not in self.query_params._query_params

    def test_formatted_options_accepts_valid_option(self) -> None:
        """Test that valid option is accepted when formatted_options is set."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            formatted_options=["Small", "Medium", "Large"],
        )
        self.query_params._query_params["size"] = "Medium"

        seeded = self.session_state._seed_widget_from_url(
            metadata, "size", "widget_1", "Medium"
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] == "Medium"

    def test_no_formatted_options_accepts_any_string(self) -> None:
        """Test that any string is accepted when formatted_options is None.

        This is the behavior for widgets like text_input, or selectbox
        with accept_new_options=True.
        """
        metadata = _create_test_widget_metadata(
            "widget_1",
            formatted_options=None,
        )
        self.query_params._query_params["text"] = "anything"

        seeded = self.session_state._seed_widget_from_url(
            metadata, "text", "widget_1", "anything"
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] == "anything"

    def test_no_formatted_options_accepts_novel_array_values(self) -> None:
        """Test that novel values pass through for string_array_value when
        formatted_options is None (e.g. multiselect with accept_new_options)."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            formatted_options=None,
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
        )
        self.query_params._query_params["tags"] = ["Red", "NewTag", "AnotherNew"]

        seeded = self.session_state._seed_widget_from_url(
            metadata, "tags", "widget_1", ["Red", "NewTag", "AnotherNew"]
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] == [
            "Red",
            "NewTag",
            "AnotherNew",
        ]

    def test_no_formatted_options_still_deduplicates_array_values(self) -> None:
        """Test that deduplication applies even when formatted_options is None."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            formatted_options=None,
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
        )
        self.query_params._query_params["tags"] = ["NewTag", "Red", "NewTag"]

        seeded = self.session_state._seed_widget_from_url(
            metadata, "tags", "widget_1", ["NewTag", "Red", "NewTag"]
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] == ["NewTag", "Red"]

    def test_formatted_options_filters_invalid_array_values(self) -> None:
        """Test that invalid values are filtered from string_array_value URL params."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            formatted_options=["Red", "Green", "Blue"],
            # Deserializer returns the list as-is (valid values pass through)
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
        )
        self.query_params._query_params["colors"] = ["Red", "Invalid", "Blue"]

        seeded = self.session_state._seed_widget_from_url(
            metadata, "colors", "widget_1", ["Red", "Invalid", "Blue"]
        )

        assert seeded is True
        # Only valid values should be stored
        assert self.session_state._new_widget_state["widget_1"] == ["Red", "Blue"]

    def test_formatted_options_clears_all_invalid_array_values(self) -> None:
        """Test that all-invalid array URL values clear the URL param."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            formatted_options=["Red", "Green", "Blue"],
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
        )
        self.query_params._query_params["colors"] = ["Invalid1", "Invalid2"]

        seeded = self.session_state._seed_widget_from_url(
            metadata, "colors", "widget_1", ["Invalid1", "Invalid2"]
        )

        assert seeded is False
        assert "widget_1" not in self.session_state._new_widget_state
        assert "colors" not in self.query_params._query_params

    def test_formatted_options_accepts_all_valid_array_values(self) -> None:
        """Test that all-valid array URL values pass through without filtering."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            formatted_options=["Red", "Green", "Blue"],
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
        )
        self.query_params._query_params["colors"] = ["Red", "Blue"]

        seeded = self.session_state._seed_widget_from_url(
            metadata, "colors", "widget_1", ["Red", "Blue"]
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] == ["Red", "Blue"]

    def test_max_array_length_truncates_excess_values(self) -> None:
        """Test that arrays exceeding max_array_length are truncated."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
            max_array_length=2,
        )
        self.query_params._query_params["colors"] = ["Red", "Green", "Blue", "Yellow"]

        seeded = self.session_state._seed_widget_from_url(
            metadata, "colors", "widget_1", ["Red", "Green", "Blue", "Yellow"]
        )

        assert seeded is True
        # Only the first 2 values should be kept
        assert self.session_state._new_widget_state["widget_1"] == ["Red", "Green"]

    def test_max_array_length_no_truncation_when_within_limit(self) -> None:
        """Test that arrays within max_array_length are not truncated."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
            max_array_length=3,
        )
        self.query_params._query_params["colors"] = ["Red", "Blue"]

        seeded = self.session_state._seed_widget_from_url(
            metadata, "colors", "widget_1", ["Red", "Blue"]
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] == ["Red", "Blue"]

    def test_max_array_length_with_filtering_and_truncation(self) -> None:
        """Test that filtering and truncation compose: filter first, then truncate."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            formatted_options=["Red", "Green", "Blue", "Yellow"],
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
            max_array_length=2,
        )
        # 5 URL values: 2 invalid + 3 valid = after filtering 3, truncate to 2
        self.query_params._query_params["colors"] = [
            "Red",
            "Invalid1",
            "Green",
            "Invalid2",
            "Blue",
        ]

        seeded = self.session_state._seed_widget_from_url(
            metadata,
            "colors",
            "widget_1",
            ["Red", "Invalid1", "Green", "Invalid2", "Blue"],
        )

        assert seeded is True
        # After filtering: ["Red", "Green", "Blue"], then truncated to 2
        assert self.session_state._new_widget_state["widget_1"] == ["Red", "Green"]

    def test_max_array_length_truncation_clears_when_equals_default(self) -> None:
        """Test that truncated value matching default clears the URL param."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            # Default is ["Red"] — truncation to 1 should match default
            deserializer=lambda x: x if x is not None else ["Red"],
            serializer=lambda x: x,
            max_array_length=1,
        )
        self.query_params._query_params["colors"] = ["Red", "Blue"]

        seeded = self.session_state._seed_widget_from_url(
            metadata, "colors", "widget_1", ["Red", "Blue"]
        )

        # Truncated to ["Red"] which equals default — should clear
        assert seeded is False
        assert "widget_1" not in self.session_state._new_widget_state
        assert "colors" not in self.query_params._query_params

    def test_duplicate_array_values_deduplicated(self) -> None:
        """Test that duplicate URL values are deduplicated, preserving order."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            formatted_options=["Red", "Green", "Blue"],
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
        )
        self.query_params._query_params["colors"] = ["Red", "Blue", "Red"]

        seeded = self.session_state._seed_widget_from_url(
            metadata, "colors", "widget_1", ["Red", "Blue", "Red"]
        )

        assert seeded is True
        # Duplicate "Red" should be removed, keeping first occurrence
        assert self.session_state._new_widget_state["widget_1"] == ["Red", "Blue"]

    def test_duplicate_array_values_with_filtering_and_truncation(self) -> None:
        """Test that dedup composes with filtering and truncation."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            formatted_options=["Red", "Green", "Blue"],
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
            max_array_length=2,
        )
        # After filter: ["Red", "Green", "Red", "Blue"] (Invalid removed)
        # After dedup: ["Red", "Green", "Blue"]
        # After truncate: ["Red", "Green"]
        self.query_params._query_params["colors"] = [
            "Red",
            "Invalid",
            "Green",
            "Red",
            "Blue",
        ]

        seeded = self.session_state._seed_widget_from_url(
            metadata,
            "colors",
            "widget_1",
            ["Red", "Invalid", "Green", "Red", "Blue"],
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] == ["Red", "Green"]

    def test_all_duplicate_values_collapse_to_single(self) -> None:
        """Test that all-duplicate URL values collapse to a single value."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="string_array_value",
            formatted_options=["Red", "Green", "Blue"],
            deserializer=lambda x: x if x is not None else [],
            serializer=lambda x: x,
        )
        self.query_params._query_params["colors"] = ["Red", "Red", "Red"]

        seeded = self.session_state._seed_widget_from_url(
            metadata, "colors", "widget_1", ["Red", "Red", "Red"]
        )

        assert seeded is True
        assert self.session_state._new_widget_state["widget_1"] == ["Red"]


class AutoCorrectUrlTest(DeltaGeneratorTestCase):
    """Tests for _auto_correct_url_if_needed method."""

    def setUp(self) -> None:
        super().setUp()
        self.session_state = SessionState()
        self.query_params = self.session_state.query_params

    def test_no_correction_when_values_match(self) -> None:
        """Test that no correction happens when serialized == parsed."""
        metadata = _create_test_widget_metadata("widget_1", serializer=lambda x: x)

        assert "my_key" not in self.query_params._query_params

        self.session_state._auto_correct_url_if_needed(
            metadata, "my_key", "same_value", "same_value"
        )

        assert "my_key" not in self.query_params._query_params

    def test_correction_updates_url_for_clamped_value(self) -> None:
        """Test that URL is corrected when value is clamped."""
        metadata = _create_test_widget_metadata(
            "widget_1",
            value_type="int_value",
            serializer=lambda x: x,
        )

        self.session_state._auto_correct_url_if_needed(
            metadata,
            "my_slider",
            100,
            50,
        )

        assert self.query_params._query_params["my_slider"] == "50"


class SanitizeUrlArrayTest(unittest.TestCase):
    """Tests for the _sanitize_url_array helper function."""

    def test_deduplicates_by_default(self):
        """By default, duplicate values are removed."""

        result = _sanitize_url_array(
            ["Red", "Blue", "Red"],
            valid_options=None,
            max_length=None,
        )
        assert result == ["Red", "Blue"]

    def test_allows_duplicates_when_enabled(self):
        """When allow_duplicates=True, duplicate values are preserved."""

        result = _sanitize_url_array(
            ["Red", "Red"],
            valid_options=None,
            max_length=None,
            allow_duplicates=True,
        )
        # No changes needed, so returns None
        assert result is None

    def test_allows_duplicates_preserves_order(self):
        """When allow_duplicates=True, order and duplicates are preserved."""

        result = _sanitize_url_array(
            ["Blue", "Red", "Blue"],
            valid_options=None,
            max_length=None,
            allow_duplicates=True,
        )
        assert result is None

    def test_filters_invalid_options(self):
        """Invalid options are filtered out."""

        result = _sanitize_url_array(
            ["Red", "Invalid", "Blue"],
            valid_options=["Red", "Blue", "Green"],
            max_length=None,
        )
        assert result == ["Red", "Blue"]

    def test_truncates_to_max_length(self):
        """Arrays exceeding max_length are truncated."""

        result = _sanitize_url_array(
            ["Red", "Blue", "Green"],
            valid_options=None,
            max_length=2,
        )
        assert result == ["Red", "Blue"]

    def test_returns_none_when_no_changes(self):
        """Returns None when no sanitization is needed."""

        result = _sanitize_url_array(
            ["Red", "Blue"],
            valid_options=["Red", "Blue", "Green"],
            max_length=None,
        )
        assert result is None

    def test_combined_filter_dedup_truncate(self):
        """All sanitization steps work together."""

        result = _sanitize_url_array(
            ["Red", "Invalid", "Blue", "Red", "Green"],
            valid_options=["Red", "Blue", "Green"],
            max_length=2,
        )
        assert result == ["Red", "Blue"]
