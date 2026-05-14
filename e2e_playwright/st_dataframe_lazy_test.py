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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.dataframe_utils import (
    expect_canvas_to_be_stable,
    sort_column,
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


def test_lazy_dataframe_sorting(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that lazy dataframe supports server-side sorting."""
    wait_for_app_run(themed_app)

    # Get the dataframe element
    dataframe = themed_app.get_by_test_id("stDataFrame")
    expect(dataframe).to_be_visible()

    # Wait for the dataframe canvas to be stable
    expect_canvas_to_be_stable(dataframe)

    # Sort by clicking on the "id" column header (col_pos=1, since col_pos=0 is index)
    # This triggers server-side sorting for lazy dataframes
    sort_column(dataframe, col_pos=1, column_width="small")

    # Wait for the sort to complete and data to reload
    expect_canvas_to_be_stable(dataframe)

    # Take a snapshot to verify the sorted state
    # The snapshot comparison ensures the data order actually changed
    assert_snapshot(dataframe, name="lazy_dataframe_sorted")


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
