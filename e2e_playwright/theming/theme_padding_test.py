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

"""E2E tests for theme.paddingTop and theme.paddingBottom options.

All tests run under one server config that sets both main and sidebar padding
so that the full feature surface is exercised in a single browser launch.
"""

import os

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import expect_no_skeletons


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_padding():
    """Configure paddingTop/paddingBottom on both [theme] and [theme.sidebar]."""
    os.environ["STREAMLIT_THEME_PADDING_TOP"] = "0rem"
    os.environ["STREAMLIT_THEME_PADDING_BOTTOM"] = "1rem"
    # Sidebar uses distinct values to verify independent override
    os.environ["STREAMLIT_THEME_SIDEBAR_PADDING_BOTTOM"] = "3rem"
    yield
    del os.environ["STREAMLIT_THEME_PADDING_TOP"]
    del os.environ["STREAMLIT_THEME_PADDING_BOTTOM"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_PADDING_BOTTOM"]


@pytest.mark.usefixtures("configure_padding")
def test_configured_padding_applied_to_main_and_sidebar(app: Page):
    """Configured main/sidebar padding replaces built-in insets in one load."""
    expect_no_skeletons(app, timeout=25000)

    main_block = app.get_by_test_id("stMainBlockContainer")
    sidebar_header = app.get_by_test_id("stSidebarHeader")
    sidebar_content = app.get_by_test_id("stSidebarUserContent")

    # padding-top = calc(headerHeight + paddingTop) = calc(3.75rem + 0rem) = 60px
    # (3.75rem x 16px/rem = 60px at the default 16px base font size)
    expect(main_block).to_have_css("padding-top", "60px")

    # paddingBottom=1rem = 16px at 16px base font size (replaces the usual 10rem inset)
    expect(main_block).to_have_css("padding-bottom", "16px")

    # Single-page app has no page nav; inherited paddingTop="0rem" is on header margin
    expect(sidebar_header).to_have_css("margin-bottom", "0px")
    expect(sidebar_content).to_have_css("padding-top", "0px")

    # Sidebar uses the sidebar-specific bottom override (3rem = 48px)
    expect(sidebar_content).to_have_css("padding-bottom", "48px")
