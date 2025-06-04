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


import os

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_sidebar_custom_theme():
    """Configure sidebar custom theme."""
    os.environ["STREAMLIT_THEME_BASE"] = "light"
    os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"] = "14"
    os.environ["STREAMLIT_THEME_BASE_RADIUS"] = "full"
    os.environ["STREAMLIT_THEME_SHOW_WIDGET_BORDER"] = "True"
    os.environ["STREAMLIT_THEME_SIDEBAR_BACKGROUND_COLOR"] = "black"
    os.environ["STREAMLIT_THEME_SIDEBAR_BASE_RADIUS"] = "none"
    os.environ["STREAMLIT_THEME_SIDEBAR_BUTTON_RADIUS"] = "small"
    os.environ["STREAMLIT_THEME_SIDEBAR_BORDER_COLOR"] = "white"
    os.environ["STREAMLIT_THEME_SIDEBAR_DATAFRAME_BORDER_COLOR"] = "orange"
    os.environ["STREAMLIT_THEME_SIDEBAR_HEADING_FONT"] = "bold, serif"
    os.environ["STREAMLIT_THEME_SIDEBAR_LINK_COLOR"] = "#90EE90"
    os.environ["STREAMLIT_THEME_SIDEBAR_PRIMARY_COLOR"] = "blue"
    os.environ["STREAMLIT_THEME_SIDEBAR_SECONDARY_BACKGROUND_COLOR"] = "#222222"
    os.environ["STREAMLIT_THEME_SIDEBAR_TEXT_COLOR"] = "white"
    os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"] = "minimal"
    yield
    del os.environ["STREAMLIT_THEME_BASE"]
    del os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"]
    del os.environ["STREAMLIT_THEME_BASE_RADIUS"]
    del os.environ["STREAMLIT_THEME_SHOW_WIDGET_BORDER"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_BASE_RADIUS"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_BUTTON_RADIUS"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_DATAFRAME_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_HEADING_FONT"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_LINK_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_PRIMARY_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_SECONDARY_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_TEXT_COLOR"]
    del os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"]


@pytest.mark.usefixtures("configure_sidebar_custom_theme")
def test_sidebar_custom_theme(app: Page, assert_snapshot: ImageCompareFunction):
    # Make sure that all elements are rendered and no skeletons are shown:
    expect(app.get_by_test_id("stSkeleton")).to_have_count(0, timeout=25000)

    # Add some additional timeout to ensure that fonts can load without
    # creating flakiness:
    app.wait_for_timeout(5000)
    assert_snapshot(app, name="sidebar_custom_theme", image_threshold=0.0003)
