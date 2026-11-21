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

"""Wire-format coverage for the agent endpoint's widget encoder.

A ``WidgetState`` is read by the ScriptRunner strictly by which value arm is
set, and an unexpected arm reads back as an untouched widget rather than an
error. These tests pin each supported widget to the arm and payload the
frontend would send, so a mis-encoded widget fails here instead of silently
doing nothing at runtime.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest

from streamlit.testing.v1.app_test import AppTest
from streamlit.web.server.agent.agent_interact import (
    AgentInteractError,
    _encode_widget_state,
)

if TYPE_CHECKING:
    from streamlit.proto.WidgetStates_pb2 import WidgetState


def encode(app: Any, key: str, value: Any) -> WidgetState:
    """Run ``app``, set ``key`` to ``value``, and encode it for the wire."""
    at = AppTest.from_function(app)
    at.run()
    node = next(
        widget
        for widget in at._tree
        if getattr(widget, "key", None) == key and hasattr(widget, "_widget_state")
    )
    node.set_value(value)
    return _encode_widget_state(node)


def test_button_uses_trigger_value() -> None:
    def app() -> None:
        import streamlit as st

        st.button("Go", key="w")

    assert encode(app, "w", True).trigger_value is True


def test_checkbox_uses_bool_value() -> None:
    def app() -> None:
        import streamlit as st

        st.checkbox("On", key="w")

    assert encode(app, "w", True).bool_value is True


def test_text_input_uses_string_value() -> None:
    def app() -> None:
        import streamlit as st

        st.text_input("Name", key="w")

    assert encode(app, "w", "Ada").string_value == "Ada"


def test_selectbox_uses_option_label() -> None:
    def app() -> None:
        import streamlit as st

        st.selectbox("Region", ["All", "Europe"], key="w")

    assert encode(app, "w", "Europe").string_value == "Europe"


def test_multiselect_uses_string_array_value() -> None:
    def app() -> None:
        import streamlit as st

        st.multiselect("Regions", ["All", "Europe", "APAC"], key="w")

    encoded = encode(app, "w", ["Europe", "APAC"])
    assert list(encoded.string_array_value.data) == ["Europe", "APAC"]


def test_number_input_uses_double_value_even_for_integers() -> None:
    """An int on ``int_value`` would be ignored; the serde reads a double."""

    def app() -> None:
        import streamlit as st

        st.number_input("Count", value=1, key="w")

    encoded = encode(app, "w", 7)
    assert encoded.WhichOneof("value") == "double_value"
    assert encoded.double_value == 7.0


def test_slider_uses_double_array_value() -> None:
    def app() -> None:
        import streamlit as st

        st.slider("Amount", 0, 100, key="w")

    encoded = encode(app, "w", 42)
    assert encoded.WhichOneof("value") == "double_array_value"
    assert list(encoded.double_array_value.data) == [42.0]


def test_range_slider_serializes_both_thumbs() -> None:
    def app() -> None:
        import streamlit as st

        st.slider("Range", 0, 100, (10, 20), key="w")

    encoded = encode(app, "w", [30, 60])
    assert list(encoded.double_array_value.data) == [30.0, 60.0]


def test_select_slider_uses_string_array_value() -> None:
    def app() -> None:
        import streamlit as st

        st.select_slider("Size", options=["S", "M", "L"], key="w")

    encoded = encode(app, "w", "L")
    assert list(encoded.string_array_value.data) == ["L"]


def test_date_input_uses_string_array_value() -> None:
    """Dates travel as a list because ``st.date_input`` supports ranges."""

    def app() -> None:
        from datetime import date

        import streamlit as st

        st.date_input("Day", value=date(2026, 1, 1), key="w")

    encoded = encode(app, "w", "2026-03-04")
    assert encoded.WhichOneof("value") == "string_array_value"
    assert list(encoded.string_array_value.data) == ["2026-03-04"]


def test_time_input_uses_string_value() -> None:
    def app() -> None:
        from datetime import time

        import streamlit as st

        st.time_input("At", value=time(9, 0), key="w")

    assert encode(app, "w", "14:30").string_value == "14:30"


def test_toggle_uses_bool_value() -> None:
    def app() -> None:
        import streamlit as st

        st.toggle("Enabled", key="w")

    assert encode(app, "w", True).bool_value is True


def test_color_picker_uses_string_value() -> None:
    def app() -> None:
        import streamlit as st

        st.color_picker("Shade", key="w")

    assert encode(app, "w", "#ff0000").string_value == "#ff0000"


def test_feedback_uses_stringified_index() -> None:
    def app() -> None:
        import streamlit as st

        st.feedback("thumbs", key="w")

    assert encode(app, "w", 1).string_value == "1"


def test_pills_use_string_array_value() -> None:
    def app() -> None:
        import streamlit as st

        st.pills("Tags", ["a", "b"], key="w")

    encoded = encode(app, "w", ["b"])
    assert list(encoded.string_array_value.data) == ["b"]


def test_datetime_accepts_iso_string() -> None:
    def app() -> None:
        from datetime import datetime

        import streamlit as st

        st.slider(
            "When",
            min_value=datetime(2026, 1, 1),
            max_value=datetime(2026, 12, 31),
            key="w",
        )

    encoded = encode(app, "w", "2026-06-01T00:00")
    assert encoded.WhichOneof("value") == "double_array_value"
    assert len(encoded.double_array_value.data) == 1


def test_unknown_option_is_rejected_with_valid_options() -> None:
    """A bad option names the alternatives so an agent can correct itself."""

    def app() -> None:
        import streamlit as st

        st.selectbox("Region", ["All", "Europe"], key="w")

    with pytest.raises(AgentInteractError) as exc:
        encode(app, "w", "Atlantis")
    assert exc.value.code == "invalid_widget_value"
    assert "Europe" in exc.value.message


def test_non_numeric_number_input_is_rejected() -> None:
    def app() -> None:
        import streamlit as st

        st.number_input("Count", value=1, key="w")

    with pytest.raises(AgentInteractError) as exc:
        encode(app, "w", "many")
    assert exc.value.code == "invalid_widget_value"


def test_malformed_date_is_rejected() -> None:
    def app() -> None:
        from datetime import date

        import streamlit as st

        st.date_input("Day", value=date(2026, 1, 1), key="w")

    with pytest.raises(AgentInteractError) as exc:
        encode(app, "w", "not-a-date")
    assert exc.value.code == "invalid_widget_value"
