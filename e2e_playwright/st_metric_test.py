# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expect_help_tooltip,
    get_element_by_key,
    get_metric,
)


def test_first_metric_in_first_row(app: Page):
    metric = get_metric(app, "User growth")
    expect(metric.get_by_test_id("stMetricLabel")).to_have_text("User growth")
    expect(metric.get_by_test_id("stMetricValue")).to_have_text(" 123 ")
    expect(metric.get_by_test_id("stMetricDelta")).to_have_text(" 123 ")


def test_second_metric_in_first_row(app: Page):
    metric = get_metric(app, "S&P 500")
    expect(metric.get_by_test_id("stMetricLabel")).to_have_text("S&P 500")
    expect(metric.get_by_test_id("stMetricValue")).to_have_text(" -4.56 ")
    expect(metric.get_by_test_id("stMetricDelta")).to_have_text(" -50 ")


def test_third_metric_in_first_row(app: Page):
    metric = get_metric(app, "Apples I've eaten")
    expect(metric.get_by_test_id("stMetricLabel")).to_have_text("Apples I've eaten")
    expect(metric.get_by_test_id("stMetricValue")).to_have_text(" 23k ")
    expect(metric.get_by_test_id("stMetricDelta")).to_have_text(" -20 ")


def test_green_up_arrow_render(themed_app: Page, assert_snapshot: ImageCompareFunction):
    assert_snapshot(
        get_metric(themed_app, "User growth"),
        name="st_metric-green",
    )


def test_red_down_arrow_render(themed_app: Page, assert_snapshot: ImageCompareFunction):
    assert_snapshot(
        get_metric(themed_app, "S&P 500"),
        name="st_metric-red",
    )


def test_gray_down_arrow_render(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    assert_snapshot(
        get_metric(themed_app, "Apples I've eaten"),
        name="st_metric-gray",
    )


def test_help_shows_up_without_columns(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    assert_snapshot(
        get_metric(themed_app, "Relatively long title with help"),
        name="st_metric-with_help",
    )


def test_none_results_in_dash_in_value(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    assert_snapshot(
        get_metric(themed_app, "label title"),
        name="st_metric-with_none_value",
    )


def test_border(themed_app: Page, assert_snapshot: ImageCompareFunction):
    assert_snapshot(
        get_metric(themed_app, "Test 10"),
        name="st_metric-border",
    )


def test_label_visibility_set_to_hidden(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    metric = get_metric(themed_app, "Test 4")
    expect(metric.get_by_test_id("stMetricLabel")).to_have_text("Test 4")
    assert_snapshot(
        metric,
        name="st_metric-label_hidden",
    )


def test_label_visibility_set_to_collapse(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    metric = get_metric(themed_app, "Test 5")
    expect(metric.get_by_test_id("stMetricLabel")).to_have_text("Test 5")
    assert_snapshot(
        metric,
        name="st_metric-label_collapse",
    )


def test_markdown_label_support(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    assert_snapshot(
        get_metric(
            themed_app,
            re.compile("Test 11.+"),
        ),
        name="st_metric-markdown_label",
    )


def test_ellipses_and_help_shows_up_properly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    metric_element = get_metric(themed_app, "Example metric")
    expect_help_tooltip(themed_app, metric_element, "Something should feel right")
    assert_snapshot(
        metric_element,
        name="st_metric-help_and_ellipses",
    )


def test_code_in_help_shows_up_properly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    metric_element = get_metric(themed_app, "Test 9")
    hover_target = metric_element.get_by_test_id("stTooltipHoverTarget")
    tooltip_content = themed_app.get_by_test_id("stTooltipContent")

    expect(hover_target).to_be_visible()
    hover_target.hover()
    expect(tooltip_content).to_have_text("Test help with code select * from table")

    assert_snapshot(
        tooltip_content,
        name="st_metric-code_in_help",
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stMetric")


def test_stretch_width(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that stretch width works correctly."""
    metric_element = get_metric(app, "Stretch width")
    expect(metric_element.get_by_test_id("stMetricLabel")).to_have_text("Stretch width")

    assert_snapshot(
        metric_element,
        name="st_metric-stretch_width",
    )


def test_pixel_width(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that pixel width works correctly."""
    metric_element = get_metric(app, "Pixel width (300px)")
    expect(metric_element.get_by_test_id("stMetricLabel")).to_have_text(
        "Pixel width (300px)"
    )

    assert_snapshot(
        metric_element,
        name="st_metric-pixel_width",
    )


def test_content_width(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that content width works correctly."""
    metric_element = get_metric(app, "Content width")
    expect(metric_element.get_by_test_id("stMetricLabel")).to_have_text("Content width")

    assert_snapshot(
        metric_element,
        name="st_metric-content_width",
    )


def test_pixel_height(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that pixel height works correctly."""
    metric_element = get_metric(app, "Pixel height (200px)")
    expect(metric_element.get_by_test_id("stMetricLabel")).to_have_text(
        "Pixel height (200px)"
    )

    assert_snapshot(
        metric_element,
        name="st_metric-pixel_height",
    )


def test_metric_chart_hover(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that hovering over a metric chart shows correctly."""
    # Get the first metric which has a line chart
    metric_element = get_metric(themed_app, "User growth")
    chart_element = metric_element.get_by_test_id("stMetricChart").locator("svg")

    # Ensure the chart is visible and hover over it
    expect(chart_element).to_be_visible()
    chart_element.hover()

    # Take a screenshot of the chart while hovering
    assert_snapshot(
        metric_element,
        name="st_metric-chart_hover",
    )


def test_height_in_container(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that stretch and content height works correctly in a container."""
    container = get_element_by_key(app, "height_test")
    expect(container).to_be_visible()

    stretch_metric = get_metric(container, "Stretch height")
    expect(stretch_metric.get_by_test_id("stMetricLabel")).to_have_text(
        "Stretch height"
    )

    content_metric = get_metric(container, "Content height")
    expect(content_metric.get_by_test_id("stMetricLabel")).to_have_text(
        "Content height"
    )

    assert_snapshot(
        container,
        name="st_metric-height_in_container",
    )
