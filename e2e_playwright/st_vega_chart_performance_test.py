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

"""
Performance tests for Vega-based charts.

These tests measure rendering performance for various Vega-based chart types:
- st.line_chart
- st.bar_chart
- st.altair_chart
- st.vega_lite_chart

Test scenarios include:
- Initial chart load
- Window resize (the key optimization target)
- Data updates
- Multiple charts rendering in parallel

The tests use @pytest.mark.performance to capture detailed metrics via
Chrome DevTools Protocol, including execution time, long tasks, and
network/websocket traffic.
"""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import click_button

# Number of charts in the test app:
# 1 (line_chart) + 3 (columns: bar_chart, line_chart, altair) +
# 1 (altair large) + 1 (vega_lite_chart) + 1 (altair update) = 7
EXPECTED_CHART_COUNT = 7


def wait_for_charts_rendered(app: Page) -> None:
    """Wait for all Vega-based charts to be fully rendered."""
    charts = app.get_by_test_id("stVegaLiteChart")
    expect(charts).to_have_count(EXPECTED_CHART_COUNT)

    # Wait for each chart to have the SVG marks rendered
    for i in range(EXPECTED_CHART_COUNT):
        chart = charts.nth(i)
        expect(chart.locator("svg.marks")).to_be_visible()


def assert_no_errors(app: Page) -> None:
    """Verify that no errors or exceptions occurred during test execution."""
    # Check that no exception elements are displayed
    expect(app.get_by_test_id("stException")).to_have_count(0)
    # Check that no error alerts are displayed
    expect(app.get_by_role("alert")).to_have_count(0)


@pytest.mark.performance
@pytest.mark.repeat(5)
def test_vega_chart_initial_load(app: Page):
    """
    Test the performance of initial Vega-based chart rendering.

    This test measures the time and resources needed to:
    - Load and parse the app
    - Create all Vega views (line_chart, bar_chart, altair_chart, vega_lite_chart)
    - Render initial chart content

    Expected: Charts should render within acceptable time limits.
    The performance marker captures detailed metrics including long tasks.
    """
    wait_for_charts_rendered(app)
    assert_no_errors(app)


@pytest.mark.performance
@pytest.mark.repeat(5)
def test_vega_chart_resize(app: Page):
    """
    Test the performance of Vega-based chart resize operations.

    This is the key performance scenario that was optimized. Previously,
    resize events caused full view recreation (~195ms per chart). After
    optimization, resize uses Vega's native API (~18ms per chart).

    Test flow:
    1. Wait for initial render
    2. Resize viewport multiple times
    3. Verify charts still render correctly

    Expected: Resize operations should be smooth without long tasks.
    """
    wait_for_charts_rendered(app)

    # Get initial viewport size
    viewport = app.viewport_size
    assert viewport is not None
    initial_width = viewport["width"]
    initial_height = viewport["height"]

    # Perform multiple resize operations to simulate window dragging
    resize_widths = [
        initial_width - 200,  # Shrink
        initial_width - 400,  # Shrink more
        initial_width - 100,  # Grow back slightly
        initial_width,  # Return to original
    ]

    for width in resize_widths:
        app.set_viewport_size({"width": width, "height": initial_height})
        # Brief wait for resize to process (debounce is 50ms + RAF)
        app.wait_for_timeout(150)

    # Verify charts are still properly rendered after resize
    wait_for_charts_rendered(app)
    assert_no_errors(app)


@pytest.mark.performance
@pytest.mark.repeat(5)
def test_vega_chart_rapid_resize(app: Page):
    """
    Test performance under rapid consecutive resize events.

    This stress test simulates a user quickly dragging the window edge,
    which generates many resize events in quick succession.

    The optimization uses:
    - 50ms debounce on ResizeObserver
    - requestAnimationFrame for smooth updates
    - Vega's native resize API instead of view recreation

    Expected: No long tasks or visible jank during rapid resize.
    """
    wait_for_charts_rendered(app)

    viewport = app.viewport_size
    assert viewport is not None
    base_width = viewport["width"]
    height = viewport["height"]

    # Simulate rapid resize (like dragging window edge)
    for i in range(10):
        # Oscillate width to simulate back-and-forth dragging
        offset = (i % 4) * 50 - 100  # -100, -50, 0, 50, -100, ...
        new_width = max(400, base_width + offset)
        app.set_viewport_size({"width": new_width, "height": height})
        # Minimal wait to allow resize event to fire
        app.wait_for_timeout(30)

    # Return to original size
    app.set_viewport_size({"width": base_width, "height": height})
    app.wait_for_timeout(200)

    # Verify charts recovered properly
    wait_for_charts_rendered(app)
    assert_no_errors(app)


@pytest.mark.performance
@pytest.mark.repeat(5)
def test_vega_chart_data_update(app: Page):
    """
    Test performance of data updates without spec changes.

    When only the data changes (not the chart spec), the optimization
    should use Vega's data update API rather than recreating the view.

    Test flow:
    1. Wait for initial render
    2. Click button to update data
    3. Wait for chart to update
    4. Verify chart still renders correctly

    Expected: Data updates should be efficient, using incremental updates.
    """
    wait_for_charts_rendered(app)

    # Find the data update button and click it
    click_button(app, "Update data")
    wait_for_app_run(app)

    # Verify charts are still rendered after data update
    wait_for_charts_rendered(app)

    # Verify the data version was updated
    expect(app.get_by_text("Data version: 1")).to_be_visible()

    # Perform another update
    click_button(app, "Update data")
    wait_for_app_run(app)

    expect(app.get_by_text("Data version: 2")).to_be_visible()
    wait_for_charts_rendered(app)
    assert_no_errors(app)


@pytest.mark.performance
@pytest.mark.repeat(5)
def test_vega_chart_multiple_charts_resize(app: Page):
    """
    Test resize performance with multiple chart types on the page.

    This tests the scenario where a user has multiple charts in columns,
    using different chart APIs (line_chart, bar_chart, altair_chart).
    All charts need to resize simultaneously, which previously caused
    severe performance issues with the old recreation approach.

    Expected: Multiple charts should resize smoothly together.
    """
    wait_for_charts_rendered(app)

    viewport = app.viewport_size
    assert viewport is not None

    # Resize to trigger all charts to update
    app.set_viewport_size(
        {"width": viewport["width"] - 300, "height": viewport["height"]}
    )
    app.wait_for_timeout(200)

    # Verify all charts still render correctly
    wait_for_charts_rendered(app)

    # Resize back
    app.set_viewport_size({"width": viewport["width"], "height": viewport["height"]})
    app.wait_for_timeout(200)

    wait_for_charts_rendered(app)
    assert_no_errors(app)
