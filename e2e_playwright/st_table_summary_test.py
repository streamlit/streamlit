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

"""E2E tests for st.table with summary parameter."""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def test_table_with_summary_footer(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.table renders a summary footer correctly."""
    # Get the tables from the app
    tables = themed_app.get_by_test_id("stTable")
    expect(tables).to_have_count(4)

    # First table: with summary (sum and count)
    first_table = tables.nth(0)
    footer = first_table.get_by_test_id("stTableFooter")
    expect(footer).to_be_visible()

    # Verify footer cells are present
    footer_cells = footer.get_by_test_id("stTableFooterCell")
    expect(footer_cells).to_have_count(3)  # 3 columns

    # Take a snapshot for visual comparison
    assert_snapshot(first_table, name="table_with_summary")


def test_table_without_summary(themed_app: Page):
    """Test that st.table without summary doesn't have a footer."""
    tables = themed_app.get_by_test_id("stTable")

    # Third table: no summary
    third_table = tables.nth(2)
    footer = third_table.get_by_test_id("stTableFooter")
    expect(footer).not_to_be_visible()


def test_table_summary_various_types(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test st.table with various summary types."""
    tables = themed_app.get_by_test_id("stTable")

    # Second table: with all summary types
    second_table = tables.nth(1)
    footer = second_table.get_by_test_id("stTableFooter")
    expect(footer).to_be_visible()

    # Take a snapshot for visual comparison
    assert_snapshot(second_table, name="table_with_all_summary_types")


def test_table_with_truncated_data_shows_icon(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that truncated data shows info icon in summary."""
    tables = themed_app.get_by_test_id("stTable")

    # Fourth table: with truncated data (should show info icon)
    fourth_table = tables.nth(3)
    footer = fourth_table.get_by_test_id("stTableFooter")
    expect(footer).to_be_visible()

    # The truncation icon should be visible for truncated data
    # Note: This test requires a data source that triggers truncation
    # (e.g., a generator or iterator with > 100 rows)
    assert_snapshot(fourth_table, name="table_with_truncated_data_summary")
