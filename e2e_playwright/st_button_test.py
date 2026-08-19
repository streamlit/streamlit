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

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_checkbox,
    click_toggle,
    expect_label_truncated,
    expect_markdown,
    expect_prefixed_markdown,
    get_button,
    get_element_by_key,
    get_expander,
    reset_hovering,
)

TOTAL_BUTTONS = 40

WRAP_LABEL = "Regenerate the complete quarterly report now"


def test_button_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the button widgets are correctly rendered via screenshot matching."""
    expect(themed_app.get_by_test_id("stButton")).to_have_count(TOTAL_BUTTONS)

    assert_snapshot(
        get_button(themed_app, "button 1"),
        name="st_button-default",
    )
    assert_snapshot(
        get_button(themed_app, "button 2 (disabled)"),
        name="st_button-disabled",
    )
    assert_snapshot(
        get_button(themed_app, "button 3 (primary)"),
        name="st_button-primary",
    )
    assert_snapshot(
        get_button(themed_app, "button 4 (primary + disabled)"),
        name="st_button-disabled_primary",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "styled_label_button"),
        name="st_button-styled_label",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "help_button_key"),
        name="st_button-just_help",
    )
    assert_snapshot(
        get_button(themed_app, "Like Button"),
        name="st_button-material_icon",
    )
    assert_snapshot(
        get_button(themed_app, "Star Button"),
        name="st_button-emoji_icon",
    )
    assert_snapshot(
        get_button(themed_app, re.compile(r"^Tertiary Button$")),
        name="st_button-tertiary",
    )
    assert_snapshot(
        get_button(themed_app, "Disabled Tertiary Button"),
        name="st_button-disabled_tertiary",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "material_icon_digit_button"),
        name="st_button-material_icon_1k_icon",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "material_icon_digit_in_label_button"),
        name="st_button-material_icon_1k_markdown",
    )
    assert_snapshot(
        get_button(themed_app, "Shortcut Button"),
        name="st_button-shortcut_button",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "icon_right_material"),
        name="st_button-icon_position_right_material",
    )

    # The rest is tested in one screenshot in the following test


def test_material_icon_hover(app: Page, assert_snapshot: ImageCompareFunction):
    like_btn_container = get_button(app, "Like Button")
    like_btn_container.hover()
    assert_snapshot(like_btn_container, name="st_button-material_icon_hover")


def test_buttons_in_columns(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the button widgets are correctly rendered in columns via screenshot matching."""
    columns_container = get_element_by_key(themed_app, "buttons_in_columns")
    expect(columns_container).to_have_count(1)
    expect(columns_container.get_by_test_id("stButton")).to_have_count(8)

    assert_snapshot(columns_container, name="st_button-in_columns")


def test_value_correct_on_click(app: Page):
    click_button(app, "button 1")
    expect_markdown(app, "value: True")
    expect_markdown(app, "value from state: True")


def test_value_not_reset_on_reclick(app: Page):
    click_button(app, "button 1")
    click_button(app, "button 1")
    expect_markdown(app, "value: True")


def test_click_calls_callback(app: Page):
    expect_markdown(app, "Button was clicked: False")
    click_button(app, "button 1")
    expect_markdown(app, "Button was clicked: True")
    expect_markdown(app, "times clicked: 1")
    expect_markdown(app, "arg value: 1")
    expect_markdown(app, "kwarg value: 2")


def test_click_increment_count(app: Page):
    click_button(app, "button 1")
    expect_markdown(app, "times clicked: 1")
    click_button(app, "button 1")
    expect_markdown(app, "times clicked: 2")
    click_button(app, "button 1")
    expect_markdown(app, "times clicked: 3")


def test_reset_on_other_widget_change(app: Page):
    click_button(app, "button 1")
    expect_markdown(app, "value: True")
    expect_markdown(app, "value from state: True")

    click_checkbox(app, "reset button return value")
    expect_markdown(app, "value: False")
    expect_markdown(app, "value from state: False")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stButton")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "button")).to_be_visible()


def test_shows_cursor_pointer(app: Page):
    """Test that the button shows cursor pointer when hovered."""
    expect(get_button(app, "button 1")).to_have_css("cursor", "pointer")


def test_colored_text_hover(app: Page):
    """Test that the colored text is correctly rendered and changes color on hover."""
    # Check hover behavior for colored text in primary button
    primary_button_container = get_element_by_key(app, "colored_text_primary")
    primary_text = primary_button_container.locator("span.stMarkdownColoredText").first
    expect(primary_text).to_have_class("stMarkdownColoredText")
    expect(primary_text).to_have_css(
        "color",
        "rgb(0, 84, 163)",  # blueTextColor
    )
    primary_button_container.locator("button").hover()
    # For primary buttons, the colored text should stay blue on hover (no color inheritance)
    expect(primary_text).to_have_css(
        "color",
        "rgb(0, 84, 163)",  # blueTextColor
    )

    # Check hover behavior for colored text in secondary button
    secondary_button_container = get_element_by_key(app, "colored_text_secondary")
    secondary_text = secondary_button_container.locator(
        "span.stMarkdownColoredText"
    ).first
    expect(secondary_text).to_have_class("stMarkdownColoredText")
    expect(secondary_text).to_have_css(
        "color",
        "rgb(0, 84, 163)",  # blueTextColor
    )
    secondary_button_container.locator("button").hover()
    # For secondary buttons, the colored text should stay blue on hover (no color inheritance)
    expect(secondary_text).to_have_css(
        "color",
        "rgb(0, 84, 163)",  # blueTextColor
    )

    # Check hover behavior for colored text in tertiary button
    tertiary_button_container = get_element_by_key(app, "colored_text_tertiary")
    tertiary_text = tertiary_button_container.locator(
        "span.stMarkdownColoredText"
    ).first
    expect(tertiary_text).to_have_class("stMarkdownColoredText")
    expect(tertiary_text).to_have_css(
        "color",
        "rgb(0, 84, 163)",  # blueTextColor
    )
    tertiary_button_container.locator("button").hover()
    # For tertiary buttons, the colored text should be red on hover to match the rest of the text
    expect(tertiary_text).to_have_css(
        "color",
        "rgb(255, 75, 75)",
    )


def test_button_hover(themed_app: Page, assert_snapshot: ImageCompareFunction):
    help_button_container = get_element_by_key(themed_app, "help_button_container")
    help_button = get_element_by_key(help_button_container, "help_button_key")
    # Prime the interaction modality to 'pointer' before hovering.
    reset_hovering(themed_app)
    help_button.hover()
    expect(themed_app.get_by_text("help text")).to_be_visible()
    assert_snapshot(help_button_container, name="st_button-help_button")


def test_button_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test button width examples via screenshot matching."""
    # Button width examples
    button_expander = get_expander(app, "Button Width Examples")
    assert_snapshot(
        get_button(button_expander, "Content Width (Default)"),
        name="st_button-width_content",
    )
    assert_snapshot(
        get_button(button_expander, "Stretch Width"),
        name="st_button-width_stretch",
    )
    assert_snapshot(
        get_button(button_expander, "200px Width"),
        name="st_button-width_200px",
    )


def test_dynamic_button(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the button can be updated dynamically."""
    dynamic_button = get_element_by_key(app, "dynamic_button_with_key")
    expect(dynamic_button).to_be_visible()

    expect(dynamic_button).to_contain_text("Initial dynamic button")
    assert_snapshot(dynamic_button, name="st_button-dynamic_initial")
    # Click the toggle to update the button props
    click_toggle(app, "Update button props")

    expect(dynamic_button).to_contain_text("Updated dynamic button")
    dynamic_button.scroll_into_view_if_needed()
    assert_snapshot(dynamic_button, name="st_button-dynamic_updated")

    # Click the submit button:
    dynamic_button.click()
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Clicked updated button:", "True")


@pytest.mark.skip_browser("webkit")
def test_button_shortcut_triggers(app: Page):
    """Ensure pressing the shortcut activates the button."""
    shortcut_button = get_element_by_key(app, "shortcut_button")
    expect(shortcut_button).to_be_visible()

    # Ensure shortcut labels are rendered for buttons.
    # Use regex to accept both Windows (Ctrl) and macOS (⌘) representations
    expect(shortcut_button.locator("kbd")).to_have_text(re.compile(r"(Ctrl|⌘) \+ J"))

    # Press hotkey to trigger the button:
    app.keyboard.press("ControlOrMeta+J")
    wait_for_app_run(app)
    expect_markdown(app, "Shortcut button pressed!")


def test_button_with_spinner_icon(app: Page):
    """Test that the button with spinner icon is rendered."""
    button = get_button(app, "Button with spinner icon")
    # Check that the spinner icon is visible:
    expect(button.get_by_test_id("stSpinnerIcon")).to_be_visible()


def test_markdown_syntax_in_labels(app: Page):
    """Test that markdown syntax characters in labels are displayed literally (issue #7359)."""
    # Test that "+" is not parsed as a list marker
    plus_button = get_element_by_key(app, "markdown_plus_label")
    expect(plus_button).to_contain_text("+")

    # Test that "1." is not parsed as an ordered list marker
    numbered_button = get_element_by_key(app, "markdown_numbered_label")
    expect(numbered_button).to_contain_text("1. Something")


def test_wrap_false_keeps_single_row_and_sets_title(app: Page):
    """wrap=False keeps the button on one row and exposes the full label via a
    native title, while the auto default (``wrap=None``) in a vertical layout
    wraps, grows taller, and adds no title.
    """
    wrap_false = get_element_by_key(app, "wrap_false_button")
    wrap_auto_vertical = get_element_by_key(app, "wrap_auto_vertical_button")

    # wrap=False exposes the full label via a native title; auto vertical does not.
    expect(wrap_false.get_by_title(WRAP_LABEL, exact=True)).to_be_visible()
    expect(wrap_auto_vertical.get_by_title(WRAP_LABEL, exact=True)).to_have_count(0)

    # Same long label: auto vertical wraps onto another line and is clearly taller.
    false_box = wrap_false.locator("button").bounding_box()
    auto_box = wrap_auto_vertical.locator("button").bounding_box()
    assert false_box is not None
    assert auto_box is not None
    # The 4px margin absorbs sub-pixel rounding so the assertion stays robust:
    # the wrapped (two-line) button must be clearly taller than the single-row
    # one, not just larger by a rounding artifact.
    assert auto_box["height"] > false_box["height"] + 4


def test_wrap_auto_no_wrap_inside_horizontal_container(app: Page):
    """With the default (auto) wrap, a button inside a horizontal container keeps
    its single-row height and exposes the full label via a native title, whereas
    the same default in a vertical container wraps and adds no title.
    """
    auto_horizontal = get_element_by_key(app, "wrap_auto_button")
    # The label is actually ellipsized (not just given a title attribute).
    expect_label_truncated(auto_horizontal)
    expect(auto_horizontal.get_by_title(WRAP_LABEL, exact=True)).to_be_visible()

    # Same default (auto) in a vertical container wraps and gets no title.
    auto_vertical = get_element_by_key(app, "wrap_auto_vertical_button")
    expect(auto_vertical.get_by_title(WRAP_LABEL, exact=True)).to_have_count(0)


def test_wrap_auto_no_wrap_for_direct_column_children(app: Page):
    """Direct column children keep auto no-wrap, including after columns stack.

    Nested containers and a form placed in a column wrap; wrap=True still wraps.
    """
    auto_direct = get_element_by_key(app, "wrap_auto_direct_column_button")
    explicit_true = get_element_by_key(app, "wrap_true_direct_column_button")
    auto_nested = get_element_by_key(app, "wrap_auto_nested_column_button")
    form_submit = get_element_by_key(app, "wrap_auto_form_submit_in_column")

    expect_label_truncated(auto_direct)
    expect(auto_direct.get_by_title(WRAP_LABEL, exact=True)).to_be_visible()
    expect(explicit_true.get_by_title(WRAP_LABEL, exact=True)).to_have_count(0)
    expect(auto_nested.get_by_title(WRAP_LABEL, exact=True)).to_have_count(0)
    expect(form_submit.get_by_title(WRAP_LABEL, exact=True)).to_have_count(0)

    def button_height(element: Locator) -> float:
        box = element.locator("button").bounding_box()
        assert box is not None
        return box["height"]

    direct_height = button_height(auto_direct)
    assert button_height(explicit_true) > direct_height + 4
    assert button_height(auto_nested) > direct_height + 4
    assert button_height(form_submit) > direct_height + 4

    app.set_viewport_size({"width": 390, "height": 844})
    auto_direct.scroll_into_view_if_needed()
    expect_label_truncated(auto_direct)
    expect(auto_direct.get_by_title(WRAP_LABEL, exact=True)).to_be_visible()


def test_wrap_false_help_takes_precedence_over_title(app: Page):
    """When help is set, no native title is added (the help tooltip takes over)."""
    container = get_element_by_key(app, "wrap_help_button")
    expect(container.get_by_title(WRAP_LABEL, exact=True)).to_have_count(0)

    # Prime the interaction modality to 'pointer' before hovering so React Aria
    # reliably opens the help tooltip (the cursor starts off-page otherwise).
    reset_hovering(app)
    container.hover()
    expect(app.get_by_text("wrap help text")).to_be_visible()


def test_wrap_false_keeps_icon_and_shortcut_visible(app: Page):
    """Icons and keyboard shortcuts stay visible when the label ellipsizes."""
    container = get_element_by_key(app, "wrap_icon_button")
    expect(container.get_by_test_id("stIconMaterial")).to_be_visible()
    expect(container.locator("kbd")).to_be_visible()
    # The full label is still exposed via the native title.
    expect(container.get_by_title(WRAP_LABEL, exact=True)).to_be_visible()
