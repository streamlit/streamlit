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
def configure_custom_theme():
    """Configure custom theme."""
    os.environ["STREAMLIT_THEME_BASE"] = "dark"
    os.environ["STREAMLIT_THEME_PRIMARY_COLOR"] = "#1BD760"
    os.environ["STREAMLIT_THEME_BACKGROUND_COLOR"] = "#001200"
    os.environ["STREAMLIT_THEME_SECONDARY_BACKGROUND_COLOR"] = "#03200C"
    os.environ["STREAMLIT_THEME_TEXT_COLOR"] = "#DFFDE0"
    os.environ["STREAMLIT_THEME_BASE_RADIUS"] = "1.2rem"
    os.environ["STREAMLIT_THEME_BUTTON_RADIUS"] = "0.57rem"
    os.environ["STREAMLIT_THEME_BORDER_COLOR"] = "#0B4C0B"
    os.environ["STREAMLIT_THEME_SHOW_WIDGET_BORDER"] = "True"
    os.environ["STREAMLIT_THEME_LINK_COLOR"] = "#2EC163"
    os.environ["STREAMLIT_THEME_CODE_BACKGROUND_COLOR"] = "#29361e"
    os.environ["STREAMLIT_THEME_SHOW_SIDEBAR_BORDER"] = "True"
    os.environ["STREAMLIT_THEME_HEADING_FONT"] = "bold, serif"
    os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"] = "minimal"
    yield
    del os.environ["STREAMLIT_THEME_BASE"]
    del os.environ["STREAMLIT_THEME_PRIMARY_COLOR"]
    del os.environ["STREAMLIT_THEME_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SECONDARY_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_BASE_RADIUS"]
    del os.environ["STREAMLIT_THEME_BUTTON_RADIUS"]
    del os.environ["STREAMLIT_THEME_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_SHOW_WIDGET_BORDER"]
    del os.environ["STREAMLIT_THEME_LINK_COLOR"]
    del os.environ["STREAMLIT_THEME_CODE_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SHOW_SIDEBAR_BORDER"]
    del os.environ["STREAMLIT_THEME_HEADING_FONT"]
    del os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"]


@pytest.mark.usefixtures("configure_custom_theme")
def test_custom_theme(app: Page, assert_snapshot: ImageCompareFunction):
    # Make sure that all elements are rendered and no skeletons are shown:
    expect(app.get_by_test_id("stSkeleton")).to_have_count(0, timeout=25000)
    # Add some additional timeout to ensure that fonts can load without
    # creating flakiness:
    app.wait_for_timeout(10000)
    assert_snapshot(app, name="custom_themed_app", image_threshold=0.0003)
