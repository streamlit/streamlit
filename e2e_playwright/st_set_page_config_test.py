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

from e2e_playwright.shared.app_utils import (
    click_button,
    expect_exception,
    expect_no_exception,
    get_expander,
)


def test_wide_layout(app: Page):
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

    expander_dimensions = expander_container.bounding_box()
    assert expander_dimensions is not None

    # Its fine to use assert here since we don't need to wait for this to be true:
    assert narrow_expander_width < expander_dimensions["width"]


def test_centered_layout(app: Page):
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


def test_double_set_page_config(app: Page):
    """Should display an error when st.set_page_config is called
    multiple times in a callback."""
    click_button(app, "Double Set Page Config")
    expect_exception(app, "set_page_config() can only be called once per app page")
    expect(app).to_have_title("Page Config 1")


def test_with_collapsed_sidebar(app: Page):
    click_button(app, "Collapsed Sidebar")
    expect(app).to_have_title("Collapsed Sidebar")
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "false")
    expect_no_exception(app)


def test_with_expanded_sidebar(app: Page):
    click_button(app, "Expanded Sidebar")
    expect(app).to_have_title("Expanded Sidebar")
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")
    expect_no_exception(app)


def test_page_icon_with_emoji_shortcode(app: Page):
    click_button(app, "Page Config With Emoji Shortcode")
    expect(app).to_have_title("With Emoji Shortcode")
    favicon = app.locator("link[rel='shortcut icon']")
    expect(favicon).to_have_attribute(
        "href",
        "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f988.png",
    )
    expect_no_exception(app)


def test_page_icon_with_emoji_symbol(app: Page):
    click_button(app, "Page Config With Emoji Symbol")
    expect(app).to_have_title("With Emoji Symbol")
    favicon = app.locator("link[rel='shortcut icon']")
    expect(favicon).to_have_attribute(
        "href",
        "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f419.png",
    )


def test_page_icon_with_local_icon(app: Page):
    click_button(app, "Page Config With Local Icon")
    expect(app).to_have_title("With Local Icon")
    favicon_element = app.locator("link[rel='shortcut icon']")
    expect(favicon_element).to_have_count(1)
    expect(favicon_element).to_have_attribute(
        "href",
        re.compile(r"d1e92a291d26c1e0cb9b316a93c929b3be15899677ef3bc6e3bf3573\.png"),
    )
    expect_no_exception(app)


def test_page_icon_with_material_icon(app: Page):
    click_button(app, "Page Config With Material Icon")
    expect(app).to_have_title("With Material Icon")
    favicon = app.locator("link[rel='shortcut icon']")
    expect(favicon).to_have_attribute(
        "href",
        "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsrounded/thumb_up/default/24px.svg",
    )
    expect_no_exception(app)
