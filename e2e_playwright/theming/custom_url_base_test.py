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
from e2e_playwright.shared.app_utils import expect_font, expect_no_skeletons

# ruff: noqa: ERA001
# The theme.base points to a toml file hosted on our streamlit s3 bucket
# It has the following fields set:
# [theme]
# base = "light"
# font = "Ojuju:https://fonts.googleapis.com/css2?family=Ojuju:wght@200..800&display=swap"
# primaryColor = "#0013de" # blue
# secondaryBackgroundColor = "#d8e4ee"  # light grayish blue
# textColor = "#05014a" # dark blue
# [theme.sidebar]
# linkColor = "#FF7518" # Pumpkin orange


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_base_and_config_custom_theme():
    """Configure custom theme - with base pointing to url and config overrides."""
    os.environ["STREAMLIT_THEME_BASE"] = "https://data.streamlit.io/corporate.toml"
    os.environ["STREAMLIT_THEME_LINK_COLOR"] = "#CD1C18"  # Chili red
    os.environ["STREAMLIT_THEME_CODE_BACKGROUND_COLOR"] = (
        "#eeeaef"  # Light grayish purple
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_FONT"] = (
        "Oswald:https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap"
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_LINK_COLOR"] = "#7851A9"  # Royal purple

    yield
    del os.environ["STREAMLIT_THEME_BASE"]
    del os.environ["STREAMLIT_THEME_LINK_COLOR"]
    del os.environ["STREAMLIT_THEME_CODE_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_FONT"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_LINK_COLOR"]


@pytest.mark.usefixtures("configure_base_and_config_custom_theme")
def test_custom_theme_with_url_base(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that custom theme with theme.base = <url> loads correctly and applies theme inheritance."""

    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)

    # Verify that fonts from external TOML file have loaded:
    expect_font(app, "Ojuju", style="normal")

    # Verify that fonts from local config overrides have loaded:
    expect_font(app, "Oswald", style="normal")

    assert_snapshot(app, name="custom_theme_with_url_base", image_threshold=0.0003)
