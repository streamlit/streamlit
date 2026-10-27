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

import pytest
from playwright.sync_api import Page, ViewportSize, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key

# Same A4 ratio as the other print tests. Wide enough to stay off the mobile
# layout, short of a full printed page.
_PORTRAIT: ViewportSize = {"width": 1240, "height": 1754}

_ROW_CAP_NOTE = "Further rows were not printed. This table is capped at 1,000 rows."
_CELL_BUDGET_NOTE = "Further rows were not printed because other tables on this page were already expanded."


@pytest.mark.only_browser("chromium")
def test_print_notes_for_row_cap_and_cell_budget(
    app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    """A long frame stops at 1,000 rows. The next one stops when the page budget is spent.

    Chromium only: building the print tables is the expensive part, and the
    note text does not depend on the browser. Print colors are forced, so a
    second theme would snapshot the same pixels.
    """
    expect(app.get_by_test_id("stDataFrame")).to_have_count(2)
    row_cap = get_element_by_key(app, "row_cap")
    cell_budget = get_element_by_key(app, "cell_budget")
    expect(row_cap).to_be_visible()
    expect(cell_budget).to_be_visible()

    # A browser fires beforeprint while screen media is still active, then
    # switches to print. emulate_media delivers the matchMedia change on the
    # next task.
    app.set_viewport_size(_PORTRAIT)
    app.evaluate("() => window.dispatchEvent(new Event('beforeprint'))")
    app.emulate_media(media="print", forced_colors="active")
    app.evaluate("() => new Promise(resolve => setTimeout(resolve, 0))")

    row_cap_table = row_cap.locator(".stDataFramePrintTable")
    budget_table = cell_budget.locator(".stDataFramePrintTable")
    expect(row_cap_table.locator("th")).to_have_count(48)
    expect(row_cap_table.locator("tbody tr")).to_have_count(1_000)
    expect(row_cap_table.locator("tbody tr").nth(999).locator("td").first).to_have_text(
        "999"
    )
    expect(budget_table.locator("th")).to_have_count(4)
    expect(budget_table.locator("tbody tr")).to_have_count(500)
    expect(budget_table.locator("tbody tr").nth(499).locator("td").first).to_have_text(
        "499"
    )

    row_cap_note = row_cap.locator(".stDataFramePrintNote")
    budget_note = cell_budget.locator(".stDataFramePrintNote")
    expect(row_cap_note).to_have_text(_ROW_CAP_NOTE)
    expect(budget_note).to_have_text(_CELL_BUDGET_NOTE)
    # The note sits under the printed rows, outside the scaled table.
    expect(
        row_cap.locator(".stDataFramePrintScale + .stDataFramePrintNote")
    ).to_have_count(1)
    expect(
        cell_budget.locator(".stDataFramePrintScale + .stDataFramePrintNote")
    ).to_have_count(1)

    assert_snapshot(row_cap_note, name="st_dataframe_print-row_cap_note")
    assert_snapshot(budget_note, name="st_dataframe_print-cell_budget_note")
