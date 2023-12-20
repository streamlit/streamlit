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

from e2e_playwright.conftest import ImageCompareFunction


def test_components_iframe_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that our components v1 API correctly renders elements via screenshot matching."""

    elements = themed_app.locator("iframe")
    expect(elements).to_have_count(3)

    assert_snapshot(elements.nth(0), name="st_components-html")
    assert_snapshot(elements.nth(1), name="st_components-iframe")


def test_html_correctly_sets_attr(app: Page):
    """Test that html correctly sets attributes."""

    html_component = app.locator("iframe").nth(0)

    expect(html_component).to_have_attribute("srcDoc", "<h1>Hello, Streamlit!</h1>")
    expect(html_component).to_have_attribute("width", "200")
    expect(html_component).to_have_attribute("height", "500")
    expect(html_component).to_have_attribute("scrolling", "no")


def test_iframe_correctly_sets_attr(app: Page):
    """Test that iframe correctly sets attributes."""

    iframe_component = app.locator("iframe").nth(1)

    expect(iframe_component).to_have_attribute("src", "http://not.a.real.url")
    expect(iframe_component).to_have_attribute("width", "200")
    expect(iframe_component).to_have_attribute("height", "500")
    expect(iframe_component).to_have_attribute("scrolling", "auto")


def test_declare_component_correctly_sets_attr(app: Page):
    """Test that components.declare_component correctly sets attributes."""

    declare_component = app.locator("iframe").nth(2)

    expect(declare_component).to_have_attribute(
        "title", "st_components_v1.test_component"
    )
    expect(declare_component).to_have_attribute(
        "src",
        re.compile(r"http://not.a.real.url\?streamlitUrl=http%3A%2F%2Flocalhost.*"),
    )
