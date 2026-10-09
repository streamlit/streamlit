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
def test_padding_top_applied_to_main_block(app: Page):
    """paddingTop=0rem + visible header bar → padding-top = headerHeight + 0rem = 60px."""
    expect_no_skeletons(app, timeout=25000)

    main_block = app.get_by_test_id("stMainBlockContainer")

    # padding-top = calc(headerHeight + paddingTop) = calc(3.75rem + 0rem) = 60px
    # (3.75rem x 16px/rem = 60px at the default 16px base font size)
    expect(main_block).to_have_css("padding-top", "60px")

    # Default unset path is 6rem = 96px — must NOT appear
    expect(main_block).not_to_have_css("padding-top", "96px")


@pytest.mark.usefixtures("configure_padding")
def test_padding_bottom_applied_to_main_block(app: Page):
    """paddingBottom=1rem overrides the default aesthetic inset on the main area."""
    expect_no_skeletons(app, timeout=25000)

    main_block = app.get_by_test_id("stMainBlockContainer")

    # paddingBottom=1rem = 16px at 16px base font size
    expect(main_block).to_have_css("padding-bottom", "16px")

    # Default unset path (showPadding=False) would be theme.spacing.lg, not 10rem
    expect(main_block).not_to_have_css("padding-bottom", "160px")


@pytest.mark.usefixtures("configure_padding")
def test_sidebar_padding_bottom_override_is_independent(app: Page):
    """[theme.sidebar] paddingBottom overrides the main theme value independently."""
    expect_no_skeletons(app, timeout=25000)

    main_block = app.get_by_test_id("stMainBlockContainer")
    sidebar_content = app.get_by_test_id("stSidebarUserContent")

    # Main block keeps its own value (1rem = 16px)
    expect(main_block).to_have_css("padding-bottom", "16px")

    # Sidebar uses the sidebar-specific override (3rem = 48px)
    expect(sidebar_content).to_have_css("padding-bottom", "48px")
