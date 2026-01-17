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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class

TOTAL_TABLE_ELEMENTS = 43


def test_table_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.table renders correctly via snapshot testing."""
    table_elements = app.get_by_test_id("stTable")
    expect(table_elements).to_have_count(TOTAL_TABLE_ELEMENTS)

    for i, element in enumerate(table_elements.all()):
        assert_snapshot(element, name=f"st_table-{i}")


def test_themed_table_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.table renders correctly with different theming."""
    table_elements = themed_app.get_by_test_id("stTable")
    expect(table_elements).to_have_count(TOTAL_TABLE_ELEMENTS)

    # Only test a single table element to ensure theming is applied correctly:
    assert_snapshot(table_elements.nth(30), name="st_table-themed")


def test_pandas_styler_tooltips(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that pandas styler tooltips render correctly."""
    styled_table = app.get_by_test_id("stTable").nth(31)
    table_cell = styled_table.locator("td", has_text="38").first
    table_cell.hover()
    expect(table_cell.locator(".pd-t")).to_have_css("visibility", "visible")
    assert_snapshot(styled_table, name="st_table-styler_tooltip")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stTable")


def test_hide_index_visual_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test visual appearance of hide_index parameter with snapshots."""
    tables = themed_app.get_by_test_id("stTable")

    # Default: Index visible
    assert_snapshot(tables.nth(35), name="st_table-default_index_visible")

    # Hide index (hide_index=True)
    assert_snapshot(tables.nth(36), name="st_table-hide_index_true")


def test_hide_index_with_multiindex_visual_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test hide_index with MultiIndex dataframes."""
    tables = themed_app.get_by_test_id("stTable")

    # MultiIndex with hide_index=False (default)
    assert_snapshot(tables.nth(37), name="st_table-multiindex_hide_index_false_default")

    # MultiIndex with hide_index=True
    assert_snapshot(tables.nth(38), name="st_table-multiindex_hide_index_true")


def test_hide_index_with_styler_visual_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test hide_index works correctly with Pandas Styler."""
    tables = themed_app.get_by_test_id("stTable")

    # Pandas Styler with hide_index=False (default)
    assert_snapshot(tables.nth(39), name="st_table-styler_hide_index_false_default")

    # Pandas Styler with hide_index=True
    assert_snapshot(tables.nth(40), name="st_table-styler_hide_index_true")


def test_hide_index_with_range_index_visual_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test hide_index with default RangeIndex."""
    tables = themed_app.get_by_test_id("stTable")

    # DataFrame without custom index (RangeIndex)
    assert_snapshot(tables.nth(41), name="st_table-range_index_default")

    # DataFrame without custom index with hide_index=True
    assert_snapshot(tables.nth(42), name="st_table-range_index_hide_index_true")


def test_default_index_column_is_visible(app: Page):
    """Test that index column is visible by default."""
    # Get the first table with index (nth(35) - "Default: Index visible")
    table = app.get_by_test_id("stTable").nth(35)

    # Check that there are 3 columns (1 index + 2 data columns)
    header_cells = table.locator("thead th")
    expect(header_cells).to_have_count(3)

    # Verify first column is the index (empty header for default index)
    expect(header_cells.nth(0)).to_be_visible()

    # Verify data columns are present
    expect(header_cells.nth(1)).to_contain_text("Name")
    expect(header_cells.nth(2)).to_contain_text("Age")

    # Check first data row has index value
    first_row_cells = table.locator("tbody tr").nth(0).locator("th, td")
    expect(first_row_cells).to_have_count(3)
    expect(first_row_cells.nth(0)).to_contain_text("D1")


def test_hide_index_hides_index_column(app: Page):
    """Test that hide_index=True properly hides the index column."""
    # Get table with hide_index=True (nth(36))
    table = app.get_by_test_id("stTable").nth(36)

    # Check that there are only 2 columns (no index column)
    header_cells = table.locator("thead th")
    expect(header_cells).to_have_count(2)

    # Verify data columns start immediately (no index column)
    expect(header_cells.nth(0)).to_contain_text("Name")
    expect(header_cells.nth(1)).to_contain_text("Age")

    # Check first data row doesn't have index value
    first_row_cells = table.locator("tbody tr").nth(0).locator("td")
    expect(first_row_cells).to_have_count(2)
    expect(first_row_cells.nth(0)).to_contain_text("Max")
    # Ensure index value is not present
    expect(table.locator("tbody")).not_to_contain_text("D1")


def test_multiindex_all_index_columns_hidden(app: Page):
    """Test that hide_index=True hides all index columns in MultiIndex."""
    # Get MultiIndex table with hide_index=True (nth(38))
    table = app.get_by_test_id("stTable").nth(38)

    # Check that there are only 2 data columns (both index columns hidden)
    header_cells = table.locator("thead th")
    expect(header_cells).to_have_count(2)

    # Verify only data columns are present
    expect(header_cells.nth(0)).to_contain_text("Driver")
    expect(header_cells.nth(1)).to_contain_text("Position")

    # Verify index values are not present in the table
    expect(table).not_to_contain_text("Year")
    expect(table).not_to_contain_text("Month")
    expect(table).not_to_contain_text("2023")
    expect(table).not_to_contain_text("Jan")


def test_multiindex_default_shows_all_index_columns(app: Page):
    """Test that MultiIndex shows all index columns by default."""
    # Get MultiIndex table with default behavior (nth(37))
    table = app.get_by_test_id("stTable").nth(37)

    # Check that there are 4 columns (2 index + 2 data)
    header_cells = table.locator("thead th")
    expect(header_cells).to_have_count(4)

    # Verify index column headers
    expect(header_cells.nth(0)).to_contain_text("Year")
    expect(header_cells.nth(1)).to_contain_text("Month")

    # Verify data column headers
    expect(header_cells.nth(2)).to_contain_text("Driver")
    expect(header_cells.nth(3)).to_contain_text("Position")

    # Verify index values are present
    first_row_cells = table.locator("tbody tr").nth(0).locator("th, td")
    expect(first_row_cells.nth(0)).to_contain_text("2023")
    expect(first_row_cells.nth(1)).to_contain_text("Jan")


def test_styler_with_hide_index_hides_index(app: Page):
    """Test that hide_index=True works with Pandas Styler."""
    # Get Styler table with hide_index=True (nth(40))
    table = app.get_by_test_id("stTable").nth(40)

    # Check that there are only 2 data columns (no index)
    header_cells = table.locator("thead th")
    expect(header_cells).to_have_count(2)

    # Verify data columns
    expect(header_cells.nth(0)).to_contain_text("Team")
    expect(header_cells.nth(1)).to_contain_text("Wins")

    # Ensure index values are not visible
    expect(table).not_to_contain_text("Team 1")
    expect(table).not_to_contain_text("Team 2")
    expect(table).not_to_contain_text("Team 3")


def test_styler_default_shows_index_and_styling(app: Page):
    """Test that Styler default behavior shows index and preserves styling."""
    # Get Styler table with default behavior (nth(39))
    table = app.get_by_test_id("stTable").nth(39)

    # Check that there are 3 columns (1 index + 2 data)
    header_cells = table.locator("thead th")
    expect(header_cells).to_have_count(3)

    # Verify index values are visible
    first_row_cells = table.locator("tbody tr").nth(0).locator("th, td")
    expect(first_row_cells.nth(0)).to_contain_text("Team 1")

    # Verify first data cell is present
    expect(first_row_cells.nth(1)).to_contain_text("Ferrari")


def test_range_index_hidden_removes_numeric_index(app: Page):
    """Test that hide_index=True removes default numeric index (RangeIndex)."""
    # Get RangeIndex table with hide_index=True (nth(42))
    table = app.get_by_test_id("stTable").nth(42)

    # Check that there are only 2 data columns (no index)
    header_cells = table.locator("thead th")
    expect(header_cells).to_have_count(2)

    # Verify data columns
    expect(header_cells.nth(0)).to_contain_text("Team")
    expect(header_cells.nth(1)).to_contain_text("Rating")

    # Verify first row starts with data, not index numbers
    first_row_cells = table.locator("tbody tr").nth(0).locator("td")
    expect(first_row_cells.nth(0)).to_contain_text("Ferrari")
