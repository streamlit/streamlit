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
from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import expect_no_skeletons


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_custom_theme_text_colors():
    """Configure custom theme text colors."""
    # Background colors
    os.environ["STREAMLIT_THEME_RED_TEXT_COLOR"] = "#e74c3c"
    os.environ["STREAMLIT_THEME_ORANGE_TEXT_COLOR"] = "#f39c12"
    os.environ["STREAMLIT_THEME_YELLOW_TEXT_COLOR"] = "#f1c40f"
    os.environ["STREAMLIT_THEME_BLUE_TEXT_COLOR"] = "#3498db"
    os.environ["STREAMLIT_THEME_GREEN_TEXT_COLOR"] = "#27ae60"
    os.environ["STREAMLIT_THEME_VIOLET_TEXT_COLOR"] = "#9b59b6"
    os.environ["STREAMLIT_THEME_GRAY_TEXT_COLOR"] = "#7f8c8d"
    os.environ["STREAMLIT_THEME_SIDEBAR_RED_TEXT_COLOR"] = "#dc3545"
    os.environ["STREAMLIT_THEME_SIDEBAR_ORANGE_TEXT_COLOR"] = "#fd7e14"
    os.environ["STREAMLIT_THEME_SIDEBAR_YELLOW_TEXT_COLOR"] = "#ffc107"
    os.environ["STREAMLIT_THEME_SIDEBAR_BLUE_TEXT_COLOR"] = "#007bff"
    os.environ["STREAMLIT_THEME_SIDEBAR_GREEN_TEXT_COLOR"] = "#28a745"
    os.environ["STREAMLIT_THEME_SIDEBAR_VIOLET_TEXT_COLOR"] = "#6f42c1"
    os.environ["STREAMLIT_THEME_SIDEBAR_GRAY_TEXT_COLOR"] = "#6c757d"
    yield
    del os.environ["STREAMLIT_THEME_RED_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_ORANGE_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_YELLOW_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_BLUE_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_GREEN_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_VIOLET_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_GRAY_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_RED_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_ORANGE_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_YELLOW_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_BLUE_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_GREEN_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_VIOLET_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_GRAY_TEXT_COLOR"]


@pytest.mark.usefixtures("configure_custom_theme_text_colors")
def test_custom_theme_text_colors(app: Page, assert_snapshot: ImageCompareFunction):
    # Set bigger viewport to better show app content
    app.set_viewport_size({"width": 1280, "height": 1000})
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    assert_snapshot(app, name="custom_text_colors_app", image_threshold=0.0003)
