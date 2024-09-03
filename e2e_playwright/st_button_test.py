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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_checkbox,
    get_element_by_key,
)


def test_button_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the button widgets are correctly rendered via screenshot matching."""
    button_elements = themed_app.get_by_test_id("stButton")
    expect(button_elements).to_have_count(17)

    assert_snapshot(button_elements.nth(0), name="st_button-default")
    assert_snapshot(button_elements.nth(1), name="st_button-disabled")
    assert_snapshot(button_elements.nth(2), name="st_button-primary")
    assert_snapshot(button_elements.nth(3), name="st_button-disabled_primary")
    assert_snapshot(button_elements.nth(4), name="st_button-use_container_width")
    assert_snapshot(button_elements.nth(5), name="st_button-use_container_width_help")
    assert_snapshot(button_elements.nth(6), name="st_button-styled_label")
    assert_snapshot(button_elements.nth(7), name="st_button-material_icon")
    assert_snapshot(button_elements.nth(8), name="st_button-emoji_icon")

    # The rest is tested in one screenshot in the following test


def test_buttons_in_columns(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the button widgets are correctly rendered in columns via screenshot matching."""
    columns_container = themed_app.get_by_test_id("stHorizontalBlock")
    expect(columns_container).to_have_count(1)

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


def test_show_tooltip_on_hover(app: Page, assert_snapshot: ImageCompareFunction):
    button_element = app.get_by_test_id("stButton").nth(5)
    button_element.hover()
    assert_snapshot(button_element, name="st_button-on_hover")
    expect(app.get_by_test_id("stTooltipContent")).to_have_text("help text")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stButton")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "button")).to_be_visible()
