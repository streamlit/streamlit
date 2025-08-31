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
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import expect_font


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_snowflake_dark_theme():
    """Configure snowflake dark theme."""
    os.environ["STREAMLIT_THEME_BASE"] = "dark"
    os.environ["STREAMLIT_THEME_PRIMARY_COLOR"] = "#004cbe"
    os.environ["STREAMLIT_THEME_BACKGROUND_COLOR"] = "#191e24"
    os.environ["STREAMLIT_THEME_SECONDARY_BACKGROUND_COLOR"] = "#0f161e"
    os.environ["STREAMLIT_THEME_TEXT_COLOR"] = "#bdc4d5"
    os.environ["STREAMLIT_THEME_BORDER_COLOR"] = "#293246"
    os.environ["STREAMLIT_THEME_SHOW_BORDER_AROUND_INPUTS"] = "True"
    os.environ["STREAMLIT_THEME_FONT_FACES"] = json.dumps(
        [
            {
                "family": "Inter",
                "url": "./app/static/Inter-Regular.woff2",
                "weight": 400,
            },
            {
                "family": "Inter",
                "url": "./app/static/Inter-SemiBold.woff2",
                "weight": 600,
            },
            {
                "family": "Inter",
                "url": "./app/static/Inter-Bold.woff2",
                "weight": 700,
            },
            {
                "family": "Inter",
                "url": "./app/static/Inter-Black.woff2",
                "weight": 900,
            },
            {
                "family": "Monaspace Argon",
                "url": "https://raw.githubusercontent.com/githubnext/monaspace/refs/heads/main/fonts/webfonts/MonaspaceArgon-Regular.woff2",
                "weight": 400,
            },
            {
                "family": "Monaspace Argon",
                "url": "https://raw.githubusercontent.com/githubnext/monaspace/refs/heads/main/fonts/webfonts/MonaspaceArgon-Medium.woff2",
                "weight": 500,
            },
            {
                "family": "Monaspace Argon",
                "url": "https://raw.githubusercontent.com/githubnext/monaspace/refs/heads/main/fonts/webfonts/MonaspaceArgon-Bold.woff2",
                "weight": 700,
            },
        ]
    )
    os.environ["STREAMLIT_THEME_FONT"] = (
        "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
    )
    os.environ["STREAMLIT_THEME_HEADING_FONT"] = (
        "bold Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
    )
    os.environ["STREAMLIT_THEME_CODE_FONT"] = (
        '"Monaspace Argon", Menlo, Monaco, Consolas, "Courier New", monospace'
    )
    os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"] = "minimal"
    os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"] = "14"
    os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"] = "minimal"
    yield
    del os.environ["STREAMLIT_THEME_BASE"]
    del os.environ["STREAMLIT_THEME_PRIMARY_COLOR"]
    del os.environ["STREAMLIT_THEME_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_SECONDARY_BACKGROUND_COLOR"]
    del os.environ["STREAMLIT_THEME_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_BORDER_COLOR"]
    del os.environ["STREAMLIT_THEME_SHOW_BORDER_AROUND_INPUTS"]
    del os.environ["STREAMLIT_THEME_FONT_FACES"]
    del os.environ["STREAMLIT_THEME_FONT"]
    del os.environ["STREAMLIT_THEME_HEADING_FONT"]
    del os.environ["STREAMLIT_THEME_CODE_FONT"]
    del os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"]
    del os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"]


@pytest.mark.usefixtures("configure_snowflake_dark_theme")
def test_snowflake_dark_theme(app: Page, assert_snapshot: ImageCompareFunction):
    # Make sure that all elements are rendered and no skeletons are shown:
    expect(app.get_by_test_id("stSkeleton")).to_have_count(0, timeout=25000)
    # Add some additional timeout to ensure that fonts can load without
    # creating flakiness:
    app.wait_for_timeout(5000)
    expect_font(app, "Inter")
    expect_font(app, "bold Inter")
    expect_font(app, "Monaspace Argon")
    assert_snapshot(app, name="snowflake_dark_theme")
