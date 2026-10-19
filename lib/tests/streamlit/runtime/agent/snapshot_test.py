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

"""The snapshot builder turns a run's messages into the tree an agent reads."""

from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import replace
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

import numpy as np
import pandas as pd

import streamlit as st
from streamlit.elements.exception import _GENERIC_UNCAUGHT_EXCEPTION_TEXT
from streamlit.elements.lib import agent_spec
from streamlit.elements.widgets.chat import ChatInputValue
from streamlit.error_util import show_uncaught_app_exception
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.runtime.agent.snapshot import (
    ElementState,
    Snapshot,
    _authored_options,
    _public_key,
    build_snapshot,
)
from streamlit.runtime.state import SCRIPT_RUN_WITHOUT_ERRORS_KEY
from streamlit.runtime.state.session_state import Serialized
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from streamlit.testing.v1.util import patch_config_options
from tests.delta_generator_test_case import DeltaGeneratorTestCase

if TYPE_CHECKING:
    from streamlit.runtime.state.session_state import SessionState

_OBSERVED_AT = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")


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


def _describe(path: list[int], body: dict[str, Any]) -> ForwardMsg:
    """A markdown element at ``path`` described by ``body``."""
    message = ForwardMsg()
    message.metadata.delta_path[:] = path
    message.metadata.agent_props = json.dumps(body)
    message.delta.new_element.markdown.body = str(body.get("props", {}).get("body", ""))
    return message


class SnapshotBuilderTest(DeltaGeneratorTestCase):
    """Structure, values, actions, and run status, with recording forced on."""

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

    def test_envelope_and_root_containers(self) -> None:
        """The four roots stay, in order, around whatever the run emitted."""
        st.markdown("hello")
        st.sidebar.caption("side")
        st.chat_input("Say something")

        document = self._build(query_params={"region": ["Europe", "AMER"]}).document

        assert document["schema_version"] == 1
        assert document["session_id"] == "s_7f3a"
        assert document["status"] == "ready"
        assert _OBSERVED_AT.fullmatch(document["observed_at"])
        assert document["page"] == {}
        assert document["pages"] == []
        assert document["query_params"] == {"region": ["Europe", "AMER"]}
        assert document["tree"]["type"] == "root"
        assert [child["type"] for child in document["tree"]["children"]] == [
            "main",
            "sidebar",
            "event",
            "bottom",
        ]
        assert _one(document, "markdown")["props"]["body"] == "hello"
        assert _one(document, "caption")["props"]["body"] == "side"
        assert (
            _by_type(document, "chat_input")[0] in _one(document, "bottom")["children"]
        )
        assert "undescribed_types" not in document
        assert all("data" not in node for node in _walk(document["tree"]))

    def test_later_delta_replaces_the_same_position(self) -> None:
        """A slot written twice keeps the later element, as the frontend does."""
        slot = st.empty()
        slot.markdown("first")
        slot.markdown("second")

        document = self._build().document
        bodies = [node["props"]["body"] for node in _by_type(document, "markdown")]
        assert bodies == ["second"]
        assert _by_type(document, "empty") == []

    def test_block_adopts_children_that_arrived_first(self) -> None:
        """A block written after its child keeps that child."""
        child = _describe(
            [0, 0, 0],
            {"type": "markdown", "props": {"body": "inside"}},
        )
        block = ForwardMsg()
        block.metadata.delta_path[:] = [0, 0]
        block.metadata.agent_props = json.dumps(
            {"type": "expander", "props": {"label": "More", "expanded": False}}
        )
        block.delta.add_block.expandable.label = "More"

        document = self._build(child, block).document
        expander = _one(document, "expander")
        assert expander["props"]["label"] == "More"
        assert expander["children"] == [
            {"type": "markdown", "props": {"body": "inside"}}
        ]

        # Re-sending the same block, as a dialog does when it updates, keeps
        # the children. A different block type replaces them.
        again = ForwardMsg()
        again.metadata.delta_path[:] = [0, 0]
        again.metadata.agent_props = json.dumps(
            {
                "type": "expander",
                "props": {"label": "More", "expanded": True},
            }
        )
        again.delta.add_block.expandable.label = "More"
        updated = self._build(child, block, again).document
        assert _one(updated, "expander")["props"]["expanded"] is True
        assert _one(updated, "expander")["children"][0]["props"]["body"] == "inside"

    def test_replacing_a_container_drops_its_children(self) -> None:
        """A different block replaces the previous one, as the frontend does.

        The same proto type keeps its children. A dialog with a new identity
        does not, so the previous dialog's widgets do not stay mounted.
        """
        container = ForwardMsg()
        container.metadata.delta_path[:] = [0, 0]
        container.metadata.agent_props = json.dumps({"type": "container"})
        container.delta.add_block.flex_container.SetInParent()
        first = _describe(
            [0, 0, 0],
            {
                "type": "button",
                "key": "$$ID-1-one",
                "action": "trigger",
                "props": {"label": "One"},
            },
        )
        second = _describe(
            [0, 0, 1],
            {
                "type": "button",
                "key": "$$ID-2-two",
                "action": "trigger",
                "props": {"label": "Two"},
            },
        )
        expander = ForwardMsg()
        expander.metadata.delta_path[:] = [0, 0]
        expander.metadata.agent_props = json.dumps(
            {"type": "expander", "props": {"label": "More", "expanded": False}}
        )
        expander.delta.add_block.expandable.label = "More"
        only = _describe([0, 0, 0], {"type": "text", "props": {"body": "only"}})

        document = self._build(container, first, second, expander, only).document
        assert document["actions"] == []
        assert [
            child["props"]["body"] for child in _one(document, "expander")["children"]
        ] == ["only"]

        previous = ForwardMsg()
        previous.metadata.delta_path[:] = [2, 0]
        previous.metadata.agent_props = json.dumps(
            {"type": "dialog", "props": {"title": "A", "is_open": True}}
        )
        previous.delta.add_block.id = "dialog-a"
        previous.delta.add_block.dialog.title = "A"
        body = _describe([2, 0, 0], {"type": "markdown", "props": {"body": "secret"}})
        same = ForwardMsg()
        same.metadata.delta_path[:] = [2, 0]
        same.metadata.agent_props = json.dumps(
            {"type": "dialog", "props": {"title": "A", "is_open": False}}
        )
        same.delta.add_block.id = "dialog-a"
        same.delta.add_block.dialog.title = "A"
        kept = self._build(previous, body, same).document
        assert _one(kept, "dialog")["children"][0]["props"]["body"] == "secret"

        replacement = ForwardMsg()
        replacement.metadata.delta_path[:] = [2, 0]
        replacement.metadata.agent_props = json.dumps(
            {"type": "dialog", "props": {"title": "B", "is_open": True}}
        )
        replacement.delta.add_block.id = "dialog-b"
        replacement.delta.add_block.dialog.title = "B"
        replaced = self._build(previous, body, replacement).document
        assert _one(replaced, "dialog")["props"]["title"] == "B"
        assert _one(replaced, "dialog")["children"] == []

    def test_contentless_and_transparent_nodes_drop_out(self) -> None:
        """Placeholders, blank space, and internal wrappers are not nodes."""
        st.empty()
        st.space()
        st.skeleton()
        st.markdown("kept")
        wrapper = ForwardMsg()
        wrapper.metadata.delta_path[:] = [0, 4]
        wrapper.metadata.agent_props = json.dumps(
            {"type": "container", "transparent": True}
        )
        wrapper.delta.add_block.transparent.SetInParent()
        inner = _describe(
            [0, 4, 0],
            {"type": "caption", "props": {"body": "through"}},
        )

        document = self._build(wrapper, inner).document
        main = _one(document, "main")
        assert [child["type"] for child in main["children"]] == ["markdown", "caption"]
        assert _by_type(document, "empty") == []
        assert _by_type(document, "space") == []
        assert _by_type(document, "skeleton") == []

    def test_single_child_container_collapses_unless_it_is_named(self) -> None:
        """A bare container with one child contributes that child."""
        with st.container():
            st.markdown("only")
        with st.container(key="box"):
            st.markdown("named")
        with st.container():
            st.markdown("left")
            st.markdown("right")

        document = self._build().document
        containers = _by_type(document, "container")
        assert [container.get("key") for container in containers] == ["box", None]
        named = next(
            container for container in containers if container.get("key") == "box"
        )
        assert named["children"][0]["props"]["body"] == "named"
        pair = next(
            container for container in containers if container.get("key") is None
        )
        assert [child["props"]["body"] for child in pair["children"]] == [
            "left",
            "right",
        ]
        assert "only" in [
            node["props"]["body"] for node in _by_type(document, "markdown")
        ]

    def test_columns_expander_and_tabs_keep_their_children(self) -> None:
        """Grouping stays, including content a browser would hide."""
        left, right = st.columns(2)
        left.markdown("L")
        right.markdown("R")
        with st.expander("Details", expanded=False):
            st.markdown("hidden")
        one, two = st.tabs(["One", "Two"])
        one.markdown("first")
        two.markdown("second")

        document = self._build().document
        columns = _one(document, "columns")
        assert [child["type"] for child in columns["children"]] == ["column", "column"]
        assert [
            child["children"][0]["props"]["body"] for child in columns["children"]
        ] == [
            "L",
            "R",
        ]
        expander = _one(document, "expander")
        assert expander["props"]["expanded"] is False
        assert expander["children"][0]["props"]["body"] == "hidden"
        tabs = _by_type(document, "tab")
        assert [tab["props"]["label"] for tab in tabs] == ["One", "Two"]
        assert [tab["props"]["open"] for tab in tabs] == [True, False]
        assert [tab["children"][0]["props"]["body"] for tab in tabs] == [
            "first",
            "second",
        ]

    def test_transient_messages_are_skipped(self) -> None:
        """A spinner is progress for a run that has already finished."""
        st.markdown("done")
        no_path = ForwardMsg()
        no_path.delta.new_element.markdown.body = "nowhere"
        transient = ForwardMsg()
        transient.metadata.delta_path[:] = [0, 1]
        transient.metadata.agent_props = json.dumps(
            {"type": "spinner", "props": {"text": "wait"}}
        )
        transient.delta.new_transient.elements.add().spinner.text = "wait"

        # A descendant whose own block never arrived is still in the tree.
        orphan = _describe(
            [0, 2, 0],
            {"type": "caption", "props": {"body": "unwrapped"}},
        )
        document = self._build(no_path, transient, orphan).document
        assert _by_type(document, "spinner") == []
        assert [node["props"]["body"] for node in _by_type(document, "markdown")] == [
            "done"
        ]
        assert _one(document, "caption")["props"]["body"] == "unwrapped"

    def test_undescribed_elements_are_named_after_their_proto_field(self) -> None:
        """A gap stays visible, and a widget's value does not leak through it."""
        element = ForwardMsg()
        element.metadata.delta_path[:] = [0, 0]
        text = element.delta.new_element.text_input
        text.id = "$$ID-abc-None"
        text.label = "Password"
        text.value = "secret"
        text.default = "secret"

        block = ForwardMsg()
        block.metadata.delta_path[:] = [0, 1]
        block.delta.add_block.form.form_id = "bare"
        child = _describe(
            [0, 1, 0],
            {"type": "markdown", "props": {"body": "in form"}},
        )

        document = self._build(element, block, child).document
        assert document["undescribed_types"] == ["form", "text_input"]
        leaked = _one(document, "text_input")
        assert "secret" not in json.dumps(leaked)
        assert leaked["props"]["label"] == "Password"
        assert leaked["key"] == "$$ID-abc-None"
        assert _one(document, "form")["children"][0]["props"]["body"] == "in form"

    def test_actions_skip_disabled_and_unsupported_elements(self) -> None:
        """The index names what can be set or fired, and nothing else."""
        st.button("Refresh", key="refresh")
        st.button("Wait", key="wait", disabled=True)
        st.button("Generated")
        st.feedback("stars", key="mood")
        st.file_uploader("Upload", key="upload")
        st.dataframe(pd.DataFrame({"a": [1]}), on_select="rerun", key="table")
        st.download_button("Save", b"data", key="save")
        st.download_button("Later", lambda: b"data", key="later")
        st.link_button(
            "Docs", "https://docs.streamlit.io", on_click="rerun", key="docs"
        )
        with st.form("edit"):
            st.text_input("Name", key="name")
            st.form_submit_button("Submit")

        snapshot = self._build()
        document = snapshot.document
        by_key = {entry["key"]: entry for entry in document["actions"]}
        assert by_key["refresh"] == {
            "key": "refresh",
            "kind": "trigger",
            "type": "button",
            "label": "Refresh",
        }
        assert "wait" not in by_key
        assert _one_keyed(document, "button", "wait")["props"]["disabled"] is True
        generated = next(
            entry for entry in document["actions"] if entry["key"].endswith("-None")
        )
        assert generated["key"].startswith("$$ID-")
        assert generated["label"] == "Generated"
        assert "label" not in by_key["mood"]
        assert by_key["mood"]["type"] == "feedback"
        assert "upload" not in by_key
        assert (
            _one_keyed(document, "file_uploader", "upload")["support"]
            == "action_unsupported"
        )
        assert "table" not in by_key
        assert _one(document, "dataframe")["support"] == "action_unsupported"
        assert "data" not in _one(document, "dataframe")
        assert by_key["save"]["kind"] == "trigger"
        assert "later" not in by_key
        assert (
            _one_keyed(document, "download_button", "later")["support"]
            == "action_unsupported"
        )
        assert by_key["docs"] == {
            "key": "docs",
            "kind": "trigger",
            "type": "link_button",
            "label": "Docs",
        }
        assert _one_keyed(document, "text_input", "name")["form_id"] == "edit"
        assert by_key["name"]["kind"] == "value"
        assert _state(snapshot, "text_input", "name").form_id == "edit"

        mood = _state(snapshot, "feedback", "mood")
        assert mood.options == [0, 1, 2, 3, 4]
        assert mood.clearable is True
        assert mood.actionable is True
        upload = _state(snapshot, "file_uploader", "upload")
        assert upload.support == "action_unsupported"
        assert upload.actionable is False
        waiting = _state(snapshot, "button", "wait")
        assert waiting.disabled is True
        assert waiting.actionable is False

    def test_container_support_binds_its_contents(self) -> None:
        """A child of an undrivable container is not an action either."""
        block = ForwardMsg()
        block.metadata.delta_path[:] = [0, 0]
        block.metadata.agent_props = json.dumps(
            {
                "type": "container",
                "key": "wrapped",
                "support": "browser_required",
            }
        )
        block.delta.add_block.flex_container.SetInParent()
        child = _describe(
            [0, 0, 0],
            {
                "type": "button",
                "key": "$$ID-child-go",
                "action": "trigger",
                "props": {"label": "Go"},
            },
        )

        document = self._build(block, child).document
        button = _one(document, "button")
        assert button["support"] == "browser_required"
        assert document["actions"] == []

    def test_authored_keys_with_hyphens_and_bind(self) -> None:
        """The author's key is reported whole, and bind comes from the registry."""
        st.text_input("City", key="home-city", bind="query-params")
        with st.form("my-form"):
            st.text_input("Note", key="note")

        document = self._build().document
        city = _one_keyed(document, "text_input", "home-city")
        assert city["props"]["bind"] == "query-params"
        assert _one(document, "form")["key"] == "my-form"

    def test_password_value_is_never_reported(self) -> None:
        """A password can be set, and it never comes back out."""
        st.text_input("Password", value="secret", type="password", key="pw")

        snapshot = self._build()
        node = _one_keyed(snapshot.document, "text_input", "pw")
        assert "value" not in node
        assert "secret" not in json.dumps(node)
        assert _state(snapshot, "text_input", "pw").actionable is True
        assert snapshot.document["actions"][0]["kind"] == "value"

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

    def test_element_state_records_limits_a_request_is_checked_against(self) -> None:
        """Constraints a later validator reads are stored on the element state."""
        st.date_input(
            "Days",
            (dt.date(2026, 1, 1), dt.date(2026, 1, 31)),
            key="days",
        )
        st.pills("Mood", ["a", "b"], key="mood")
        st.pills("Required", ["a", "b"], required=True, key="required")
        st.segmented_control("Mode", ["a", "b"], key="mode")
        st.selectbox("City", ["Paris"], accept_new_options=True, key="open_city")
        st.selectbox("Closed", ["Paris"], key="closed_city")
        with st.form("edit"):
            st.text_input("Name", key="name")

        snapshot = self._build()
        days = _state(snapshot, "date_input", "days")
        assert days.max_items == 2
        assert days.schema_type == "array"
        assert _state(snapshot, "pills", "mood").clearable is True
        assert _state(snapshot, "pills", "required").clearable is False
        assert _state(snapshot, "segmented_control", "mode").clearable is True
        assert _state(snapshot, "selectbox", "open_city").options_open is True
        assert _state(snapshot, "selectbox", "closed_city").options_open is False
        name = _state(snapshot, "text_input", "name")
        assert name.form_id == "edit"
        assert name.schema_type == "string"

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
            "streamlit.runtime.agent.snapshot.json_encoding.to_json_value",
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

    def test_dialog_body_uses_the_dialogs_fragment(self) -> None:
        """The dialog block keeps the opener's fragment; its body keeps its own."""

        @st.fragment
        def opener() -> None:
            st.markdown("opened from here")

            @st.dialog("Confirm")
            def ask() -> None:
                st.button("Yes", key="yes")

            ask()

        opener()

        snapshot = self._build()
        document = snapshot.document
        opener_fragment = _one(document, "markdown")["fragment"]
        dialog = _one(document, "dialog")
        button = _one_keyed(document, "button", "yes")
        assert dialog["fragment"] == opener_fragment
        assert button["fragment"] != opener_fragment
        assert _state(snapshot, "button", "yes").in_dialog is True
        assert _state(snapshot, "button", "yes").fragment_id == button["fragment"]
        assert "yes" in {entry["key"] for entry in document["actions"]}

    def test_a_closed_dialog_does_not_mark_its_body(self) -> None:
        """A closed dialog keeps its body, and nothing in it can be used."""
        from streamlit.delta_generator_singletons import get_dg_singleton_instance

        st.button("Outside", key="outside")
        dialog = get_dg_singleton_instance().event_dg._dialog(
            title="Closed", on_dismiss="rerun"
        )
        dialog.open()
        with dialog:
            st.button("Inside", key="inside")
        dialog.close()

        snapshot = self._build()
        document = snapshot.document
        assert _one(document, "dialog")["props"]["is_open"] is False
        assert _one_keyed(document, "button", "inside")["props"]["label"] == "Inside"
        inside = _state(snapshot, "button", "inside")
        assert inside.in_dialog is False
        assert inside.actionable is False
        dialog_state = next(
            state
            for state in snapshot.element_states.values()
            if state.command == "dialog"
        )
        assert dialog_state.actionable is False
        keys = {entry["key"] for entry in document["actions"]}
        assert "inside" not in keys
        assert "outside" in keys
        assert all(entry["type"] != "dialog" for entry in document["actions"])

    def test_status_uses_both_failure_signals(self) -> None:
        """A caught exception is not a failure. Either real signal is."""
        st.exception(ValueError("caught"))
        ready = self._build().document
        assert ready["status"] == "ready"
        assert _one(ready, "exception")["props"]["uncaught"] is False

        self.clear_queue()
        undescribed = ForwardMsg()
        undescribed.metadata.delta_path[:] = [0, 0]
        undescribed.delta.new_element.exception.type = "ValueError"
        undescribed.delta.new_element.exception.message = "from a browser cache"
        replayed = self._build(undescribed).document
        assert replayed["status"] == "ready"
        assert "uncaught" not in _one(replayed, "exception")["props"]

        self.clear_queue()
        show_uncaught_app_exception(ValueError("boom"))
        failed = self._build().document
        assert failed["status"] == "error"
        assert _one(failed, "exception")["props"]["uncaught"] is True

        self.clear_queue()
        st.markdown("still here")
        self._session_state()[SCRIPT_RUN_WITHOUT_ERRORS_KEY] = False
        suppressed = self._build().document
        assert suppressed["status"] == "error"
        assert _by_type(suppressed, "exception") == []
        assert _one(suppressed, "markdown")["props"]["body"] == "still here"

    def test_compile_error_is_reported_in_main(self) -> None:
        """A script that did not compile is an uncaught exception and no actions."""
        st.button("Go", key="go")
        finished = ForwardMsg()
        finished.script_finished = ForwardMsg.FINISHED_WITH_COMPILE_ERROR
        event = ForwardMsg()
        exception = event.session_event.script_compilation_exception
        exception.type = "SyntaxError"
        exception.message = "invalid syntax"
        exception.stack_trace.append('File "app.py", line 1')

        without_detail = self._build(finished).document
        assert without_detail["status"] == "error"
        assert _by_type(without_detail, "exception") == []

        snapshot = self._build(finished, event)
        document = snapshot.document
        assert document["status"] == "error"
        assert document["actions"] == []
        assert _state(snapshot, "button", "go").actionable is False
        reported = _one(document, "exception")
        assert reported["props"]["uncaught"] is True
        assert reported["props"]["type"] == "SyntaxError"
        assert reported["props"]["message"] == "invalid syntax"
        assert reported["props"]["stack_trace"] == ['File "app.py", line 1']
        assert reported in _one(document, "main")["children"]

        changed = ForwardMsg()
        changed.session_event.script_changed_on_disk = True
        still = self._build(finished, event, changed).document
        assert _one(still, "exception")["props"]["message"] == "invalid syntax"

        with patch_config_options({"client.showErrorDetails": "stacktrace"}):
            redacted = self._build(finished, event).document
        redacted_props = _one(redacted, "exception")["props"]
        assert redacted_props["message"] == _GENERIC_UNCAUGHT_EXCEPTION_TEXT
        assert redacted_props["type"] == "SyntaxError"
        assert redacted_props["stack_trace"] == ['File "app.py", line 1']

        recovered = ForwardMsg()
        recovered.script_finished = ForwardMsg.FINISHED_SUCCESSFULLY
        ready = self._build(finished, event, recovered).document
        assert ready["status"] == "ready"
        assert _by_type(ready, "exception") == []

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

    def test_container_actions_precede_their_children(self) -> None:
        """A stateful container is listed before the actions inside it."""
        one, _two = st.tabs(["One", "Two"], on_change="rerun", key="tabs")
        one.button("Inside", key="inside")

        document = self._build().document
        keys = [entry["key"] for entry in document["actions"]]
        assert keys.index("tabs") < keys.index("inside")
        assert _state(self._build(), "tabs", "tabs").options == ["One", "Two"]

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

    def test_a_form_and_a_widget_may_share_an_authored_key(self) -> None:
        """Both nodes report the authored key. The request validator tells them apart."""
        with st.form("name"):
            st.text_input("Name", key="name")

        document = self._build().document
        named = [node for node in _walk(document["tree"]) if node.get("key") == "name"]
        assert [node["type"] for node in named] == ["form", "text_input"]

    def test_pages_come_from_navigation_or_the_single_script(self) -> None:
        """A single script is one page. Navigation replaces the session list."""
        single = ForwardMsg()
        single.new_session.name = "revenue.py"
        page = single.new_session.app_pages.add()
        page.page_script_hash = "main"
        page.page_name = "revenue"
        page.url_pathname = "revenue"
        page.icon = ":material/payments:"
        single.new_session.page_script_hash = "main"

        document = self._build(single).document
        expected = {
            "url_path": "",
            "title": "revenue.py",
            "icon": ":material/payments:",
        }
        assert document["page"] == expected
        assert document["pages"] == [expected]

        navigation = ForwardMsg()
        navigation.navigation.page_script_hash = "reports"
        home = navigation.navigation.app_pages.add()
        home.page_script_hash = "main"
        home.page_name = "Home"
        home.url_pathname = ""
        reports = navigation.navigation.app_pages.add()
        reports.page_script_hash = "reports"
        reports.page_name = "Reports"
        reports.url_pathname = "reports"
        reports.icon = ":material/description:"

        navigated = self._build(single, navigation).document
        assert navigated["pages"] == [
            {"url_path": "", "title": "Home"},
            {
                "url_path": "reports",
                "title": "Reports",
                "icon": ":material/description:",
            },
        ]
        assert navigated["page"] == navigated["pages"][1]
        navigated["page"]["title"] = "changed"
        assert navigated["pages"][1]["title"] == "Reports"

    def test_external_navigation_links_are_not_pages(self) -> None:
        """An external link is not a destination the app can switch to."""
        navigation = ForwardMsg()
        navigation.navigation.page_script_hash = "main"
        home = navigation.navigation.app_pages.add()
        home.page_script_hash = "main"
        home.page_name = "Home"
        home.url_pathname = ""
        docs = navigation.navigation.app_pages.add()
        docs.page_script_hash = "docs"
        docs.page_name = "Docs"
        docs.url_pathname = "Docs"
        docs.external_url = "https://docs.streamlit.io"

        document = self._build(navigation).document
        assert document["pages"] == [{"url_path": "", "title": "Home"}]
        assert document["page"] == document["pages"][0]


def _one_keyed(
    document: dict[str, Any], element_type: str, key: str | None
) -> dict[str, Any]:
    """The only node of ``element_type`` with ``key``."""
    matches = [
        node for node in _by_type(document, element_type) if node.get("key") == key
    ]
    assert len(matches) == 1, matches
    return matches[0]


def _state(snapshot: Snapshot, command: str, key: str) -> ElementState:
    """Element state for the node whose public key is ``key``."""
    matches = [
        state
        for element_id, state in snapshot.element_states.items()
        if state.command == command and _public_key(element_id) == key
    ]
    assert len(matches) == 1, matches
    return matches[0]
