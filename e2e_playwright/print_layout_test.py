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

import itertools

from playwright.sync_api import Locator, Page, ViewportSize, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import (
    end_browser_print,
    get_element_by_key,
    start_browser_print,
)

# Same A4 ratio as the hello-app print tests, wide enough that columns would
# sit side by side on screen. Print CSS decides which rows stack.
_PORTRAIT: ViewportSize = {"width": 1240, "height": 1754}


def _break_inside(locator: Locator) -> str:
    return str(locator.evaluate("element => getComputedStyle(element).breakInside"))


def test_print_stacks_chart_rows_without_overlap(
    app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    """Only rows with a chart stack, and nothing overlaps.

    Print forces colors, so a dark theme would snapshot the same pixels.
    """
    expect(app.get_by_text("Plain column")).to_be_visible()
    expect(app.get_by_text("Bordered column")).to_be_visible()

    app.set_viewport_size(_PORTRAIT)
    start_browser_print(app)

    plain = get_element_by_key(app, "plain")
    bordered = get_element_by_key(app, "bordered")
    metric_row = get_element_by_key(app, "metric_row").get_by_test_id(
        "stHorizontalBlock"
    )
    metric_columns = metric_row.get_by_test_id("stColumn")
    expect(metric_columns).to_have_count(4)

    def text_and_metric_rows_stay_side_by_side() -> None:
        # A border alone does not stack a row. Text wraps and metrics
        # shrink to fit, so neither overflows its column.
        plain_box = plain.bounding_box()
        bordered_box = bordered.bounding_box()
        assert plain_box is not None
        assert bordered_box is not None
        assert abs(plain_box["y"] - bordered_box["y"]) < 2
        assert bordered_box["x"] > plain_box["x"] + plain_box["width"] - 1

        row_box = metric_row.bounding_box()
        assert row_box is not None
        boxes = []
        for index in range(4):
            box = metric_columns.nth(index).bounding_box()
            assert box is not None
            boxes.append(box)
        for box in boxes:
            assert abs(box["y"] - boxes[0]["y"]) < 2
            assert box["width"] < row_box["width"] / 3
        for left, right in itertools.pairwise(boxes):
            assert right["x"] >= left["x"] + left["width"] - 1

    wait_until(app, text_and_metric_rows_stay_side_by_side)

    # A side-by-side row of bordered cards, and a bordered card with a chart,
    # each stay on one page. A text-only card can split like normal text.
    assert _break_inside(metric_row) == "avoid"
    assert _break_inside(get_element_by_key(app, "chart_card")) == "avoid"
    assert _break_inside(bordered) == "auto"

    # A horizontally centered container keeps flex, because display:block
    # would drop align-items. A fixed-height container keeps flex, so its
    # vertical alignment still has free space to center in.
    centered = get_element_by_key(app, "centered")
    expect(centered).to_be_visible()
    centered_style = centered.evaluate(
        """element => {
            const style = getComputedStyle(element)
            return { display: style.display, alignItems: style.alignItems }
        }"""
    )
    assert centered_style["display"] == "flex"
    assert centered_style["alignItems"] == "center"

    vertically_centered = get_element_by_key(app, "vertically_centered")
    vertical_style = vertically_centered.evaluate(
        """element => {
            const style = getComputedStyle(element)
            return { display: style.display, justifyContent: style.justifyContent }
        }"""
    )
    assert vertical_style["display"] == "flex"
    assert vertical_style["justifyContent"] == "center"

    # A stretch-height container in a fixed-height parent still fills it, so
    # its vertical alignment has free space to center in.
    stretch_centered = get_element_by_key(app, "stretch_centered")
    stretch_style = stretch_centered.evaluate(
        """element => {
            const style = getComputedStyle(element)
            return {
                display: style.display,
                wrapperDisplay: getComputedStyle(element.parentElement).display,
            }
        }"""
    )
    assert stretch_style["display"] == "flex"
    assert stretch_style["wrapperDisplay"] == "flex"
    stretch_box = stretch_centered.bounding_box()
    text_box = stretch_centered.get_by_text("Stretch centered").bounding_box()
    assert stretch_box is not None
    assert text_box is not None
    assert stretch_box["height"] > 2 * text_box["height"]

    # An expander's content block is height 100% of a content-height parent.
    # It prints as a block, so its chart does not cover the next element.
    expander_chart = app.get_by_test_id("stExpander").get_by_test_id("stVegaLiteChart")
    after_expander = app.get_by_text("After the expander chart", exact=True)
    expect(expander_chart).to_be_visible()

    def expander_chart_does_not_overlap() -> None:
        chart_box = expander_chart.bounding_box()
        after_box = after_expander.bounding_box()
        assert chart_box is not None
        assert after_box is not None
        assert chart_box["y"] + chart_box["height"] <= after_box["y"] + 1

    wait_until(app, expander_chart_does_not_overlap)

    # A centered container keeps flex even when it holds a chart. The chart
    # stays inside the container without covering the next element.
    centered_chart = get_element_by_key(app, "centered_chart")
    centered_parts = [
        centered_chart.get_by_test_id("stVegaLiteChart"),
        app.get_by_text("After the centered chart", exact=True),
    ]
    for part in centered_parts:
        expect(part).to_be_visible()

    def centered_chart_does_not_overlap() -> None:
        container_box = centered_chart.bounding_box()
        assert container_box is not None
        chart_box, after_box = (part.bounding_box() for part in centered_parts)
        assert chart_box is not None
        assert after_box is not None
        assert chart_box["y"] + chart_box["height"] <= after_box["y"] + 1
        assert chart_box["x"] >= container_box["x"] - 1
        assert chart_box["x"] + chart_box["width"] <= (
            container_box["x"] + container_box["width"] + 1
        )

    wait_until(app, centered_chart_does_not_overlap)

    chart_row = get_element_by_key(app, "chart_row")
    chart = chart_row.get_by_test_id("stVegaLiteChart")
    after_chart = app.get_by_text("After the chart row", exact=True)
    expect(chart).to_be_visible()
    expect(after_chart).to_be_visible()

    def chart_stays_above_the_heading() -> None:
        chart_box = chart.bounding_box()
        after_box = after_chart.bounding_box()
        content = (
            chart_row.get_by_test_id("stColumn")
            .first.get_by_test_id("stVerticalBlock")
            .first
        )
        display = content.evaluate("element => getComputedStyle(element).display")
        assert chart_box is not None
        assert after_box is not None
        # The column content block is height 100%. Once the column stacks,
        # that percentage is auto, so the block has to leave flex or the
        # chart paints over the heading.
        assert display == "block"
        assert chart_box["y"] + chart_box["height"] <= after_box["y"] + 1

    wait_until(app, chart_stays_above_the_heading)

    # The geometry checks above cover the whole page. The snapshot keeps to
    # the stacked chart row.
    assert_snapshot(chart_row, name="print_layout-stacked_chart_row")

    end_browser_print(app)


def _assert_inside(inner: Locator, outer: Locator) -> None:
    inner_box = inner.bounding_box()
    outer_box = outer.bounding_box()
    assert inner_box is not None
    assert outer_box is not None
    assert inner_box["x"] >= outer_box["x"] - 1
    assert inner_box["x"] + inner_box["width"] <= (
        outer_box["x"] + outer_box["width"] + 1
    )


def test_print_fits_metrics_and_stacks_chart_containers(app: Page) -> None:
    """Metric variants fit their card, Plotly rows and horizontal containers
    with a chart stack, and a trailing placeholder adds no gap.
    """
    expect(app.get_by_text("After the Plotly row", exact=True)).to_be_visible()

    app.set_viewport_size(_PORTRAIT)
    start_browser_print(app)

    # A content-width metric and a metric sparkline both keep the size
    # measured on screen unless print caps them to the narrower card.
    metric_columns = get_element_by_key(app, "metric_extras").get_by_test_id("stColumn")
    expect(metric_columns).to_have_count(2)
    content_column, chart_column = metric_columns.nth(0), metric_columns.nth(1)
    content_value = content_column.get_by_test_id("stMetricValue")
    sparkline = chart_column.get_by_test_id("stMetricChart")
    sparkline_graphic = sparkline.locator("svg, canvas").first
    expect(content_value).to_be_visible()
    expect(sparkline_graphic).to_be_visible()

    def metrics_fit_their_columns() -> None:
        _assert_inside(content_value, content_column)
        _assert_inside(sparkline, chart_column)
        _assert_inside(sparkline_graphic, chart_column)

    wait_until(app, metrics_fit_their_columns)

    # A Plotly chart stacks its row like the built-in charts.
    plotly_row = get_element_by_key(app, "plotly_row")
    plotly_chart = plotly_row.get_by_test_id("stPlotlyChart")
    beside_text = plotly_row.get_by_text("Beside the Plotly chart", exact=True)
    after_plotly = app.get_by_text("After the Plotly row", exact=True)
    expect(plotly_chart).to_be_visible()

    def plotly_row_stacks() -> None:
        chart_box = plotly_chart.bounding_box()
        beside_box = beside_text.bounding_box()
        after_box = after_plotly.bounding_box()
        assert chart_box is not None
        assert beside_box is not None
        assert after_box is not None
        assert chart_box["y"] + chart_box["height"] <= beside_box["y"] + 1
        assert beside_box["y"] + beside_box["height"] <= after_box["y"] + 1

    wait_until(app, plotly_row_stacks)

    # A horizontal container with a chart stacks like a column row, and the
    # chart spans the container. Its fixed height fits the row but not the
    # stacked children, so it grows to fit them. One without a chart stays
    # side by side.
    horizontal_chart = get_element_by_key(app, "horizontal_chart")
    horizontal_parts = [
        horizontal_chart.get_by_test_id("stVegaLiteChart"),
        horizontal_chart.get_by_text("Beside the horizontal chart", exact=True),
        app.get_by_text("After the horizontal chart", exact=True),
    ]
    for part in horizontal_parts:
        expect(part).to_be_visible()

    def horizontal_chart_stacks() -> None:
        container_box = horizontal_chart.bounding_box()
        assert container_box is not None
        chart_box, beside_box, after_box = (
            part.bounding_box() for part in horizontal_parts
        )
        assert chart_box is not None
        assert beside_box is not None
        assert after_box is not None
        assert chart_box["width"] > container_box["width"] * 0.9
        assert chart_box["y"] + chart_box["height"] <= beside_box["y"] + 1
        assert (
            beside_box["y"] + beside_box["height"]
            <= container_box["y"] + container_box["height"] + 1
        )
        assert beside_box["y"] + beside_box["height"] <= after_box["y"] + 1

    wait_until(app, horizontal_chart_stacks)

    buttons = get_element_by_key(app, "horizontal_buttons").get_by_test_id("stButton")
    expect(buttons).to_have_count(2)
    first_button = buttons.nth(0).bounding_box()
    second_button = buttons.nth(1).bounding_box()
    assert first_button is not None
    assert second_button is not None
    assert abs(first_button["y"] - second_button["y"]) < 2
    assert second_button["x"] >= first_button["x"] + first_button["width"] - 1

    # The print gap margin only goes on a child with a printed sibling after
    # it, so a hidden trailing placeholder leaves no blank strip.
    trailing_children = get_element_by_key(app, "trailing_empty").locator(":scope > *")
    expect(trailing_children).to_have_count(2)
    assert (
        trailing_children.first.evaluate(
            "element => getComputedStyle(element).marginBottom"
        )
        == "0px"
    )

    end_browser_print(app)
