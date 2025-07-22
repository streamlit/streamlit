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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def test_html_resizes(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that html renders correctly using snapshot testing."""
    html_elements = app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(1)
    first_html = html_elements.nth(0)

    assert_snapshot(first_html, name="st_html_wide_mode-sidebar_open")

    # Collapse the sidebar
    app.get_by_test_id("stSidebarContent").hover()
    app.get_by_test_id("stSidebarCollapseButton").locator("button").click()
    # Wait for the sidebar animations to complete
    app.wait_for_timeout(1000)

    assert_snapshot(first_html, name="st_html_wide_mode-sidebar_closed")
