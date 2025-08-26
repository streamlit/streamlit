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
def configure_custom_fonts():
    """Configure custom theme."""
    os.environ["STREAMLIT_THEME_FONT"] = (
        # Google Fonts option
        "Mozilla Headline:https://fonts.googleapis.com/css2?family=Mozilla+Headline&display=swap"
    )
    os.environ["STREAMLIT_THEME_CODE_FONT"] = (
        # Adobe Fonts option
        "playwrite-cc-za:https://use.typekit.net/eor5wum.css"
    )
    os.environ["STREAMLIT_THEME_HEADING_FONT"] = (
        # Adobe Fonts option - case-insensitive
        "FLEGREI:https://use.typekit.net/zru6msp.css"
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_FONT"] = (
        "Ojuju:https://fonts.googleapis.com/css2?family=Ojuju:wght@200..800&display=swap"
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_CODE_FONT"] = (
        "Rubik Distressed:https://fonts.googleapis.com/css2?family=Rubik+Distressed&display=swap"
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_HEADING_FONT"] = (
        "Oswald:https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap"
    )
    yield
    del os.environ["STREAMLIT_THEME_FONT"]
    del os.environ["STREAMLIT_THEME_CODE_FONT"]
    del os.environ["STREAMLIT_THEME_HEADING_FONT"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_FONT"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_CODE_FONT"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_HEADING_FONT"]


@pytest.mark.usefixtures("configure_custom_fonts")
def test_custom_theme(app: Page, assert_snapshot: ImageCompareFunction):
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)
    # Add some additional timeout to ensure that fonts can load without
    # creating flakiness:
    app.wait_for_timeout(10000)

    assert_snapshot(app, name="custom_fonts_app", image_threshold=0.0003)
