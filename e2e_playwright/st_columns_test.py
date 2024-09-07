# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import click_button, expect_exception, get_expander

# The threshold for the image comparison for the cat images
# we use a bigger threshold because the images will have a sub-pixel size
# when resized, which can cause slightly different results for test runs
CAT_IMAGE_THRESHOLD = 0.02


def _get_basic_column_container(
    app: Page,
):
    column_container = app.get_by_test_id("stHorizontalBlock").nth(0)
    expect(column_container).to_be_visible()
    return column_container


def test_show_columns_horizontally_when_viewport_allows(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """shows columns horizontally when viewport > 640"""
    app.set_viewport_size({"width": 641, "height": 800})
    column_container = _get_basic_column_container(app)
    assert_snapshot(
        column_container.nth(0), name="st_columns-responsive_layout_horizontal"
    )


def test_show_columns_vertically_when_viewport_requires(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """stacks columns vertically when viewport <= 640"""
    app.set_viewport_size({"width": 640, "height": 800})
    column_container = _get_basic_column_container(app)
    assert_snapshot(column_container, name="st_columns-responsive_layout_vertical")


def test_columns_always_take_up_space(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that columns still takes up space with no elements present"""
    column_element = app.get_by_test_id("stHorizontalBlock").nth(1)
    assert_snapshot(column_element, name="st_columns-with_empty_columns")


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
    assert_snapshot(
        column_gap_small,
        name="st_columns-column_gap_small",
        image_threshold=CAT_IMAGE_THRESHOLD,
    )


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
    assert_snapshot(
        column_gap_medium,
        name="st_columns-column_gap_medium",
        image_threshold=CAT_IMAGE_THRESHOLD,
    )


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
    assert_snapshot(
        column_gap_large,
        name="st_columns-column_gap_large",
        image_threshold=CAT_IMAGE_THRESHOLD,
    )


def test_one_level_nesting_works_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that its possible to nest columns for one level."""
    nested_columns = (
        get_expander(app, "Nested columns - one level")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    assert_snapshot(nested_columns, name="st_columns-nested_one_level")


def test_column_variable_relative_width(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a variable relative width works correctly."""
    column_gap_small = (
        get_expander(app, "Variable-width columns (relative numbers)")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    assert_snapshot(
        column_gap_small,
        name="st_columns-variable_width_relative",
        image_threshold=CAT_IMAGE_THRESHOLD,
    )


def test_column_variable_absolute_width(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a variable absolute width works correctly."""
    column_gap_small = (
        get_expander(app, "Variable-width columns (absolute numbers)")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    assert_snapshot(
        column_gap_small,
        name="st_columns-variable_width_absolute",
        image_threshold=CAT_IMAGE_THRESHOLD,
    )


def test_column_vertical_alignment_top(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that vertical alignment top works correctly."""
    column_gap_small = (
        get_expander(app, "Vertical alignment - top")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    assert_snapshot(
        column_gap_small,
        name="st_columns-vertical_alignment_top",
    )


def test_column_vertical_alignment_center(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that vertical alignment center works correctly."""
    column_gap_small = (
        get_expander(app, "Vertical alignment - center")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    assert_snapshot(
        column_gap_small,
        name="st_columns-vertical_alignment_center",
    )


def test_column_vertical_alignment_bottom(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that vertical alignment center works correctly."""
    column_gap_small = (
        get_expander(app, "Vertical alignment - bottom")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    assert_snapshot(
        column_gap_small,
        name="st_columns-vertical_alignment_bottom",
    )


def test_two_level_nested_columns_shows_exception(app: Page):
    """Shows exception when trying to nest columns more than one level deep."""

    click_button(app, "Nested columns - two levels (raises exception)")
    expect_exception(
        app,
        re.compile(
            "Columns can only be placed inside other columns up to one level of nesting."
        ),
    )


def test_nested_columns_in_sidebar_shows_exception(app: Page):
    """Shows exception when trying to nest columns in the sidebar."""

    click_button(app, "Nested columns - in sidebar (raises exception)")
    expect_exception(
        app,
        re.compile(
            "Columns cannot be placed inside other columns in the sidebar. This is only possible in the main area of the app."
        ),
    )
