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

"""Tests for `st.components.v2.shared_state`."""

from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class SharedStateTest(DeltaGeneratorTestCase):
    def _send_from_browser(self, widget_id: str, values: dict) -> None:
        ws = WidgetState(id=widget_id)
        ws.json_value = json.dumps(values)
        self.script_run_ctx.session_state.on_script_will_rerun(
            WidgetStates(widgets=[ws])
        )

    def _start_new_run(self) -> None:
        self.script_run_ctx.shared.widget_ids_this_run.clear()
        self.script_run_ctx.shared.widget_user_keys_this_run.clear()

    def test_declares_channel_with_seed_data(self) -> None:
        result = st.components.v2.shared_state("bi", data={"cube": [1, 2]})

        proto = self.get_delta_from_queue().new_element.bidi_component
        assert proto.shared_channel == "bi"
        assert json.loads(proto.json) == {"cube": [1, 2]}
        assert proto.component_name == ""
        assert dict(result) == {}

    def test_returns_values_synced_by_the_browser(self) -> None:
        st.components.v2.shared_state("bi", key="ibi")
        widget_id = self.get_delta_from_queue().new_element.bidi_component.id

        self._send_from_browser(widget_id, {"filters": {"region": "EUROPE"}})

        assert st.session_state["ibi"] == {"filters": {"region": "EUROPE"}}
        self._start_new_run()
        result = st.components.v2.shared_state("bi", key="ibi")
        assert result.filters == {"region": "EUROPE"}

    def test_on_change_runs_when_synced_values_change(self) -> None:
        on_change = MagicMock()
        st.components.v2.shared_state("bi", key="ibi", on_change=on_change)
        widget_id = self.get_delta_from_queue().new_element.bidi_component.id

        self._send_from_browser(widget_id, {"filters": {}})

        on_change.assert_called_once()

    def test_key_keeps_id_stable_when_data_changes(self) -> None:
        st.components.v2.shared_state("bi", data={"v": 1}, key="ibi")
        first = self.get_delta_from_queue().new_element.bidi_component.id
        self._start_new_run()
        st.components.v2.shared_state("bi", data={"v": 2}, key="ibi")
        second = self.get_delta_from_queue().new_element.bidi_component.id

        assert first == second

    def test_rejects_invalid_arguments(self) -> None:
        with pytest.raises(StreamlitAPIException, match="non-empty string"):
            st.components.v2.shared_state("")
        with pytest.raises(StreamlitAPIException, match="mapping"):
            st.components.v2.shared_state("bi", data=[1, 2])  # type: ignore[arg-type]
