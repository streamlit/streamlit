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

"""Widget values in a snapshot are what a request can send back."""

from __future__ import annotations

import datetime as dt
import json
from dataclasses import replace
from typing import Any
from unittest.mock import patch

import numpy as np

import streamlit as st
from streamlit.elements.widgets.chat import ChatInputValue
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.runtime.agent.snapshot import _public_key
from streamlit.runtime.agent.widget_values import _authored_options
from streamlit.runtime.state.session_state import Serialized
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from tests.streamlit.runtime.agent.snapshot_test_case import (
    SnapshotCase,
    _by_type,
    _describe,
    _one_keyed,
    _walk,
)


def _matches_schema(value: Any, schema: dict[str, Any]) -> bool:
    """Whether ``value`` is null or has the JSON type ``schema`` names."""
    if value is None:
        return True
    expected = schema.get("type")
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "array" and isinstance(value, list):
        item_schema = schema.get("items")
        if not isinstance(item_schema, dict):
            return True
        return all(_matches_schema(item, item_schema) for item in value)
    return False


class WidgetValueTest(SnapshotCase):
    """A reported value is the wire form of the widget's stored value."""

    def test_reported_values_are_what_a_request_can_send(self) -> None:
        """A closed option set reports labels, including a null option."""
        st.selectbox(
            "Month",
            [1, 12],
            format_func=lambda month: "January" if month == 1 else "December",
            key="month",
        )
        st.selectbox(
            "Maybe",
            [None, "a"],
            index=0,
            format_func=lambda option: "Nothing" if option is None else str(option),
            key="maybe",
        )
        st.multiselect(
            "Months",
            [None, 1],
            default=[None, 1],
            format_func=lambda option: "Nothing" if option is None else "January",
            key="months",
        )
        st.session_state.city = "Berlin"
        st.selectbox(
            "City",
            ["Paris"],
            format_func=str.upper,
            accept_new_options=True,
            key="city",
        )

        document = self._build().document
        month = _one_keyed(document, "selectbox", "month")
        assert month["props"]["options"] == ["January", "December"]
        assert month["value"] == "January"
        assert _one_keyed(document, "selectbox", "maybe")["value"] is None
        assert _one_keyed(document, "multiselect", "months")["value"] == [
            "Nothing",
            "January",
        ]
        city = _one_keyed(document, "selectbox", "city")
        assert city["value"] == "Berlin"
        assert city["props"]["options"] == ["PARIS"]

    def test_a_sequence_option_is_reported_as_its_label(self) -> None:
        """A tuple or list option is the label string, not the sequence."""
        st.pills(
            "Pair",
            [("a", "b")],
            default=[("a", "b")],
            format_func=lambda option: option[1],
            key="pair",
        )
        st.select_slider(
            "Country",
            options=[["us", "United States"], ["ca", "Canada"]],
            format_func=lambda option: option[1],
            key="country",
        )

        document = self._build().document
        assert _one_keyed(document, "pills", "pair")["value"] == "b"
        assert _one_keyed(document, "select_slider", "country")["value"] == (
            "United States"
        )

    def test_typed_text_and_unusual_options_stay_requestable(self) -> None:
        """Typed text, sets, and odd option types still report a wire value."""
        st.session_state.matched_city = "paris"
        st.selectbox(
            "Matched",
            ["Paris"],
            format_func=str.upper,
            key="matched_city",
        )
        st.session_state.typed_city = "paris"
        st.selectbox(
            "Typed",
            ["Paris"],
            format_func=str.upper,
            accept_new_options=True,
            key="typed_city",
        )
        st.session_state.raw_city = "paris"
        st.selectbox(
            "Raw",
            ["paris"],
            format_func=str.upper,
            accept_new_options=True,
            key="raw_city",
        )
        st.session_state.mixed = ["paris", "Berlin"]
        st.multiselect(
            "Mixed",
            ["Paris", "Berlin"],
            format_func=str.upper,
            accept_new_options=True,
            key="mixed",
        )
        st.session_state.as_set = {"Berlin"}
        st.multiselect("Set", ["Paris", "Berlin"], key="as_set")

        class _Ambiguous:
            """Equality with anything else returns a value that cannot be bool()."""

            __hash__ = None

            def __eq__(self, other: object) -> Any:
                if other is self:
                    return True
                return _NotABool()

        class _NotABool:
            def __bool__(self) -> bool:
                raise ValueError("ambiguous")

        st.selectbox("Comparable", ["a", _Ambiguous()], index=0, key="comparable")

        numpy_city = np.str_("Paris")
        st.session_state.numpy_city = numpy_city
        st.selectbox(
            "Numpy",
            [numpy_city],
            format_func=str.upper,
            accept_new_options=True,
            key="numpy_city",
        )
        st.selectbox(
            "Array",
            np.array(["alpha", "beta"]),
            format_func=str.upper,
            accept_new_options=True,
            key="numpy_array",
        )
        st.selectbox(
            "Buffer",
            ["a", memoryview(bytearray(b"b"))],
            accept_new_options=True,
            key="buffer",
        )

        class _ScalarEqual:
            """Equality with the typed text returns a NumPy scalar bool."""

            __hash__ = None

            def __eq__(self, other: object) -> Any:
                return np.bool_(other == "scalar")

        st.session_state.scalar_city = "scalar"
        st.selectbox(
            "Scalar",
            [_ScalarEqual()],
            format_func=lambda _option: "SCALAR",
            accept_new_options=True,
            key="scalar_city",
        )
        typed = self._build().document
        assert _one_keyed(typed, "selectbox", "matched_city")["value"] == "PARIS"
        assert _one_keyed(typed, "selectbox", "typed_city")["value"] == "paris"
        assert _one_keyed(typed, "selectbox", "comparable")["value"] == "a"
        assert _one_keyed(typed, "selectbox", "numpy_city")["value"] == "PARIS"
        assert _one_keyed(typed, "selectbox", "numpy_array")["value"] == "ALPHA"
        assert _one_keyed(typed, "selectbox", "buffer")["value"] == "a"
        assert _one_keyed(typed, "selectbox", "scalar_city")["value"] == "SCALAR"
        assert _one_keyed(typed, "selectbox", "raw_city")["value"] == "PARIS"
        assert _one_keyed(typed, "multiselect", "mixed")["value"] == [
            "paris",
            "BERLIN",
        ]
        assert _one_keyed(typed, "multiselect", "as_set")["value"] == ["Berlin"]

    def test_widget_values_match_their_value_schema(self) -> None:
        """Every reported value is null or the JSON type its schema names."""
        st.checkbox("Check", key="check")
        st.toggle("Toggle", key="toggle")
        st.radio("Choose", ["a", "b"], key="radio")
        st.selectbox("Select", ["a", "b"], key="select")
        st.multiselect("Many", ["a", "b"], default=["a"], key="many")
        st.select_slider("Step", options=["a", "b", "c"], key="step")
        st.select_slider("Span", options=["a", "b", "c"], value=("a", "c"), key="span")
        st.slider("Amount", key="amount")
        st.slider("Range", 0, 100, (20, 80), key="range")
        st.number_input("Whole", value=3, key="whole")
        st.number_input("Fraction", value=1.5, key="fraction")
        st.text_input("Text", value="hello", key="text")
        st.text_area("Area", value="lines", key="area")
        st.date_input("Day", dt.date(2026, 1, 2), key="day")
        st.date_input(
            "Days",
            (dt.date(2026, 1, 1), dt.date(2026, 1, 31)),
            key="days",
        )
        st.time_input("Time", dt.time(9, 30), key="time")
        st.datetime_input("When", dt.datetime(2026, 1, 2, 9, 30), key="when")
        st.color_picker("Color", key="color")
        st.pills("Pills", ["a", "b"], default="a", key="pills")
        st.segmented_control(
            "Segments",
            ["a", "b"],
            selection_mode="multi",
            default=["a"],
            key="segments",
        )
        st.feedback("stars", key="stars")
        st.pagination(10, key="page")
        st.tabs(["A", "B"], on_change="rerun", key="tabs")
        st.expander("Open?", on_change="rerun", key="open")

        document = self._build().document
        mismatches = [
            (node["type"], node.get("key"), node["value"], node["value_schema"])
            for node in _walk(document["tree"])
            if "value" in node
            and isinstance(node.get("value_schema"), dict)
            and not _matches_schema(node["value"], node["value_schema"])
        ]
        assert mismatches == []
        assert _one_keyed(document, "checkbox", "check")["value"] is False
        assert _one_keyed(document, "slider", "amount")["value"] == 0
        assert _one_keyed(document, "slider", "range")["value"] == [20, 80]
        assert _one_keyed(document, "number_input", "whole")["value"] == 3
        assert _one_keyed(document, "number_input", "fraction")["value"] == 1.5
        assert _one_keyed(document, "text_input", "text")["value"] == "hello"
        assert _one_keyed(document, "date_input", "day")["value"] == "2026-01-02"
        assert _one_keyed(document, "date_input", "days")["value"] == [
            "2026-01-01",
            "2026-01-31",
        ]
        assert _one_keyed(document, "time_input", "time")["value"] == "09:30"
        assert _one_keyed(document, "datetime_input", "when")["value"] == (
            "2026-01-02T09:30"
        )
        assert _one_keyed(document, "select_slider", "span")["value"] == ["a", "c"]
        assert _one_keyed(document, "pills", "pills")["value"] == "a"
        assert _one_keyed(document, "segmented_control", "segments")["value"] == ["a"]
        assert _one_keyed(document, "tabs", "tabs")["value"] == "A"
        assert _one_keyed(document, "expander", "open")["value"] is False
        tabs_action = next(
            entry for entry in document["actions"] if entry["key"] == "tabs"
        )
        assert tabs_action["kind"] == "value"
        assert tabs_action["type"] == "tabs"

    def test_a_missing_or_unserializable_value_does_not_raise(self) -> None:
        """No session, a missing key, and a failing serializer still build."""
        st.selectbox("Pick", ["a", "b"], key="pick")
        missing = _describe(
            [0, 2],
            {
                "type": "text_input",
                "key": "$$ID-missing-None",
                "action": "value",
                "value_schema": {"type": "string"},
                "props": {"label": "Name"},
            },
        )

        without_state = self._build(missing, use_session_state=False)
        assert _one_keyed(without_state.document, "selectbox", "pick")["value"] is None

        state = self._session_state()
        element_id = next(
            widget_id
            for widget_id, metadata in state._new_widget_state.widget_metadata.items()
            if _public_key(widget_id) == "pick"
        )

        def _fail(_value: object) -> str:
            raise RuntimeError("serializer failed")

        metadata = state.get_widget_metadata(element_id)
        assert metadata is not None
        state._set_widget_metadata(replace(metadata, serializer=_fail))
        st.selectbox(
            "Num",
            [1, 12],
            format_func=str,
            key="num",
        )
        num_id = next(
            widget_id
            for widget_id in state._new_widget_state.widget_metadata
            if _public_key(widget_id) == "num"
        )
        num_meta = state.get_widget_metadata(num_id)
        assert num_meta is not None
        state._set_widget_metadata(replace(num_meta, serializer=_fail))
        document = self._build(missing).document
        assert _one_keyed(document, "selectbox", "pick")["value"] is None
        assert _one_keyed(document, "selectbox", "num")["value"] is None
        with patch(
            "streamlit.runtime.agent.widget_values.json_encoding.to_json_value",
            side_effect=TypeError("unencodable"),
        ):
            unencoded = self._build().document
        assert _one_keyed(unencoded, "selectbox", "pick")["value"] is None
        named = next(
            node
            for node in _by_type(document, "text_input")
            if node.get("props", {}).get("label") == "Name"
        )
        assert named["value"] is None

    def test_trigger_values_are_the_text_a_request_sends(self) -> None:
        """A fired menu and a chat submission report strings, not protos."""
        st.menu_button(
            "Month",
            [1, 12],
            format_func=lambda month: "January" if month == 1 else "December",
            key="menu",
        )
        st.chat_input("Say", accept_file=True, key="chat")
        self._set_stored("menu", 12)
        self._set_stored(
            "chat", ChatInputValue(text="hello there", _include_files=True)
        )

        st.menu_button("Idle", ["January", "December"], key="idle")
        st.menu_button("Blank", [""], key="blank")
        self._set_stored("blank", "")

        document = self._build().document
        assert _one_keyed(document, "menu_button", "menu")["value"] == "December"
        assert "value" not in _one_keyed(document, "menu_button", "idle")
        assert _one_keyed(document, "menu_button", "blank")["value"] == ""
        chat = _one_keyed(document, "chat_input", "chat")
        assert chat["value"] == "hello there"
        assert "UploadedFile" not in json.dumps(chat)

    def test_a_fired_button_reports_no_value(self) -> None:
        """A trigger without a payload does not report the True it stores."""
        st.button("Go", key="go")
        self._set_stored("go", True)

        button = _one_keyed(self._build().document, "button", "go")
        assert "value" not in button
        assert button["props"]["label"] == "Go"

    def test_reading_a_value_does_not_mutate_what_is_stored(self) -> None:
        """A formatter that edits its argument leaves the stored value unchanged."""

        def label(option: Any) -> str:
            if isinstance(option, dict):
                option["touched"] = True
            return "January"

        st.selectbox("Month", ["January"], format_func=label, key="month")
        stored = {"name": "January"}
        self._set_stored("month", stored)

        document = self._build().document
        assert _one_keyed(document, "selectbox", "month")["value"] == "January"
        assert stored == {"name": "January"}

    def test_serialized_chat_read_keeps_uploaded_files(self) -> None:
        """A still-serialized chat proto is read without removing its upload."""
        st.chat_input("Say", accept_file=True, key="chat")
        rec = UploadedFileRec("file1", "doc.txt", "text/plain", b"abc")
        self.script_run_ctx.uploaded_file_mgr.add_file(
            session_id=self.script_run_ctx.session_id, file=rec
        )

        state = self._session_state()
        element_id = next(
            widget_id
            for widget_id in state._new_widget_state.widget_metadata
            if _public_key(widget_id) == "chat"
        )
        proto = WidgetStateProto()
        proto.id = element_id
        proto.chat_input_value.data = "hello"
        info = proto.chat_input_value.file_uploader_state.uploaded_file_info.add()
        info.file_id = "file1"
        info.file_urls.file_id = "file1"
        state._new_widget_state.set_widget_from_proto(proto)

        document = self._build().document
        assert _one_keyed(document, "chat_input", "chat")["value"] == "hello"
        assert isinstance(state._new_widget_state.states[element_id], Serialized)
        remaining = self.script_run_ctx.uploaded_file_mgr.get_files(
            session_id=self.script_run_ctx.session_id, file_ids=["file1"]
        )
        assert [record.file_id for record in remaining] == ["file1"]

    def test_empty_chat_text_is_still_a_fired_value(self) -> None:
        """A file-only chat submission is an empty string, not an unset trigger."""
        st.chat_input("Say", accept_file=True, key="chat")
        self._set_stored("chat", ChatInputValue(text="", _include_files=True))

        document = self._build().document
        assert _one_keyed(document, "chat_input", "chat")["value"] == ""

    def test_option_widgets_expose_authored_options(self) -> None:
        """Typed-text detection reads the option objects from the serde."""
        st.selectbox("Select", ["a"], key="s")
        st.multiselect("Many", ["a", "b"], key="m")
        st.radio("Choose", ["a"], key="r")
        st.pills("Pills", ["a"], key="p")
        st.menu_button("Menu", ["a"], key="menu")

        state = self._session_state()
        for key, expected in (
            ("s", ["a"]),
            ("m", ["a", "b"]),
            ("r", ["a"]),
            ("p", ["a"]),
            ("menu", ["a"]),
        ):
            element_id = next(
                widget_id
                for widget_id in state._new_widget_state.widget_metadata
                if _public_key(widget_id) == key
            )
            metadata = state.get_widget_metadata(element_id)
            assert metadata is not None
            assert list(_authored_options(metadata.serializer) or []) == expected
