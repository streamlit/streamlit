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
from e2e_playwright.shared.app_utils import get_element_by_key

# Same A4 ratio as the hello-app print tests, wide enough that columns would
# sit side by side on screen. Print CSS is what stacks them.
_PORTRAIT: ViewportSize = {"width": 1240, "height": 1754}


def test_print_stacks_columns_and_fits_the_dataframe(
    themed_app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    """Every column uses the full page width, and the print table stays in its card."""
    app = themed_app

    expect(app.get_by_text("Plain column")).to_be_visible()
    expect(app.get_by_text("Bordered column")).to_be_visible()

    # A browser fires beforeprint while screen media is still active, then
    # switches to print. emulate_media fires the matchMedia change on the
    # next task, which refits the table to the printed column. A fresh
    # matchMedia("print") is a different object, so dispatching change on
    # it would not reach that listener.
    app.set_viewport_size(_PORTRAIT)
    app.evaluate("() => window.dispatchEvent(new Event('beforeprint'))")
    app.emulate_media(media="print", forced_colors="active")
    app.evaluate("() => new Promise(resolve => setTimeout(resolve, 0))")

    plain = get_element_by_key(app, "plain")
    bordered = get_element_by_key(app, "bordered")
    row = app.get_by_test_id("stHorizontalBlock")

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

    # A centered or end-aligned container keeps flex. display:block would
    # drop align-items and justify-content and print the content at the start.
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

    assert_snapshot(app, name="st_print_layout-stacked_columns")

    app.evaluate("() => window.dispatchEvent(new Event('afterprint'))")
    expect(table).to_have_count(0)
