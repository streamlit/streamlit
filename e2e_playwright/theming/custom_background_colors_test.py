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
def configure_custom_theme_background_colors():
    """Configure custom theme background colors."""
    # Also set some main colors for better contrast with background colors
    os.environ["STREAMLIT_THEME_RED_COLOR"] = "#750000"
    os.environ["STREAMLIT_THEME_GREEN_COLOR"] = "#008000"
    os.environ["STREAMLIT_THEME_GRAY_COLOR"] = "#525252"

    # Background colors
    os.environ["STREAMLIT_THEME_RED_BACKGROUND_COLOR"] = "#ffc7c7"
    os.environ["STREAMLIT_THEME_ORANGE_BACKGROUND_COLOR"] = "#fdae44"
    os.environ["STREAMLIT_THEME_YELLOW_BACKGROUND_COLOR"] = "#fde992"
    os.environ["STREAMLIT_THEME_BLUE_BACKGROUND_COLOR"] = "#6495ED"
    os.environ["STREAMLIT_THEME_GREEN_BACKGROUND_COLOR"] = "#9dc183"
    os.environ["STREAMLIT_THEME_VIOLET_BACKGROUND_COLOR"] = "#9E7BB5"
    os.environ["STREAMLIT_THEME_GRAY_BACKGROUND_COLOR"] = "#A7A6BA"
    os.environ["STREAMLIT_THEME_SIDEBAR_RED_BACKGROUND_COLOR"] = "#9d2933"
    os.environ["STREAMLIT_THEME_SIDEBAR_ORANGE_BACKGROUND_COLOR"] = "#fed8b1"
    os.environ["STREAMLIT_THEME_SIDEBAR_YELLOW_BACKGROUND_COLOR"] = "#ffffe0"
    os.environ["STREAMLIT_THEME_SIDEBAR_BLUE_BACKGROUND_COLOR"] = "#87afc7"
    os.environ["STREAMLIT_THEME_SIDEBAR_GREEN_BACKGROUND_COLOR"] = "#d8e4bc"
    os.environ["STREAMLIT_THEME_SIDEBAR_VIOLET_BACKGROUND_COLOR"] = "#D8BFD8"
    os.environ["STREAMLIT_THEME_SIDEBAR_GRAY_BACKGROUND_COLOR"] = "#DCDCDC"
    yield
    del os.environ["STREAMLIT_THEME_RED_COLOR"]
    del os.environ["STREAMLIT_THEME_GREEN_COLOR"]
    del os.environ["STREAMLIT_THEME_GRAY_COLOR"]
    del os.environ["STREAMLIT_THEME_RED_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_ORANGE_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_YELLOW_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_BLUE_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_GREEN_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_VIOLET_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_GRAY_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_RED_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_ORANGE_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_YELLOW_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_BLUE_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_GREEN_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_VIOLET_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_GRAY_BACKGROUND_COLOR"]


@pytest.mark.usefixtures("configure_custom_theme_background_colors")
def test_custom_theme_background_colors(
    app: Page, assert_snapshot: ImageCompareFunction
):
    # Set bigger viewport to better show app content
    app.set_viewport_size({"width": 1280, "height": 1000})
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    assert_snapshot(app, name="custom_background_colors_app", image_threshold=0.0003)
