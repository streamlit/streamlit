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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.shared.app_utils import get_element_by_key

IFRAME_COUNT = 6


def get_iframe(app: Page, key: str) -> Locator:
    """Return the iframe inside the keyed container."""
    iframe = get_element_by_key(app, key).locator("iframe")
    expect(iframe).to_be_visible()
    return iframe


def get_iframe_box(iframe: Locator) -> dict[str, float]:
    """Return the bounding box for an iframe."""
    box = iframe.bounding_box()
    if box is None:
        raise AssertionError("Bounding box is None")
    return box


def test_iframe_srcdoc_sources_auto_size_to_content(app: Page):
    """Test that srcdoc iframes auto-size to their HTML content."""
    expect(app.locator("iframe")).to_have_count(IFRAME_COUNT)

    inline_iframe = get_iframe(app, "inline_html_iframe")
    expect(inline_iframe).to_have_attribute("tabindex", "3")
    expect(inline_iframe).not_to_have_attribute("src")
    inline_box = get_iframe_box(inline_iframe)
    assert 176 <= inline_box["height"] <= 184
    assert inline_box["height"] < 400
    expect(
        app.frame_locator(".st-key-inline_html_iframe iframe").locator(
            "#inline-html-content"
        )
    ).to_contain_text("Inline iframe HTML")

    local_html_iframe = get_iframe(app, "local_html_iframe")
    expect(local_html_iframe).not_to_have_attribute("src")
    local_html_box = get_iframe_box(local_html_iframe)
    assert 136 <= local_html_box["height"] <= 144
    assert local_html_box["height"] < 400
    expect(
        app.frame_locator(".st-key-local_html_iframe iframe").locator(
            "#local-html-content"
        )
    ).to_contain_text("Local HTML iframe content")

    content_width_iframe = get_iframe(app, "content_width_iframe")
    content_width_box = get_iframe_box(content_width_iframe)
    assert 176 <= content_width_box["width"] <= 184
    assert content_width_box["width"] < 400
    expect(content_width_iframe).not_to_have_attribute("src")
    expect(
        app.frame_locator(".st-key-content_width_iframe iframe").locator(
            "#width-content-html"
        )
    ).to_contain_text("Width content iframe")


def test_iframe_url_and_non_html_file_sources_use_expected_fallbacks(app: Page):
    """Test that URL and media-backed iframe sources keep the fallback height."""
    expect(app.locator("iframe")).to_have_count(IFRAME_COUNT)

    data_url_iframe = get_iframe(app, "data_url_iframe")
    expect(data_url_iframe).to_have_attribute("src", re.compile(r"^data:text/html,"))
    expect(data_url_iframe).not_to_have_attribute("srcdoc")
    assert 398 <= get_iframe_box(data_url_iframe)["height"] <= 402

    static_url_iframe = get_iframe(app, "static_url_iframe")
    expect(static_url_iframe).to_have_attribute(
        "src", re.compile(r"/app/static/test_iframe\.html$")
    )
    expect(static_url_iframe).not_to_have_attribute("srcdoc")
    assert 398 <= get_iframe_box(static_url_iframe)["height"] <= 402

    local_svg_iframe = get_iframe(app, "local_svg_iframe")
    expect(local_svg_iframe).to_have_attribute("src", re.compile(r"/media/.*\.svg$"))
    expect(local_svg_iframe).not_to_have_attribute("srcdoc")
    assert 398 <= get_iframe_box(local_svg_iframe)["height"] <= 402
