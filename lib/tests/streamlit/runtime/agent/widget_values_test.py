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
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

import streamlit as st
from streamlit.elements.widgets.chat import ChatInputValue
from streamlit.proto.ArrowData_pb2 import ArrowData
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.runtime.agent import widget_values
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
    render_value_widgets,
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

    def test_a_changed_formatter_reports_the_captured_label(self) -> None:
        """A formatter that changes after registration cannot invent a new label."""
        labels = {"a": "Alpha"}

        def label(option: str) -> str:
            return labels.get(option, option)

        st.selectbox("Item", ["a"], format_func=label, key="item")
        labels["a"] = "Changed"

        document = self._build().document
        node = _one_keyed(document, "selectbox", "item")
        assert node["props"]["options"] == ["Alpha"]
        assert node["value"] == "Alpha"

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
        render_value_widgets()

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

    def test_a_required_range_that_holds_both_ends_takes_two_items(self) -> None:
        """Such a range refuses fewer than two dates, and its schema says so.

        One that is still empty holds fewer, and reports that value, which a
        request may send back, so its schema keeps allowing it.
        """
        days = (dt.date(2026, 1, 1), dt.date(2026, 1, 5))
        st.date_input("Trip", days, required=True, key="trip")
        st.date_input("Empty trip", value=[], required=True, key="empty_trip")
        st.date_input("Optional", days, key="optional")

        document = self._build().document

        def schema(key: str) -> dict[str, Any]:
            return _one_keyed(document, "date_input", key)["value_schema"]

        assert schema("trip") == {
            "type": "array",
            "items": {"type": "string", "format": "date"},
            "minItems": 2,
            "maxItems": 2,
        }
        assert _one_keyed(document, "date_input", "empty_trip")["value"] == []
        assert "minItems" not in schema("empty_trip")
        assert "minItems" not in schema("optional")

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


class _Unprintable:
    """A value with no JSON form: even ``str()`` on it raises."""

    def __str__(self) -> str:
        raise RuntimeError("no text form")


class _EqualityRaises:
    """An option whose comparison raises."""

    __hash__ = None  # type: ignore[assignment]

    def __eq__(self, other: object) -> bool:
        raise RuntimeError("cannot compare")


class _ZeroDimTruthRaises:
    """A 0-d comparison result whose truth value raises."""

    ndim = 0

    def __bool__(self) -> bool:
        raise ValueError("no truth value")


class _ReturnsFromEq:
    """An option whose ``==`` returns a fixed object instead of a bool."""

    __hash__ = None  # type: ignore[assignment]

    def __init__(self, result: object) -> None:
        self._result = result

    def __eq__(self, other: object) -> Any:
        return self._result


class _PresencelessPayload:
    """A trigger proto stand-in whose ``data`` field has no presence bit."""

    def __init__(self, data: str) -> None:
        self.data = data

    def HasField(self, name: str) -> bool:
        raise ValueError(f"Field {name} does not have presence.")


def _session_state_holding(value: Any) -> MagicMock:
    """A session state that stores ``value`` for any widget, without metadata."""
    session_state = MagicMock()
    session_state.get_widget_value.return_value = value
    session_state.get_widget_metadata.return_value = None
    return session_state


def test_an_unencodable_value_reports_null_and_logs() -> None:
    """A stored value with no JSON form reports null and warns, naming the widget."""
    session_state = _session_state_holding(_Unprintable())

    with patch.object(widget_values._LOGGER, "warning") as warning:
        result = widget_values.reported_value(session_state, "widget-id")

    assert result is None
    warning.assert_called_once()
    assert warning.call_args.args[0] == "Could not encode the value of %s."
    assert warning.call_args.args[1] == "widget-id"


def test_an_encodable_value_without_metadata_is_json_encoded() -> None:
    """Without metadata the stored value is reported in its JSON form."""
    session_state = _session_state_holding((1, "a"))

    with patch.object(widget_values._LOGGER, "warning") as warning:
        result = widget_values.reported_value(session_state, "widget-id")

    assert result == [1, "a"]
    warning.assert_not_called()


def test_a_presenceless_payload_with_text_data_reports_the_text() -> None:
    """A proto whose ``data`` has no presence bit still reports its text."""
    assert widget_values._string_payload(_PresencelessPayload("hello")) == "hello"


def test_a_presenceless_proto_with_non_text_data_is_returned_unchanged() -> None:
    """A real proto with non-text ``data`` and no presence bit passes through."""
    proto = ArrowData(data=b"bytes")

    assert widget_values._string_payload(proto) is proto


@pytest.mark.parametrize(
    ("option", "expected"),
    [
        pytest.param(_EqualityRaises(), False, id="equality_raises"),
        pytest.param(_ReturnsFromEq(np.bool_(True)), True, id="numpy_true"),
        pytest.param(_ReturnsFromEq(np.bool_(False)), False, id="numpy_false"),
        pytest.param(_ReturnsFromEq(np.array([True])), False, id="array_result"),
        pytest.param(_ReturnsFromEq(_ZeroDimTruthRaises()), False, id="bool_raises"),
        pytest.param(_ReturnsFromEq("truthy"), False, id="non_array_object"),
    ],
)
def test_option_equals_only_matches_a_true_scalar(option: Any, expected: bool) -> None:
    """Only a true builtin or 0-d result is a match; failures are not."""
    assert widget_values._option_equals("item", option) is expected


def test_index_authored_without_options_is_none() -> None:
    """No authored options means no index, not an empty one."""
    assert widget_values._index_authored(None) is None


def test_index_authored_splits_hashable_and_unhashable_options() -> None:
    """Hashable options go to the set; unhashable ones stay on the linear scan."""
    assert widget_values._index_authored(["a", ["b"], "c"]) == ({"a", "c"}, [["b"]])


@pytest.mark.parametrize(
    ("item", "expected"),
    [
        pytest.param(["b"], True, id="unhashable_linear_match"),
        pytest.param(["z"], False, id="unhashable_no_match"),
    ],
)
def test_is_authored_falls_back_to_equality_for_unhashable_items(
    item: Any, expected: bool
) -> None:
    """An unhashable item is compared by equality against every authored option."""
    index = widget_values._index_authored(["a", ["b"]])
    assert index is not None

    assert widget_values._is_authored(item, index) is expected


@pytest.mark.parametrize(
    ("serialized", "expected"),
    [
        pytest.param("b", "b", id="label_in_options"),
        pytest.param("unknown", None, id="label_not_in_options"),
    ],
)
def test_unhashable_options_are_checked_by_membership(
    serialized: str, expected: str | None
) -> None:
    """Unhashable option labels still allow a matching label and reject others."""
    result = widget_values._keep_typed_text("b", serialized, [["a"], "b"])

    assert result == expected


@pytest.mark.parametrize(
    ("stored", "authored", "expected"),
    [
        pytest.param("b", ["a", "b"], "B", id="captured_label_by_index"),
        pytest.param("z", ["a", "b"], None, id="not_an_authored_option"),
        pytest.param("c", ["a", "b", "c"], None, id="index_beyond_captured_labels"),
    ],
)
def test_a_changed_label_falls_back_to_the_captured_one(
    stored: str, authored: list[str], expected: str | None
) -> None:
    """A label that is no longer an option maps to the captured label, or null."""
    result = widget_values._keep_typed_text(stored, "CHANGED", ["A", "B"], authored)

    assert result == expected
