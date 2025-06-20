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


import json
import os

import pytest
from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import expect_font, expect_no_skeletons


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_tagesschrift_font():
    """Configure Tagesschrift font with basic and extended latin characters."""
    os.environ["STREAMLIT_THEME_FONT_FACES"] = json.dumps(
        [
            {
                "family": "Tagesschrift",
                "url": "./app/static/Tagesschrift-basic-latin.woff2",
                "weight": 400,
                "style": "normal",
                "unicode_range": (
                    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, "
                    "U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, "
                    "U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
                ),
            },
            {
                "family": "Tagesschrift",
                "url": "./app/static/Tagesschrift-extended-latin.woff2",
                "weight": 400,
                "style": "normal",
                "unicode_range": (
                    "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, "
                    "U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, "
                    "U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"
                ),
            },
            {
                "family": "Chimera",
                "url": "./app/static/NotoSans-only-letters_and_numbers.woff2",
                "unicode_range": "U+0000-0040",
            },
            {
                "family": "Chimera",
                "url": "./app/static/SourGummy-Normal-Variable.ttf",
                "unicode_range": "U+0041-10FFFF",
            },
        ]
    )
    os.environ["STREAMLIT_THEME_FONT"] = (
        '"Tagesschrift", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_FONT"] = (
        '"Chimera", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    )
    os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"] = "16"
    os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"] = "minimal"
    yield
    del os.environ["STREAMLIT_THEME_FONT_FACES"]
    del os.environ["STREAMLIT_THEME_FONT"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_FONT"]
    del os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"]
    del os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"]


@pytest.mark.usefixtures("configure_tagesschrift_font")
def test_font_unicode_ranges(app: Page, assert_snapshot: ImageCompareFunction):
    # Make sure that all elements are rendered and no skeletons are shown
    expect_no_skeletons(app, timeout=25000)

    # Verify Tagesschrift font is loaded
    expect_font(app, "Tagesschrift")

    # Verify Chimera font is loaded
    expect_font(app, "Chimera")

    assert_snapshot(app, name="font_unicode_range-font_unicode_ranges")
