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

"""E2E tests for built-in color name support in charts.

Tests that all built-in color names (red, orange, yellow, green, blue,
violet, gray, primary) are correctly resolved to custom theme color values.
"""

import os

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import expect_no_skeletons


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_custom_theme_colors():
    """Configure a dark theme with pale/pastel colors for testing builtin color name resolution.

    Colors are chosen to be obviously different from the default dark theme colors
    (which are vibrant/saturated) by using pale/pastel versions instead.
    """
    # Dark theme base
    os.environ["STREAMLIT_THEME_BASE"] = "dark"
    os.environ["STREAMLIT_THEME_RED_COLOR"] = "#ffb3b3"  # Pale pink-red
    os.environ["STREAMLIT_THEME_ORANGE_COLOR"] = "#ffd9b3"  # Pale peach
    os.environ["STREAMLIT_THEME_YELLOW_COLOR"] = "#ffffb3"  # Pale cream
    os.environ["STREAMLIT_THEME_GREEN_COLOR"] = "#b3ffb3"  # Pale mint
    os.environ["STREAMLIT_THEME_BLUE_COLOR"] = "#b3d9ff"  # Pale sky blue
    os.environ["STREAMLIT_THEME_VIOLET_COLOR"] = "#d9b3ff"  # Pale lavender
    os.environ["STREAMLIT_THEME_GRAY_COLOR"] = "#d9d9d9"  # Light silver
    os.environ["STREAMLIT_THEME_PRIMARY_COLOR"] = "#ffb3d9"  # Pale pink
    yield
    del os.environ["STREAMLIT_THEME_BASE"]
    del os.environ["STREAMLIT_THEME_RED_COLOR"]
    del os.environ["STREAMLIT_THEME_ORANGE_COLOR"]
    del os.environ["STREAMLIT_THEME_YELLOW_COLOR"]
    del os.environ["STREAMLIT_THEME_GREEN_COLOR"]
    del os.environ["STREAMLIT_THEME_BLUE_COLOR"]
    del os.environ["STREAMLIT_THEME_VIOLET_COLOR"]
    del os.environ["STREAMLIT_THEME_GRAY_COLOR"]
    del os.environ["STREAMLIT_THEME_PRIMARY_COLOR"]


@pytest.mark.usefixtures("configure_custom_theme_colors")
def test_builtin_colors_with_custom_theme(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that all built-in color names resolve to custom theme colors.

    This test configures a dark theme with pale/pastel colors, then verifies all
    4 chart types render with those custom colors via a snapshot. The test
    covers all builtin color names: red, orange, yellow, green, blue, violet,
    gray, and primary.
    """
    # Set larger viewport to show all charts
    app.set_viewport_size({"width": 1280, "height": 800})

    # Wait for all elements to render
    expect_no_skeletons(app, timeout=25000)

    # Wait for all 4 charts to render (line, bar, area, scatter)
    chart_elements = app.get_by_test_id("stVegaLiteChart")
    expect(chart_elements).to_have_count(4)

    # Ensure all charts have rendered their Vega graphics
    expect(chart_elements.locator("[role='graphics-document']")).to_have_count(4)

    # Take a single snapshot of all charts
    assert_snapshot(app, name="st_chart_builtin_colors-custom_theme")
