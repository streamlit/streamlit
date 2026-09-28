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

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from starlette.testclient import TestClient

from streamlit.testing.v1.app_test import AppTest
from streamlit.testing.v1.util import patch_config_options
from streamlit.web.server.agent.agent_interact import (
    AgentInteractError,
    parse_interact_request,
    reset_agent_sessions,
)
from streamlit.web.server.agent.agent_tree_json import element_tree_to_agent_json
from streamlit.web.server.starlette.starlette_app import App
from streamlit.web.server.starlette.starlette_routes import ROUTE_AGENT_INTERACT

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path


@pytest.fixture(autouse=True)
def _reset_agent_sessions() -> Iterator[None]:
    reset_agent_sessions()
    yield
    reset_agent_sessions()


def test_parse_empty_body_creates_session() -> None:
    """Omitting session_id is a create call."""
    parsed = parse_interact_request({})
    assert parsed.session_id is None
    assert parsed.widget_state == {}
    assert parsed.trigger is None


def test_parse_rejects_widget_state_on_create() -> None:
    """Keys do not exist until the app has run once."""
    with pytest.raises(AgentInteractError) as exc:
        parse_interact_request({"widget_state": {"region": "Europe"}})
    assert exc.value.code == "widget_state_on_create"


def test_parse_rejects_navigation_with_widget_changes() -> None:
    """Navigation cannot be combined with widget changes."""
    with pytest.raises(AgentInteractError) as exc:
        parse_interact_request(
            {
                "session_id": "s1",
                "page": "reports",
                "widget_state": {"region": "Europe"},
            }
        )
    assert exc.value.code == "navigation_with_widget_changes"


def test_parse_rejects_unknown_trigger_shape() -> None:
    """trigger must include a key."""
    with pytest.raises(AgentInteractError) as exc:
        parse_interact_request({"session_id": "s1", "trigger": {}})
    assert exc.value.code == "invalid_request"


def test_snapshot_uses_public_command_names() -> None:
    """Snapshot types match public st.* command names."""

    def app() -> None:
        import streamlit as st

        st.title("Regional revenue")
        st.selectbox("Region", ["All", "Europe"], key="region")
        st.button("Refresh data", key="refresh")
        st.metric("Net revenue", "€1.2M")

    at = AppTest.from_function(app)
    at.run()
    snapshot = element_tree_to_agent_json(
        at._tree,
        session_id="s_test",
        pages=[{"url_path": "", "title": "Regional revenue"}],
        page={"url_path": "", "title": "Regional revenue"},
        query_params={},
        run_ok=True,
        observed_at="2026-09-06T10:00:00Z",
        session_state=at.session_state,
    )
    assert snapshot["schema_version"] == 1
    assert snapshot["status"] == "ready"
    main = snapshot["tree"]["children"][0]
    assert main["type"] == "main"
    types = [child["type"] for child in main["children"]]
    assert "title" in types
    assert "selectbox" in types
    assert "button" in types
    assert "metric" in types
    selectbox = next(
        child for child in main["children"] if child["type"] == "selectbox"
    )
    assert selectbox["key"] == "region"
    assert selectbox["value"] == "All"
    assert "All" in selectbox["props"]["options"]
    action_keys = {action["key"] for action in snapshot["actions"]}
    assert "region" in action_keys
    assert "refresh" in action_keys


def test_snapshot_includes_dataframe_rows_and_chart_spec() -> None:
    """Tables and Vega-Lite charts expose their payload in a sibling data object."""

    def app() -> None:
        import pandas as pd

        import streamlit as st

        frame = pd.DataFrame({"region": ["Europe", "AMER"], "net": [0.4, 0.5]})
        st.dataframe(frame)
        st.bar_chart(frame.set_index("region"))

    at = AppTest.from_function(app)
    at.run()
    snapshot = element_tree_to_agent_json(
        at._tree,
        session_id="s_data",
        pages=[{"url_path": "", "title": ""}],
        page={"url_path": "", "title": ""},
        query_params={},
        run_ok=True,
        observed_at="2026-09-06T10:00:00Z",
        session_state=at.session_state,
    )
    main = snapshot["tree"]["children"][0]["children"]
    table = next(child for child in main if child["type"] == "dataframe")
    assert table["data"]["columns"] == ["region", "net"]
    assert table["data"]["row_count"] == 2
    assert {"region": "Europe", "net": 0.4} in table["data"]["rows"]
    chart = next(child for child in main if child["type"] == "vega_lite_chart")
    assert isinstance(chart["data"]["spec"], dict)
    assert chart["data"]["values"]
    assert "region" in chart["data"]["columns"] or any(
        "region" in row for row in chart["data"]["values"]
    )


@pytest.fixture
def reset_runtime() -> Iterator[None]:
    """Reset the Runtime singleton around each HTTP test."""
    from streamlit.runtime import Runtime

    Runtime._instance = None
    yield
    Runtime._instance = None


@pytest.fixture
def agent_script(tmp_path: Path) -> Path:
    """Write a tiny dashboard the agent endpoint can drive."""
    script = tmp_path / "agent_app.py"
    script.write_text(
        "import streamlit as st\n"
        "st.title('Regional revenue')\n"
        "region = st.selectbox('Region', ['All', 'Europe'], key='region')\n"
        "st.metric('Net revenue', '€1.2M' if region == 'All' else '€0.4M')\n"
        "if st.button('Refresh data', key='refresh'):\n"
        "    st.write('refreshed')\n"
    )
    return script


_AGENT_CONFIG = {
    "server.enableAgentApi": True,
    "server.fileWatcherType": "none",
    "server.headless": True,
    "server.enableXsrfProtection": False,
    "global.developmentMode": False,
    "browser.gatherUsageStats": False,
}


@patch_config_options(_AGENT_CONFIG)
def test_interact_create_and_set_widget(
    agent_script: Path, reset_runtime: None
) -> None:
    """Creating a session then setting a selectbox returns an updated snapshot."""
    app = App(agent_script)
    with TestClient(app, client=("127.0.0.1", 50000)) as client:
        created = client.post(f"/{ROUTE_AGENT_INTERACT}", json={})
        assert created.status_code == 200, created.text
        payload = created.json()
        assert payload["schema_version"] == 1
        assert payload["session_id"]
        session_id = payload["session_id"]
        types = [child["type"] for child in payload["tree"]["children"][0]["children"]]
        assert "selectbox" in types
        updated = client.post(
            f"/{ROUTE_AGENT_INTERACT}",
            json={"session_id": session_id, "widget_state": {"region": "Europe"}},
        )
        assert updated.status_code == 200, updated.text
        metric = next(
            child
            for child in updated.json()["tree"]["children"][0]["children"]
            if child["type"] == "metric"
        )
        assert metric["props"]["value"] == "€0.4M"


@pytest.fixture
def widget_zoo_script(tmp_path: Path) -> Path:
    """Write an app that echoes one line per widget, so values are observable."""
    script = tmp_path / "widget_zoo.py"
    script.write_text(
        "import streamlit as st\n"
        "from datetime import date, time\n"
        "st.text(f\"text:{st.text_input('Text', key='text')}\")\n"
        "st.text(f\"num:{st.number_input('Num', value=1, key='num')}\")\n"
        "st.text(f\"slide:{st.slider('Slide', 0, 100, 5, key='slide')}\")\n"
        "st.text(f\"check:{st.checkbox('Check', key='check')}\")\n"
        "st.text(f\"sel:{st.selectbox('Sel', ['a', 'b'], key='sel')}\")\n"
        "st.text(f\"multi:{st.multiselect('Multi', ['a', 'b'], key='multi')}\")\n"
        "st.text(f\"sslide:{st.select_slider('SSlide', ['s', 'm'], key='sslide')}\")\n"
        "st.text(f\"day:{st.date_input('Day', value=date(2026, 1, 1), key='day')}\")\n"
        "st.text(f\"at:{st.time_input('At', value=time(9, 0), key='at')}\")\n"
    )
    return script


@patch_config_options(_AGENT_CONFIG)
def test_widget_values_reach_the_running_script(
    widget_zoo_script: Path, reset_runtime: None
) -> None:
    """Every supported widget type round-trips into the script's own output.

    A widget encoded onto the wrong ``WidgetState`` arm is ignored rather than
    rejected, so asserting on what the script printed is the only way to catch
    it.
    """
    app = App(widget_zoo_script)
    with TestClient(app, client=("127.0.0.1", 50000)) as client:
        session_id = client.post(f"/{ROUTE_AGENT_INTERACT}", json={}).json()[
            "session_id"
        ]
        response = client.post(
            f"/{ROUTE_AGENT_INTERACT}",
            json={
                "session_id": session_id,
                "widget_state": {
                    "text": "hello",
                    "num": 7,
                    "slide": 42,
                    "check": True,
                    "sel": "b",
                    "multi": ["a", "b"],
                    "sslide": "m",
                    "day": "2026-03-04",
                    "at": "14:30",
                },
            },
        )
        assert response.status_code == 200, response.text
        rendered = {
            child["props"]["body"]
            for child in response.json()["tree"]["children"][0]["children"]
            if child["type"] == "text"
        }

    assert "text:hello" in rendered
    # An int-typed number_input travels as a double and is narrowed back on read.
    assert "num:7" in rendered
    assert "slide:42" in rendered
    assert "check:True" in rendered
    assert "sel:b" in rendered
    assert "multi:['a', 'b']" in rendered
    assert "sslide:m" in rendered
    assert "day:2026-03-04" in rendered
    assert "at:14:30:00" in rendered


@patch_config_options(_AGENT_CONFIG)
def test_invalid_option_is_rejected_before_running(
    widget_zoo_script: Path, reset_runtime: None
) -> None:
    """An option outside the widget's choices fails instead of running the app."""
    app = App(widget_zoo_script)
    with TestClient(app, client=("127.0.0.1", 50000)) as client:
        session_id = client.post(f"/{ROUTE_AGENT_INTERACT}", json={}).json()[
            "session_id"
        ]
        response = client.post(
            f"/{ROUTE_AGENT_INTERACT}",
            json={"session_id": session_id, "widget_state": {"sel": "nope"}},
        )
        assert response.status_code == 400
        assert response.json()["error"] == "invalid_widget_value"


@patch_config_options(_AGENT_CONFIG)
def test_unknown_session_is_not_silently_created(
    agent_script: Path, reset_runtime: None
) -> None:
    """An unknown session_id is an error, never a fresh start."""
    app = App(agent_script)
    with TestClient(app, client=("127.0.0.1", 50000)) as client:
        response = client.post(
            f"/{ROUTE_AGENT_INTERACT}",
            json={"session_id": "does-not-exist"},
        )
        assert response.status_code == 404
        assert response.json()["error"] == "unknown_session"


@patch_config_options(_AGENT_CONFIG)
def test_non_loopback_is_forbidden(agent_script: Path, reset_runtime: None) -> None:
    """Non-loopback peers cannot call the agent API."""
    app = App(agent_script)
    with TestClient(app, client=("10.0.0.1", 50000)) as client:
        response = client.post(f"/{ROUTE_AGENT_INTERACT}", json={})
        assert response.status_code == 403
        assert response.json()["error"] == "loopback_only"


@patch_config_options(
    {
        "server.enableAgentApi": False,
        "server.fileWatcherType": "none",
        "server.headless": True,
        "global.developmentMode": False,
    }
)
def test_disabled_agent_api_is_not_mounted(
    agent_script: Path, reset_runtime: None
) -> None:
    """The route is absent when server.enableAgentApi is off."""
    app = App(agent_script)
    with TestClient(app, client=("127.0.0.1", 50000)) as client:
        response = client.post(f"/{ROUTE_AGENT_INTERACT}", json={})
        assert response.status_code == 404
