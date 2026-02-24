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

TOTAL_TABLE_ELEMENTS = 47


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


def test_table_fixed_dimensions_with_scrolling(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a table with fixed width/height and custom index scrolls correctly."""
    # Table with custom index and width=400, height=200 (index 35)
    table = app.get_by_test_id("stTable").nth(35)

    # Scroll both directions and verify sticky headers/index columns
    table_inner = table.locator("[data-testid='stTableStyledTable']")
    table_inner.evaluate(
        "el => { el.parentElement.scrollTop = 100; el.parentElement.scrollLeft = 150; }"
    )
    assert_snapshot(table, name="st_table-fixed_dimensions_scrolled")


def test_hide_index_auto_hides_range_index(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that hide_index=None auto-hides default RangeIndex."""
    # DataFrame with auto-hidden RangeIndex (index 37)
    table = app.get_by_test_id("stTable").nth(37)
    # Verify no index cells are present (only header and data cells)
    header_cells = table.locator("th[scope='row']")
    expect(header_cells).to_have_count(0)
    assert_snapshot(table, name="st_table-auto_hide_range_index")


def test_hide_index_shows_custom_index(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that hide_index=None shows custom (non-RangeIndex) index."""
    # DataFrame with custom index (index 38)
    table = app.get_by_test_id("stTable").nth(38)
    # Verify index cells are present with custom values
    expect(table.locator("th[scope='row']", has_text="row1")).to_be_visible()
    expect(table.locator("th[scope='row']", has_text="row2")).to_be_visible()
    assert_snapshot(table, name="st_table-custom_index_shown")


def test_hide_index_explicit_true(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that hide_index=True hides the index column."""
    # Explicit hide_index=True on custom index (index 39)
    table = app.get_by_test_id("stTable").nth(39)
    # Verify index cells are not present
    header_cells = table.locator("th[scope='row']")
    expect(header_cells).to_have_count(0)
    assert_snapshot(table, name="st_table-hide_index_true")


def test_hide_index_explicit_false(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that hide_index=False shows the index column."""
    # Explicit hide_index=False on RangeIndex (index 40)
    table = app.get_by_test_id("stTable").nth(40)
    # Verify RangeIndex cells are present
    expect(table.locator("th[scope='row']", has_text="0")).to_be_visible()
    expect(table.locator("th[scope='row']", has_text="1")).to_be_visible()
    assert_snapshot(table, name="st_table-hide_index_false")


def test_hide_header_auto_hides_for_dict(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that hide_header=None auto-hides headers for dict data."""
    # Dict data with auto-hidden headers (index 41)
    table = app.get_by_test_id("stTable").nth(41)
    # Verify no thead element is present (headers hidden)
    expect(table.locator("thead")).not_to_be_attached()
    assert_snapshot(table, name="st_table-auto_hide_headers_dict")


def test_hide_header_auto_hides_for_list(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that hide_header=None auto-hides headers for list data."""
    # List data with auto-hidden headers (index 42)
    table = app.get_by_test_id("stTable").nth(42)
    # Verify no thead element is present
    expect(table.locator("thead")).not_to_be_attached()
    assert_snapshot(table, name="st_table-auto_hide_headers_list")


def test_hide_header_explicit_true(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that hide_header=True hides the headers."""
    # Explicit hide_header=True on DataFrame (index 43)
    table = app.get_by_test_id("stTable").nth(43)
    # Verify no thead element is present
    expect(table.locator("thead")).not_to_be_attached()
    assert_snapshot(table, name="st_table-hide_header_true")


def test_hide_header_explicit_false(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that hide_header=False shows headers even for dict data."""
    # Explicit hide_header=False on dict (index 44)
    table = app.get_by_test_id("stTable").nth(44)
    # Verify thead element is present
    expect(table.locator("thead")).to_be_attached()
    assert_snapshot(table, name="st_table-hide_header_false")


def test_hide_index_and_hide_header_together(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that both hide_index and hide_header work together."""
    # Both hide_index=True and hide_header=True (index 45)
    table = app.get_by_test_id("stTable").nth(45)
    # Verify no thead and no index cells
    expect(table.locator("thead")).not_to_be_attached()
    header_cells = table.locator("th[scope='row']")
    expect(header_cells).to_have_count(0)
    assert_snapshot(table, name="st_table-hide_both")


def test_hide_index_with_multiindex(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that hide_index=True works with MultiIndex DataFrames."""
    # MultiIndex with hide_index=True (index 46)
    table = app.get_by_test_id("stTable").nth(46)
    # Verify no index cells are present
    header_cells = table.locator("th[scope='row']")
    expect(header_cells).to_have_count(0)
    assert_snapshot(table, name="st_table-hide_multiindex")
