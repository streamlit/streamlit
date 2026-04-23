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

"""E2E tests for st.mermaid_chart."""

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key


def test_mermaid_charts_render(app: Page):
    """Test that all mermaid chart types render correctly."""
    container = get_element_by_key(app, "mermaid_charts")
    mermaid_charts = container.get_by_test_id("stMermaidChart")
    expect(mermaid_charts).to_have_count(6)

    # Check that each chart contains an img element with blob URL (rendered mermaid)
    for i in range(6):
        img = mermaid_charts.nth(i).locator("img")
        expect(img).to_be_visible()
        expect(img).to_have_attribute("src", re.compile(r"^blob:"))


def test_chart_snapshots(app: Page, assert_snapshot: ImageCompareFunction):
    """Test all mermaid chart types rendering with snapshots."""
    container = get_element_by_key(app, "mermaid_charts")
    mermaid_charts = container.get_by_test_id("stMermaidChart")

    chart_names = [
        "flowchart",
        "sequence_diagram",
        "class_diagram",
        "state_diagram",
        "pie_chart",
        "gantt_chart",
    ]

    for i, name in enumerate(chart_names):
        chart = mermaid_charts.nth(i)
        expect(chart.locator("img")).to_be_visible()
        assert_snapshot(chart, name=f"st_mermaid_chart-{name}")


def test_themed_chart_snapshots(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test mermaid chart rendering in light and dark theme."""
    container = get_element_by_key(themed_app, "mermaid_charts")
    mermaid_charts = container.get_by_test_id("stMermaidChart")

    themed_charts = [
        (0, "flowchart"),
        (1, "sequence_diagram"),
        (4, "pie_chart"),
    ]

    for idx, name in themed_charts:
        chart = mermaid_charts.nth(idx)
        expect(chart.locator("img")).to_be_visible()
        assert_snapshot(chart, name=f"st_mermaid_chart-{name}_themed")


def test_toolbar_copy_source(app: Page):
    """Test that copy source toolbar action works."""
    container = get_element_by_key(app, "mermaid_charts")
    # Get the fullscreen frame which contains both the toolbar and the chart
    fullscreen_frame = container.get_by_test_id("stFullScreenFrame").first
    toolbar = fullscreen_frame.get_by_test_id("stElementToolbar")
    mermaid_chart = fullscreen_frame.get_by_test_id("stMermaidChart")
    expect(mermaid_chart.locator("img")).to_be_visible()

    # Toolbar should be hidden initially (opacity 0)
    expect(toolbar).not_to_have_css("opacity", "1")

    # Hover to show toolbar
    fullscreen_frame.hover()
    expect(toolbar).to_have_css("opacity", "1")

    # Click copy button
    copy_button = toolbar.get_by_role("button", name="Copy to clipboard")
    copy_button.click()

    # Button label should change to indicate success
    expect(toolbar.get_by_role("button", name="Copied")).to_be_visible()


def test_toolbar_download_png(app: Page):
    """Test that download PNG toolbar action is available."""
    container = get_element_by_key(app, "mermaid_charts")
    # Get the fullscreen frame which contains both the toolbar and the chart
    fullscreen_frame = container.get_by_test_id("stFullScreenFrame").first
    toolbar = fullscreen_frame.get_by_test_id("stElementToolbar")
    mermaid_chart = fullscreen_frame.get_by_test_id("stMermaidChart")
    expect(mermaid_chart.locator("img")).to_be_visible()

    # Toolbar should be hidden initially (opacity 0)
    expect(toolbar).not_to_have_css("opacity", "1")

    # Hover to show toolbar
    fullscreen_frame.hover()
    expect(toolbar).to_have_css("opacity", "1")

    # Verify the download button is visible and can be clicked
    download_button = toolbar.get_by_role("button", name="Download as PNG")
    download_button.click()
