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
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class

# Total number of st.iframe elements in the test app
# 1: HTML string, 2: Fixed dims, 3: Data URL, 4: Stretch width, 5: Content width,
# 6: Tab index, 7: Auto-sizing height, 8: Auto-sizing both
ST_IFRAME_COUNT = 8


def test_iframe_elements_render(app: Page):
    """Test that all st.iframe elements are rendered."""
    iframe_elements = app.get_by_test_id("stIFrame")
    expect(iframe_elements).to_have_count(ST_IFRAME_COUNT)


def test_iframe_with_html_string(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.iframe renders HTML string content correctly."""
    iframe_elements = app.get_by_test_id("stIFrame")
    first_iframe = iframe_elements.nth(0)

    # The iframe should be visible
    expect(first_iframe).to_be_visible()

    # Check the content inside the iframe using frame_locator
    iframe_frame = first_iframe.content_frame
    heading = iframe_frame.locator("h2")
    expect(heading).to_have_text("Hello from iframe!")

    assert_snapshot(first_iframe, name="st_iframe-html_string")


def test_iframe_with_fixed_dimensions(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.iframe with explicit width and height."""
    iframe_elements = app.get_by_test_id("stIFrame")
    second_iframe = iframe_elements.nth(1)

    expect(second_iframe).to_be_visible()
    assert_snapshot(second_iframe, name="st_iframe-fixed_dimensions")


def test_iframe_with_data_url(app: Page):
    """Test st.iframe with a data: URL."""
    iframe_elements = app.get_by_test_id("stIFrame")
    third_iframe = iframe_elements.nth(2)

    expect(third_iframe).to_be_visible()
    # Verify the src attribute contains a data: URL
    expect(third_iframe).to_have_attribute("src", re.compile(r"^data:text/html,"))


def test_iframe_scrolling_enabled(app: Page):
    """Test that st.iframe has scrolling enabled (scrolling='auto')."""
    iframe_elements = app.get_by_test_id("stIFrame")
    first_iframe = iframe_elements.nth(0)

    # Scrolling should be set to "auto" for st.iframe
    expect(first_iframe).to_have_attribute("scrolling", "auto")


def test_iframe_sandbox_policy(app: Page):
    """Test that st.iframe has the default sandbox policy."""
    iframe_elements = app.get_by_test_id("stIFrame")
    first_iframe = iframe_elements.nth(0)

    # Check that sandbox attribute contains expected permissions using regex
    expect(first_iframe).to_have_attribute("sandbox", re.compile(r"allow-scripts"))
    expect(first_iframe).to_have_attribute("sandbox", re.compile(r"allow-same-origin"))


def test_iframe_tab_index(app: Page):
    """Test st.iframe with tab_index parameter."""
    iframe_elements = app.get_by_test_id("stIFrame")
    # The 6th iframe (index 5) has tab_index=0
    tab_index_iframe = iframe_elements.nth(5)

    expect(tab_index_iframe).to_have_attribute("tabindex", "0")


def test_iframe_no_tab_index_by_default(app: Page):
    """Test that st.iframe without tab_index doesn't set tabindex attribute."""
    iframe_elements = app.get_by_test_id("stIFrame")
    first_iframe = iframe_elements.nth(0)

    # First iframe doesn't have tab_index set - check attribute doesn't exist
    # Using regex that matches any value to verify attribute is absent
    expect(first_iframe).not_to_have_attribute("tabindex", re.compile(r".*"))


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stIFrame")


@pytest.mark.skip_browser("webkit")  # Webkit postMessage timing is flaky in CI
def test_iframe_auto_sizing_height(app: Page):
    """Test st.iframe with height='content' auto-sizes to content."""
    iframe_elements = app.get_by_test_id("stIFrame")
    auto_size_iframe = iframe_elements.nth(6)

    expect(auto_size_iframe).to_be_visible()

    # First ensure the content is rendered inside the iframe
    iframe_frame = auto_size_iframe.content_frame
    heading = iframe_frame.locator("h3")
    expect(heading).to_have_text("Auto-sized iframe")

    # Wait for the iframe to receive height from content via postMessage
    # The height is set as an HTML attribute on the iframe element
    # Use a longer timeout for webkit which can be slower at processing postMessage
    expect(auto_size_iframe).to_have_attribute(
        "height", re.compile(r"\d+px"), timeout=15000
    )


@pytest.mark.skip_browser("webkit")  # Webkit postMessage timing is flaky in CI
def test_iframe_auto_sizing_both_dimensions(app: Page):
    """Test st.iframe with both width='content' and height='content'."""
    iframe_elements = app.get_by_test_id("stIFrame")
    auto_size_iframe = iframe_elements.nth(7)

    expect(auto_size_iframe).to_be_visible()

    # First ensure the content is rendered inside the iframe
    iframe_frame = auto_size_iframe.content_frame
    strong = iframe_frame.locator("strong")
    expect(strong).to_have_text("Auto width & height")

    # Wait for both width and height to be set via postMessage
    # These are set as HTML attributes on the iframe element
    expect(auto_size_iframe).to_have_attribute(
        "width", re.compile(r"\d+px"), timeout=15000
    )
    expect(auto_size_iframe).to_have_attribute(
        "height", re.compile(r"\d+px"), timeout=15000
    )
