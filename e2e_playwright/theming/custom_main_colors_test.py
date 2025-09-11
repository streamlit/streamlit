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
def configure_custom_theme_colors():
    """Configure custom theme colors."""
    os.environ["STREAMLIT_THEME_RED_COLOR"] = "#7d353b"
    os.environ["STREAMLIT_THEME_ORANGE_COLOR"] = "#d95a00"
    os.environ["STREAMLIT_THEME_YELLOW_COLOR"] = "#916e10"
    os.environ["STREAMLIT_THEME_BLUE_COLOR"] = "#004280"
    os.environ["STREAMLIT_THEME_GREEN_COLOR"] = "#177233"
    os.environ["STREAMLIT_THEME_VIOLET_COLOR"] = "#583f84"
    os.environ["STREAMLIT_THEME_GRAY_COLOR"] = "#0e1117"
    os.environ["STREAMLIT_THEME_SIDEBAR_RED_COLOR"] = "#ffc7c7"
    os.environ["STREAMLIT_THEME_SIDEBAR_ORANGE_COLOR"] = "#ffd16a"
    os.environ["STREAMLIT_THEME_SIDEBAR_YELLOW_COLOR"] = "#ffffa0"
    os.environ["STREAMLIT_THEME_SIDEBAR_BLUE_COLOR"] = "#a6dcff"
    os.environ["STREAMLIT_THEME_SIDEBAR_GREEN_COLOR"] = "#9ef6bb"
    os.environ["STREAMLIT_THEME_SIDEBAR_VIOLET_COLOR"] = "#dbbbff"
    os.environ["STREAMLIT_THEME_SIDEBAR_GRAY_COLOR"] = "#e6eaf1"

    # Since main colors are configured, these are used to derive background
    # and text colors as well
    yield
    del os.environ["STREAMLIT_THEME_RED_COLOR"]
    del os.environ["STREAMLIT_THEME_ORANGE_COLOR"]
    del os.environ["STREAMLIT_THEME_YELLOW_COLOR"]
    del os.environ["STREAMLIT_THEME_BLUE_COLOR"]
    del os.environ["STREAMLIT_THEME_GREEN_COLOR"]
    del os.environ["STREAMLIT_THEME_VIOLET_COLOR"]
    del os.environ["STREAMLIT_THEME_GRAY_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_RED_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_ORANGE_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_YELLOW_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_BLUE_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_GREEN_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_VIOLET_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_GRAY_COLOR"]


@pytest.mark.usefixtures("configure_custom_theme_colors")
def test_custom_theme_colors(app: Page, assert_snapshot: ImageCompareFunction):
    # Set bigger viewport to better show app content
    app.set_viewport_size({"width": 1280, "height": 1000})
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    assert_snapshot(app, name="custom_main_colors_app", image_threshold=0.0003)
