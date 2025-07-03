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
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_checkbox,
    get_element_by_key,
    get_expander,
)

TOTAL_BUTTONS = 26


def test_button_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the button widgets are correctly rendered via screenshot matching."""
    button_elements = themed_app.get_by_test_id("stButton")
    expect(button_elements).to_have_count(TOTAL_BUTTONS)

    assert_snapshot(button_elements.nth(0), name="st_button-default")
    assert_snapshot(button_elements.nth(1), name="st_button-disabled")
    assert_snapshot(button_elements.nth(2), name="st_button-primary")
    assert_snapshot(button_elements.nth(3), name="st_button-disabled_primary")
    assert_snapshot(button_elements.nth(4), name="st_button-styled_label")
    assert_snapshot(button_elements.nth(5), name="st_button-just_help")
    assert_snapshot(button_elements.nth(6), name="st_button-material_icon")
    assert_snapshot(button_elements.nth(7), name="st_button-emoji_icon")
    assert_snapshot(button_elements.nth(8), name="st_button-tertiary")
    assert_snapshot(button_elements.nth(9), name="st_button-disabled_tertiary")
    assert_snapshot(button_elements.nth(10), name="st_button-material_icon_1k_icon")
    assert_snapshot(button_elements.nth(11), name="st_button-material_icon_1k_markdown")

    # The rest is tested in one screenshot in the following test


def test_material_icon_hover(app: Page, assert_snapshot: ImageCompareFunction):
    material_icon_button = app.get_by_test_id("stButton").nth(6)
    app.get_by_text("Like Button").hover()
    assert_snapshot(material_icon_button, name="st_button-material_icon_hover")


def test_buttons_in_columns(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the button widgets are correctly rendered in columns via screenshot matching."""
    columns_container = themed_app.get_by_test_id("stHorizontalBlock")
    expect(columns_container).to_have_count(1)
    expect(columns_container.get_by_test_id("stButton")).to_have_count(8)

    assert_snapshot(columns_container, name="st_button-in_columns")


def test_value_correct_on_click(app: Page):
    button_element = app.get_by_test_id("stButton").locator("button").first
    button_element.click()
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text("value: True")
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text(
        "value from state: True"
    )


def test_value_not_reset_on_reclick(app: Page):
    button_element = app.get_by_test_id("stButton").locator("button").first
    button_element.click()
    button_element.click()
    expect(app.get_by_test_id("stMarkdown").first).to_have_text("value: True")


def test_click_calls_callback(app: Page):
    button_element = app.get_by_test_id("stButton").locator("button").first
    expect(app.get_by_test_id("stMarkdown").nth(2)).to_contain_text(
        "Button was clicked: False"
    )
    button_element.click()
    expect(app.get_by_test_id("stMarkdown").nth(2)).to_have_text(
        "Button was clicked: True"
    )
    expect(app.get_by_test_id("stMarkdown").nth(3)).to_have_text("times clicked: 1")
    expect(app.get_by_test_id("stMarkdown").nth(4)).to_have_text("arg value: 1")
    expect(app.get_by_test_id("stMarkdown").nth(5)).to_have_text("kwarg value: 2")


def test_click_increment_count(app: Page):
    button_element = app.get_by_test_id("stButton").locator("button").first
    button_element.click()
    expect(app.get_by_test_id("stMarkdown").nth(3)).to_have_text("times clicked: 1")
    button_element.click()
    expect(app.get_by_test_id("stMarkdown").nth(3)).to_have_text("times clicked: 2")
    button_element.click()
    expect(app.get_by_test_id("stMarkdown").nth(3)).to_have_text("times clicked: 3")


def test_reset_on_other_widget_change(app: Page):
    click_button(app, "button 1")
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text("value: True")
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text(
        "value from state: True"
    )

    click_checkbox(app, "reset button return value")
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text("value: False")
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text(
        "value from state: False"
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stButton")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "button")).to_be_visible()


def test_shows_cursor_pointer(app: Page):
    """Test that the button shows cursor pointer when hovered."""
    button_element = app.get_by_test_id("stButton").first
    expect(button_element.locator("button")).to_have_css("cursor", "pointer")


def test_colored_text_hover(app: Page):
    """Test that the colored text is correctly rendered and changes color on hover."""
    # Check hover behavior for colored text in primary button
    primary_button_element = app.get_by_test_id("stButton").nth(20)
    expect(primary_button_element.locator("span")).to_have_class(
        "stMarkdownColoredText"
    )
    expect(primary_button_element.locator("span")).to_have_css(
        "color", "rgb(0, 104, 201)"
    )
    primary_button_element.locator("button").hover()
    # For primary buttons, the colored text should stay blue on hover (no color inheritance)
    expect(primary_button_element.locator("span")).to_have_css(
        "color", "rgb(0, 104, 201)"
    )

    # Check hover behavior for colored text in secondary button
    secondary_button_element = app.get_by_test_id("stButton").nth(21)
    expect(secondary_button_element.locator("span")).to_have_class(
        "stMarkdownColoredText"
    )
    expect(secondary_button_element.locator("span")).to_have_css(
        "color", "rgb(0, 104, 201)"
    )
    secondary_button_element.locator("button").hover()
    # For secondary buttons, the colored text should stay blue on hover (no color inheritance)
    expect(secondary_button_element.locator("span")).to_have_css(
        "color", "rgb(0, 104, 201)"
    )

    # Check hover behavior for colored text in tertiary button
    tertiary_button_element = app.get_by_test_id("stButton").nth(22)
    expect(tertiary_button_element.locator("span")).to_have_class(
        "stMarkdownColoredText"
    )
    expect(tertiary_button_element.locator("span")).to_have_css(
        "color", "rgb(0, 104, 201)"
    )
    tertiary_button_element.locator("button").hover()
    # For tertiary buttons, the colored text should be red on hover to match the rest of the text
    expect(tertiary_button_element.locator("span")).to_have_css(
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
    button_elements = button_expander.get_by_test_id("stButton")

    assert_snapshot(button_elements.nth(0), name="st_button-width_content")
    assert_snapshot(button_elements.nth(1), name="st_button-width_stretch")
    assert_snapshot(button_elements.nth(2), name="st_button-width_200px")
