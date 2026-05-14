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

"""E2E tests for lazy st.dataframe loading."""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import wait_for_app_run
from e2e_playwright.shared.dataframe_utils import (
    click_on_cell,
    expect_canvas_to_be_stable,
)


def test_lazy_dataframe_renders_initial_data(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that lazy dataframe renders the initial chunk of data."""
    wait_for_app_run(themed_app)

    # Get the dataframe element
    dataframe = themed_app.get_by_test_id("stDataFrame")
    expect(dataframe).to_be_visible()

    # Wait for the dataframe canvas to be stable
    expect_canvas_to_be_stable(dataframe)

    # Take a snapshot of the initial state
    assert_snapshot(dataframe, name="lazy_dataframe_initial")


def test_lazy_dataframe_sorting(themed_app: Page):
    """Test that lazy dataframe supports server-side sorting."""
    wait_for_app_run(themed_app)

    # Get the dataframe element
    dataframe = themed_app.get_by_test_id("stDataFrame")
    expect(dataframe).to_be_visible()

    # Wait for the dataframe canvas to be stable
    expect_canvas_to_be_stable(dataframe)

    # Click on a column header (row 0) to sort
    # The first column (col 1) is the "id" column after the index column (col 0)
    click_on_cell(
        dataframe, row_pos=0, col_pos=1, column_width="small", wait_after_ms=500
    )

    # Wait for the sort to complete
    expect_canvas_to_be_stable(dataframe)

    # Verify the dataframe is still visible after sorting
    expect(dataframe).to_be_visible()


def test_lazy_dataframe_search_disabled(themed_app: Page):
    """Test that search is disabled for lazy dataframes."""
    wait_for_app_run(themed_app)

    # Get the dataframe element
    dataframe = themed_app.get_by_test_id("stDataFrame")
    expect(dataframe).to_be_visible()

    # Hover to show the toolbar
    dataframe.hover()

    # Get the toolbar - it should appear on hover
    toolbar = themed_app.get_by_test_id("stElementToolbar")

    # The search button should not be visible for lazy dataframes
    search_button = toolbar.get_by_role("button", name="Search")
    expect(search_button).not_to_be_visible()
