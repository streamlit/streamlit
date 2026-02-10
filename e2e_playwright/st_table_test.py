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

TOTAL_TABLE_ELEMENTS = 39


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


def test_table_fixed_height_vertical_scrolling(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a table with fixed height enables vertical scrolling with sticky headers."""
    # Table with height=200 (index 35)
    table = app.get_by_test_id("stTable").nth(35)
    assert_snapshot(table, name="st_table-fixed_height")

    # Verify scrolling works by scrolling down
    table_inner = table.locator("[data-testid='stTableStyledTable']")
    table_inner.evaluate("el => el.parentElement.scrollTop = 100")
    assert_snapshot(table, name="st_table-fixed_height_scrolled")


def test_table_fixed_width_horizontal_scrolling(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a table with fixed width enables horizontal scrolling."""
    # Table with width=400 (index 36)
    table = app.get_by_test_id("stTable").nth(36)
    assert_snapshot(table, name="st_table-fixed_width")

    # Verify scrolling works by scrolling right
    table_inner = table.locator("[data-testid='stTableStyledTable']")
    table_inner.evaluate("el => el.parentElement.scrollLeft = 200")
    assert_snapshot(table, name="st_table-fixed_width_scrolled")


def test_table_fixed_dimensions_both_scrolling(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a table with both fixed width and height enables scrolling in both directions."""
    # Table with width=400 and height=200 (index 37)
    table = app.get_by_test_id("stTable").nth(37)
    assert_snapshot(table, name="st_table-fixed_dimensions")

    # Verify scrolling works in both directions
    table_inner = table.locator("[data-testid='stTableStyledTable']")
    table_inner.evaluate(
        "el => { el.parentElement.scrollTop = 100; el.parentElement.scrollLeft = 200; }"
    )
    assert_snapshot(table, name="st_table-fixed_dimensions_scrolled")


def test_table_multi_index_with_sticky_columns(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a table with multi-index and fixed dimensions has sticky index columns."""
    # Table with multi-index and width=500, height=250 (index 38)
    table = app.get_by_test_id("stTable").nth(38)
    assert_snapshot(table, name="st_table-multi_index_fixed_dimensions")

    # Scroll to verify sticky index columns
    table_inner = table.locator("[data-testid='stTableStyledTable']")
    table_inner.evaluate(
        "el => { el.parentElement.scrollTop = 100; el.parentElement.scrollLeft = 150; }"
    )
    assert_snapshot(table, name="st_table-multi_index_scrolled")
