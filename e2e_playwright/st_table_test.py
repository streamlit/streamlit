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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class

TOTAL_TABLE_ELEMENTS = 33


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
