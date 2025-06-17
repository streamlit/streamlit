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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_until
from e2e_playwright.shared.app_utils import (
    click_button,
    expect_no_exception,
    get_expander,
)
from e2e_playwright.shared.react18_utils import wait_for_react_stability


def test_wide_layout(app: Page):
    """Test the default layout is centered and calling set_page_config with
    layout="wide" sets the layout to wide.
    """

    app_view_container = app.get_by_test_id("stAppViewContainer")
    # The default layout is "centered":
    expect(app_view_container).to_have_attribute("data-layout", "narrow")

    expander_container = get_expander(app, "Expander in main")
    expect(expander_container).to_be_visible()
    expander_dimensions = expander_container.bounding_box()
    assert expander_dimensions is not None
    narrow_expander_width = expander_dimensions["width"]

    click_button(app, "Wide Layout")
    expect(app).to_have_title("Wide Layout")
    expect(app_view_container).to_have_attribute("data-layout", "wide")

    expect(expander_container).to_be_visible()
    # Wait until the expander width becomes greater than the narrow width.
    wait_until(
        app,
        lambda: (bbox := expander_container.bounding_box()) is not None
        and bbox["width"] > narrow_expander_width,
    )


def test_wide_layout_with_small_viewport(app: Page):
    """Test that the wide layout is using the same width as the centered layout
    when the viewport is narrow.
    """

    app.set_viewport_size({"width": 640, "height": 800})

    app_view_container = app.get_by_test_id("stAppViewContainer")
    # The default layout is "centered":
    expect(app_view_container).to_have_attribute("data-layout", "narrow")

    expander_container = get_expander(app, "Expander in main")
    expect(expander_container).to_be_visible()
    wait_for_react_stability(app)
    expander_dimensions = expander_container.bounding_box()
    assert expander_dimensions is not None
    narrow_expander_width = expander_dimensions["width"]

    click_button(app, "Wide Layout")
    expect(app).to_have_title("Wide Layout")
    app_view_container = app.get_by_test_id("stAppViewContainer")
    expect(app_view_container).to_have_attribute("data-layout", "wide")
    wait_for_react_stability(app)
    # Wait until the expander width equals the narrow width.
    wait_until(
        app,
        lambda: (bbox := expander_container.bounding_box()) is not None
        and bbox["width"] == narrow_expander_width,
    )


def test_centered_layout(app: Page):
    """Test that calling set_page_config with layout="centered" sets the layout
    to centered.
    """
    click_button(app, "Centered Layout")
    expect(app).to_have_title("Centered Layout")
    app_view_container = app.get_by_test_id("stAppViewContainer")
    expect(app_view_container).to_have_attribute("data-layout", "narrow")


def test_allows_preceding_command_in_callback(app: Page):
    """Should not display an error when st.set_page_config is used after an st.*
    command in a callback.
    """
    click_button(app, "Preceding Command in Callback")
    expect(app).to_have_title("Allows preceding command in callback")
    expect_no_exception(app)


def test_with_collapsed_sidebar(app: Page):
    """Test that calling set_page_config with initial_sidebar_state="collapsed"
    sets the sidebar to collapsed.
    """
    click_button(app, "Collapsed Sidebar")
    expect(app).to_have_title("Collapsed Sidebar")
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "false")
    expect_no_exception(app)


def test_with_expanded_sidebar(app: Page):
    """Test that calling set_page_config with initial_sidebar_state="expanded"
    sets the sidebar to expanded.
    """
    click_button(app, "Expanded Sidebar")
    expect(app).to_have_title("Expanded Sidebar")
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")
    expect_no_exception(app)


def test_page_icon_with_emoji_shortcode(app: Page):
    """Test that calling set_page_config with page_icon=":shark:" sets
    the page icon to a shark emoji.
    """
    click_button(app, "Page Config With Emoji Shortcode")
    expect(app).to_have_title("With Emoji Shortcode")
    favicon = app.locator("link[rel='shortcut icon']")
    expect(favicon).to_have_attribute(
        "href",
        "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
        "<text y='.9em' font-size='90'>🦈</text></svg>",
    )
    expect_no_exception(app)


def test_page_icon_with_emoji_symbol(app: Page):
    """Test that calling set_page_config with page_icon="🐦‍🔥" sets
    the page icon to a phoenix emoji.
    """
    click_button(app, "Page Config With Emoji Symbol")
    expect(app).to_have_title("With Emoji Symbol")
    favicon = app.locator("link[rel='shortcut icon']")
    expect(favicon).to_have_attribute(
        "href",
        "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
        "<text y='.9em' font-size='90'>🐦‍🔥</text></svg>",
    )


def test_page_icon_with_local_icon_str(app: Page):
    """Test that calling set_page_config with a local icon string for page_icon
    sets as expected.
    """
    click_button(app, "Page Config With Local Icon Str")
    expect(app).to_have_title("With Local Icon Str")
    favicon_element = app.locator("link[rel='shortcut icon']")
    expect(favicon_element).to_have_count(1)
    expect(favicon_element).to_have_attribute("href", re.compile(r".*\.png$"))
    expect_no_exception(app)


def test_page_icon_with_local_icon(app: Page):
    """Test that calling set_page_config with a local icon path for page_icon
    sets as expected.
    """
    click_button(app, "Page Config With Local Icon Path")
    expect(app).to_have_title("With Local Icon Path")
    favicon_element = app.locator("link[rel='shortcut icon']")
    expect(favicon_element).to_have_count(1)
    expect(favicon_element).to_have_attribute("href", re.compile(r".*\.png$"))
    expect_no_exception(app)


def test_page_icon_with_material_icon(app: Page):
    """Test that calling set_page_config with a material icon for page_icon
    sets as expected.
    """
    click_button(app, "Page Config With Material Icon")
    expect(app).to_have_title("With Material Icon")
    favicon = app.locator("link[rel='shortcut icon']")
    expect(favicon).to_have_attribute(
        "href",
        "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/thumb_up/default/24px.svg",
    )
    expect_no_exception(app)


# Tests for removal of set page config restrictions:
def test_allow_double_set_page_config(app: Page):
    """Test that calling set_page_config multiple times no longer triggers
    an error.
    """
    click_button(app, "Double Set Page Config")
    expect_no_exception(app)
    expect(app).to_have_title("Page Config 2")


def test_allow_set_page_config_not_first_command(app: Page):
    """Test that calling set_page_config after the first command does not trigger
    an error.
    """
    click_button(app, "Page Config not first command")
    favicon = app.locator("link[rel='shortcut icon']")
    expect(favicon).to_have_attribute(
        "href",
        "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/pets/default/24px.svg",
    )
    updated_text = app.locator("text=Page Icon updated")
    expect(updated_text).to_be_visible()
    expect_no_exception(app)


def test_set_page_config_properties_additive(app: Page):
    """Test that calling set_page_config multiple times with different properties
    sets as expected (properties are additive).
    """
    click_button(app, "Set Page Config Properties Additive")
    expect_no_exception(app)
    expect(app).to_have_title("Page Config Additive")
    favicon = app.locator("link[rel='shortcut icon']")
    expect(favicon).to_have_attribute(
        "href",
        "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/electric_bolt/default/24px.svg",
    )
    app_view_container = app.get_by_test_id("stAppViewContainer")
    expect(app_view_container).to_have_attribute("data-layout", "wide")


def test_set_page_config_layout_additive(app: Page):
    """Test that calling set_page_config multiple times with different layout
    configs sets as expected (properties are additive).
    """
    click_button(app, "Layout Additive")
    expect_no_exception(app)
    expect(app).to_have_title("Updated")
    app_view_container = app.get_by_test_id("stAppViewContainer")
    # Layout set to None should inherit config from previous call
    expect(app_view_container).to_have_attribute("data-layout", "wide")


def test_set_page_config_sidebar_additive(app: Page):
    """Test that calling set_page_config multiple times with different sidebar
    configs sets as expected (properties are additive).
    """
    click_button(app, "Sidebar Additive")
    expect_no_exception(app)
    expect(app).to_have_title("Updated")
    sidebar = app.get_by_test_id("stSidebar")
    # Sidebar set to None should inherit config from previous call
    expect(sidebar).to_have_attribute("aria-expanded", "false")


# Webkit (safari) doesn't support screencast on linux machines, so menu item
# indices not the same as other browsers
@pytest.mark.skip_browser("webkit")
def test_set_page_config_menu_items_additive(app: Page):
    """Test that calling set_page_config multiple times with different menu
    items sets as expected (properties are additive).
    """
    click_button(app, "Set Page Config Menu Items Additive")
    expect_no_exception(app)

    # Open the main menu:
    app.get_by_test_id("stMainMenu").click()
    # First main menu list includes "Report a Bug" and "Get help" (second is developer menu)
    main_menu_items = app.get_by_test_id("stMainMenuList").first.get_by_role("option")
    # These options should now be present in the main menu:
    expect(main_menu_items.nth(4)).to_have_text("Report a bug")
    expect(main_menu_items.nth(5)).to_have_text("Get help")


@pytest.mark.skip_browser("webkit")
def test_set_page_config_menu_items_overwrites(app: Page):
    """Test that menu items can be overwritten by calling set_page_config
    multiple times.
    """
    # Set the initial menu items:
    click_button(app, "Set Initial Menu Items")
    expect_no_exception(app)
    # Open the main menu:
    app.get_by_test_id("stMainMenu").click()
    # First main menu list includes "Get help" (second is developer menu)
    main_menu_items = app.get_by_test_id("stMainMenuList").first.get_by_role("option")
    # Get help should be present
    expect(main_menu_items.nth(4)).to_have_text("Get help")
    # Open the about dialog:
    main_menu_items.nth(5).click()
    about_dialog = app.get_by_role("dialog")
    expect(about_dialog).to_be_visible()
    # The about section markdown should contain the updated text:
    expect(about_dialog).to_contain_text("UPDATED")

    # Close the dialog:
    about_dialog.get_by_role("button", name="Close").click()

    # Now overwrite the menu items:
    click_button(app, "Menu Items Overwrite")
    expect_no_exception(app)
    app.get_by_test_id("stMainMenu").click()
    main_menu_items = app.get_by_test_id("stMainMenuList").first.get_by_role("option")
    # Get help should still be present in the main menu from the 1st call:
    expect(main_menu_items.nth(4)).to_have_text("Get help")
    main_menu_items.nth(5).click()
    about_dialog = app.get_by_role("dialog")
    expect(about_dialog).to_be_visible()
    # The about section markdown should not contain the updated text:
    expect(about_dialog).not_to_contain_text("UPDATED")
