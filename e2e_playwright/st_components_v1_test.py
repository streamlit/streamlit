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

import math
import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    get_checkbox,
    get_element_by_key,
)

NUM_IFRAMES = 11


def test_components_iframe_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that our components v1 API correctly renders elements via screenshot matching."""

    elements = themed_app.locator("iframe")
    expect(elements).to_have_count(NUM_IFRAMES)

    # Only doing a snapshot of the html component, since the iframe one
    # does not use a valid URL.
    assert_snapshot(elements.nth(0), name="st_components-html")

    # Emulate dark theme OS setting:
    themed_app.emulate_media(color_scheme="dark")
    assert_snapshot(elements.nth(0), name="st_components-html")


def test_components_iframe_dimensions(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that iframe correctly sets dimensions."""

    assert_snapshot(
        app.locator("iframe").nth(6), name="st_components-iframe-no-width-height"
    )
    assert_snapshot(
        app.locator("iframe").nth(7), name="st_components-iframe-fixed-width-height"
    )
    assert_snapshot(
        app.locator("iframe").nth(9),
        name="st_components-html-no-width-height-container",
    )
    # Fixed width/height html are already tested above.
    assert_snapshot(
        get_element_by_key(app, "html-iframe-in-vertical-container"),
        name="st_components-html-iframe-in-vertical-container",
    )


def test_html_correctly_sets_attr(app: Page):
    """Test that html correctly sets attributes and rendered size."""

    html_component = app.locator("iframe").nth(0)

    expect(html_component).to_have_attribute("srcDoc", "<h1>Hello, Streamlit!</h1>")
    expect(html_component).to_have_attribute("scrolling", "no")

    # Check the actual rendered size
    box = html_component.bounding_box()
    if box is None:
        raise AssertionError("Bounding box is None")

    assert math.floor(box["width"]) == 200
    assert math.floor(box["height"]) == 500


def test_iframe_correctly_sets_attr(app: Page):
    """Test that iframe correctly sets attributes and rendered size."""

    iframe_component = app.locator("iframe").nth(1)

    expect(iframe_component).to_have_attribute("src", "http://not.a.real.url")
    expect(iframe_component).to_have_attribute("scrolling", "auto")

    # Check the actual rendered size
    box = iframe_component.bounding_box()
    if box is None:
        raise AssertionError("Bounding box is None")

    assert math.floor(box["width"]) == 200
    assert math.floor(box["height"]) == 500


def test_iframe_tab_index_attributes(app: Page):
    """Test that iframe correctly handles tab_index attributes."""

    # Default iframe (no tab_index specified) - should not have tabindex attribute
    default_iframe = app.locator("iframe").nth(2)
    assert not default_iframe.evaluate("node => node.hasAttribute('tabindex')"), (
        "Iframe should not have tabindex attribute when not specified"
    )

    # Positive tab_index
    positive_iframe = app.locator("iframe").nth(3)
    expect(positive_iframe).to_have_attribute("tabindex", "5")

    # Negative tab_index
    negative_iframe = app.locator("iframe").nth(4)
    expect(negative_iframe).to_have_attribute("tabindex", "-1")

    # Zero tab_index
    zero_iframe = app.locator("iframe").nth(5)
    expect(zero_iframe).to_have_attribute("tabindex", "0")


def test_declare_component_correctly_sets_attr(app: Page):
    """Test that components.declare_component correctly sets attributes and rendered size."""

    checkbox_element = get_checkbox(app, "Show custom component")
    checkbox_element.locator("label").click()

    declare_component = app.locator("iframe").nth(11)

    expect(declare_component).to_have_attribute(
        "title", "st_components_v1.test_component"
    )
    expect(declare_component).to_have_attribute(
        "src",
        re.compile(
            r"http://not.a.real.url\?streamlitUrl=http%3A%2F%2Flocalhost%3A\d*%2F$"
        ),
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    checkbox_element = get_checkbox(app, "Show custom component")
    checkbox_element.locator("label").click()

    check_top_level_class(app, "stCustomComponentV1")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    checkbox_element = get_checkbox(app, "Show custom component")
    checkbox_element.locator("label").click()

    expect(get_element_by_key(app, "component_1")).to_be_visible()


# TODO(willhuang1997): Add tests for handling bytes, JSON, DFs, theme
# TODO(willhuang1997): add tests to ensure the messages actually go to the iframe
# Relevant code is here from the past: https://github.com/streamlit/streamlit/blob/3d0b0603627037255790fe55a483f55fce5eff67/frontend/lib/src/components/widgets/CustomComponent/ComponentInstance.test.tsx#L257
# Relevant PR is here: https://github.com/streamlit/streamlit/pull/7971
