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

import re

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import (
    click_button,
    expect_no_exception,
    get_expander,
)


def _get_basic_column_container(app: Page, index: int = 0) -> Locator:
    column_container = app.get_by_test_id("stHorizontalBlock").nth(index)
    expect(column_container).to_be_visible()
    return column_container


def test_show_columns_horizontally_when_viewport_allows(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Shows columns horizontally when viewport > 640."""
    app.set_viewport_size({"width": 641, "height": 800})
    column_container = _get_basic_column_container(app)
    expect(column_container.get_by_test_id("stMarkdownContainer").last).to_be_visible()
    assert_snapshot(column_container, name="st_columns-responsive_layout_horizontal")


def test_show_columns_vertically_when_viewport_requires(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Stacks columns vertically when viewport <= 640."""
    app.set_viewport_size({"width": 640, "height": 800})
    column_container = _get_basic_column_container(app)
    expect(column_container.get_by_test_id("stMarkdownContainer").last).to_be_visible()
    assert_snapshot(column_container, name="st_columns-responsive_layout_vertical")


def test_columns_always_take_up_space(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that columns still takes up space with no elements present."""
    column_container = _get_basic_column_container(app, 1)
    expect(column_container.get_by_test_id("stMarkdownContainer").last).to_be_visible()
    assert_snapshot(column_container, name="st_columns-with_empty_columns")


def test_columns_with_border(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that columns with border are correctly displayed."""
    column_container = _get_basic_column_container(app, 2)
    expect(column_container.get_by_test_id("stSlider").last).to_be_visible()
    assert_snapshot(column_container, name="st_columns-with_border")


def test_column_gap_small_is_correctly_applied(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the small column gap is correctly applied."""
    column_gap_small = (
        get_expander(app, "Column gap small").get_by_test_id("stHorizontalBlock").nth(0)
    )
    # We use regex here since some browsers may resolve this to two numbers:
    expect(column_gap_small).to_have_css("gap", re.compile("16px"))
    column_gap_small.scroll_into_view_if_needed()
    assert_snapshot(column_gap_small, name="st_columns-column_gap_small")


def test_column_gap_medium_is_correctly_applied(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the medium column gap is correctly applied."""
    column_gap_medium = (
        get_expander(app, "Column gap medium")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    # We use regex here since some browsers may resolve this to two numbers:
    expect(column_gap_medium).to_have_css("gap", re.compile("32px"))
    column_gap_medium.scroll_into_view_if_needed()
    assert_snapshot(column_gap_medium, name="st_columns-column_gap_medium")


def test_column_gap_large_is_correctly_applied(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the large column gap is correctly applied."""
    column_gap_large = (
        get_expander(app, "Column gap large").get_by_test_id("stHorizontalBlock").nth(0)
    )
    # We use regex here since some browsers may resolve this to two numbers:
    expect(column_gap_large).to_have_css("gap", re.compile("64px"))
    column_gap_large.scroll_into_view_if_needed()
    assert_snapshot(column_gap_large, name="st_columns-column_gap_large")


def test_column_gap_none_is_correctly_applied(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the none column gap is correctly applied."""
    column_gap_none = (
        get_expander(app, "Column gap none").get_by_test_id("stHorizontalBlock").nth(0)
    )
    # We use regex here since some browsers may resolve this to two numbers:
    expect(column_gap_none).to_have_css("gap", re.compile("0px"))
    column_gap_none.scroll_into_view_if_needed()
    assert_snapshot(column_gap_none, name="st_columns-column_gap_none")


def test_one_level_nesting_works_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that its possible to nest columns for one level."""
    nested_columns = (
        get_expander(app, "Nested columns - one level")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    expect(nested_columns.get_by_test_id("stMarkdownContainer").last).to_be_visible()
    assert_snapshot(nested_columns, name="st_columns-nested_one_level")


def test_column_variable_relative_width(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a variable relative width works correctly."""
    column = (
        get_expander(app, "Variable-width columns (relative numbers)")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    expect(column.get_by_test_id("stImageContainer").last).to_be_visible()
    assert_snapshot(column, name="st_columns-variable_width_relative")


def test_column_variable_absolute_width(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a variable absolute width works correctly."""
    column = (
        get_expander(app, "Variable-width columns (absolute numbers)")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    expect(column.get_by_test_id("stImageContainer").last).to_be_visible()
    assert_snapshot(column, name="st_columns-variable_width_absolute")


def test_column_vertical_alignment_top(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that vertical alignment top works correctly."""
    column = (
        get_expander(app, "Vertical alignment - top")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )

    expect(column.get_by_test_id("stCheckbox").first).to_be_visible()
    expect(column.get_by_test_id("stButton").last).to_be_visible()
    expect(column.get_by_test_id("stTextInput").first).to_be_visible()

    # Should apply a top margin to the first checkbox for
    # simpler visual alignment with other elements.
    expect(column.get_by_test_id("stCheckbox").first).to_have_css("margin-top", "8px")

    assert_snapshot(
        column,
        name="st_columns-vertical_alignment_top",
    )


def test_column_vertical_alignment_center(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that vertical alignment center works correctly."""
    column = (
        get_expander(app, "Vertical alignment - center")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )

    expect(column.get_by_test_id("stCheckbox").first).to_be_visible()
    expect(column.get_by_test_id("stButton").last).to_be_visible()
    expect(column.get_by_test_id("stTextInput").first).to_be_visible()

    assert_snapshot(
        column,
        name="st_columns-vertical_alignment_center",
    )


def test_column_vertical_alignment_bottom(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that vertical alignment center works correctly."""
    column = (
        get_expander(app, "Vertical alignment - bottom")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )

    expect(column.get_by_test_id("stCheckbox").first).to_be_visible()
    expect(column.get_by_test_id("stButton").last).to_be_visible()
    expect(column.get_by_test_id("stTextInput").first).to_be_visible()

    # Should apply a bottom margin to the last checkbox for
    # simpler visual alignment with other elements.
    expect(column.get_by_test_id("stCheckbox").last).to_have_css("margin-bottom", "8px")
    assert_snapshot(
        column,
        name="st_columns-vertical_alignment_bottom",
    )


def test_nesting_columns_is_allowed(app: Page):
    """Checks that nesting columns is allowed."""

    click_button(app, "Nested columns - two levels")
    expect_no_exception(app)

    click_button(app, "Nested columns - in sidebar")
    expect_no_exception(app)
