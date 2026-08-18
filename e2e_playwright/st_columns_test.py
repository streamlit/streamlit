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

import re

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import (
    click_button,
    expect_markdown,
    expect_no_exception,
    get_element_by_key,
    get_expander,
)


def _get_basic_column_container(app: Page, index: int = 0) -> Locator:
    column_container = app.get_by_test_id("stHorizontalBlock").nth(index)
    expect(column_container).to_be_visible()
    return column_container


def _get_column_group(app: Page, key: str) -> Locator:
    column_group = get_element_by_key(app, key).get_by_test_id("stHorizontalBlock")
    expect(column_group).to_be_visible()
    return column_group


def _get_width(locator: Locator) -> float:
    """Return the rendered width of a locator in pixels."""
    bounding_box = locator.bounding_box()
    assert bounding_box is not None
    return bounding_box["width"]


def _drag_horizontally(app: Page, handle: Locator, delta_x: float) -> None:
    """Press a resize handle and drag it delta_x pixels sideways."""
    handle.scroll_into_view_if_needed()
    handle_box = handle.bounding_box()
    assert handle_box is not None
    start_x = handle_box["x"] + handle_box["width"] / 2
    center_y = handle_box["y"] + handle_box["height"] / 2

    app.mouse.move(start_x, center_y)
    app.mouse.down()
    app.mouse.move(start_x + delta_x, center_y, steps=10)
    app.mouse.up()


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


def test_column_gap_is_correctly_applied(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the different-sized column gaps are correctly applied."""

    gaps = [
        (None, "0"),
        ("xxsmall", "4px"),
        ("xsmall", "8px"),
        ("small", "16px"),
        ("medium", "32px"),
        ("large", "64px"),
        ("xlarge", "96px"),
        ("xxlarge", "128px"),
    ]

    for gap, gap_value in gaps:
        gap_name = str(gap).lower()

        column_gap = (
            get_expander(app, f"Column gap {gap_name}")
            .get_by_test_id("stHorizontalBlock")
            .nth(0)
        )
        # We use regex here since some browsers may resolve this to two numbers:
        expect(column_gap).to_have_css("gap", re.compile(gap_value))
        column_gap.scroll_into_view_if_needed()
        assert_snapshot(column_gap, name=f"st_columns-column_gap_{gap_name}")


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


def test_column_top_alignment_does_not_leak_into_nested_horizontal_container(
    app: Page,
):
    """Regression test for #13162.

    Checkboxes inside a horizontal container nested inside a TOP-aligned
    column must not receive the alignment `margin-top`. The margin should
    only apply to direct-child first checkboxes of the column.
    """
    column_container = (
        get_expander(app, "Nested horizontal container in top-aligned column")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )

    checkboxes = column_container.get_by_test_id("stCheckbox")
    expect(checkboxes).to_have_count(3)

    # None of the checkboxes in the nested horizontal container should have
    # the alignment margin — previously the first-of-type inside the nested
    # container was incorrectly picking it up.
    for i in range(3):
        expect(checkboxes.nth(i)).to_have_css("margin-top", "0px")


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


def test_width_is_correctly_applied(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.columns dimensions are correctly applied."""
    column_fixed_width_container = (
        get_expander(app, "Columns with width configuration")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )

    expect_markdown(
        app,
        "column three",
    )
    assert_snapshot(
        column_fixed_width_container, name="st_columns-width_configuration_fixed"
    )

    column_stretch_width_container = (
        get_expander(app, "Columns with width configuration")
        .get_by_test_id("stHorizontalBlock")
        .nth(1)
    )
    expect(
        column_stretch_width_container.get_by_test_id("stMarkdownContainer").last
    ).to_be_visible()
    assert_snapshot(
        column_stretch_width_container, name="st_columns-width_configuration_stretch"
    )


def test_columns_wrap_false_keeps_single_row_and_scrolls(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """wrap=False keeps columns in one row and scrolls locally at narrow widths."""
    app.set_viewport_size({"width": 640, "height": 800})

    container = get_element_by_key(app, "columns_wrap_false")
    column_group = container.get_by_test_id("stHorizontalBlock")
    expect(column_group).to_be_visible()
    expect(column_group).to_have_attribute("data-test-wrap", "false")

    columns = column_group.get_by_test_id("stColumn")
    expect(columns).to_have_count(6)

    # All columns stay on one row (aligned tops) instead of stacking.
    # wait_until guards against layout races right after viewport resize.
    def _columns_share_row() -> bool:
        first_box = columns.nth(0).bounding_box()
        last_box = columns.nth(5).bounding_box()
        if first_box is None or last_box is None:
            return False
        return abs(first_box["y"] - last_box["y"]) < 2

    wait_until(app, _columns_share_row)

    # Overflow is contained by the column group, not the page.
    def _has_horizontal_overflow() -> bool:
        return bool(column_group.evaluate("el => el.scrollWidth > el.clientWidth + 1"))

    wait_until(app, _has_horizontal_overflow)

    # Overflow stays on the column group; the page itself should not scroll.
    def _page_fits_without_scroll() -> bool:
        return bool(
            app.evaluate(
                "() => document.documentElement.scrollWidth <= "
                "document.documentElement.clientWidth + 1"
            )
        )

    wait_until(app, _page_fits_without_scroll)

    column_group.scroll_into_view_if_needed()
    assert_snapshot(column_group, name="st_columns-wrap_false_narrow")


def test_columns_wrap_false_relative_widths_at_desktop(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """wrap=False preserves relative widths above the stacking breakpoint."""
    app.set_viewport_size({"width": 1000, "height": 800})

    container = get_element_by_key(app, "columns_wrap_false_relative")
    column_group = container.get_by_test_id("stHorizontalBlock")
    columns = column_group.get_by_test_id("stColumn")
    expect(columns).to_have_count(3)
    expect(column_group.get_by_test_id("stMarkdownContainer").last).to_be_visible()

    # Relative [3, 1, 2] weights: wide > medium > narrow.
    def _relative_widths_preserved() -> bool:
        wide_box = columns.nth(0).bounding_box()
        narrow_box = columns.nth(1).bounding_box()
        medium_box = columns.nth(2).bounding_box()
        if wide_box is None or narrow_box is None or medium_box is None:
            return False
        return wide_box["width"] > medium_box["width"] > narrow_box["width"]

    wait_until(app, _relative_widths_preserved)

    # At desktop width, wrap=False should not introduce unnecessary overflow.
    def _no_horizontal_overflow() -> bool:
        return bool(column_group.evaluate("el => el.scrollWidth <= el.clientWidth + 1"))

    wait_until(app, _no_horizontal_overflow)

    assert_snapshot(column_group, name="st_columns-wrap_false_relative_widths")


def test_columns_wrap_true_still_stacks_at_narrow_viewport(app: Page):
    """Explicit wrap=True keeps today's stacking behavior at 640px."""
    app.set_viewport_size({"width": 640, "height": 800})

    container = get_element_by_key(app, "columns_wrap_true")
    column_group = container.get_by_test_id("stHorizontalBlock")
    columns = column_group.get_by_test_id("stColumn")
    expect(columns).to_have_count(3)

    # wait_until guards against layout races right after viewport resize.
    def _columns_are_stacked() -> bool:
        first_box = columns.nth(0).bounding_box()
        second_box = columns.nth(1).bounding_box()
        if first_box is None or second_box is None:
            return False
        return second_box["y"] > first_box["y"] + first_box["height"] / 2

    wait_until(app, _columns_are_stacked)


def test_resizable_columns_show_a_handle_on_each_boundary(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """resizable=True puts a drag handle on every boundary between two columns."""
    column_group = _get_column_group(app, "columns_resizable")
    expect(column_group.get_by_test_id("stColumn")).to_have_count(3)

    # Three columns have two boundaries; the last column has nothing to its right.
    handles = column_group.get_by_role("separator")
    expect(handles).to_have_count(2)

    # Columns are only resizable when the app opts in...
    expect(_get_basic_column_container(app).get_by_role("separator")).to_have_count(0)
    # ...and a lone column has no neighbor to resize against.
    single_column_group = _get_column_group(app, "columns_resizable_single")
    expect(single_column_group.get_by_test_id("stColumn")).to_have_count(1)
    expect(single_column_group.get_by_role("separator")).to_have_count(0)

    # The handle only shows itself once the pointer reaches the boundary.
    first_handle = handles.first
    expect(first_handle).to_have_css("opacity", "0")
    first_handle.scroll_into_view_if_needed()
    first_handle.hover()
    expect(first_handle).to_have_css("opacity", "1")
    expect(first_handle).to_have_css("cursor", "col-resize")

    assert_snapshot(column_group, name="st_columns-resizable_hovered_handle")


def test_resizable_columns_resize_only_the_adjacent_pair(app: Page):
    """Dragging or arrow-keying a handle rebalances just the two columns it joins."""
    column_group = _get_column_group(app, "columns_resizable")
    columns = column_group.get_by_test_id("stColumn")
    expect(columns).to_have_count(3)

    first_column = columns.nth(0)
    second_column = columns.nth(1)
    third_column = columns.nth(2)
    initial_first_width = _get_width(first_column)
    initial_second_width = _get_width(second_column)
    initial_third_width = _get_width(third_column)

    first_handle = column_group.get_by_role("separator").first
    _drag_horizontally(app, first_handle, 80)
    wait_until(app, lambda: _get_width(first_column) > initial_first_width + 40)

    # The pair keeps its combined width, so the rest of the row cannot shift.
    assert _get_width(second_column) < initial_second_width
    assert (
        abs(
            (_get_width(first_column) + _get_width(second_column))
            - (initial_first_width + initial_second_width)
        )
        < 2
    )
    assert abs(_get_width(third_column) - initial_third_width) < 2

    # Dragging past the left edge of the row stops at the minimum column width
    # instead of collapsing the column or pushing a neighbor onto a second row.
    _drag_horizontally(app, first_handle, -1000)
    wait_until(app, lambda: _get_width(first_column) < initial_first_width)
    assert 40 < _get_width(first_column) < 70
    first_box = first_column.bounding_box()
    third_box = third_column.bounding_box()
    assert first_box is not None
    assert third_box is not None
    assert first_box["y"] == third_box["y"]

    # Double-clicking a handle restores the widths defined by `spec`.
    first_handle.dblclick()
    wait_until(app, lambda: abs(_get_width(first_column) - initial_first_width) < 2)
    assert abs(_get_width(second_column) - initial_second_width) < 2

    # Arrow keys move the boundary in 10px steps so the row is keyboard-operable.
    for _ in range(5):
        first_handle.press("ArrowRight")
    wait_until(app, lambda: _get_width(first_column) > initial_first_width + 40)
    assert abs(_get_width(third_column) - initial_third_width) < 2

    # Enter is the keyboard equivalent of double-clicking to reset.
    first_handle.press("Enter")
    wait_until(app, lambda: abs(_get_width(first_column) - initial_first_width) < 2)


def test_resizable_columns_hide_handles_while_stacked(app: Page):
    """Handles disappear while columns are stacked and return once they unstack."""
    app.set_viewport_size({"width": 640, "height": 800})

    column_group = _get_column_group(app, "columns_resizable")
    expect(column_group.get_by_test_id("stColumn")).to_have_count(3)
    # Stacked columns sit above each other, so there is no boundary to drag.
    expect(column_group.get_by_role("separator")).to_have_count(0)

    # wrap=False columns never stack, so they stay resizable at the same width.
    no_wrap_group = _get_column_group(app, "columns_resizable_no_wrap")
    expect(no_wrap_group.get_by_role("separator")).to_have_count(1)

    app.set_viewport_size({"width": 1000, "height": 800})
    expect(column_group.get_by_role("separator")).to_have_count(2)
