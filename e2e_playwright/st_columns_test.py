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


def _get_width(locator: Locator) -> float:
    """Return the rendered pixel width of a locator."""
    bounding_box = locator.bounding_box()
    assert bounding_box is not None
    return bounding_box["width"]


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


def test_resizable_columns_render_handles(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Resizable columns render a resize handle between adjacent column pairs."""
    container = get_element_by_key(app, "resizable_columns")
    expect(container.get_by_test_id("stColumn")).to_have_count(3)

    # 3 columns -> 2 handles (none rendered after the last column).
    handles = container.get_by_test_id("stColumnResizeHandle")
    expect(handles).to_have_count(2)

    # Non-resizable (default) columns must NOT render any resize handles.
    default_columns = _get_basic_column_container(app, 0)
    expect(default_columns.get_by_test_id("stColumnResizeHandle")).to_have_count(0)

    # A single resizable column has nothing to resize against, so no handle.
    single_column_container = get_element_by_key(app, "single_resizable_column")
    expect(single_column_container.get_by_test_id("stColumn")).to_have_count(1)
    expect(
        single_column_container.get_by_test_id("stColumnResizeHandle")
    ).to_have_count(0)

    # The handle is hidden by default and only becomes visible on hover.
    first_handle = handles.nth(0)
    expect(first_handle).to_have_css("opacity", "0")
    first_handle.hover()
    expect(first_handle).to_have_css("opacity", "1")
    expect(first_handle).to_have_css("cursor", "col-resize")

    assert_snapshot(container, name="st_columns-resizable")


def test_resizable_columns_drag_resize_and_reset(app: Page):
    """Dragging a handle resizes the adjacent columns and preserves total width."""
    container = get_element_by_key(app, "resizable_columns")
    columns = container.get_by_test_id("stColumn")
    expect(columns).to_have_count(3)

    first_column = columns.nth(0)
    second_column = columns.nth(1)
    third_column = columns.nth(2)

    initial_first_width = _get_width(first_column)
    initial_second_width = _get_width(second_column)
    initial_third_width = _get_width(third_column)
    initial_pair_width = initial_first_width + initial_second_width

    # The resizable columns sit near the bottom of a long page, so scroll the
    # handle into view first to ensure the mouse coordinates are on-screen.
    first_handle = container.get_by_test_id("stColumnResizeHandle").nth(0)
    first_handle.scroll_into_view_if_needed()
    first_handle.hover()
    handle_box = first_handle.bounding_box()
    assert handle_box is not None
    start_x = handle_box["x"] + handle_box["width"] / 2
    center_y = handle_box["y"] + handle_box["height"] / 2

    # Drag the first handle 80px to the right to grow the first column.
    app.mouse.move(start_x, center_y)
    app.mouse.down()
    # The drag mousemove/mouseup listeners are attached on the re-render that
    # follows mousedown, so wait briefly before moving to avoid missing events.
    app.wait_for_timeout(100)
    app.mouse.move(start_x + 80, center_y, steps=10)
    app.mouse.up()

    # The first column grew, the second column shrank.
    wait_until(app, lambda: _get_width(first_column) > initial_first_width + 40)
    resized_first_width = _get_width(first_column)
    resized_second_width = _get_width(second_column)
    assert resized_first_width > initial_first_width
    assert resized_second_width < initial_second_width

    # Total width of the adjacent pair is preserved.
    assert abs((resized_first_width + resized_second_width) - initial_pair_width) < 2
    # The non-adjacent third column must NOT be affected by the drag.
    assert abs(_get_width(third_column) - initial_third_width) < 2

    # Double-clicking the handle resets the columns to their spec proportions.
    first_handle.dblclick()
    wait_until(app, lambda: abs(_get_width(first_column) - initial_first_width) < 2)
    assert abs(_get_width(second_column) - initial_second_width) < 2

    # Keyboard: focusing the handle and pressing ArrowRight grows the first column.
    width_before_keyboard = _get_width(first_column)
    for _ in range(5):
        first_handle.press("ArrowRight")
    wait_until(app, lambda: _get_width(first_column) > width_before_keyboard + 20)
    assert _get_width(second_column) < initial_second_width


def test_resizable_columns_hidden_on_narrow_viewport(app: Page):
    """On narrow viewports, columns stack and resize handles are hidden."""
    app.set_viewport_size({"width": 400, "height": 800})

    container = get_element_by_key(app, "resizable_columns")
    columns = container.get_by_test_id("stColumn")
    expect(columns).to_have_count(3)
    expect(columns.first).to_be_visible()

    # Resizing is not applicable when columns are stacked -> no handles rendered.
    expect(container.get_by_test_id("stColumnResizeHandle")).to_have_count(0)
