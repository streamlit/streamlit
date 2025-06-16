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
def configure_sour_gummy_font():
    """Configure Sour Gummy font."""
    os.environ["STREAMLIT_THEME_FONT_FACES"] = json.dumps(
        [
            {
                "family": "SourGummy",
                "url": "./app/static/SourGummy-Normal-Variable.ttf",
                "weight": "100 900",
                "style": "normal",
            },
            {
                "family": "SourGummy",
                "url": "./app/static/SourGummy-Italic-Variable.ttf",
                "weight": "100 900",
                "style": "italic",
            },
            {
                "family": "SourGummyExtreme",
                "url": "./app/static/SourGummy-Thin.ttf",
                "weight": "400",
                "style": "normal",
            },
            {
                "family": "SourGummyExtreme",
                "url": "./app/static/SourGummy-SemiBold.ttf",
                "weight": 700,
                "style": "normal",
            },
            {
                "family": "SourGummyExtreme",
                "url": "./app/static/SourGummy-Light.ttf",
                "weight": "normal",
                "style": "italic",
            },
            {
                "family": "SourGummyExtreme",
                "url": "./app/static/SourGummy-Black.ttf",
                "weight": "bold",
                "style": "italic",
            },
        ]
    )
    os.environ["STREAMLIT_THEME_FONT"] = (
        '"SourGummy", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    )
    os.environ["STREAMLIT_THEME_SIDEBAR_FONT"] = (
        '"SourGummyExtreme", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    )
    os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"] = "16"
    os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"] = "minimal"
    yield
    del os.environ["STREAMLIT_THEME_FONT_FACES"]
    del os.environ["STREAMLIT_THEME_FONT"]
    del os.environ["STREAMLIT_THEME_SIDEBAR_FONT"]
    del os.environ["STREAMLIT_THEME_BASE_FONT_SIZE"]
    del os.environ["STREAMLIT_CLIENT_TOOLBAR_MODE"]


@pytest.mark.usefixtures("configure_sour_gummy_font")
def test_font_weights(app: Page, assert_snapshot: ImageCompareFunction):
    # Make sure that all elements are rendered and no skeletons are shown
    expect(app.get_by_test_id("stSkeleton")).to_have_count(0, timeout=25000)

    # Verify SourGummy font is loaded
    expect_font(app, "SourGummy", style="normal")
    expect_font(app, "SourGummy", style="italic")

    # Verify SourGummyExtreme font is loaded
    expect_font(app, "SourGummyExtreme", style="normal", weight="normal")
    expect_font(app, "SourGummyExtreme", style="normal", weight="bold")
    expect_font(app, "SourGummyExtreme", style="italic", weight="normal")
    expect_font(app, "SourGummyExtreme", style="italic", weight="bold")

    assert_snapshot(app, name="font_weight-font_weights")
