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

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest

from streamlit.errors import StreamlitAPIException, StreamlitValueError
from streamlit.proto.Common_pb2 import StringTriggerValue
from streamlit.proto.Components_pb2 import ArrowTable
from streamlit.proto.WidgetStates_pb2 import WidgetState
from streamlit.runtime.state.common import (
    pack_widget_state_value,
    unpack_widget_state_value,
    validate_on_change_mode,
)

if TYPE_CHECKING:
    from streamlit.runtime.state.common import ValueFieldName


def _widget_state(**fields: Any) -> WidgetState:
    state = WidgetState(id="w")
    for name, value in fields.items():
        target = getattr(state, name, None)
        if hasattr(target, "data"):
            if isinstance(value, list):
                target.data.extend(value)
            else:
                target.data = value
        else:
            setattr(state, name, value)
    return state


@pytest.mark.parametrize(
    ("fields", "expected"),
    [
        ({}, None),
        ({"bool_value": True}, True),
        ({"int_value": 7}, 7),
        ({"string_value": "a"}, "a"),
        ({"double_array_value": [0.5, 1.5]}, [0.5, 1.5]),
        ({"string_array_value": ["a", "b"]}, ["a", "b"]),
        ({"string_trigger_value": "December"}, "December"),
        ({"json_value": '{"a": [1, null]}'}, {"a": [1, None]}),
    ],
)
def test_unpack_widget_state_value(fields: dict[str, Any], expected: Any) -> None:
    """The deserializer gets plain data: array and trigger messages unwrapped,
    JSON parsed, and None for a cleared value.
    """
    unpacked = unpack_widget_state_value(_widget_state(**fields))
    if isinstance(expected, list):
        # A repeated proto field compares equal only to another one.
        unpacked = list(unpacked)

    assert unpacked == expected


def test_unpack_widget_state_value_keeps_a_chat_input_message() -> None:
    """`st.chat_input`'s deserializer reads the message itself, uploads included."""
    state = WidgetState(id="w")
    state.chat_input_value.data = "hi"

    unpacked = unpack_widget_state_value(state)

    assert unpacked == state.chat_input_value
    assert unpacked.data == "hi"


@pytest.mark.parametrize(
    ("field_name", "serialized", "expected"),
    [
        (None, "ignored", {}),
        ("string_value", None, {}),
        ("string_value", "a", {"string_value": "a"}),
        ("bool_value", False, {"bool_value": False}),
        ("int_value", 7, {"int_value": 7}),
        ("bytes_value", b"\x00", {"bytes_value": b"\x00"}),
        ("string_array_value", ["a", "b"], {"string_array_value": ["a", "b"]}),
        ("json_value", {"a": 1}, {"json_value": '{"a": 1}'}),
        (
            "string_trigger_value",
            StringTriggerValue(data="x"),
            {"string_trigger_value": "x"},
        ),
        ("arrow_value", ArrowTable(data=b"t"), None),
    ],
)
def test_pack_widget_state_value(
    field_name: ValueFieldName | None, serialized: Any, expected: dict[str, Any] | None
) -> None:
    """A serialized value is written to its field, and unpacks to what was packed."""
    state = pack_widget_state_value("w", field_name, serialized)

    assert state.id == "w"
    if expected is None:
        assert state.arrow_value == serialized
    else:
        assert state == _widget_state(**expected)


def test_validate_on_change_mode_returns_callback() -> None:
    """A callback is returned unchanged."""

    def callback() -> None:
        pass

    assert (
        validate_on_change_mode(callback, supported_modes=(), param_name="on_click")
        is callback
    )


@pytest.mark.parametrize("mode", ["ignore", "rerun"])
def test_validate_on_change_mode_normalizes_supported_mode(mode: str) -> None:
    """Supported modes normalize to no callback."""
    assert validate_on_change_mode(mode, supported_modes=("rerun", "ignore")) is None


@pytest.mark.parametrize("mode", ["ignore", "rerun"])
def test_validate_on_change_mode_rejects_unsupported_mode(mode: str) -> None:
    """A recognized mode gets a widget-specific unsupported-mode error."""
    with pytest.raises(
        StreamlitAPIException,
        match=f'`on_click="{mode}"` is not supported on this widget',
    ):
        validate_on_change_mode(
            mode,
            supported_modes=(),
            param_name="on_click",
        )


def test_validate_on_change_mode_rejects_mode_not_supported_by_widget() -> None:
    """Widgets can support one mode without implicitly supporting every mode."""
    with pytest.raises(
        StreamlitAPIException,
        match='`on_change="ignore"` is not supported on this widget',
    ):
        validate_on_change_mode(
            "ignore",
            supported_modes=("rerun",),
        )


def test_validate_on_change_mode_lists_supported_modes_for_invalid_value() -> None:
    """The invalid-value error lists modes only when the widget supports them."""
    with pytest.raises(StreamlitValueError, match="Invalid `on_submit` value") as exc:
        validate_on_change_mode(
            "not-a-mode",
            supported_modes=("rerun", "ignore"),
            param_name="on_submit",
        )

    message = str(exc.value)
    assert "'ignore'" in message
    assert "'rerun'" in message
    assert "a callback function" in message


def test_validate_on_change_mode_lists_only_widget_supported_modes() -> None:
    """Invalid-value errors advertise only modes supported by that widget."""
    with pytest.raises(StreamlitValueError) as exc:
        validate_on_change_mode(
            "not-a-mode",
            supported_modes=("rerun",),
        )

    message = str(exc.value)
    assert "'rerun'" in message
    assert "'ignore'" not in message


def test_validate_on_change_mode_excludes_modes_for_callback_only_widget() -> None:
    """Callback-only widgets do not advertise callback modes as valid values."""
    with pytest.raises(StreamlitValueError, match="Invalid `on_change` value") as exc:
        validate_on_change_mode("not-a-mode", supported_modes=())

    message = str(exc.value)
    assert "'ignore'" not in message
    assert "'rerun'" not in message
    assert "a callback function" in message


def test_validate_on_change_mode_rejects_none_when_unsupported() -> None:
    """Elements without a None alias reject None through the same validator."""
    with pytest.raises(StreamlitValueError, match="Invalid `on_select` value"):
        validate_on_change_mode(
            None,
            supported_modes=("rerun", "ignore"),
            none_supported=False,
            param_name="on_select",
        )
