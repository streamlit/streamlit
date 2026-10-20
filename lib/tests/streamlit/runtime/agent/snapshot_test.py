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

"""The snapshot builder turns a run's messages into the document an agent reads."""

from __future__ import annotations

import datetime as dt
import json
import re

import pandas as pd

import streamlit as st
from streamlit.error_util import show_uncaught_app_exception
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.state import SCRIPT_RUN_WITHOUT_ERRORS_KEY
from streamlit.testing.v1.util import patch_config_options
from tests.streamlit.runtime.agent.snapshot_test_case import (
    SnapshotCase,
    _by_type,
    _describe,
    _one,
    _one_keyed,
    _state,
    _walk,
)

_OBSERVED_AT = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")


class SnapshotBuilderTest(SnapshotCase):
    """Structure, actions, and run status, with recording forced on."""

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

    def test_element_state_records_limits_a_request_is_checked_against(self) -> None:
        """Constraints a later validator reads are stored on the element state."""
        st.date_input(
            "Days",
            (dt.date(2026, 1, 1), dt.date(2026, 1, 31)),
            key="days",
        )
        st.pills("Mood", ["a", "b"], key="mood")
        st.pills("Required", ["a", "b"], required=True, key="required")
        st.pills("Several", ["a", "b"], selection_mode="multi", key="several")
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
        assert _state(snapshot, "pills", "several").clearable is False
        assert _state(snapshot, "segmented_control", "mode").clearable is True
        # New text is legal, so the membership list is empty. The options stay
        # on the description for the client.
        open_city = _one_keyed(snapshot.document, "selectbox", "open_city")
        assert _state(snapshot, "selectbox", "open_city").options is None
        assert open_city["props"]["options"] == ["Paris"]
        assert open_city["props"]["accept_new_options"] is True
        assert _state(snapshot, "selectbox", "closed_city").options == ["Paris"]
        assert "clearable" not in _one_keyed(
            snapshot.document, "selectbox", "closed_city"
        )
        name = _state(snapshot, "text_input", "name")
        assert name.form_id == "edit"
        assert name.schema_type == "string"

    def test_clearable_records_an_empty_default_the_value_hides(self) -> None:
        """A chosen value hides an empty default, so `clearable` says null empties it."""
        st.selectbox("City", ["Paris"], index=None, key="optional_city")
        st.selectbox("Home", ["Paris"], key="home_city")
        st.radio("Choice", ["a"], index=None, key="choice")
        st.number_input("Count", value=None, key="count")
        st.number_input("Needed", value=None, required=True, key="needed")
        st.number_input("Set", value=1, key="set_count")
        st.date_input("Day", value=None, key="day")
        st.date_input("Due", value=None, required=True, key="due")
        st.time_input("When", value=None, key="when")
        st.time_input("Due time", value=None, required=True, key="due_time")
        st.datetime_input("Moment", value=None, key="moment")

        snapshot = self._build()
        optional = _one_keyed(snapshot.document, "selectbox", "optional_city")
        assert optional["clearable"] is True
        assert _state(snapshot, "selectbox", "optional_city").clearable is True
        assert "clearable" not in _one_keyed(
            snapshot.document, "selectbox", "home_city"
        )
        # A radio cannot be deselected, even when it starts with no selection.
        assert "clearable" not in _one_keyed(snapshot.document, "radio", "choice")
        assert (
            _one_keyed(snapshot.document, "number_input", "count")["clearable"] is True
        )
        assert "clearable" not in _one_keyed(
            snapshot.document, "number_input", "needed"
        )
        assert "clearable" not in _one_keyed(
            snapshot.document, "number_input", "set_count"
        )
        assert _one_keyed(snapshot.document, "date_input", "day")["clearable"] is True
        assert "clearable" not in _one_keyed(snapshot.document, "date_input", "due")
        assert _one_keyed(snapshot.document, "time_input", "when")["clearable"] is True
        assert "clearable" not in _one_keyed(
            snapshot.document, "time_input", "due_time"
        )
        assert (
            _one_keyed(snapshot.document, "datetime_input", "moment")["clearable"]
            is True
        )

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

        with patch_config_options({"client.showErrorDetails": "none"}):
            shown = self._build(finished, event).document
        shown_props = _one(shown, "exception")["props"]
        assert shown_props["message"] == "invalid syntax"
        assert shown_props["type"] == "SyntaxError"
        assert shown_props["stack_trace"] == ['File "app.py", line 1']

        recovered = ForwardMsg()
        recovered.script_finished = ForwardMsg.FINISHED_SUCCESSFULLY
        ready = self._build(finished, event, recovered).document
        assert ready["status"] == "ready"
        assert _by_type(ready, "exception") == []

    def test_container_actions_precede_their_children(self) -> None:
        """A stateful container is listed before the actions inside it."""
        one, _two = st.tabs(["One", "Two"], on_change="rerun", key="tabs")
        one.button("Inside", key="inside")

        document = self._build().document
        keys = [entry["key"] for entry in document["actions"]]
        assert keys.index("tabs") < keys.index("inside")
        assert _state(self._build(), "tabs", "tabs").options == ["One", "Two"]

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
