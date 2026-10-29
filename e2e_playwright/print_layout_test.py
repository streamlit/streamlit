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


def test_print_stacks_columns_and_fits_the_dataframe(
    app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    """Only rows with a chart or dataframe stack, and nothing overlaps.

    Print forces colors, so a dark theme would snapshot the same pixels.
    """
    expect(app.get_by_text("Plain column")).to_be_visible()
    expect(app.get_by_text("Bordered column")).to_be_visible()

    # The print-media change refits the table to the printed column.
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

    table = get_element_by_key(app, "feedback").locator(".stDataFramePrintTable")
    expect(table).to_be_visible()
    headers = table.locator("th")
    expect(headers).to_have_text(
        [
            "Feedback Message",
            "Date",
            "Salesforce Account Name",
            "Deployment",
            "Snowflake Account Name",
            "Username",
            "Agreement Type",
        ]
    )
    expect(table).to_contain_text("Capacity")
    expect(
        get_element_by_key(app, "feedback").locator(".stDataFrameResizable")
    ).to_be_hidden()

    def table_fits_the_card() -> None:
        fit = app.evaluate(
            """() => {
                const card = document.querySelector(".st-key-feedback");
                const table = card?.querySelector(".stDataFramePrintTable");
                if (!table || !card) {
                    return false;
                }
                const tableBox = table.getBoundingClientRect();
                const cardBox = card.getBoundingClientRect();
                return tableBox.left >= cardBox.left - 1
                    && tableBox.right <= cardBox.right + 1
                    && tableBox.top >= cardBox.top - 1
                    && tableBox.bottom <= cardBox.bottom + 1;
            }"""
        )
        assert fit

    wait_until(app, table_fits_the_card)

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

    # A centered container keeps flex even when it holds a chart and a
    # dataframe. Each stays inside the container without covering the next.
    centered_chart = get_element_by_key(app, "centered_chart")
    centered_parts = [
        centered_chart.get_by_test_id("stVegaLiteChart"),
        centered_chart.locator(".stDataFramePrintTable"),
        app.get_by_text("After the centered chart", exact=True),
    ]
    for part in centered_parts:
        expect(part).to_be_visible()

    def centered_chart_and_table_do_not_overlap() -> None:
        container_box = centered_chart.bounding_box()
        assert container_box is not None
        boxes = []
        for part in centered_parts:
            box = part.bounding_box()
            assert box is not None
            boxes.append(box)
        for upper, lower in itertools.pairwise(boxes):
            assert upper["y"] + upper["height"] <= lower["y"] + 1
        for box in boxes[:2]:
            assert box["x"] >= container_box["x"] - 1
            assert box["x"] + box["width"] <= (
                container_box["x"] + container_box["width"] + 1
            )

    wait_until(app, centered_chart_and_table_do_not_overlap)

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
    expect(app.locator(".stDataFramePrintTable")).to_have_count(0)
