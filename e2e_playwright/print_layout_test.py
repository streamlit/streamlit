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

from playwright.sync_api import Page, ViewportSize, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import (
    end_browser_print,
    get_element_by_key,
    start_browser_print,
)

# Same A4 ratio as the hello-app print tests, wide enough that columns would
# sit side by side on screen. Print CSS is what stacks them.
_PORTRAIT: ViewportSize = {"width": 1240, "height": 1754}


def test_print_stacks_columns_and_fits_the_dataframe(
    app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    """Every column uses the full page width, and the print table stays in its card.

    Print forces colors, so a dark theme would snapshot the same pixels.
    """
    expect(app.get_by_text("Plain column")).to_be_visible()
    expect(app.get_by_text("Bordered column")).to_be_visible()

    # The print-media change refits the table to the printed column.
    app.set_viewport_size(_PORTRAIT)
    start_browser_print(app)

    plain = get_element_by_key(app, "plain")
    bordered = get_element_by_key(app, "bordered")
    row = app.get_by_test_id("stHorizontalBlock").filter(has_text="Plain column")

    def columns_are_stacked() -> None:
        # Retry until the print-media reflow has stacked the columns.
        plain_box = plain.bounding_box()
        bordered_box = bordered.bounding_box()
        row_box = row.bounding_box()
        assert plain_box is not None
        assert bordered_box is not None
        assert row_box is not None
        # Stacked, not squeezed into half the page. The plain container has no border.
        assert bordered_box["y"] > plain_box["y"] + plain_box["height"] * 0.5
        assert abs(plain_box["x"] - bordered_box["x"]) < 8
        assert plain_box["width"] > row_box["width"] * 0.9
        assert bordered_box["width"] > row_box["width"] * 0.9

    wait_until(app, columns_are_stacked)

    table = app.locator(".stDataFramePrintTable")
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
    expect(app.locator(".stDataFrameResizable")).to_be_hidden()

    def table_fits_the_card() -> None:
        fit = app.evaluate(
            """() => {
                const table = document.querySelector(".stDataFramePrintTable");
                const card = document.querySelector(".st-key-feedback");
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
    expect(table).to_have_count(0)
