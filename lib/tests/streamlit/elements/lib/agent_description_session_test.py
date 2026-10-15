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
