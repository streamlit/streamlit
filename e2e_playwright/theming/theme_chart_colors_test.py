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

"""E2E coverage for chart color theming across theme sections.

Uses a single module-scoped early fixture so light/dark/sidebar env config is
applied before the shared app server starts (mixing multiple early fixtures in
one module is unsafe under xdist).
"""

import json
import os

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    expand_sidebar,
    expect_no_skeletons,
    reset_hovering,
)

# Extreme, section-specific palettes so light / dark / sidebar and
# categorical / sequential / diverging are unmistakable in snapshots.
#
# Light: cool categorical, blue→purple sequential, red↔blue diverging
# Dark: warm pastel categorical, yellow→red sequential, cyan↔magenta diverging
# Sidebar: Set1 categorical, green→teal sequential, orange↔purple diverging
_LIGHT_CATEGORICAL = [
    "#0077bb",
    "#33bbee",
    "#009988",
    "#ee7733",
    "#cc3311",
    "#ee3377",
    "#bbbbbb",
    "#000000",
    "#0077bb",
    "#33bbee",
]
_LIGHT_SEQUENTIAL = [
    "#f7fbff",
    "#deebf7",
    "#c6dbef",
    "#9ecae1",
    "#6baed6",
    "#4292c6",
    "#2171b5",
    "#08519c",
    "#08306b",
    "#041c3a",
]
_LIGHT_DIVERGING = [
    "#b2182b",
    "#d6604d",
    "#f4a582",
    "#fddbc7",
    "#f7f7f7",
    "#d1e5f0",
    "#92c5de",
    "#4393c3",
    "#2166ac",
    "#053061",
]

_DARK_CATEGORICAL = [
    "#ffd700",
    "#ff7f00",
    "#ff1493",
    "#00fa9a",
    "#00bfff",
    "#da70d6",
    "#ffa07a",
    "#7fffd4",
    "#ffd700",
    "#ff7f00",
]
_DARK_SEQUENTIAL = [
    "#ffffcc",
    "#ffeda0",
    "#fed976",
    "#feb24c",
    "#fd8d3c",
    "#fc4e2a",
    "#e31a1c",
    "#bd0026",
    "#800026",
    "#4d0014",
]
_DARK_DIVERGING = [
    "#00ffff",
    "#66ffff",
    "#99ffff",
    "#ccffff",
    "#ffffff",
    "#ffccff",
    "#ff99ff",
    "#ff66ff",
    "#ff00ff",
    "#990099",
]

_SIDEBAR_CATEGORICAL = [
    "#e41a1c",
    "#377eb8",
    "#4daf4a",
    "#984ea3",
    "#ff7f00",
    "#ffff33",
    "#a65628",
    "#f781bf",
    "#e41a1c",
    "#377eb8",
]
_SIDEBAR_SEQUENTIAL = [
    "#f7fcf5",
    "#e5f5e0",
    "#c7e9c0",
    "#a1d99b",
    "#74c476",
    "#41ab5d",
    "#238b45",
    "#006d2c",
    "#00441b",
    "#002910",
]
_SIDEBAR_DIVERGING = [
    "#7f3b08",
    "#b35806",
    "#e08214",
    "#fdb863",
    "#fee0b6",
    "#d8daeb",
    "#b2abd2",
    "#8073ac",
    "#542788",
    "#2d004b",
]


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_section_chart_colors():
    """Configure distinct chart colors for light, dark, and sidebar sections."""
    # Enough [theme] config for switchable custom light/dark themes.
    os.environ["STREAMLIT_THEME_PRIMARY_COLOR"] = "#1a6ce7"

    os.environ["STREAMLIT_THEME_LIGHT_CHART_CATEGORICAL_COLORS"] = json.dumps(
        _LIGHT_CATEGORICAL
    )
    os.environ["STREAMLIT_THEME_LIGHT_CHART_SEQUENTIAL_COLORS"] = json.dumps(
        _LIGHT_SEQUENTIAL
    )
    os.environ["STREAMLIT_THEME_LIGHT_CHART_DIVERGING_COLORS"] = json.dumps(
        _LIGHT_DIVERGING
    )

    os.environ["STREAMLIT_THEME_DARK_CHART_CATEGORICAL_COLORS"] = json.dumps(
        _DARK_CATEGORICAL
    )
    os.environ["STREAMLIT_THEME_DARK_CHART_SEQUENTIAL_COLORS"] = json.dumps(
        _DARK_SEQUENTIAL
    )
    os.environ["STREAMLIT_THEME_DARK_CHART_DIVERGING_COLORS"] = json.dumps(
        _DARK_DIVERGING
    )

    os.environ["STREAMLIT_THEME_SIDEBAR_CHART_CATEGORICAL_COLORS"] = json.dumps(
        _SIDEBAR_CATEGORICAL
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_CHART_SEQUENTIAL_COLORS"] = json.dumps(
        _SIDEBAR_SEQUENTIAL
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_CHART_DIVERGING_COLORS"] = json.dumps(
        _SIDEBAR_DIVERGING
    )
    yield
    del os.environ["STREAMLIT_THEME_PRIMARY_COLOR"]
    del os.environ["STREAMLIT_THEME_LIGHT_CHART_CATEGORICAL_COLORS"]
    del os.environ["STREAMLIT_THEME_LIGHT_CHART_SEQUENTIAL_COLORS"]
    del os.environ["STREAMLIT_THEME_LIGHT_CHART_DIVERGING_COLORS"]
    del os.environ["STREAMLIT_THEME_DARK_CHART_CATEGORICAL_COLORS"]
    del os.environ["STREAMLIT_THEME_DARK_CHART_SEQUENTIAL_COLORS"]
    del os.environ["STREAMLIT_THEME_DARK_CHART_DIVERGING_COLORS"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_CHART_CATEGORICAL_COLORS"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_CHART_SEQUENTIAL_COLORS"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_CHART_DIVERGING_COLORS"]


def _prepare_chart_page(app: Page) -> None:
    app.set_viewport_size({"width": 1280, "height": 1000})
    expect_no_skeletons(app, timeout=25000)
    reset_hovering(app)


def _select_theme(app: Page, theme_name: str) -> None:
    """Select Light or Dark from the main menu theme radios."""
    app.get_by_test_id("stMainMenu").click()
    menu = app.get_by_role("menu", name="Main menu")
    menu.get_by_role("menuitemradio", name=theme_name).click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()
    wait_for_app_run(app)
    expect_no_skeletons(app, timeout=25000)
    # Allow chart libraries / fonts to settle before snapshotting.
    app.wait_for_timeout(10000)


@pytest.mark.usefixtures("configure_section_chart_colors")
def test_light_section_chart_colors(app: Page, assert_snapshot: ImageCompareFunction):
    """[theme.light] categorical/sequential/diverging colors apply in light mode."""
    _prepare_chart_page(app)
    _select_theme(app, "Light")
    assert_snapshot(
        app, name="custom_chart_colors-light_section", image_threshold=0.0003
    )


@pytest.mark.usefixtures("configure_section_chart_colors")
def test_dark_section_chart_colors(app: Page, assert_snapshot: ImageCompareFunction):
    """[theme.dark] categorical/sequential/diverging colors apply in dark mode."""
    _prepare_chart_page(app)
    _select_theme(app, "Dark")
    assert_snapshot(
        app, name="custom_chart_colors-dark_section", image_threshold=0.0003
    )


@pytest.mark.usefixtures("configure_section_chart_colors")
def test_sidebar_section_chart_colors(app: Page, assert_snapshot: ImageCompareFunction):
    """[theme.sidebar] categorical/sequential/diverging colors apply to sidebar charts."""
    _prepare_chart_page(app)
    _select_theme(app, "Light")

    expand_sidebar(app)
    sidebar_content = app.get_by_test_id("stSidebarContent")
    expect(sidebar_content).to_be_visible()
    expect_no_skeletons(sidebar_content, timeout=25000)
    app.wait_for_timeout(2000)

    assert_snapshot(
        sidebar_content,
        name="custom_chart_colors-sidebar_section",
        image_threshold=0.01,
    )
