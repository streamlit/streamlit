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

"""A request's widget writes are checked against the last snapshot and encoded."""

from __future__ import annotations

import datetime as dt
import math
from dataclasses import dataclass, replace
from typing import TYPE_CHECKING, Any, Final, NamedTuple, get_args
from unittest.mock import MagicMock
from zoneinfo import ZoneInfo

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.agent import widget_writes
from streamlit.runtime.agent.errors import AgentRequestError
from streamlit.runtime.state.session_state import WStates
from streamlit.runtime.state.widget_checks import Violation, ViolationKind
from tests.streamlit.runtime.agent.snapshot_test_case import (
    SnapshotCase,
    _one,
    _walk,
    render_value_widgets,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping

    from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
    from streamlit.runtime.agent.snapshot import Snapshot

_BERLIN: Final = ZoneInfo("Europe/Berlin")
# "a" and "A" both show as "A" with `format_func=str.upper`.
_SHARED_OPTIONS: Final = ["a", "A", "b"]


class _Refused(NamedTuple):
    """An expected refusal: a fragment of its message, and its code."""

    message: str
    code: str = "invalid_value"


@dataclass(frozen=True)
class _Plan:
    name: str
    price: int


def _render_option_widgets() -> None:
    """Option widgets whose labels, counts, or values need a closer look."""
    st.selectbox("Many options", [f"o{index}" for index in range(25)], key="long")
    st.multiselect("Two at most", ["a", "b", "c"], max_selections=2, key="limited")
    st.selectbox("Numbered", ["1", "2"], key="numbered")
    st.selectbox(
        "Open numbered", ["1", "2"], accept_new_options=True, key="open_numbered"
    )
    st.selectbox(
        "Same",
        ["x", "y"],
        format_func=lambda _option: "Same",
        accept_new_options=True,
        key="same_open",
    )
    st.selectbox("Shared", ["x", "a", "A"], format_func=str.upper, key="shared")
    st.selectbox(
        "Shared default", ["a", "A"], format_func=str.upper, key="shared_default"
    )
    st.multiselect(
        "Shared tags", ["x", "a", "A"], format_func=str.upper, key="shared_tags"
    )
    st.selectbox("Rate", ["0.10", "0.25"], key="rate")
    st.selectbox("Count", [1, 12], key="count")
    st.multiselect("Repeated", ["a", "b"], default=["a", "a"], key="repeated")
    st.selectbox(
        "Plan",
        [_Plan("Basic", 0), _Plan("Pro", 10)],
        format_func=lambda plan: plan.name,
        key="plan",
    )


def _render_required_widgets() -> None:
    """Required widgets, each empty or filled."""
    st.text_input("Empty name", key="empty_name", required=True)
    st.session_state.filled_name = "Ada"
    st.text_input("Filled name", key="filled_name", required=True)
    st.number_input("Empty age", value=None, key="empty_age", required=True)
    st.session_state.filled_age = 30.0
    st.number_input("Filled age", value=None, key="filled_age", required=True)
    st.pills("Empty mood", ["calm", "busy"], key="empty_mood", required=True)
    st.session_state.filled_mood = "calm"
    st.pills("Filled mood", ["calm", "busy"], key="filled_mood", required=True)
    st.date_input("Empty day", value=None, key="empty_day", required=True)
    st.date_input("Trip", value=[], key="trip", required=True)
    options = ["x", "y"]
    st.selectbox("Empty pick", options, index=None, key="empty_pick", required=True)
    st.session_state.filled_pick = "y"
    st.selectbox("Filled pick", options, index=None, key="filled_pick", required=True)
    st.session_state.first_pick = "y"
    st.selectbox("First pick", options, key="first_pick", required=True)


def _render_two_forms() -> None:
    """Two forms, one with two submit buttons, and controls outside both."""
    with st.form("profile"):
        st.text_input("Name", key="name")
        st.number_input("Age", value=30, key="age")
        st.form_submit_button("Save", key="save")
        st.form_submit_button("Draft", key="draft")
    with st.form("billing"):
        st.text_input("Card holder", key="holder")
        st.form_submit_button("Pay", key="pay")
    st.checkbox("Outside", key="outside")
    st.button("Go", key="go")


class WidgetWritesTest(SnapshotCase):
    """Writes are validated against the snapshot and encoded as a browser sends them."""

    def _write(
        self,
        widget_state: Mapping[str, Any] | None = None,
        *,
        trigger: Mapping[str, Any] | None = None,
        snapshot: Snapshot | None = None,
    ) -> WidgetStates:
        """Validate and encode a request against ``snapshot``, or a fresh one."""
        built = snapshot or self._build()
        return widget_writes.build_widget_states(
            self._session_state(),
            widget_state=widget_state,
            trigger=trigger,
            element_states=built.element_states,
            compile_error=built.compile_error,
        )

    def _refusal(
        self,
        widget_state: Mapping[str, Any] | None = None,
        *,
        trigger: Mapping[str, Any] | None = None,
        snapshot: Snapshot | None = None,
    ) -> AgentRequestError:
        """The error a request is refused with."""
        with pytest.raises(AgentRequestError) as raised:
            self._write(widget_state, trigger=trigger, snapshot=snapshot)
        return raised.value

    def _read_back(self, encoded: WidgetState) -> Any:
        """What the app reads for ``encoded``, unpacked the way session state does."""
        metadata = self._session_state()._new_widget_state.widget_metadata
        states = WStates(widget_metadata=dict(metadata))
        states.set_widget_from_proto(encoded)
        return states[encoded.id]

    def _check(
        self,
        widget_state: Mapping[str, Any] | None,
        expected: Any,
        *,
        trigger: Mapping[str, Any] | None = None,
    ) -> None:
        """Send a one-widget request and compare what the app reads, or the refusal.

        An unchanged value is left out of the request's states, so the app
        reads what the widget holds.
        """
        if isinstance(expected, _Refused):
            error = self._refusal(widget_state, trigger=trigger)
            assert error.code == expected.code, error.message
            assert expected.message in error.message
            return
        widgets = self._write(widget_state, trigger=trigger).widgets
        if not widgets and widget_state is not None:
            (key,) = widget_state
            assert self._held(key) == expected
            return
        (encoded,) = widgets
        assert self._read_back(encoded) == expected

    def _held(self, key: str) -> Any:
        """The value the widget with ``key`` holds."""
        return self._session_state().get_widget_value(self._element_id(key))

    def _element_id(self, key: str) -> str:
        element_id = self._session_state().get_widget_id_from_key(key)
        assert element_id is not None
        return element_id

    def _patch_metadata(self, key: str, **changes: Any) -> None:
        """Replace fields of a rendered widget's metadata."""
        state = self._session_state()
        metadata = state.get_widget_metadata(self._element_id(key))
        assert metadata is not None
        state._set_widget_metadata(replace(metadata, **changes))

    def test_every_reported_value_is_accepted_and_changes_nothing(self) -> None:
        """Each reported value, sent alone or all at once, is what the widget holds.

        It equals the stored value on the wire, so it is left out of the
        states: the runtime has nothing to resolve, not even a shared label.
        """
        render_value_widgets()
        snapshot = self._build()
        nodes = {
            node["key"]: node
            for node in _walk(snapshot.document["tree"])
            if "key" in node
        }
        reported = {
            entry["key"]: nodes[entry["key"]]["value"]
            for entry in snapshot.document["actions"]
            if entry["kind"] == "value"
        }
        assert {"moment_slider", "thumbs", "maybe_select", "days", "pop"} <= set(
            reported
        )

        for key, value in reported.items():
            assert not self._write({key: value}, snapshot=snapshot).widgets, key

        assert not self._write(reported, snapshot=snapshot).widgets

    @parameterized.expand(
        [
            ("selectbox", lambda held: {"index": _SHARED_OPTIONS.index(held)}, False),
            ("radio", lambda held: {"index": _SHARED_OPTIONS.index(held)}, False),
            ("pills", lambda held: {"default": held}, False),
            ("select_slider", lambda held: {"value": held}, False),
            ("multiselect", lambda held: {"default": [held]}, True),
        ]
    )
    def test_a_shared_label_names_only_the_held_option(
        self, command: str, holding: Callable[[str], dict[str, Any]], as_list: bool
    ) -> None:
        """Sending back the label of the held option changes nothing.

        "a" and "A" both show as "A". Sent, the label would resolve to the last
        option that shows it, so the echo is left out rather than flipping the
        widget to "A". Sent to a widget holding another option, the label does
        not say which option it means, so it is refused.
        """
        widget = getattr(st, command)
        for key, held in (("held", "a"), ("other", "b")):
            widget(
                key, _SHARED_OPTIONS, format_func=str.upper, key=key, **holding(held)
            )
        label: Any = ["A"] if as_list else "A"

        assert not self._write({"held": label}).widgets
        assert self._held("held") == (["a"] if as_list else "a")
        error = self._refusal({"other": label})
        assert error.code == "invalid_value"
        assert "Several options for 'other' display as 'A'" in error.message

    def test_keys_resolve_like_session_state(self) -> None:
        """An authored key maps to its widget; IDs and non-widget keys stay as sent."""
        st.checkbox("Agree", key="agree")
        st.checkbox("Unkeyed")
        st.container(key="box").markdown("inside")
        with st.form("name"):
            st.text_input("Name", key="name")
            st.form_submit_button("Save", key="save")
        snapshot = self._build()
        states = snapshot.element_states
        session_state = self._session_state()
        unkeyed = next(
            entry["key"]
            for entry in snapshot.document["actions"]
            if entry.get("label") == "Unkeyed"
        )

        def resolve(key: str) -> str:
            return widget_writes.resolve_element_id(session_state, key, states)

        assert resolve("agree") == self._element_id("agree")
        assert resolve(unkeyed) == unkeyed
        assert resolve("box") == "box"
        # The form and its field share the key, and the widget wins.
        assert states[resolve("name")].command == "text_input"
        with pytest.raises(AgentRequestError) as raised:
            resolve("agre")
        assert raised.value.code == "unknown_key"

    def test_one_element_set_twice_is_refused(self) -> None:
        """An authored key and its element ID in one request are ambiguous."""
        st.checkbox("Agree", key="agree")
        element_id = self._element_id("agree")

        error = self._refusal({"agree": True, element_id: False})

        assert error.code == "invalid_request"
        assert "twice" in error.message

    def test_values_are_encoded_in_snapshot_order(self) -> None:
        """Callbacks follow the tree, whatever order the request lists keys in,
        so a stateful container's comes before those of the widgets inside it.
        """
        st.checkbox("First", key="first")
        with st.expander("Details", on_change="rerun", key="details"):
            st.checkbox("Inner", key="inner")
        st.checkbox("Second", key="second")

        encoded = self._write(
            {"second": True, "inner": True, "details": True, "first": True}
        ).widgets

        assert [state.id for state in encoded] == [
            self._element_id(key) for key in ("first", "details", "inner", "second")
        ]

    def test_a_stale_widget_key_does_not_hide_a_form_that_uses_it(self) -> None:
        """A key a removed widget once had resolves to the form that has it now."""
        st.text_input("Draft", key="draft")
        self.clear_queue()
        with st.form("draft"):
            st.text_input("Body", key="body")
            st.form_submit_button("Send", key="send")
        snapshot = self._build()

        resolved = widget_writes.resolve_element_id(
            self._session_state(), "draft", snapshot.element_states
        )
        assert resolved == "draft"
        error = self._refusal({"draft": "x"}, snapshot=snapshot)
        assert error.code == "unsupported_element"
        assert "display-only" in error.message

    def test_unknown_and_stale_keys_are_told_apart(self) -> None:
        """A key the session never had is unknown; one the snapshot lacks is not on the page."""
        st.text_input("Detail", key="detail")
        st.slider("Level", max_value=10)
        old_level = next(
            entry["key"]
            for entry in self._build().document["actions"]
            if entry.get("label") == "Level"
        )
        self.clear_queue()
        st.slider("Level", max_value=20)
        snapshot = self._build()

        assert self._refusal({"detial": "x"}, snapshot=snapshot).code == "unknown_key"
        unregistered = self._refusal({"$$ID-0-None": 1}, snapshot=snapshot)
        assert unregistered.code == "unknown_key"
        authored = self._refusal({"detail": "x"}, snapshot=snapshot)
        assert authored.code == "not_on_page"
        assert "`label`" not in authored.message
        # A generated key changes with the widget's parameters.
        regenerated = self._refusal({old_level: 5}, snapshot=snapshot)
        assert regenerated.code == "not_on_page"
        assert "find it by its `label`" in regenerated.message

    def test_unusable_elements_name_the_reason(self) -> None:
        """`support` wins over `disabled`, and a display element is unsupported."""
        st.file_uploader("Upload", disabled=True, key="upload")
        st.checkbox("Off", disabled=True, key="off")
        st.button("Wait", disabled=True, key="wait")
        st.container(key="box").markdown("inside")
        # Keyed with an element ID: one registers no widget, and the other
        # registers one although it has no action.
        st.link_button("Docs", "https://example.com", key="docs")
        st.download_button("Get", b"data", key="get", on_click="ignore")
        snapshot = self._build()

        unsupported = self._refusal({"upload": None}, snapshot=snapshot)
        assert unsupported.code == "unsupported_element"
        assert "action_unsupported" in unsupported.message
        assert self._refusal({"off": True}, snapshot=snapshot).code == "disabled_widget"
        disabled_trigger = self._refusal(trigger={"key": "wait"}, snapshot=snapshot)
        assert disabled_trigger.code == "disabled_widget"
        for key in ["box", "docs", "get"]:
            display = self._refusal(trigger={"key": key}, snapshot=snapshot)
            assert display.code == "unsupported_element", key
            assert "display-only" in display.message

    def test_a_closed_dialog_or_a_compile_error_leaves_widgets_unusable(self) -> None:
        """A widget the snapshot shows but cannot offer is not on the page now,
        which wins over `disabled`, and the refusal names the one reason.
        """
        dialog = get_dg_singleton_instance().event_dg._dialog(
            title="Closed", on_dismiss="rerun"
        )
        dialog.open()
        with dialog:
            st.button("Inside", key="inside")
            st.checkbox("Off inside", disabled=True, key="off_inside")
        dialog.close()
        st.checkbox("Agree", key="agree")
        st.checkbox("Off", disabled=True, key="off")

        for closed in (
            self._refusal(trigger={"key": "inside"}),
            self._refusal({"off_inside": True}),
        ):
            assert closed.code == "not_on_page"
            assert "closed dialog" in closed.message
            assert "compile" not in closed.message
        assert self._write({"agree": True}).widgets[0].bool_value is True

        finished = ForwardMsg()
        finished.script_finished = ForwardMsg.FINISHED_WITH_COMPILE_ERROR
        snapshot = self._build(finished)
        for failed in (
            self._refusal({"agree": True}, snapshot=snapshot),
            self._refusal({"off": True}, snapshot=snapshot),
        ):
            assert failed.code == "not_on_page"
            assert "failed to compile" in failed.message
            assert "dialog" not in failed.message

    def test_values_and_triggers_are_not_interchangeable(self) -> None:
        """A trigger is not set through `widget_state`, and a value is not fired."""
        st.button("Go", key="go")
        st.checkbox("Agree", key="agree")
        snapshot = self._build()

        assert self._refusal({"go": True}, snapshot=snapshot).code == "not_a_value"
        not_a_trigger = self._refusal(trigger={"key": "agree"}, snapshot=snapshot)
        assert not_a_trigger.code == "not_a_trigger"

    def test_a_trigger_key_must_be_text(self) -> None:
        """A trigger without a string key is malformed, not a plain rerun."""
        st.button("Go", key="go")

        assert self._refusal(trigger={"key": 1}).code == "invalid_request"

    def test_wire_types_no_described_widget_uses(self) -> None:
        """Binary input is refused, and the JSON and integer-list arms encode."""
        st.text_input("Blob", key="blob")
        st.text_input("Doc", key="doc")
        st.slider("Ints", 0, 10, (2, 5), key="ints")
        st.button("Event", key="event")
        self._patch_metadata("blob", value_type="bytes_value")
        self._patch_metadata("doc", value_type="json_value")
        self._patch_metadata("ints", value_type="int_array_value")
        self._patch_metadata("event", value_type="json_trigger_value")
        snapshot = self._build()

        assert self._refusal({"blob": "x"}, snapshot=snapshot).code == (
            "unsupported_element"
        )
        (doc,) = self._write({"doc": "x"}, snapshot=snapshot).widgets
        assert doc.json_value == '"x"'
        assert self._read_back(doc) == "x"
        (ints,) = self._write({"ints": [3, 4.0]}, snapshot=snapshot).widgets
        assert list(ints.int_array_value.data) == [3, 4]
        fraction = self._refusal({"ints": [3, 4.5]}, snapshot=snapshot)
        assert "a list of whole numbers" in fraction.message
        event = {"key": "event", "value": {"kind": "click"}}
        (fired,) = self._write(trigger=event, snapshot=snapshot).widgets
        assert fired.json_trigger_value == '{"kind": "click"}'

    @parameterized.expand(
        [
            ("text_is_not_a_number", "whole", "3", _Refused("takes a number")),
            ("feedback_takes_its_index", "stars", 1, 1),
            ("feedback_index_as_text", "stars", "1", _Refused("takes a number")),
            ("whole_float_counts_as_an_integer", "stars", 1.0, 1),
            ("true_is_not_a_number", "whole", True, _Refused("not true or false")),
            ("true_is_not_text", "text", True, _Refused("not true or false")),
            ("number_is_not_text", "text", 5, _Refused("must be a string")),
            ("number_is_not_a_boolean", "check", 1, _Refused("must be true or false")),
            ("bare_value_for_a_list", "many", "a", _Refused("takes a list")),
            ("null_inside_a_list", "many", ["a", None], _Refused("null inside")),
            ("one_item_list_for_one_value", "select", ["b"], "b"),
            ("longer_list_for_one_value", "select", ["a", "b"], _Refused("one value")),
            (
                "fraction_to_a_whole_number_is_refused",
                "whole",
                2.5,
                _Refused("'whole' takes a whole number."),
            ),
            ("number_to_a_datetime_input", "when", 5, _Refused("must be a string")),
            (
                "number_in_a_date_range",
                "days",
                [5],
                _Refused("must be a list of strings"),
            ),
            ("fraction_to_pagination", "page", 2.5, _Refused("must be a whole number")),
            ("pagination", "page", 3, 3),
            ("expander", "open", True, True),
            ("popover", "pop", True, True),
            ("color", "color", "#FF0000", "#FF0000"),
        ]
    )
    def test_json_type_check(
        self, _name: str, key: str, sent: Any, expected: Any
    ) -> None:
        """The JSON type comes from `value_schema`, with its documented readings."""
        render_value_widgets()
        self._check({key: sent}, expected)

    @parameterized.expand(
        [
            (
                "not_an_option",
                "select",
                "c",
                _Refused("'c' is not one of the options for 'select': 'a', 'b'."),
            ),
            ("listing_is_capped", "long", "zz", _Refused("'o19', and 5 more.")),
            (
                "feedback_lists_numbers",
                "stars",
                7,
                _Refused("7 is not one of the options for 'stars': 0, 1, 2, 3, 4."),
            ),
            (
                "over_max_selections",
                "limited",
                ["a", "b", "c"],
                _Refused("'limited' takes at most 2 items, as its `max_selections`"),
            ),
            ("within_max_selections", "limited", ["a", "c"], ["a", "c"]),
            (
                "over_a_range",
                "days",
                ["2026-01-01", "2026-01-02", "2026-01-03"],
                _Refused("at most 2"),
            ),
            ("accept_new_takes_new_text", "city", "Rome", "Rome"),
            ("accept_new_takes_a_new_item", "tags", ["a", "new"], ["a", "new"]),
            # Any text is legal there, so a number does not name an option.
            (
                "accept_new_number_is_not_text",
                "open_numbered",
                1,
                _Refused("must be a string"),
            ),
            # The label of the held option, so it changes nothing, and the
            # widget keeps the option it holds rather than the last with it.
            ("accept_new_shared_label", "same_open", "Same", "x"),
            (
                "shared_label",
                "shared",
                "A",
                _Refused("Several options for 'shared' display as 'A'"),
            ),
            ("unchanged_shared_label", "shared_default", "A", "a"),
            (
                "shared_label_in_a_list",
                "shared_tags",
                ["X", "A"],
                _Refused("Several options for 'shared_tags' display as 'A'"),
            ),
            (
                "duplicate_selection",
                "many",
                ["a", "b", "a"],
                _Refused("'many' lists 'a' more than once"),
            ),
            ("number_naming_an_option", "numbered", 2, "2"),
            ("tab_label", "tabs", "B", "B"),
            ("not_a_tab", "tabs", "C", _Refused("not one of the options")),
            ("select_slider", "step", "b", "b"),
            ("select_slider_range", "span", ["a", "b"], ("a", "b")),
            ("select_slider_empty_range", "span", ["b", "b"], ("b", "b")),
            ("not_a_select_slider_option", "span", ["a", "z"], _Refused("'z' is not")),
            # An app's default can repeat an option, so a reported value can too.
            ("repeated_selection", "repeated", ["a", "a"], ["a", "a"]),
        ]
    )
    def test_options_and_limits(
        self, _name: str, key: str, sent: Any, expected: Any
    ) -> None:
        """Options are matched as text, limits are enforced, and new text is allowed."""
        render_value_widgets()
        _render_option_widgets()
        self._check({key: sent}, expected)

    @parameterized.expand(
        [
            (
                "number_above_max",
                "bounded",
                11,
                _Refused("'bounded' takes values from 0 to 10, inclusive."),
            ),
            ("number_at_max", "bounded", 10, 10),
            # Only the bound the author set is named, not the browser's
            # safe-integer limit that stands in for the other.
            (
                "number_below_its_only_bound",
                "at_least_zero",
                -1,
                _Refused("'at_least_zero' takes values of at least 0, inclusive."),
            ),
            (
                "float_below_min",
                "ratio",
                -0.5,
                _Refused("'ratio' takes values from 0.0 to 1.0, inclusive."),
            ),
            (
                "slider_above_max",
                "amount",
                101,
                _Refused("'amount' takes values from 0 to 100, inclusive."),
            ),
            (
                "reversed_slider_range",
                "range",
                [80, 20],
                _Refused("'range' takes the lower end of its range first."),
            ),
            ("one_end_of_a_slider_range", "range", [20], _Refused("takes 2 items.")),
            (
                "fraction_to_an_integer_slider",
                "amount",
                2.5,
                _Refused("'amount' takes a whole number."),
            ),
            (
                "reversed_select_slider_range",
                "span",
                ["c", "a"],
                _Refused("'span' takes the lower end of its range first."),
            ),
            (
                "date_past_its_default_bounds",
                "day",
                "2040-01-01",
                _Refused("'day' takes values from 2016-01-02 to 2036-01-02"),
            ),
            (
                "date_in_the_legacy_layout",
                "day",
                "2026/01/05",
                _Refused("'day' takes a date as YYYY-MM-DD."),
            ),
            # Text the widget cannot read as a date gets the generic message.
            ("impossible_date", "day", "2026-13-45", _Refused("not one it accepts")),
            (
                "reversed_date_range",
                "days",
                ["2026-01-09", "2026-01-05"],
                _Refused("'days' takes the lower end of its range first."),
            ),
            (
                "malformed_color",
                "color",
                "red",
                _Refused("'color' takes a hex color as #rgb or #rrggbb."),
            ),
            # Only a missing field reads as the default.
            (
                "empty_color",
                "color",
                "",
                _Refused("'color' takes a hex color as #rgb or #rrggbb."),
            ),
            (
                "page_past_the_last",
                "page",
                11,
                _Refused("'page' takes values from 1 to 10, inclusive."),
            ),
            (
                "text_past_max_chars",
                "short",
                "abcd",
                _Refused("'short' takes at most 3 characters"),
            ),
            # An emoji is two UTF-16 code units, as the browser counts it.
            ("emoji_past_max_chars", "short", "ab😀", _Refused("at most 3 characters")),
            ("emoji_at_max_chars", "short", "a😀", "a😀"),
            # A browser may commit 0.12 for this bound, which the slider reads
            # as 0.123. A request is held to the bound as written instead.
            (
                "slider_below_a_rounded_bound",
                "rounded",
                0.12,
                _Refused("'rounded' takes values from 0.123 to 1.0, inclusive."),
            ),
            ("slider_at_a_rounded_bound", "rounded", 0.123, 0.123),
            # Bounds are written in the layout the widget takes, to the minute.
            (
                "datetime_before_min",
                "window",
                "2025-12-31T23:00",
                _Refused(
                    "'window' takes values from 2026-01-01T00:00 to "
                    "2026-12-31T18:30, inclusive."
                ),
            ),
        ]
    )
    def test_bounds_shapes_and_lengths(
        self, _name: str, key: str, sent: Any, expected: Any
    ) -> None:
        """A value the widget would reset, sort, or cut is refused, naming the bound.

        These are the refusals the OpenAPI document's `widget_state`
        description lists for bounds, ranges, layouts, and `max_chars`.
        """
        render_value_widgets()
        st.number_input("Bounded", 0, 10, 5, key="bounded")
        st.number_input("At least zero", min_value=0, key="at_least_zero")
        st.number_input("Ratio", 0.0, 1.0, 0.5, key="ratio")
        st.text_input("Short", max_chars=3, key="short")
        st.slider("Rounded", 0.123, 1.0, 0.5, step=0.1, key="rounded")
        st.datetime_input(
            "Window",
            dt.datetime(2026, 6, 1, 9, 30),
            min_value=dt.datetime(2026, 1, 1),
            max_value=dt.datetime(2026, 12, 31, 18, 30),
            key="window",
        )
        self._check({key: sent}, expected)

    @parameterized.expand(
        [
            # `null` to a widget that is already empty changes nothing.
            ("null_to_an_empty_text_input", "empty_name", None, ""),
            ("null_to_an_empty_number", "empty_age", None, None),
            ("null_to_empty_pills", "empty_mood", None, None),
            ("null_to_an_empty_date", "empty_day", None, None),
            ("null_to_an_empty_selectbox", "empty_pick", None, None),
            ("text_to_an_empty_input", "empty_name", "Bob", "Bob"),
            (
                "empty_text",
                "filled_name",
                "",
                _Refused("'filled_name' is required and cannot be emptied."),
            ),
            ("whitespace", "filled_name", " \t", _Refused("cannot be emptied")),
            # `null` resets to the default, which is empty.
            ("null_to_a_filled_text_input", "filled_name", None, _Refused("required")),
            ("null_to_a_filled_number", "filled_age", None, _Refused("required")),
            ("null_to_filled_pills", "filled_mood", None, _Refused("required")),
            ("null_to_a_filled_selectbox", "filled_pick", None, _Refused("required")),
            # A default option is not empty, so `null` resets to it.
            ("null_to_a_selectbox_with_a_default", "first_pick", None, "x"),
            (
                "start_of_a_range",
                "trip",
                ["2026-01-05"],
                _Refused("A date range without both ends is empty."),
            ),
        ]
    )
    def test_required(self, _name: str, key: str, sent: Any, expected: Any) -> None:
        """A required widget can stay empty, but no request can empty it."""
        _render_required_widgets()
        self._check({key: sent}, expected)

    @parameterized.expand(
        [
            ("empty_text", "filled_name", "", ""),
            ("whitespace", "filled_name", " \t", " Text of only whitespace is empty."),
            ("null_to_a_number", "filled_age", None, ""),
            ("null_to_pills", "filled_mood", None, ""),
            ("null_to_a_selectbox", "filled_pick", None, ""),
            (
                "start_of_a_range",
                "trip",
                ["2026-01-05"],
                " A date range without both ends is empty.",
            ),
        ]
    )
    def test_a_required_refusal_explains_only_what_is_not_plainly_empty(
        self, _name: str, key: str, sent: Any, why: str
    ) -> None:
        """Whitespace and a partial range get a reason; other empty values need none."""
        _render_required_widgets()

        error = self._refusal({key: sent})

        assert error.code == "invalid_value"
        assert error.message == f"{key!r} is required and cannot be emptied.{why}"

    def test_a_value_the_widget_cannot_read_is_refused(self) -> None:
        """A value the deserializer raises on would raise in every later run."""
        st.text_input("Code", key="code")

        def _unreadable(_value: Any) -> str:
            raise ValueError("cannot read")

        self._patch_metadata("code", deserializer=_unreadable)

        error = self._refusal({"code": "abc"})
        assert error.code == "invalid_value"
        assert "not one it accepts" in error.message

    def test_a_trigger_the_widget_cannot_read_is_refused(self) -> None:
        """A fired trigger passes the same checks as a value."""
        st.button("Go", key="go")

        def _unreadable(_value: Any) -> bool:
            raise ValueError("cannot read")

        self._patch_metadata("go", deserializer=_unreadable)

        error = self._refusal(trigger={"key": "go"})
        assert error.code == "invalid_value"
        assert "not one it accepts" in error.message

    def test_the_widget_validator_sees_only_changed_wire_values(self) -> None:
        """A write equal to the stored value on the wire never reaches the validator."""
        st.text_input("Name", value="Ada", key="name")
        validator = MagicMock(return_value=None)
        self._patch_metadata("name", validator=validator)

        assert not self._write({"name": "Ada"}).widgets
        validator.assert_not_called()
        (changed,) = self._write({"name": "Bob"}).widgets

        validator.assert_called_once()
        assert changed.string_value == "Bob"

    def test_a_value_the_widget_validator_refuses_is_refused(self) -> None:
        """A violation from the widget's own validator refuses the request."""
        st.text_input("Name", key="name")
        self._patch_metadata(
            "name", validator=lambda _ui, **_kwargs: Violation("wrong_type")
        )

        error = self._refusal({"name": "Bob"})
        assert error.code == "invalid_value"
        assert "not one it accepts" in error.message
        assert "Bob" not in error.message

    def test_every_violation_kind_maps_to_an_agent_error(self) -> None:
        """Each kind the shared check reports has an agent error, so none escapes."""
        assert set(widget_writes._VIOLATION_ERRORS) == set(get_args(ViolationKind))

    def test_a_widget_registered_as_disabled_is_refused(self) -> None:
        """The shared check refuses a disabled widget the snapshot missed."""
        st.checkbox("Agree", key="agree")
        snapshot = self._build()
        self._patch_metadata("agree", disabled=True)

        error = self._refusal({"agree": True}, snapshot=snapshot)
        assert error.code == "disabled_widget"

    def test_a_widget_the_latest_run_did_not_render_is_not_on_the_page(self) -> None:
        """The shared check refuses a widget the snapshot shows but no run rendered.

        The snapshot check answers first for an element it does not show, so
        this only covers an element the session no longer counts as rendered.
        """
        st.checkbox("Agree", key="agree")
        st.button("Go", key="go")
        snapshot = self._build()
        rendered_ids = self._session_state()._new_widget_state.rendered_ids
        rendered_ids.discard(self._element_id("agree"))
        rendered_ids.discard(self._element_id("go"))

        for request in ({"widget_state": {"agree": True}}, {"trigger": {"key": "go"}}):
            error = self._refusal(**request, snapshot=snapshot)
            assert error.code == "not_on_page"
            assert "the latest run did not render it" in error.message
        # A value that reads as the stored one changes nothing, so it passes.
        assert not self._write({"agree": False}, snapshot=snapshot).widgets

    @parameterized.expand(
        [
            ("non_clearable_resets", "text", None, None, "hello"),
            ("multiselect_resets", "many", None, None, ["a"]),
            ("multiselect_cleared_with_a_list", "many", [], "string_array_value", []),
            ("feedback_with_a_default", "thumbs", None, "string_value", None),
            ("pills_with_a_default", "pills", None, "string_array_value", None),
            ("segments_with_a_default", "mode", None, "string_array_value", None),
            ("empty_selectbox", "maybe_select", None, None, None),
            ("empty_number", "maybe_number", None, None, None),
            ("empty_date", "no_day", None, None, None),
            ("empty_time", "no_time", None, None, None),
            ("empty_datetime", "no_moment", None, None, None),
            ("datetime_emptied_by_session_state", "emptied", None, None, None),
        ]
    )
    def test_null_resets_or_clears(
        self, _name: str, key: str, sent: Any, field: str | None, expected: Any
    ) -> None:
        """`null` resets to the default, and clears where a browser user could."""
        render_value_widgets()
        st.segmented_control("Mode", ["x", "y"], default="x", key="mode")
        st.date_input("No day", value=None, key="no_day")
        st.time_input("No time", value=None, key="no_time")
        st.datetime_input("No moment", value=None, key="no_moment")
        st.session_state.emptied = None
        st.datetime_input("Emptied", dt.datetime(2026, 1, 1, 12, 0), key="emptied")

        widgets = self._write({key: sent}).widgets
        if field is None:
            # The unset form reads as the default, which the widget already
            # holds, so nothing is sent.
            assert not widgets
            assert self._held(key) == expected
            return
        (encoded,) = widgets
        assert encoded.WhichOneof("value") == field
        assert self._read_back(encoded) == expected

    def test_a_deserializer_that_cannot_read_null_counts_as_holding_a_value(
        self,
    ) -> None:
        """Without a readable default, null sends the empty form and a slider is numeric."""
        st.feedback("thumbs", default=1, key="thumbs")
        st.slider("Amount", key="amount")
        for key in ("thumbs", "amount"):
            metadata = self._session_state().get_widget_metadata(self._element_id(key))
            assert metadata is not None
            original = metadata.deserializer

            def _no_default(value: Any, read: Any = original) -> Any:
                if value is None:
                    raise ValueError("no default")
                return read(value)

            self._patch_metadata(key, deserializer=_no_default)
        snapshot = self._build()

        (cleared,) = self._write({"thumbs": None}, snapshot=snapshot).widgets
        assert cleared.string_value == ""
        (moved,) = self._write({"amount": 5}, snapshot=snapshot).widgets
        assert list(moved.double_array_value.data) == [5.0]

    @parameterized.expand(
        [
            (
                "datetime_seconds",
                "when",
                "2026-01-02T10:15:42",
                dt.datetime(2026, 1, 2, 10, 15),
            ),
            (
                "datetime_fraction",
                "when",
                "2026-01-02T10:15:00.250",
                dt.datetime(2026, 1, 2, 10, 15),
            ),
            (
                "datetime_space",
                "when",
                "2026-01-02 10:15",
                dt.datetime(2026, 1, 2, 10, 15),
            ),
            ("datetime_bare_date", "when", "2026-01-03", dt.datetime(2026, 1, 3)),
            (
                "datetime_offset",
                "when",
                "2026-01-02T10:15+01:00",
                _Refused("has an offset"),
            ),
            ("datetime_not_iso", "when", "tomorrow", _Refused("not an ISO 8601 date")),
            ("time_minute_step", "time", "10:15:42", dt.time(10, 15)),
            ("time_second_step", "precise", "10:15:42", dt.time(10, 15, 42)),
            ("time_offset", "time", "10:15+01:00", _Refused("has an offset")),
            ("time_not_iso", "time", "noon", _Refused("not an ISO 8601 time")),
            ("date_slider", "day_slider", "2026-01-03", dt.date(2026, 1, 3)),
            (
                "slider_microseconds",
                "day_slider",
                1767398400000000,
                _Refused("must be ISO dates or times"),
            ),
            ("slider_not_iso", "day_slider", "soon", _Refused("ISO dates or times")),
            (
                "time_to_a_date_slider",
                "day_slider",
                "10:00",
                _Refused("ISO dates without a time"),
            ),
            (
                "datetime_to_a_date_slider",
                "day_slider",
                "2026-01-03T10:00",
                _Refused("ISO dates without a time"),
            ),
            ("time_slider", "time_slider", "10:15", dt.time(10, 15)),
            (
                "zoned_slider_bare_date",
                "moment_slider",
                "2026-01-03",
                dt.datetime(2026, 1, 3, tzinfo=_BERLIN),
            ),
            (
                "zoned_slider_own_offset",
                "moment_slider",
                "2026-01-03T10:00+01:00",
                dt.datetime(2026, 1, 3, 10, tzinfo=_BERLIN),
            ),
            (
                "zoned_slider_no_offset",
                "moment_slider",
                "2026-01-03T10:00",
                dt.datetime(2026, 1, 3, 10, tzinfo=_BERLIN),
            ),
            (
                "zoned_slider_foreign_offset",
                "moment_slider",
                "2026-01-03T10:00+05:00",
                _Refused("offset other than its time zone's"),
            ),
            (
                "naive_slider_offset",
                "naive_slider",
                "2026-01-03T10:00+01:00",
                _Refused("has an offset"),
            ),
            # The zone's offset is judged on the value's own date.
            (
                "zoned_slider_summer_offset",
                "year_slider",
                "2026-07-03T10:00+02:00",
                dt.datetime(2026, 7, 3, 10, tzinfo=_BERLIN),
            ),
            (
                "zoned_slider_winter_offset_in_summer",
                "year_slider",
                "2026-07-03T10:00+01:00",
                _Refused("offset other than its time zone's"),
            ),
        ]
    )
    def test_iso_temporal_values(
        self, _name: str, key: str, sent: Any, expected: Any
    ) -> None:
        """Dates and times are ISO text in any form, and offsets must match."""
        render_value_widgets()
        st.time_input("Precise", dt.time(9, 30, 15), step=30, key="precise")
        st.slider(
            "Naive moment", value=dt.datetime(2026, 1, 2, 9, 30), key="naive_slider"
        )
        st.slider(
            "Year",
            min_value=dt.datetime(2026, 1, 1, tzinfo=_BERLIN),
            max_value=dt.datetime(2026, 12, 31, tzinfo=_BERLIN),
            value=dt.datetime(2026, 1, 2, tzinfo=_BERLIN),
            key="year_slider",
        )
        self._check({key: sent}, expected)

    @parameterized.expand(
        [
            ("empty_date_range", "days", [], ()),
            ("date_range_start", "days", ["2026-01-05"], (dt.date(2026, 1, 5),)),
            (
                "full_date_range",
                "days",
                ["2026-01-05", "2026-01-09"],
                (dt.date(2026, 1, 5), dt.date(2026, 1, 9)),
            ),
            ("decimal_label", "rate", "0.10", "0.10"),
            ("decimal_label_as_a_number", "rate", 0.1, _Refused("0.1 is not one")),
            ("largest_safe_integer", "whole", 2**53 - 1, 2**53 - 1),
            # Past 2**53 it rounds to a double, which is past what a browser
            # holds exactly. The widget sets no bound, so none is named.
            (
                "integer_past_int64_is_refused",
                "whole",
                2**63,
                _Refused(
                    "'whole' takes a whole number up to 9007199254740991, the "
                    "largest a browser holds exactly."
                ),
            ),
            (
                "integer_past_int64_on_pagination",
                "page",
                2**63,
                _Refused("whole number"),
            ),
            ("integer_too_large_for_a_float", "fraction", 10**400, _Refused("finite")),
            ("int_option_named_by_a_number", "count", 12, 12),
            ("nan", "fraction", math.nan, _Refused("must be a finite number")),
            ("infinity", "fraction", math.inf, _Refused("must be a finite number")),
            ("negative_infinity_on_a_slider", "amount", -math.inf, _Refused("finite")),
            ("object_option", "plan", "Pro", _Plan("Pro", 10)),
            ("format_func_label", "month", "December", 12),
            (
                "format_func_value",
                "month",
                12,
                _Refused("12 is not one of the options"),
            ),
        ]
    )
    def test_codec_fixtures(
        self, _name: str, key: str, sent: Any, expected: Any
    ) -> None:
        """Values whose encoding is easy to get wrong read back as the app expects."""
        render_value_widgets()
        _render_option_widgets()
        self._check({key: sent}, expected)

    @parameterized.expand(
        [
            ("button", {"key": "go"}, True),
            (
                "button_with_a_value",
                {"key": "go", "value": "x"},
                _Refused("no trigger"),
            ),
            ("chat_text", {"key": "prompt", "value": "hi"}, "hi"),
            ("chat_empty_text_is_fired", {"key": "prompt", "value": ""}, ""),
            ("chat_without_text", {"key": "prompt"}, _Refused("string `value`")),
            ("chat_number", {"key": "prompt", "value": 5}, _Refused("string `value`")),
            (
                "chat_past_max_chars",
                {"key": "prompt", "value": "x" * 9},
                _Refused("'prompt' takes at most 8 characters"),
            ),
            ("chat_at_max_chars", {"key": "prompt", "value": "x" * 8}, "x" * 8),
            ("menu_option", {"key": "menu", "value": "December"}, "December"),
            (
                "menu_unknown_option",
                {"key": "menu", "value": "May"},
                _Refused(
                    "'May' is not one of the options for 'menu': 'January', 'December'."
                ),
            ),
            (
                "menu_object",
                {"key": "menu", "value": {"month": 1}},
                _Refused("one of its options: 'January', 'December'."),
            ),
            ("menu_without_a_payload", {"key": "menu"}, _Refused("string `value`")),
        ]
    )
    def test_trigger_payloads(
        self, _name: str, trigger: dict[str, Any], expected: Any
    ) -> None:
        """A trigger carries only the payload its widget reads."""
        st.button("Go", key="go")
        st.chat_input("Say", key="prompt", max_chars=8)
        st.menu_button("Month", ["January", "December"], key="menu")
        self._check(None, expected, trigger=trigger)

    def test_a_dialog_without_on_dismiss_has_no_overlay_key(self) -> None:
        """With the default `on_dismiss`, the dialog is not addressable."""

        @st.dialog("Notice")
        def notice() -> None:
            st.markdown("body")

        notice()

        dialog = _one(self._build().document, "dialog")
        assert "key" not in dialog
        assert dialog["props"]["on_dismiss"] == "ignore"

    @parameterized.expand(
        [
            ("submit_alone", None, "save", None),
            ("fields_and_a_submit", {"name": "Ada", "age": 36}, "draft", None),
            ("unrelated_widget_and_trigger", {"outside": True}, "go", None),
            ("fields_without_a_submit", {"name": "Ada"}, None, "missing_form_submit"),
            ("two_forms", {"name": "Ada"}, "pay", "cross_form_batch"),
            (
                "field_and_outside_widget",
                {"name": "Ada", "outside": True},
                "save",
                "cross_form_batch",
            ),
            ("field_and_outside_trigger", {"name": "Ada"}, "go", "cross_form_batch"),
            (
                "submit_and_other_forms_field",
                {"holder": "Ada"},
                "save",
                "cross_form_batch",
            ),
        ]
    )
    def test_form_rules(
        self,
        _name: str,
        widget_state: dict[str, Any] | None,
        submit: str | None,
        code: str | None,
    ) -> None:
        """A form's fields travel with exactly one of its submit triggers."""
        _render_two_forms()
        trigger = {"key": submit} if submit else None
        if code is not None:
            assert self._refusal(widget_state, trigger=trigger).code == code
            return
        encoded = self._write(widget_state, trigger=trigger)
        assert len(encoded.widgets) == len(widget_state or {}) + 1

    def test_resolve_fragment_scopes_to_a_shared_fragment(self) -> None:
        """Keys in one fragment rerun it; anything wider, or a fragment the
        session no longer holds, is a full rerun.
        """

        @st.fragment
        def panel() -> None:
            st.radio("Detail", ["x", "y"], key="detail")
            st.checkbox("Pin", key="pin")

        @st.fragment
        def other_panel() -> None:
            st.checkbox("Other", key="other")

        panel()
        other_panel()
        st.checkbox("Outside", key="outside")
        snapshot = self._build()

        def scope(widget_state: dict[str, Any], *, held: bool = True) -> str:
            return widget_writes.resolve_fragment(
                self._session_state(),
                snapshot.element_states,
                widget_state=widget_state,
                trigger=None,
                has_fragment=lambda _fragment_id: held,
            )

        panel_fragment = snapshot.element_states[self._element_id("detail")].fragment_id
        assert panel_fragment
        assert scope({"detail": "y", "pin": True}) == panel_fragment
        assert scope({"detail": "y", "pin": True}, held=False) == ""
        assert scope({"detail": "y", "outside": True}) == ""
        assert scope({"detail": "y", "other": True}) == ""
        assert scope({"outside": True}) == ""

    def test_resolve_fragment_keeps_an_open_dialog_apart(self) -> None:
        """A dialog's widgets rerun its fragment and cannot mix with anything
        else, or go to a full rerun when the session no longer holds it.
        """

        @st.dialog("Rename", on_dismiss="rerun")
        def rename() -> None:
            st.text_input("New name", key="new_name")
            st.button("Next", key="next")

        st.checkbox("Archive", key="archive")
        rename()
        snapshot = self._build()
        dismiss = _one(snapshot.document, "dialog")["key"]

        def scope(
            widget_state: dict[str, Any] | None,
            trigger: dict[str, Any] | None,
            *,
            held: bool = True,
        ) -> str:
            return widget_writes.resolve_fragment(
                self._session_state(),
                snapshot.element_states,
                widget_state=widget_state,
                trigger=trigger,
                has_fragment=lambda _fragment_id: held,
            )

        body = snapshot.element_states[self._element_id("new_name")].fragment_id
        assert body
        assert scope({"new_name": "Ada"}, {"key": "next"}) == body
        with pytest.raises(AgentRequestError) as dropped:
            scope({"new_name": "Ada"}, {"key": "next"}, held=False)
        assert dropped.value.code == "not_on_page"
        assert "'new_name' is in a dialog the app no longer holds" in (
            dropped.value.message
        )
        # The overlay belongs to the opener, here the main script.
        assert scope(None, {"key": dismiss}) == ""
        (fired,) = self._write(trigger={"key": dismiss}, snapshot=snapshot).widgets
        assert fired.trigger_value is True
        for widget_state, trigger in (
            ({"new_name": "Ada", "archive": True}, None),
            ({"new_name": "Ada"}, {"key": dismiss}),
        ):
            with pytest.raises(AgentRequestError) as raised:
                scope(widget_state, trigger)
            assert raised.value.code == "cross_dialog_batch"

    def test_errors_do_not_quote_a_password(self) -> None:
        """A refused password is described by its type, never quoted."""
        st.text_input("Password", type="password", key="pw")

        for sent, secrets in (
            (31415926, ["31415926"]),
            (["hunter2", "hunter3"], ["hunter2", "hunter3"]),
            ({"pin": "8008"}, ["8008"]),
        ):
            error = self._refusal({"pw": sent})
            assert error.code == "invalid_value"
            for text in (error.message, str(error.__cause__)):
                assert not any(secret in text for secret in secrets), text
