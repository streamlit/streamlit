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
from contextlib import ExitStack
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

import pandas as pd
import pyarrow as pa
from parameterized import parameterized

import streamlit as st
from streamlit import runtime
from streamlit.elements.lib import agent_data, agent_spec
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.agent.snapshot import build_snapshot
from streamlit.runtime.forward_msg_cache import populate_hash_if_needed
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.data_test_cases import SHARED_TEST_CASES, CaseMetadata
from tests.streamlit.elements.lib.agent_spec_coverage_test import _PRODUCERS
from tests.streamlit.runtime.agent.snapshot_test_case import (
    _assert_data_resolves,
    _one,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.runtime.media_file_manager import MediaFileManager


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

    def _media_file_mgr(self) -> MediaFileManager:
        return runtime.get_instance().media_file_mgr

    def _arrow_files(self) -> list[bytes]:
        """Contents of every Arrow file in media storage."""
        return [
            file.content
            for file in self.media_file_storage._files_by_id.values()
            if file.mimetype == agent_data.ARROW_MIMETYPE
        ]

    def _start_full_run(self) -> None:
        """Start the next full run, after the last one's files were collected.

        A full run drops the session's media references and positions, so only
        what this run registers survives the collection at its end.
        """
        self.clear_queue()
        self.script_run_ctx.reset()
        self._media_file_mgr().clear_session_refs(self.script_run_ctx.session_id)
        self._media_file_mgr().remove_orphaned_files()

    def _snapshot(self, messages: list[ForwardMsg]) -> dict[str, Any]:
        return build_snapshot(
            session_id="s_7f3a",
            messages=messages,
            session_state=None,
            query_params={},
        ).document

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
                "props": {"body": "hello", "help": "more"},
            }
        ]

    def test_markdown_omits_unsafe_html_when_false(self) -> None:
        """The documented false default is omitted. True is reported."""
        self._record()
        st.markdown("<b>hello</b>", unsafe_allow_html=True)
        st.caption("plain")

        descriptions = _descriptions(list(self.forward_msg_queue._queue))
        markdown = next(item for item in descriptions if item["type"] == "markdown")
        caption = next(item for item in descriptions if item["type"] == "caption")
        assert markdown["props"]["unsafe_allow_html"] is True
        assert "unsafe_allow_html" not in caption["props"]

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

    def test_non_pandas_data_reports_the_hidden_index(self) -> None:
        """A dict has no index, so the description reports the hidden flag."""
        self._record()
        st.dataframe({"a": [1, 2]})
        st.data_editor({"a": [1]}, key="dict-editor")

        described = _descriptions(list(self.forward_msg_queue._queue))
        dataframe = next(item for item in described if item["type"] == "dataframe")
        editor = next(item for item in described if item["type"] == "data_editor")
        assert dataframe["props"]["hide_index"] is True
        assert editor["props"]["hide_index"] is True

    def test_text_placeholder_keeps_an_authored_space(self) -> None:
        """Text widgets do not treat a single space as an empty sentinel."""
        self._record()
        st.text_input("Empty", placeholder="")
        st.text_input("Space", placeholder=" ")
        st.text_area("Area empty", placeholder="")
        st.text_area("Area space", placeholder=" ")

        inputs = [
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "text_input"
        ]
        areas = [
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "text_area"
        ]
        assert [item["props"]["placeholder"] for item in inputs] == ["", " "]
        assert [item["props"]["placeholder"] for item in areas] == ["", " "]

    def test_multiselect_placeholder_reports_the_public_empty_value(self) -> None:
        """An explicit empty placeholder is ``""``, and the default is omitted."""
        self._record()
        st.multiselect("Default", ["a"])
        st.multiselect("Empty", ["a"], placeholder="")
        st.multiselect("Custom", ["a"], placeholder="Pick")

        selects = [
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "multiselect"
        ]
        assert "placeholder" not in selects[0]["props"]
        assert selects[1]["props"]["placeholder"] == ""
        assert selects[2]["props"]["placeholder"] == "Pick"

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

    def test_chart_reports_the_color_and_size_arguments(self) -> None:
        """Color and size are the arguments the author passed.

        The chart specification carries whether a string is a column or a
        fixed color, so the description does not resolve that itself.
        """
        self._record()
        frame = pd.DataFrame({"a": [1], "b": [2]})
        st.line_chart(frame, x="a", y="b", color="#ffaa00")
        st.line_chart(frame, x="a", y="b", color="b")
        st.scatter_chart(frame, x="a", y="b", size="b", color=["#ff0000"])

        described = _descriptions(list(self.forward_msg_queue._queue))
        line_charts = [item for item in described if item["type"] == "line_chart"]
        scatter = next(item for item in described if item["type"] == "scatter_chart")
        assert [item["props"]["color"] for item in line_charts] == ["#ffaa00", "b"]
        assert scatter["props"]["size"] == "b"
        assert scatter["props"]["color"] == ["#ff0000"]

    def test_map_reports_the_color_and_size_arguments(self) -> None:
        """Color and size are the arguments the author passed.

        The plotted table carries which columns those names refer to, so the
        description does not resolve them.
        """
        self._record()
        st.map(
            {
                "lat": [1.0],
                "lon": [2.0],
                "red": ["#ff0000"],
                "#0044ff": [12],
            },
            color="red",
            size="#0044ff",
        )
        st.map({"lat": [1.0], "lon": [2.0]}, color="#0044ff", size=20)

        maps = [
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "map"
        ]
        assert maps[0]["props"]["color"] == "red"
        assert maps[0]["props"]["size"] == "#0044ff"
        assert maps[1]["props"]["color"] == "#0044ff"
        assert maps[1]["props"]["size"] == 20

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

    def test_on_select_is_reported_only_with_selections_on(self) -> None:
        """`on_select` appears only when selections are on, as "rerun" even for a
        callback. The documented default, "ignore", is left out.
        """
        import altair as alt
        import plotly.graph_objects as go
        import pydeck as pdk

        self._record()
        frame = pd.DataFrame({"a": [1, 2]})
        chart = alt.Chart(frame).mark_bar().encode(x="a")
        figure = go.Figure(go.Scatter(x=[1], y=[1]))
        st.dataframe(frame)
        st.dataframe(frame, on_select=lambda: None, key="selectable_dataframe")
        st.plotly_chart(figure)
        st.plotly_chart(figure, on_select="rerun", key="selectable_plotly")
        st.pydeck_chart(pdk.Deck())
        st.pydeck_chart(pdk.Deck(), on_select="rerun", key="selectable_deck")
        st.altair_chart(chart)
        st.altair_chart(
            chart.add_params(alt.selection_point()),
            on_select="rerun",
            key="selectable_altair",
        )

        described = _descriptions(list(self.forward_msg_queue._queue))
        for command in ("dataframe", "plotly_chart", "pydeck_chart", "altair_chart"):
            plain, selectable = [item for item in described if item["type"] == command]
            assert "on_select" not in plain["props"], command
            assert selectable["props"]["on_select"] == "rerun", command

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

    def test_fragment_tables_in_an_outside_container_keep_their_files(self) -> None:
        """Each table a fragment writes to the sidebar is registered where it renders.

        The fragment's writes go into one wrapper block, and the sidebar's own
        cursor advances once for it, so its position would be the same for the
        second and third tables. The third would replace the second's
        reference, and the second's file would be collected while the snapshot
        still reports its URL. A fragment rerun reuses the wrapper.
        """
        self._record()

        @st.fragment
        def writer() -> None:
            for rows in (1, 2, 3):
                st.sidebar.dataframe(pd.DataFrame({"n": range(rows)}))

        def assert_registered_where_rendered() -> None:
            refs = self._media_file_mgr()._files_by_session_and_coord[
                self.script_run_ctx.session_id
            ]
            tables = [
                message
                for message in self.forward_msg_queue._queue
                if message.delta.new_element.WhichOneof("type") == "dataframe"
            ]
            assert len(tables) == 3
            for message in tables:
                [described] = _descriptions([message])
                file_id = described["data"]["url"].rsplit("/", 1)[-1]
                assert refs[str(list(message.metadata.delta_path))] == file_id
            self._media_file_mgr().remove_orphaned_files()
            assert len(self._arrow_files()) == 3

        writer()
        assert_registered_where_rendered()

        fragment_id = next(iter(self.script_run_ctx.fragment_storage._fragments))
        self.script_run_ctx.fragment_ids_this_run = [fragment_id]
        self.clear_queue()
        self.script_run_ctx.fragment_storage._fragments[fragment_id]()
        assert_registered_where_rendered()

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

        Replaying it in the same agent session keeps the description. Replaying
        into a browser session drops it. Replaying a browser-filled entry into
        an agent session does not invent one.
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
        filled_by_agent()
        replayed_types = {
            item["type"] for item in _descriptions(list(self.forward_msg_queue._queue))
        }
        assert {"markdown", "container", "text"} <= replayed_types

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

    def test_browser_session_builds_and_registers_no_data(self) -> None:
        """No element mock builds a data block or serves Arrow data, or even
        tries to, in a browser session: every builder's body reads its payload
        through one of these helpers.
        """
        helpers = ("_serve_arrow_over_http", "summarize_arrow", "parse_spec")
        with ExitStack() as stack:
            spies = [
                stack.enter_context(
                    patch.object(agent_data, helper, wraps=getattr(agent_data, helper))
                )
                for helper in helpers
            ]
            for producers in _PRODUCERS.values():
                for producer in producers:
                    producer()

        for spy in spies:
            spy.assert_not_called()
        assert self._arrow_files() == []

    @parameterized.expand(SHARED_TEST_CASES)
    def test_dataframe_and_table_data_accept_every_input(
        self, _name: str, input_data: Any, _metadata: CaseMetadata
    ) -> None:
        """Every input a table accepts gets a data block that counts its payload."""
        self._record()
        st.dataframe(input_data)
        st.table(input_data)

        messages = list(self.forward_msg_queue._queue)
        payloads = {
            "dataframe": messages[0].delta.new_element.dataframe.arrow_data.data,
            "table": messages[1].delta.new_element.table.arrow_data.data,
        }
        document = self._snapshot(messages)
        for element_type, payload in payloads.items():
            data = _one(document, element_type)["data"]
            _assert_data_resolves(data)
            assert (
                data["row_count"]
                == pa.RecordBatchStreamReader(payload).read_all().num_rows
            )

    def test_cache_replay_registers_table_data_only_for_agent_sessions(self) -> None:
        """A replay into the agent session registers the table again; a replay into
        a browser session registers nothing and attaches no description.
        """

        @st.cache_data(show_spinner=False)
        def filled_by_agent() -> int:
            st.dataframe(pd.DataFrame({"n": range(150)}))
            return 1

        self._record()
        filled_by_agent()
        [described] = _descriptions(list(self.forward_msg_queue._queue))
        self._start_full_run()
        assert self._arrow_files() == []

        filled_by_agent()
        self._media_file_mgr().remove_orphaned_files()
        [replayed] = _descriptions(list(self.forward_msg_queue._queue))
        assert replayed["data"] == described["data"]
        assert len(self._arrow_files()) == 1
        self.media_file_storage.get_file(described["data"]["url"].rsplit("/", 1)[-1])

        agent_spec.forget_agent_session(self.script_run_ctx.session_id)
        self._start_full_run()
        filled_by_agent()
        assert _descriptions(list(self.forward_msg_queue._queue)) == []
        assert self._arrow_files() == []

    @parameterized.expand(
        [
            ("table", lambda: st.table(pd.DataFrame({"n": range(3)}))),
            ("chart", lambda: st.line_chart(pd.DataFrame({"n": range(3)}))),
        ]
    )
    def test_cache_replay_serves_each_kind_of_data_again(
        self, _name: str, emit: Callable[[], object]
    ) -> None:
        """A replayed table or chart serves the bytes its first run did, read
        back from the replayed payload.
        """

        @st.cache_data(show_spinner=False)
        def filled_by_agent() -> int:
            emit()
            return 1

        self._record()
        filled_by_agent()
        [described] = _descriptions(list(self.forward_msg_queue._queue))
        [original] = self._arrow_files()
        self._start_full_run()

        filled_by_agent()
        self._media_file_mgr().remove_orphaned_files()

        [replayed] = _descriptions(list(self.forward_msg_queue._queue))
        assert replayed["data"] == described["data"]
        served = self.media_file_storage.get_file(
            replayed["data"]["url"].rsplit("/", 1)[-1]
        )
        assert served.content == original

    def test_a_browser_filled_cache_replays_as_undescribed(self) -> None:
        """An entry a browser filled has no copy, so the agent sees why there is none."""

        @st.cache_data(show_spinner=False)
        def filled_by_browser() -> int:
            st.dataframe(pd.DataFrame({"n": range(150)}))
            return 1

        filled_by_browser()
        self.clear_queue()
        self._record()
        filled_by_browser()

        document = self._snapshot(list(self.forward_msg_queue._queue))
        data = _one(document, "dataframe")["data"]
        assert document["undescribed_types"] == ["dataframe"]
        assert data["unavailable"] == "undescribed"
        assert "url" not in data
        assert self._arrow_files() == []

    def test_replayed_table_data_follows_the_replaying_position(self) -> None:
        """A cached table that moved is registered where it now renders.

        Under the position of the run that filled the cache, the audio now
        rendered there would replace the table's reference, and the table's
        file would be collected while the snapshot still reports its URL.
        """

        @st.cache_data(show_spinner=False)
        def table() -> int:
            st.dataframe(pd.DataFrame({"n": range(150)}))
            return 1

        self._record()
        st.audio(b"not really audio", format="audio/wav")
        table()

        self._start_full_run()
        table()
        st.audio(b"not really audio", format="audio/wav")
        self._media_file_mgr().remove_orphaned_files()

        replayed = next(
            item
            for item in _descriptions(list(self.forward_msg_queue._queue))
            if item["type"] == "dataframe"
        )
        self.media_file_storage.get_file(replayed["data"]["url"].rsplit("/", 1)[-1])
        assert len(self._arrow_files()) == 1

    def test_nested_cache_replay_keeps_the_inner_tables_file(self) -> None:
        """An outer cache filled around an inner cache hit serves the inner table.

        The inner hit registers its file while the outer function is being
        filled, and the outer entry records that file too, so a later outer
        hit registers it as well instead of reporting a collected URL.
        """

        @st.cache_data(show_spinner=False)
        def inner() -> int:
            st.dataframe(pd.DataFrame({"n": range(150)}))
            return 1

        @st.cache_data(show_spinner=False)
        def outer() -> int:
            return inner() + 1

        self._record()
        inner()
        self._start_full_run()
        outer()
        self._start_full_run()
        outer()
        self._media_file_mgr().remove_orphaned_files()

        [replayed] = _descriptions(list(self.forward_msg_queue._queue))
        self.media_file_storage.get_file(replayed["data"]["url"].rsplit("/", 1)[-1])
        assert len(self._arrow_files()) == 1

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
