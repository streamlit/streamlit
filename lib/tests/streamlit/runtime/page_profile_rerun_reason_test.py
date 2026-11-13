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

"""End-to-end tests for the rerun reason and element type in PageProfile.

These run real scripts through AppTest and inspect the PageProfile message each
script run produces.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from typing import Any
from unittest.mock import patch

import pytest

from streamlit.proto.PageProfile_pb2 import PageProfile
from streamlit.proto.WidgetStates_pb2 import WidgetState
from streamlit.runtime import metrics_util
from streamlit.testing.v1 import AppTest
from tests import testutil

PageProfileRecorder = Callable[[], list[PageProfile]]


@pytest.fixture
def page_profiles() -> Iterator[PageProfileRecorder]:
    """Record the PageProfile of every script run.

    Calling the returned function returns the profiles recorded since the last
    call.
    """
    profiles: list[PageProfile] = []

    def record(*args: Any, **kwargs: Any) -> Any:
        msg = metrics_util.create_page_profile_message(*args, **kwargs)
        profiles.append(msg.page_profile)
        return msg

    def take() -> list[PageProfile]:
        taken = list(profiles)
        profiles.clear()
        return taken

    with (
        testutil.patch_config_options({"browser.gatherUsageStats": True}),
        patch(
            "streamlit.runtime.scriptrunner.script_runner.create_page_profile_message",
            side_effect=record,
        ),
    ):
        yield take


def _reasons(profiles: list[PageProfile]) -> list[tuple[str, str]]:
    return [(p.rerun_reason, p.rerun_element_type) for p in profiles]


def _run_with_widget_state(at: AppTest, widget_state: WidgetState) -> None:
    """Rerun ``at`` as if the browser sent ``widget_state`` with all other values."""
    widget_states = at._tree.get_widget_states()
    widget_states.widgets.append(widget_state)
    at._run(widget_states)


def test_initial_load_and_slider_interaction(
    page_profiles: PageProfileRecorder,
) -> None:
    def script() -> None:
        import streamlit as st

        st.slider("Slider", 0, 10)
        st.checkbox("Checkbox")

    at = AppTest.from_function(script).run()
    assert _reasons(page_profiles()) == [("initial_load", "")]

    at.slider[0].set_value(5).run()
    assert _reasons(page_profiles()) == [("widget_interaction", "slider")]

    # AppTest reruns without a browser request, so nothing names a reason.
    at.run()
    assert _reasons(page_profiles()) == [("unknown", "")]


def test_form_submit_records_submit_button(
    page_profiles: PageProfileRecorder,
) -> None:
    def script() -> None:
        import streamlit as st

        with st.form("form"):
            st.text_input("Name")
            st.slider("Age", 0, 100)
            st.form_submit_button("Submit")

    at = AppTest.from_function(script).run()
    page_profiles()

    at.text_input[0].input("Ada")
    at.slider[0].set_value(36)
    at.button[0].click().run()
    assert _reasons(page_profiles()) == [("widget_interaction", "form_submit_button")]


def test_dataframe_selection(page_profiles: PageProfileRecorder) -> None:
    def script() -> None:
        import pandas as pd

        import streamlit as st

        st.dataframe(pd.DataFrame({"a": [1, 2]}), on_select="rerun", key="df")
        st.slider("Slider", 0, 10)

    at = AppTest.from_function(script).run()
    page_profiles()

    dataframe_id = at.dataframe[0].proto.id
    _run_with_widget_state(
        at,
        WidgetState(
            id=dataframe_id,
            string_value='{"selection": {"rows": [0], "columns": [], "cells": []}}',
        ),
    )
    assert _reasons(page_profiles()) == [("widget_interaction", "dataframe")]


def test_chart_selection(page_profiles: PageProfileRecorder) -> None:
    def script() -> None:
        import pandas as pd

        import streamlit as st

        st.vega_lite_chart(
            pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
            {
                "mark": "point",
                "params": [{"name": "points", "select": "point"}],
                "encoding": {
                    "x": {"field": "a", "type": "quantitative"},
                    "y": {"field": "b", "type": "quantitative"},
                },
            },
            on_select="rerun",
            key="chart",
        )

    at = AppTest.from_function(script).run()
    page_profiles()

    chart_id = at.get("vega_lite_chart")[0].proto.id
    _run_with_widget_state(
        at,
        WidgetState(
            id=chart_id,
            string_value='{"selection": {"points": [{"a": 1, "b": 3}]}}',
        ),
    )
    assert _reasons(page_profiles()) == [("widget_interaction", "vega_lite_chart")]


def test_custom_component_records_generic_type(
    page_profiles: PageProfileRecorder,
) -> None:
    def script() -> None:
        import streamlit.components.v1 as components

        my_secret_component = components.declare_component(
            "my_secret_component", url="http://localhost:3001"
        )
        my_secret_component(key="component")

    at = AppTest.from_function(script).run()
    page_profiles()

    component_id = at.get("component_instance")[0].proto.id
    _run_with_widget_state(at, WidgetState(id=component_id, json_value='"clicked"'))
    assert _reasons(page_profiles()) == [("widget_interaction", "component_instance")]


def test_st_rerun(page_profiles: PageProfileRecorder) -> None:
    def script() -> None:
        import streamlit as st

        if not st.session_state.get("reran"):
            st.session_state.reran = True
            st.rerun()

    AppTest.from_function(script).run()
    assert _reasons(page_profiles()) == [
        ("initial_load", ""),
        ("st_rerun", ""),
    ]


def test_st_rerun_from_widget_callback(page_profiles: PageProfileRecorder) -> None:
    def script() -> None:
        import streamlit as st

        def on_click() -> None:
            st.rerun()

        st.button("Rerun", on_click=on_click)

    at = AppTest.from_function(script).run()
    page_profiles()

    at.button[0].click().run()
    assert _reasons(page_profiles()) == [
        ("widget_interaction", "button"),
        ("st_rerun", ""),
    ]


def test_query_params_change(page_profiles: PageProfileRecorder) -> None:
    def script() -> None:
        import streamlit as st

        st.write(st.query_params.get("q"))

    at = AppTest.from_function(script).run()
    page_profiles()

    at.query_params["q"] = "1"
    at.run()
    assert _reasons(page_profiles()) == [("query_params_change", "")]

    at.run()
    assert _reasons(page_profiles()) == [("unknown", "")]


def test_query_params_set_by_script_are_not_a_change(
    page_profiles: PageProfileRecorder,
) -> None:
    def script() -> None:
        import streamlit as st

        st.query_params["q"] = "from_script"

    at = AppTest.from_function(script).run()
    page_profiles()

    at.run()
    assert _reasons(page_profiles()) == [("unknown", "")]


def test_switch_page(page_profiles: PageProfileRecorder) -> None:
    def script() -> None:
        import streamlit as st

        def home() -> None:
            if st.button("Go"):
                st.switch_page(other_page)

        def other() -> None:
            st.write("Other")

        other_page = st.Page(other, title="Other")
        st.navigation([st.Page(home, title="Home"), other_page]).run()

    at = AppTest.from_function(script).run()
    page_profiles()

    at.button[0].click().run()
    assert _reasons(page_profiles()) == [
        ("widget_interaction", "button"),
        ("navigation", ""),
    ]


def test_reason_not_computed_without_usage_stats() -> None:
    def script() -> None:
        import streamlit as st

        st.slider("Slider", 0, 10)

    with (
        testutil.patch_config_options({"browser.gatherUsageStats": False}),
        patch(
            "streamlit.runtime.scriptrunner.script_runner.ScriptRunner._rerun_reason_at_run_start"
        ) as rerun_reason_at_run_start,
        patch(
            "streamlit.runtime.scriptrunner.script_runner.create_page_profile_message"
        ) as create_page_profile_message,
    ):
        at = AppTest.from_function(script).run()
        at.slider[0].set_value(5).run()

    rerun_reason_at_run_start.assert_not_called()
    create_page_profile_message.assert_not_called()
