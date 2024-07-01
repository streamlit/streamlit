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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run


def _select_component(app: Page, component: str):
    selectbox_input = app.get_by_test_id("stSelectbox").locator("input")

    # Type an option (defined in the test app):
    selectbox_input.type(component)
    selectbox_input.press("Enter")
    wait_for_app_run(app)


def _expect_no_exception(app: Page):
    """If there is an issue with importing / using the custom component, Streamlit throws an exception. So, expect that no exception was thrown."""
    expect(app.get_by_test_id("stException")).not_to_be_visible()


def _expect_iframe_attached(app: Page):
    """Expect the CustomComponent iframe to be attached to the DOM."""
    expect(app.locator("iframe").first).to_be_attached()


def test_components_html(app: Page):
    """Test that components.html can be imported and used"""
    _select_component(app, "componentsHtml")
    _expect_no_exception(app)
    _expect_iframe_attached(app)
    iframe = app.frame_locator("iframe")
    div = iframe.locator("div")
    expect(div).to_have_text("Hello World!")


@pytest.mark.parametrize(
    ("name", "expected_text"),
    [
        ("componentsIframe", "bound method IframeMixin._iframe of DeltaGenerator()"),
        ("componentsDeclareComponent", "function declare_component at"),
    ],
)
def test_components_import(app: Page, name: str, expected_text: str):
    """Test that components.iframe and components.declare_component can be imported and used.

    We only make sure that they are importable but do not call them, so we don't have an iframe element in the DOM.
    """
    _select_component(app, name)
    _expect_no_exception(app)
    div = app.get_by_test_id("stMarkdownContainer").filter(
        has_text=re.compile(f"<{expected_text}.*>")
    )
    expect(div).to_be_attached()


def test_ace(app: Page):
    """Test that the ace component renders"""
    _select_component(app, "ace")
    _expect_no_exception(app)
    _expect_iframe_attached(app)


def test_aggrid(app: Page):
    """Test that the aggrid component renders"""
    _select_component(app, "aggrid")
    _expect_no_exception(app)
    _expect_iframe_attached(app)


def test_antd(app: Page):
    """Test that the ace component renders"""
    _select_component(app, "antd")
    _expect_no_exception(app)
    _expect_iframe_attached(app)


def test_autorefresh(app: Page):
    """Test that the autorefresh component renders"""
    _select_component(app, "autorefresh")
    _expect_no_exception(app)


def test_chat(app: Page):
    """Test that the chat component renders"""
    _select_component(app, "chat")
    _expect_iframe_attached(app)


def test_echarts(app: Page):
    """Test that the echarts component renders"""
    _select_component(app, "echarts")
    _expect_no_exception(app)


def test_extra_streamlit_components(app: Page):
    """Test that the extra-strealit-components component renders"""
    _select_component(app, "extraStreamlitComponents")
    _expect_no_exception(app)
    _expect_iframe_attached(app)


def test_folium(app: Page):
    """Test that the folium component renders"""
    _select_component(app, "folium")
    _expect_no_exception(app)
    _expect_iframe_attached(app)


def test_option_menu(app: Page):
    """Test that the option-menu component renders"""
    _select_component(app, "optionMenu")
    _expect_no_exception(app)
    _expect_iframe_attached(app)

    # TODO: uncomment the on_change callback as soon as streamlit-option-menu is updated and uses the new on_change callback
    # frame_locator = app.frame_locator("iframe")
    # frame_locator.locator("a", has_text="Home").click()
    # expect(
    #     app.get_by_test_id("stMarkdown").filter(has_text="Selection changed to Home")
    # ).to_be_visible()


def test_url_fragment(app: Page):
    """Test that the url-fragment component renders"""
    _select_component(app, "urlFragment")
    _expect_no_exception(app)
    _expect_iframe_attached(app)
