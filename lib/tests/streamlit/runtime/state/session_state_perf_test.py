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

"""Benchmarks for widget state on the rerun hot path.

A browser resends its whole widget map on every rerun, and session state checks
each entry before callbacks run. Run with ``make python-performance-tests``.
"""

from __future__ import annotations

import itertools
import json
from typing import TYPE_CHECKING, Any

import pytest

from streamlit.elements.widgets.checkbox import CheckboxSerde
from streamlit.elements.widgets.data_editor import DataEditorSerde
from streamlit.elements.widgets.selectbox import SelectboxSerde
from streamlit.elements.widgets.text_widgets import TextInputSerde
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    RunLocation,
    ThreadState,
)
from streamlit.runtime.state import SessionState
from streamlit.runtime.state.common import WidgetMetadata

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_benchmark.fixture import BenchmarkFixture

    from streamlit.runtime.state.common import ValueFieldName


def _register(
    ss: SessionState,
    widget_id: str,
    serde: Any,
    value_type: ValueFieldName,
) -> None:
    ss._set_widget_metadata(
        WidgetMetadata(
            id=widget_id,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            value_type=value_type,
            callback=lambda: None,
        )
    )


def _rerun_with(ss: SessionState, messages: list[WidgetStates]) -> Callable[[], None]:
    """One rerun per call, cycling through ``messages``."""
    cycle = itertools.cycle(messages)
    ThreadState.initialize(run_location=RunLocation.MAIN_SCRIPT)

    def rerun() -> None:
        ss.on_script_will_rerun(next(cycle))
        ss.on_script_finished(frozenset())

    return rerun


@pytest.mark.performance
def test_a_thousand_widgets_with_one_change(benchmark: BenchmarkFixture) -> None:
    """A map of 1,000 checkboxes and text inputs in which one value changes."""
    ss = SessionState()
    states: list[WidgetState] = []
    for index in range(500):
        _register(ss, f"checkbox-{index}", CheckboxSerde(value=False), "bool_value")
        _register(ss, f"text-{index}", TextInputSerde(value=""), "string_value")
        states.append(WidgetState(id=f"checkbox-{index}", bool_value=index % 2 == 0))
        states.append(WidgetState(id=f"text-{index}", string_value=f"text {index}"))
    # The last checkbox alternates, so every rerun sees exactly one change.
    toggled = [
        *states[:-2],
        WidgetState(id="checkbox-499", bool_value=True),
        states[-1],
    ]
    rerun = _rerun_with(
        ss, [WidgetStates(widgets=states), WidgetStates(widgets=toggled)]
    )

    benchmark(rerun)


@pytest.mark.performance
def test_a_large_selectbox_that_changes(benchmark: BenchmarkFixture) -> None:
    """A selectbox with 10,000 options whose value changes on every rerun."""
    options = [f"option {index}" for index in range(10_000)]
    serde = SelectboxSerde(
        options,
        formatted_options=options,
        formatted_option_to_option_index={label: i for i, label in enumerate(options)},
        default_option_index=0,
    )
    ss = SessionState()
    _register(ss, "select", serde, "string_value")
    rerun = _rerun_with(
        ss,
        [
            WidgetStates(widgets=[WidgetState(id="select", string_value=label)])
            for label in ("option 1", "option 9999")
        ],
    )

    benchmark(rerun)


@pytest.mark.performance
def test_a_large_unchanged_data_editor_payload(benchmark: BenchmarkFixture) -> None:
    """A data editor payload of about 20 MB that the browser resends unchanged."""
    row = {"name": "x" * 80, "value": 1.5, "flag": True}
    payload = json.dumps(
        {"edited_rows": {}, "added_rows": [row] * 180_000, "deleted_rows": []}
    )
    ss = SessionState()
    _register(ss, "editor", DataEditorSerde(), "string_value")
    message = WidgetStates(widgets=[WidgetState(id="editor", string_value=payload)])
    rerun = _rerun_with(ss, [message])
    rerun()  # The first rerun stores the payload, so every measured one is unchanged.

    benchmark(rerun)
