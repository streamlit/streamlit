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


def test_mermaid_charts_render(app: Page):
    """Test that all mermaid chart types render correctly."""
    mermaid_charts = app.get_by_test_id("stMermaidChart")
    expect(mermaid_charts).to_have_count(9)

    # Check that each chart contains an img element with blob URL (rendered mermaid)
    for i in range(9):
        img = mermaid_charts.nth(i).locator("img")
        expect(img).to_be_visible()
        expect(img).to_have_attribute("src", re.compile(r"^blob:"))


def test_chart_sizing(app: Page):
    """Test mermaid chart sizing for ``width="content"`` and tall diagrams.

    Regression guards for two bugs: a ``width="content"`` diagram that collapsed
    to a zero-size image, and tall diagrams that were clamped to an unreadable
    sliver by a fixed inline ``max-height``.
    """
    mermaid_charts = app.get_by_test_id("stMermaidChart")

    # The "Content width" chart (second to last) must render at a visible,
    # non-zero size rather than collapsing to 0x0.
    content_img = mermaid_charts.nth(7).locator("img")
    expect(content_img).to_be_visible()
    content_box = content_img.bounding_box()
    assert content_box is not None
    assert content_box["width"] > 50, content_box
    assert content_box["height"] > 20, content_box

    # The tall chart (last) must not be clamped to a short strip: its height
    # should clearly exceed the previous 25rem (~400px) inline max-height.
    tall_img = mermaid_charts.nth(8).locator("img")
    expect(tall_img).to_be_visible()
    tall_box = tall_img.bounding_box()
    assert tall_box is not None
    assert tall_box["height"] > 450, tall_box


def test_chart_snapshots(app: Page, assert_snapshot: ImageCompareFunction):
    """Test all mermaid chart types rendering with snapshots."""
    mermaid_charts = app.get_by_test_id("stMermaidChart")

    chart_names = [
        "flowchart",
        "sequence_diagram",
        "class_diagram",
        "state_diagram",
        "pie_chart",
        "gantt_chart",
        "mind_map",
    ]

    for i, name in enumerate(chart_names):
        chart = mermaid_charts.nth(i)
        expect(chart.locator("img")).to_be_visible()
        assert_snapshot(chart, name=f"st_mermaid_chart-{name}")


def test_themed_chart_snapshots(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test mermaid chart rendering in light and dark theme."""
    mermaid_charts = themed_app.get_by_test_id("stMermaidChart")

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
    # Get the fullscreen frame which contains both the toolbar and the chart
    fullscreen_frame = app.get_by_test_id("stFullScreenFrame").first
    toolbar = fullscreen_frame.get_by_test_id("stElementToolbar")
    mermaid_chart = fullscreen_frame.get_by_test_id("stMermaidChart")
    expect(mermaid_chart.locator("img")).to_be_visible()

    expect(toolbar).not_to_have_css("opacity", "1")

    fullscreen_frame.hover()
    expect(toolbar).to_have_css("opacity", "1")

    copy_button = toolbar.get_by_role("button", name="Copy to clipboard")
    copy_button.click()

    expect(toolbar.get_by_role("button", name="Copied")).to_be_visible()


def test_toolbar_download_png(app: Page):
    """Test that download PNG toolbar action is available."""
    # Get the fullscreen frame which contains both the toolbar and the chart
    fullscreen_frame = app.get_by_test_id("stFullScreenFrame").first
    toolbar = fullscreen_frame.get_by_test_id("stElementToolbar")
    mermaid_chart = fullscreen_frame.get_by_test_id("stMermaidChart")
    expect(mermaid_chart.locator("img")).to_be_visible()

    expect(toolbar).not_to_have_css("opacity", "1")

    fullscreen_frame.hover()
    expect(toolbar).to_have_css("opacity", "1")

    download_button = toolbar.get_by_role("button", name="Download as PNG")
    download_button.click()
