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

from playwright.sync_api import Page, expect


def test_url_iframe_renders(app: Page):
    """Test that a URL-based iframe renders with correct src attribute."""
    iframes = app.get_by_test_id("stIFrame")
    expect(iframes.first).to_be_attached()
    expect(iframes.first).to_have_attribute("src", "https://example.com")


def test_data_url_iframe_renders(app: Page):
    """Test that a data URL iframe renders correctly."""
    iframes = app.get_by_test_id("stIFrame")
    expect(iframes.nth(1)).to_have_attribute(
        "src", "data:text/html,<h1>Data URL Content</h1>"
    )


def test_html_string_iframe_has_srcdoc(app: Page):
    """Test that HTML string iframes use srcdoc."""
    iframes = app.get_by_test_id("stIFrame")
    html_iframe = iframes.nth(2)
    expect(html_iframe).to_have_attribute(
        "srcdoc", "<p style='margin:0;padding:10px;'>Auto height HTML</p>"
    )
    src_val = html_iframe.get_attribute("src")
    assert src_val is None or src_val == ""


def test_html_iframe_fixed_height(app: Page):
    """Test that fixed-height HTML iframes have the correct rendered height."""
    iframes = app.get_by_test_id("stIFrame")
    fixed_height_iframe = iframes.nth(3)
    box = fixed_height_iframe.bounding_box()
    assert box is not None
    assert abs(box["height"] - 150) < 2


def test_html_iframe_pixel_width(app: Page):
    """Test that pixel-width iframes have the correct width."""
    iframes = app.get_by_test_id("stIFrame")
    pixel_width_iframe = iframes.nth(5)
    box = pixel_width_iframe.bounding_box()
    assert box is not None
    assert abs(box["width"] - 300) < 2


def test_local_html_file_uses_srcdoc(app: Page):
    """Test that local HTML files are embedded via srcdoc."""
    iframes = app.get_by_test_id("stIFrame")
    local_file_iframe = iframes.nth(6)
    srcdoc = local_file_iframe.get_attribute("srcdoc")
    assert srcdoc is not None
    assert "Local HTML File" in srcdoc
    assert "Loaded from a local file path" in srcdoc


def test_scrolling_is_auto(app: Page):
    """Test that st.iframe always enables scrolling (auto mode)."""
    iframes = app.get_by_test_id("stIFrame")
    for i in range(iframes.count()):
        expect(iframes.nth(i)).to_have_attribute("scrolling", "auto")


def test_tab_index_set_correctly(app: Page):
    """Test that tab_index is set correctly on iframes."""
    iframes = app.get_by_test_id("stIFrame")
    tab_index_0_iframe = iframes.nth(8)
    expect(tab_index_0_iframe).to_have_attribute("tabindex", "0")

    tab_index_neg1_iframe = iframes.nth(9)
    expect(tab_index_neg1_iframe).to_have_attribute("tabindex", "-1")


def test_sandbox_policy(app: Page):
    """Test that iframes have the correct sandbox policy."""
    iframes = app.get_by_test_id("stIFrame")
    first_iframe = iframes.first
    sandbox = first_iframe.get_attribute("sandbox")
    assert sandbox is not None
    assert "allow-scripts" in sandbox
    assert "allow-same-origin" in sandbox
    assert "allow-forms" in sandbox
