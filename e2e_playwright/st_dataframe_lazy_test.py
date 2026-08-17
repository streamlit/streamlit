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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.dataframe_utils import (
    expect_canvas_to_be_stable,
    open_column_menu,
    sort_column,
)


def _expect_run_count(app: Page, count: int) -> None:
    """Assert the script run count text shows the expected value."""
    expect(app.get_by_text(f"Run count: {count}", exact=True)).to_be_visible()


def _get_dataframe(app: Page, index: int) -> Locator:
    """Return the dataframe element at the given index."""
    dataframe = app.get_by_test_id("stDataFrame").nth(index)
    expect(dataframe).to_be_visible()
    expect_canvas_to_be_stable(dataframe)
    return dataframe


def test_lazy_dataframe_renders(app: Page, assert_snapshot: ImageCompareFunction):
    """The lazy dataframe renders its initial chunk."""
    expect(app.get_by_test_id("stDataFrame")).to_have_count(4)
    _expect_run_count(app, 1)

    lazy_df = _get_dataframe(app, 0)
    assert_snapshot(lazy_df, name="st_dataframe_lazy-initial")


def test_scrolling_does_not_trigger_rerun(app: Page):
    """Scrolling a lazy dataframe loads chunks without triggering a script rerun."""
    lazy_df = _get_dataframe(app, 0)

    # Scroll beyond the 1,000-row initial chunk to request a later chunk.
    lazy_df.hover()
    app.mouse.wheel(0, 40_000)

    expect_canvas_to_be_stable(lazy_df)
    # The run count must stay at 1: chunk requests use the non-rerun transport.
    _expect_run_count(app, 1)


def test_server_side_sorting(app: Page):
    """Clicking a column header sorts a lazy dataframe without a rerun."""
    lazy_df = _get_dataframe(app, 0)

    sort_column(lazy_df, col_pos=1, column_width="medium")
    expect_canvas_to_be_stable(lazy_df)

    # Sorting is handled server-side via chunk requests, not a script rerun.
    _expect_run_count(app, 1)


def test_search_and_csv_hidden_for_lazy(app: Page):
    """Search and CSV download are hidden for lazy dataframes; column menu stays."""
    lazy_df = _get_dataframe(app, 0)
    lazy_df.hover()

    toolbar = lazy_df.get_by_test_id("stElementToolbar")
    expect(toolbar).to_be_attached()

    expect(toolbar.get_by_role("button", name="Search")).to_have_count(0)
    expect(toolbar.get_by_role("button", name="Download as CSV")).to_have_count(0)
    # The column visibility menu remains available.
    expect(toolbar.get_by_role("button", name="Show/hide columns")).to_have_count(1)


def test_small_lazy_dataframe_stays_eager(app: Page):
    """A small dataframe with lazy=True keeps the regular eager toolbar."""
    small_df = _get_dataframe(app, 2)
    small_df.hover()

    toolbar = small_df.get_by_test_id("stElementToolbar")
    # The eager path keeps search and CSV download available.
    expect(toolbar.get_by_role("button", name="Search")).to_have_count(1)
    expect(toolbar.get_by_role("button", name="Download as CSV")).to_have_count(1)


def test_lazy_column_menu_sort_gating_and_statistics(app: Page):
    """The lazy column menu gates sorting on orderability and hides statistics.

    Statistics are hidden because only the initial chunk is loaded client-side,
    so they would reflect a subset of rows rather than the full dataframe.
    Server-side sorting is offered for orderable data columns but hidden for
    unorderable (nested) columns, which the backend cannot sort.
    """
    # Use the fixed-width, index-hidden lazy dataframe (index 3) so the column
    # menu opens at a deterministic position. Columns (all medium width):
    # index_col (0), tags (1, a list column), squared (2), label (3).
    fixed_df = _get_dataframe(app, 3)

    # An orderable data column offers server-side sorting and hides statistics.
    open_column_menu(fixed_df, col_pos=0, column_width="medium")
    menu = app.get_by_test_id("stDataFrameColumnMenu")
    expect(menu).to_be_visible()
    expect(menu.get_by_text("Sort ascending")).to_be_visible()
    expect(menu.get_by_text("Sort descending")).to_be_visible()
    expect(menu.get_by_text("Statistics")).to_have_count(0)

    # Close the menu before opening it for another column.
    app.keyboard.press("Escape")
    expect(menu).not_to_be_visible()

    # The unorderable ``tags`` list column does not offer server-side sorting,
    # so clicking it can never leave the grid stuck on a failed sort request.
    open_column_menu(fixed_df, col_pos=1, column_width="medium")
    menu = app.get_by_test_id("stDataFrameColumnMenu")
    expect(menu).to_be_visible()
    expect(menu.get_by_text("Sort ascending")).to_have_count(0)
    expect(menu.get_by_text("Sort descending")).to_have_count(0)
