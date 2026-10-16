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

"""Descriptions are recorded only for agent sessions, and their arguments never raise."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import patch

import pandas as pd

import streamlit as st
from streamlit.elements.lib import agent_spec
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.forward_msg_cache import populate_hash_if_needed
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.lib.agent_spec_coverage_test import _PRODUCERS


def _descriptions(messages: list[ForwardMsg]) -> list[dict[str, Any]]:
    """Decoded descriptions attached to ``messages``."""
    return [
        json.loads(message.metadata.agent_props)
        for message in messages
        if message.metadata.HasField("agent_props")
    ]


class AgentDescriptionSessionTest(DeltaGeneratorTestCase):
    """Session gating, cache replay, and description arguments."""

    def tearDown(self) -> None:
        agent_spec.forget_agent_session(self.script_run_ctx.session_id)
        st.cache_data.clear()
        st.cache_resource.clear()
        super().tearDown()

    def _record(self) -> None:
        agent_spec.register_agent_session(self.script_run_ctx.session_id)

    def test_is_recording_follows_the_session_id(self) -> None:
        """Another agent session does not make this browser session record."""
        agent_spec.register_agent_session("some-other-session")
        try:
            assert agent_spec.is_recording() is False
        finally:
            agent_spec.forget_agent_session("some-other-session")

    def test_is_recording_requires_a_script_context(self) -> None:
        """Recording needs both an agent session and a script-run context."""
        self._record()
        with patch(
            "streamlit.runtime.scriptrunner_utils.script_run_context.get_script_run_ctx",
            return_value=None,
        ):
            assert agent_spec.is_recording() is False

    def test_browser_session_sets_no_agent_props(self) -> None:
        """Every element mock runs in a browser session without a description.

        Description arguments are evaluated on this path, so an argument that
        raises for an input the command accepts fails here.
        """
        for producers in _PRODUCERS.values():
            for producer in producers:
                producer()

        assert _descriptions(list(self.forward_msg_queue._queue)) == []

    def test_recording_session_attaches_the_command_description(self) -> None:
        """An agent session stores the command name and its parameters."""
        self._record()
        st.markdown("hello", help="more")

        decoded = _descriptions(list(self.forward_msg_queue._queue))
        assert decoded == [
            {
                "type": "markdown",
                "props": {"body": "hello", "help": "more", "unsafe_allow_html": False},
            }
        ]

    def test_markdown_reports_unsafe_html_as_a_boolean(self) -> None:
        """``unsafe_allow_html`` is reported for both values, including the default."""
        self._record()
        st.markdown("<b>hello</b>", unsafe_allow_html=True)
        st.caption("plain")

        descriptions = _descriptions(list(self.forward_msg_queue._queue))
        markdown = next(item for item in descriptions if item["type"] == "markdown")
        caption = next(item for item in descriptions if item["type"] == "caption")
        assert markdown["props"]["unsafe_allow_html"] is True
        assert caption["props"]["unsafe_allow_html"] is False

    def test_indented_markdown_and_caption_match_the_proto(self) -> None:
        """Body text is the dedented string the browser receives."""
        self._record()
        st.markdown(
            """
            - one
            - two
            """
        )
        st.caption(
            """
            note
            """
        )

        descriptions = _descriptions(list(self.forward_msg_queue._queue))
        markdown = next(item for item in descriptions if item["type"] == "markdown")
        caption = next(item for item in descriptions if item["type"] == "caption")
        assert markdown["props"]["body"] == "- one\n- two"
        assert caption["props"]["body"] == "note"

    def test_selectable_range_index_reports_hide_index(self) -> None:
        """Row selection hides a range index, and the description says so."""
        self._record()
        st.dataframe(
            pd.DataFrame({"a": [1, 2]}),
            on_select="rerun",
            selection_mode="single-row",
        )

        dataframe = next(
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "dataframe"
        )
        assert dataframe["props"]["hide_index"] is True

    def test_text_input_reports_the_resolved_autocomplete(self) -> None:
        """Autocomplete includes the type default, an override, and empty."""
        self._record()
        st.text_input("Email", type="email")
        st.text_input("Name", autocomplete="name")
        st.text_input("Blank", autocomplete="")

        inputs = [
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "text_input"
        ]
        assert [item["props"]["autocomplete"] for item in inputs] == [
            "email",
            "name",
            "",
        ]

    def test_number_input_reports_the_resolved_format(self) -> None:
        """An omitted format is the printf string the browser receives."""
        self._record()
        st.number_input("Int", value=1)
        st.number_input("Float", value=1.0)

        formats = [
            item["props"]["format"]
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "number_input"
        ]
        assert formats == ["%d", "%0.2f"]

    def test_metric_reports_missing_value_and_dedented_delta(self) -> None:
        """A missing value is the em dash, and a string delta is dedented."""
        self._record()
        st.metric("Empty", None, "    up")

        metric = next(
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "metric"
        )
        assert metric["props"]["value"] == "—"
        assert metric["props"]["delta"] == "up"

    def test_chart_color_literal_is_not_an_encoding(self) -> None:
        """A hex color is presentation. A column name is an encoding."""
        self._record()
        frame = pd.DataFrame({"a": [1], "b": [2]})
        st.line_chart(frame, x="a", y="b", color="#ffaa00")
        st.line_chart(frame, x="a", y="b", color="b")

        charts = [
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "line_chart"
        ]
        assert "color" not in charts[0]["props"]
        assert charts[1]["props"]["color"] == "b"

    def test_plotly_selection_mode_survives_a_generator(self) -> None:
        """Selection modes are read after the iterable has been consumed."""
        import plotly.graph_objects as go

        self._record()
        figure = go.Figure(go.Scatter(x=[1], y=[1]))
        st.plotly_chart(
            figure, on_select="rerun", selection_mode=iter(["points", "box"])
        )

        chart = next(
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "plotly_chart"
        )
        assert set(chart["props"]["selection_mode"]) == {"points", "box"}
        assert "theme" not in chart["props"]

    def test_text_help_matches_the_dedented_proto(self) -> None:
        """Help is the dedented string the browser receives."""
        self._record()
        st.text("hello", help="    tip")

        message = self.get_message_from_queue()
        decoded = json.loads(message.metadata.agent_props)
        assert decoded["props"]["help"] == "tip"
        assert message.delta.new_element.text.help == "tip"

    def test_dataframe_column_order_reads_the_consumed_iterable(self) -> None:
        """A one-shot column order is read from the proto after it is consumed."""
        self._record()
        st.dataframe(pd.DataFrame({"b": [1], "a": [2]}), column_order=iter(["a", "b"]))

        dataframe = next(
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "dataframe"
        )
        assert dataframe["props"]["column_order"] == ["a", "b"]

    def test_data_editor_reports_disabled_false(self) -> None:
        """``disabled=False`` is an effective value, and a column list is omitted."""
        self._record()
        frame = pd.DataFrame({"a": [1]})
        st.data_editor(frame, disabled=False, key="unlocked")
        st.data_editor(frame, disabled=["a"], key="partial")

        editors = [
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "data_editor"
        ]
        assert editors[0]["props"]["disabled"] is False
        assert "disabled" not in editors[1]["props"]

    def test_custom_component_reports_bytes_and_omits_dataframes(self) -> None:
        """Bytes arguments are their length. Dataframe arguments stay omitted."""
        from streamlit.components.v1 import declare_component

        self._record()
        component = declare_component("demo", url="http://not.a.url")
        component(label="Ada", payload=b"abc", frame=pd.DataFrame({"a": [1]}))

        described = next(
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "components.v1.declare_component"
        )
        assert described["props"]["args"]["label"] == "Ada"
        assert described["props"]["args"]["payload"] == {"bytes": 3}
        assert "frame" not in described["props"]["args"]

    def test_fragment_rerun_resends_the_transparent_wrapper(self) -> None:
        """A fragment rerun keeps the instruction to skip the internal wrapper."""
        self._record()
        outside = st.container()

        @st.fragment
        def writer() -> None:
            with outside:
                st.markdown("inside")

        writer()

        def transparent() -> list[dict[str, Any]]:
            return [
                item
                for item in _descriptions(list(self.forward_msg_queue._queue))
                if item.get("transparent") is True
            ]

        assert transparent() == [
            {"type": "container", "transparent": True, "props": {}}
        ]

        fragment_id = next(iter(self.script_run_ctx.fragment_storage._fragments))
        self.script_run_ctx.fragment_ids_this_run = [fragment_id]
        self.clear_queue()
        self.script_run_ctx.fragment_storage._fragments[fragment_id]()

        assert transparent() == [
            {"type": "container", "transparent": True, "props": {}}
        ]

    def test_radio_series_captions_do_not_raise(self) -> None:
        """Captions may be a pandas Series, which has no truth value."""
        self._record()
        st.radio("Choose", ["a", "b"], captions=pd.Series(["one", "two"]))

        radio = next(
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "radio"
        )
        assert radio["props"]["captions"] == ["one", "two"]
        assert radio["props"]["options"] == ["a", "b"]
        assert radio["value_schema"] == {"type": "string"}

    def test_radio_reports_format_func_labels(self) -> None:
        """Options are the labels a later request would send back."""
        self._record()
        st.radio(
            "Month",
            [1, 12],
            format_func=lambda month: "December" if month == 12 else "January",
        )

        radio = next(
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "radio"
        )
        assert radio["props"]["options"] == ["January", "December"]

    def test_progress_reports_the_whole_percent_the_browser_shows(self) -> None:
        """The description uses the proto's rounded percent, as a fraction."""
        self._record()
        st.progress(0.335)

        message = self.get_message_from_queue()
        decoded = json.loads(message.metadata.agent_props)
        assert (
            decoded["props"]["value"] == message.delta.new_element.progress.value / 100
        )

    def test_json_body_keeps_nulls(self) -> None:
        """A null in ``st.json`` is content and stays in the description."""
        self._record()
        st.json({"a": None, "b": 1})

        decoded = json.loads(self.get_message_from_queue().metadata.agent_props)
        assert decoded["props"]["body"] == {"a": None, "b": 1}

    def test_agent_props_do_not_change_the_message_hash(self) -> None:
        """The description lives in metadata, which the cache hash excludes."""
        self._record()
        st.markdown("hello")
        described = self.get_message_from_queue()

        bare = ForwardMsg()
        bare.CopyFrom(described)
        bare.metadata.ClearField("agent_props")

        populate_hash_if_needed(described)
        populate_hash_if_needed(bare)
        assert described.hash == bare.hash
        assert described.metadata.HasField("agent_props")

    def test_cache_replay_keeps_descriptions_in_the_session_that_records(self) -> None:
        """A cache entry carries the description from the run that filled it.

        Replaying into a browser session drops it. Replaying a browser-filled
        entry into an agent session does not invent one.
        """

        @st.cache_data(show_spinner=False)
        def filled_by_agent() -> int:
            st.markdown("from-agent")
            with st.container():
                st.text("inside")
            return 1

        @st.cache_data(show_spinner=False)
        def filled_by_browser() -> int:
            st.markdown("from-browser")
            return 2

        self._record()
        filled_by_agent()
        filled_types = {
            item["type"] for item in _descriptions(list(self.forward_msg_queue._queue))
        }
        assert {"markdown", "container", "text"} <= filled_types

        self.clear_queue()
        agent_spec.forget_agent_session(self.script_run_ctx.session_id)
        filled_by_agent()
        assert _descriptions(list(self.forward_msg_queue._queue)) == []

        self.clear_queue()
        filled_by_browser()
        assert _descriptions(list(self.forward_msg_queue._queue)) == []

        self.clear_queue()
        self._record()
        filled_by_browser()
        assert _descriptions(list(self.forward_msg_queue._queue)) == []

    def test_status_update_resends_the_new_state(self) -> None:
        """``status.update()`` rebuilds the description on the replacement message."""
        self._record()
        with st.status("Working", expanded=False) as status:
            status.update(state="complete", expanded=True)

        statuses = [
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "status"
        ]
        assert statuses[-1]["props"]["state"] == "complete"
        assert statuses[-1]["props"]["expanded"] is True

    def test_dialog_open_reports_is_open(self) -> None:
        """A dialog's re-sent block reports that it is open."""
        self._record()

        @st.dialog("Hello")
        def my_dialog() -> None:
            st.write("content")

        my_dialog()

        dialogs = [
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "dialog"
        ]
        assert dialogs[-1]["props"]["is_open"] is True
