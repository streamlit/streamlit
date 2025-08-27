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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_checkbox,
    expect_markdown,
    get_button,
    get_element_by_key,
    get_expander,
)

TOTAL_BUTTONS = 26


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
    expect(primary_button_container.locator("span")).to_have_class(
        "stMarkdownColoredText"
    )
    expect(primary_button_container.locator("span")).to_have_css(
        "color", "rgb(0, 104, 201)"
    )
    primary_button_container.locator("button").hover()
    # For primary buttons, the colored text should stay blue on hover (no color inheritance)
    expect(primary_button_container.locator("span")).to_have_css(
        "color", "rgb(0, 104, 201)"
    )

    # Check hover behavior for colored text in secondary button
    secondary_button_container = get_element_by_key(app, "colored_text_secondary")
    expect(secondary_button_container.locator("span")).to_have_class(
        "stMarkdownColoredText"
    )
    expect(secondary_button_container.locator("span")).to_have_css(
        "color", "rgb(0, 104, 201)"
    )
    secondary_button_container.locator("button").hover()
    # For secondary buttons, the colored text should stay blue on hover (no color inheritance)
    expect(secondary_button_container.locator("span")).to_have_css(
        "color", "rgb(0, 104, 201)"
    )

    # Check hover behavior for colored text in tertiary button
    tertiary_button_container = get_element_by_key(app, "colored_text_tertiary")
    expect(tertiary_button_container.locator("span")).to_have_class(
        "stMarkdownColoredText"
    )
    expect(tertiary_button_container.locator("span")).to_have_css(
        "color", "rgb(0, 104, 201)"
    )
    tertiary_button_container.locator("button").hover()
    # For tertiary buttons, the colored text should be red on hover to match the rest of the text
    expect(tertiary_button_container.locator("span")).to_have_css(
        "color", "rgb(255, 75, 75)"
    )


def test_button_hover(themed_app: Page, assert_snapshot: ImageCompareFunction):
    help_button_container = get_element_by_key(themed_app, "help_button_container")
    help_button = get_element_by_key(help_button_container, "help_button_key")
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
