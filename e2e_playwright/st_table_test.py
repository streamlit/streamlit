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


def test_hide_index_scenarios(app: Page, assert_snapshot: ImageCompareFunction):
    """Test hide_index parameter with various scenarios.

    Tests auto-hide for RangeIndex, custom index shown, explicit true/false,
    and MultiIndex support.
    """
    table_elements = app.get_by_test_id("stTable")

    # Auto-hide RangeIndex (index 37) - no index cells should be present
    table_auto = table_elements.nth(37)
    expect(table_auto.locator("th[scope='row']")).to_have_count(0)
    assert_snapshot(table_auto, name="st_table-auto_hide_range_index")

    # Custom index shown (index 38) - custom index values should be visible
    table_custom = table_elements.nth(38)
    expect(table_custom.locator("th[scope='row']", has_text="row1")).to_be_visible()
    expect(table_custom.locator("th[scope='row']", has_text="row2")).to_be_visible()
    assert_snapshot(table_custom, name="st_table-custom_index_shown")

    # Explicit hide_index=True (index 39) - index cells hidden
    table_explicit_true = table_elements.nth(39)
    expect(table_explicit_true.locator("th[scope='row']")).to_have_count(0)
    assert_snapshot(table_explicit_true, name="st_table-hide_index_true")

    # Explicit hide_index=False (index 40) - RangeIndex cells shown
    table_explicit_false = table_elements.nth(40)
    expect(
        table_explicit_false.locator("th[scope='row']", has_text="0")
    ).to_be_visible()
    expect(
        table_explicit_false.locator("th[scope='row']", has_text="1")
    ).to_be_visible()
    assert_snapshot(table_explicit_false, name="st_table-hide_index_false")

    # MultiIndex with hide_index=True (index 46) - all index cells hidden
    table_multiindex = table_elements.nth(46)
    expect(table_multiindex.locator("th[scope='row']")).to_have_count(0)
    assert_snapshot(table_multiindex, name="st_table-hide_multiindex")


def test_hide_header_scenarios(app: Page, assert_snapshot: ImageCompareFunction):
    """Test hide_header parameter with various scenarios.

    Tests auto-hide for dict/list data, explicit true/false, and combined
    hide_index + hide_header usage.
    """
    table_elements = app.get_by_test_id("stTable")

    # Auto-hide headers for dict data (index 41) - no thead element
    table_dict = table_elements.nth(41)
    expect(table_dict.locator("thead")).not_to_be_attached()
    assert_snapshot(table_dict, name="st_table-auto_hide_headers_dict")

    # Auto-hide headers for list data (index 42) - no thead element
    table_list = table_elements.nth(42)
    expect(table_list.locator("thead")).not_to_be_attached()
    assert_snapshot(table_list, name="st_table-auto_hide_headers_list")

    # Explicit hide_header=True on DataFrame (index 43) - no thead element
    table_explicit_true = table_elements.nth(43)
    expect(table_explicit_true.locator("thead")).not_to_be_attached()
    assert_snapshot(table_explicit_true, name="st_table-hide_header_true")

    # Explicit hide_header=False on dict (index 44) - thead element present
    table_explicit_false = table_elements.nth(44)
    expect(table_explicit_false.locator("thead")).to_be_attached()
    assert_snapshot(table_explicit_false, name="st_table-hide_header_false")

    # Both hide_index=True and hide_header=True (index 45) - no thead and no index
    table_both = table_elements.nth(45)
    expect(table_both.locator("thead")).not_to_be_attached()
    expect(table_both.locator("th[scope='row']")).to_have_count(0)
    assert_snapshot(table_both, name="st_table-hide_both")
