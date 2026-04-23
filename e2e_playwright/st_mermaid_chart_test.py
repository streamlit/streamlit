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


def test_flowchart_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test flowchart rendering with snapshot."""
    container = get_element_by_key(app, "mermaid_charts")
    flowchart = container.get_by_test_id("stMermaidChart").nth(0)
    expect(flowchart.locator("img")).to_be_visible()
    assert_snapshot(flowchart, name="st_mermaid_chart-flowchart")


def test_sequence_diagram_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test sequence diagram rendering with snapshot."""
    container = get_element_by_key(app, "mermaid_charts")
    sequence_diagram = container.get_by_test_id("stMermaidChart").nth(1)
    expect(sequence_diagram.locator("img")).to_be_visible()
    assert_snapshot(sequence_diagram, name="st_mermaid_chart-sequence_diagram")


def test_class_diagram_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test class diagram rendering with snapshot."""
    container = get_element_by_key(app, "mermaid_charts")
    class_diagram = container.get_by_test_id("stMermaidChart").nth(2)
    expect(class_diagram.locator("img")).to_be_visible()
    assert_snapshot(class_diagram, name="st_mermaid_chart-class_diagram")


def test_state_diagram_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test state diagram rendering with snapshot."""
    container = get_element_by_key(app, "mermaid_charts")
    state_diagram = container.get_by_test_id("stMermaidChart").nth(3)
    expect(state_diagram.locator("img")).to_be_visible()
    assert_snapshot(state_diagram, name="st_mermaid_chart-state_diagram")


def test_pie_chart_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test pie chart rendering with snapshot."""
    container = get_element_by_key(app, "mermaid_charts")
    pie_chart = container.get_by_test_id("stMermaidChart").nth(4)
    expect(pie_chart.locator("img")).to_be_visible()
    assert_snapshot(pie_chart, name="st_mermaid_chart-pie_chart")


def test_gantt_chart_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test gantt chart rendering with snapshot."""
    container = get_element_by_key(app, "mermaid_charts")
    gantt_chart = container.get_by_test_id("stMermaidChart").nth(5)
    expect(gantt_chart.locator("img")).to_be_visible()
    assert_snapshot(gantt_chart, name="st_mermaid_chart-gantt_chart")


def test_themed_flowchart(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test flowchart rendering in light and dark theme."""
    container = get_element_by_key(themed_app, "mermaid_charts")
    flowchart = container.get_by_test_id("stMermaidChart").nth(0)
    expect(flowchart.locator("img")).to_be_visible()
    assert_snapshot(flowchart, name="st_mermaid_chart-flowchart_themed")


def test_themed_sequence_diagram(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test sequence diagram rendering in light and dark theme."""
    container = get_element_by_key(themed_app, "mermaid_charts")
    sequence_diagram = container.get_by_test_id("stMermaidChart").nth(1)
    expect(sequence_diagram.locator("img")).to_be_visible()
    assert_snapshot(sequence_diagram, name="st_mermaid_chart-sequence_diagram_themed")


def test_themed_pie_chart(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test pie chart rendering in light and dark theme."""
    container = get_element_by_key(themed_app, "mermaid_charts")
    pie_chart = container.get_by_test_id("stMermaidChart").nth(4)
    expect(pie_chart.locator("img")).to_be_visible()
    assert_snapshot(pie_chart, name="st_mermaid_chart-pie_chart_themed")


def test_toolbar_copy_source(app: Page):
    """Test that copy source toolbar action works."""
    container = get_element_by_key(app, "mermaid_charts")
    mermaid_chart = container.get_by_test_id("stMermaidChart").first
    expect(mermaid_chart.locator("img")).to_be_visible()

    # Toolbar should be hidden initially
    copy_button = mermaid_chart.get_by_role("button", name="Copy source")
    expect(copy_button).not_to_be_visible()

    # Hover to show toolbar
    mermaid_chart.hover()
    expect(copy_button).to_be_visible()

    # Click copy button
    copy_button.click()

    # Button label should change to indicate success
    expect(mermaid_chart.get_by_role("button", name="Copied!")).to_be_visible()


def test_toolbar_download_png(app: Page):
    """Test that download PNG toolbar action is available."""
    container = get_element_by_key(app, "mermaid_charts")
    mermaid_chart = container.get_by_test_id("stMermaidChart").first
    expect(mermaid_chart.locator("img")).to_be_visible()

    # Toolbar should be hidden initially
    download_button = mermaid_chart.get_by_role("button", name="Download as PNG")
    expect(download_button).not_to_be_visible()

    # Hover to show toolbar
    mermaid_chart.hover()
    expect(download_button).to_be_visible()

    # Click should trigger download (we verify the button is clickable)
    with app.expect_download() as download_info:
        download_button.click()

    download = download_info.value
    assert download.suggested_filename == "mermaid-diagram.png"
