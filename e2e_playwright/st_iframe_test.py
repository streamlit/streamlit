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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.shared.app_utils import get_element_by_key


def _get_iframe(app: Page, key: str) -> Locator:
    """Return the stIFrame locator inside the container with the given key."""
    return get_element_by_key(app, key).get_by_test_id("stIFrame")


def test_url_iframes(app: Page):
    """Test that URL-based iframes render with correct src and no srcdoc."""
    http_iframe = _get_iframe(app, "url_http")
    expect(http_iframe).to_be_attached()
    expect(http_iframe).to_have_attribute("src", "https://example.com")

    data_iframe = _get_iframe(app, "url_data")
    expect(data_iframe).to_have_attribute(
        "src", "data:text/html,<h1>Data URL Content</h1>"
    )


def test_html_string_iframes(app: Page):
    """Test that HTML string iframes use srcdoc and respect height settings."""
    auto_iframe = _get_iframe(app, "html_auto_height")
    expect(auto_iframe).to_have_attribute(
        "srcdoc", "<p style='margin:0;padding:10px;'>Auto height HTML</p>"
    )
    src_val = auto_iframe.get_attribute("src")
    assert src_val is None or src_val == ""

    fixed_iframe = _get_iframe(app, "html_fixed_height")
    box = fixed_iframe.bounding_box()
    assert box is not None
    assert abs(box["height"] - 150) < 2

    pixel_width_iframe = _get_iframe(app, "html_pixel_width")
    box = pixel_width_iframe.bounding_box()
    assert box is not None
    assert abs(box["width"] - 300) < 2


def test_local_html_file_uses_srcdoc(app: Page):
    """Test that local HTML files are embedded via srcdoc."""
    iframe = _get_iframe(app, "local_html_file")
    srcdoc = iframe.get_attribute("srcdoc")
    assert srcdoc is not None
    assert "Local HTML File" in srcdoc
    assert "Loaded from a local file path" in srcdoc


def test_scrolling_and_sandbox(app: Page):
    """Test that all iframes enable scrolling and use the sandbox policy."""
    iframes = app.get_by_test_id("stIFrame")
    for i in range(iframes.count()):
        expect(iframes.nth(i)).to_have_attribute("scrolling", "auto")

    first_iframe = iframes.first
    sandbox = first_iframe.get_attribute("sandbox")
    assert sandbox is not None
    assert "allow-scripts" in sandbox
    assert "allow-same-origin" in sandbox
    assert "allow-forms" in sandbox


def test_tab_index(app: Page):
    """Test that tab_index is set correctly on iframes."""
    expect(_get_iframe(app, "tab_index_0")).to_have_attribute("tabindex", "0")
    expect(_get_iframe(app, "tab_index_neg1")).to_have_attribute("tabindex", "-1")
