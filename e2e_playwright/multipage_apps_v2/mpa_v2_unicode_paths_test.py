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

"""Tests for browser navigation with Unicode URL paths.

Regression tests for https://github.com/streamlit/streamlit/issues/15267
"""

from __future__ import annotations

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import build_app_url, wait_for_app_loaded
from e2e_playwright.shared.app_utils import goto_app

UNICODE_PAGE_TITLE = "Págé_Wíth_Spêcîãl_Chäracters"


def test_browser_back_forward_with_unicode_url_path(app: Page):
    """Test browser Back/Forward navigation works with Unicode URL paths.

    Regression test for https://github.com/streamlit/streamlit/issues/15267.
    Browsers encode Unicode in URLs (e.g., "Págé" becomes "P%C3%A1g%C3%A9").
    The frontend must decode the pathname before matching against page routes.
    """
    expect(app.get_by_role("heading", name="Home")).to_be_visible()

    # Navigate to the Unicode page via sidebar
    app.get_by_test_id("stSidebarNav").get_by_role(
        "link", name=UNICODE_PAGE_TITLE
    ).click()
    wait_for_app_loaded(app)
    expect(app.get_by_role("heading", name=UNICODE_PAGE_TITLE)).to_be_visible()

    # Browser Back should return to home
    app.go_back()
    wait_for_app_loaded(app)
    expect(app.get_by_role("heading", name="Home")).to_be_visible()

    # Browser Forward should restore the Unicode page (not fall back to home)
    app.go_forward()
    wait_for_app_loaded(app)
    expect(app.get_by_role("heading", name=UNICODE_PAGE_TITLE)).to_be_visible()
    expect(app.get_by_role("heading", name="Home")).not_to_be_visible()


def test_direct_navigation_to_unicode_url_path(app: Page, app_base_url: str):
    """Test direct URL navigation works with Unicode URL paths."""
    goto_app(app, build_app_url(app_base_url, path=f"/{UNICODE_PAGE_TITLE}"))
    expect(app.get_by_role("heading", name=UNICODE_PAGE_TITLE)).to_be_visible()
