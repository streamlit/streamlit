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

"""Shared harness for the snapshot, delta-tree, and widget-value tests."""

from __future__ import annotations

import datetime as dt
import json
from typing import TYPE_CHECKING, Any, get_args
from zoneinfo import ZoneInfo

import streamlit as st
from streamlit.elements.lib import agent_spec
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.agent.snapshot import (
    ElementState,
    Snapshot,
    UnavailableReason,
    _public_key,
    build_snapshot,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase

if TYPE_CHECKING:
    from streamlit.runtime.state.session_state import SessionState


def _walk(node: dict[str, Any]) -> list[dict[str, Any]]:
    """``node`` and every descendant, in tree order."""
    found = [node]
    for child in node.get("children") or []:
        found.extend(_walk(child))
    return found


def _by_type(document: dict[str, Any], element_type: str) -> list[dict[str, Any]]:
    """Every node in ``document`` whose ``type`` is ``element_type``."""
    return [
        node for node in _walk(document["tree"]) if node.get("type") == element_type
    ]


def _one(document: dict[str, Any], element_type: str) -> dict[str, Any]:
    """The only node of ``element_type``."""
    matches = _by_type(document, element_type)
    assert len(matches) == 1, matches
    return matches[0]


def _one_keyed(
    document: dict[str, Any], element_type: str, key: str | None
) -> dict[str, Any]:
    """The only node of ``element_type`` with ``key``."""
    matches = [
        node for node in _by_type(document, element_type) if node.get("key") == key
    ]
    assert len(matches) == 1, matches
    return matches[0]


def _assert_data_resolves(data: dict[str, Any]) -> None:
    """The `data` invariant: complete, or a URL, or a known reason; never both."""
    assert data["complete"] is True or "url" in data or "unavailable" in data, data
    assert not ("url" in data and "unavailable" in data), data
    if "unavailable" in data:
        assert data["unavailable"] in get_args(UnavailableReason), data
        assert data["complete"] is False, data


def _describe(path: list[int], body: dict[str, Any]) -> ForwardMsg:
    """A markdown element at ``path`` described by ``body``."""
    message = ForwardMsg()
    message.metadata.delta_path[:] = path
    message.metadata.agent_props = json.dumps(body)
    message.delta.new_element.markdown.body = str(body.get("props", {}).get("body", ""))
    return message


def render_value_widgets() -> None:
    """Render one of each value widget, plus the variants a request treats apart.

    Covers empty defaults, `accept_new_options`, a `format_func`, temporal
    sliders including a time-zone-aware one, and stateful containers. Each
    widget's key names what it is.
    """
    st.checkbox("Check", key="check")
    st.toggle("Toggle", key="toggle")
    st.radio("Choose", ["a", "b"], key="radio")
    st.radio("Maybe choose", ["a", "b"], index=None, key="maybe_radio")
    st.selectbox("Select", ["a", "b"], key="select")
    st.selectbox("Maybe select", ["a", "b"], index=None, key="maybe_select")
    st.selectbox("City", ["Paris", "Berlin"], accept_new_options=True, key="city")
    st.selectbox(
        "Month",
        [1, 12],
        format_func=lambda month: "January" if month == 1 else "December",
        key="month",
    )
    st.multiselect("Many", ["a", "b"], default=["a"], key="many")
    st.multiselect(
        "Tags", ["a", "b"], default=["a"], accept_new_options=True, key="tags"
    )
    st.select_slider("Step", options=["a", "b", "c"], key="step")
    st.select_slider("Span", options=["a", "b", "c"], value=("a", "c"), key="span")
    st.slider("Amount", key="amount")
    st.slider("Range", 0, 100, (20, 80), key="range")
    st.slider("Day slider", value=dt.date(2026, 1, 2), key="day_slider")
    st.slider("Time slider", value=dt.time(9, 30), key="time_slider")
    st.slider(
        "Moment slider",
        value=dt.datetime(2026, 1, 2, 9, 30, tzinfo=ZoneInfo("Europe/Berlin")),
        key="moment_slider",
    )
    st.number_input("Whole", value=3, key="whole")
    st.number_input("Fraction", value=1.5, key="fraction")
    st.number_input("Maybe number", value=None, key="maybe_number")
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
    st.feedback("thumbs", default=1, key="thumbs")
    st.pagination(10, key="page")
    st.tabs(["A", "B"], on_change="rerun", key="tabs")
    st.expander("Open?", on_change="rerun", key="open")
    st.popover("Menu", on_change="rerun", key="pop")


def _state(snapshot: Snapshot, command: str, key: str) -> ElementState:
    """Element state for the node whose public key is ``key``."""
    matches = [
        state
        for element_id, state in snapshot.element_states.items()
        if state.command == command and _public_key(element_id) == key
    ]
    assert len(matches) == 1, matches
    return matches[0]


class SnapshotCase(DeltaGeneratorTestCase):
    """A script run with agent recording on, and a helper that builds its snapshot."""

    def setUp(self) -> None:
        super().setUp()
        agent_spec.register_agent_session(self.script_run_ctx.session_id)

    def tearDown(self) -> None:
        agent_spec.forget_agent_session(self.script_run_ctx.session_id)
        super().tearDown()

    def _session_state(self) -> SessionState:
        return self.script_run_ctx.session_state._state

    def _set_stored(self, key: str, value: Any) -> None:
        """Store ``value`` as the widget's base value, before a snapshot."""
        state = self._session_state()
        element_id = next(
            widget_id
            for widget_id in state._new_widget_state.widget_metadata
            if _public_key(widget_id) == key
        )
        state._new_widget_state.set_from_value(element_id, value)

    def _build(
        self,
        *extra: ForwardMsg,
        query_params: dict[str, list[str]] | None = None,
        session_state: SessionState | None = None,
        use_session_state: bool = True,
    ) -> Snapshot:
        """Build a snapshot from the queued messages plus ``extra``."""
        messages = [*self.forward_msg_queue._queue, *extra]
        state = self._session_state() if use_session_state else session_state
        return build_snapshot(
            session_id="s_7f3a",
            messages=messages,
            session_state=state,
            query_params={} if query_params is None else query_params,
        )
