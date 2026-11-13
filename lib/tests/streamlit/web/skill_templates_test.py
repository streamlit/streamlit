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

"""AppTest smoke tests for the dashboard templates bundled with the agent skill."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest

from streamlit.testing.v1 import AppTest

if TYPE_CHECKING:
    from collections.abc import Iterator

_APPS_DIR = (
    Path(__file__).resolve().parents[3]
    / "streamlit"
    / ".agents"
    / "skills"
    / "developing-with-streamlit"
    / "assets"
    / "templates"
    / "apps"
)
_TEMPLATES = sorted(path.name for path in _APPS_DIR.iterdir() if path.is_dir())

# Widget states that reach branches the default run skips, by template. Keys
# are widget keys, so each state runs as if the user had set those widgets.
_ALTERNATE_STATES: list[tuple[str, dict[str, Any]]] = [
    (
        "dashboard-metrics",
        {"users_view": "table", "channel_chart": "bar", "channel_pct": True},
    ),
    (
        "dashboard-metrics",
        {"channel_chart": "line", "channel_select": [], "revenue_lines": []},
    ),
    # No account type selected shows every company, ranked by growth over all time.
    (
        "dashboard-companies",
        {"types": [], "ranking": "growth_asc", "window": "All time"},
    ),
    ("dashboard-seattle-weather", {"years": [2015]}),
    ("dashboard-stock-peers", {"stocks": ["AAPL"], "horizon": "1 Year"}),
    ("dashboard-stock-peers", {"stocks": ["AAPL", "IBM"], "horizon": "All"}),
]


@pytest.fixture
def isolated_helper_modules(request: pytest.FixtureRequest) -> Iterator[None]:
    """Unload a template's helper modules before and after its run.

    Several templates import helpers with the same names (``data``,
    ``charts``), so a module cached by one template would shadow another's.
    """
    template_dir = _APPS_DIR / request.node.callspec.params["template"]
    names = [path.stem for path in template_dir.glob("*.py")]
    saved = {name: sys.modules.pop(name) for name in names if name in sys.modules}
    yield
    for name in names:
        sys.modules.pop(name, None)
    sys.modules.update(saved)


def _run_template(template: str, state: dict[str, Any] | None = None) -> AppTest:
    at = AppTest.from_file(
        str(_APPS_DIR / template / "streamlit_app.py"), default_timeout=60
    )
    for key, value in (state or {}).items():
        at.session_state[key] = value
    return at.run()


def _assert_renders_cleanly(at: AppTest) -> None:
    assert [exc.value for exc in at.exception] == []
    # The templates follow the skill's chart ranking: every chart is ECharts.
    assert at.get("vega_lite_chart") == []
    assert at.get("plotly_chart") == []
    for chart in at.echarts_chart:
        assert (chart.alt or "").strip(), "every template chart needs an alt"


def test_templates_are_discovered() -> None:
    """Discovery finds the templates, and each alternate state names one of them."""
    assert "dashboard-metrics" in _TEMPLATES
    assert {template for template, _ in _ALTERNATE_STATES} <= set(_TEMPLATES)


@pytest.mark.usefixtures("isolated_helper_modules")
@pytest.mark.parametrize("template", _TEMPLATES)
def test_template_runs(template: str) -> None:
    """Each template runs without exceptions and draws accessible ECharts charts."""
    at = _run_template(template)
    _assert_renders_cleanly(at)
    # Catches a template that stops before its charts. The companies template
    # draws charts only in the drawer that a table click opens.
    if template != "dashboard-companies":
        assert at.echarts_chart, "the default run should draw a chart"


@pytest.mark.usefixtures("isolated_helper_modules")
@pytest.mark.parametrize(("template", "state"), _ALTERNATE_STATES)
def test_template_runs_with_alternate_state(
    template: str, state: dict[str, Any]
) -> None:
    """Templates also run with widget states that reach their other branches."""
    at = _run_template(template, state)
    _assert_renders_cleanly(at)
