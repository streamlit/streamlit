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
from e2e_playwright.shared.app_utils import expect_no_skeletons, reset_hovering


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_custom_sequential_colors():
    """Configure custom theme."""
    os.environ["STREAMLIT_THEME_CHART_SEQUENTIAL_COLORS"] = json.dumps(
        [
            "#bad0e4",
            "#a8c2dd",
            "#9ab0d4",
            "#919cc9",
            "#8d85be",
            "#8b6db2",
            "#8a55a6",
            "#873c99",
            "#822287",
            "#6a00a8",
        ]
    )
    yield
    del os.environ["STREAMLIT_THEME_CHART_SEQUENTIAL_COLORS"]


@pytest.mark.usefixtures("configure_custom_sequential_colors")
def test_custom_sequential_colors(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that custom sequential colors are correctly applied to charts."""
    # Set bigger viewport to better show the charts
    app.set_viewport_size({"width": 1280, "height": 1000})
    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app, timeout=25000)
    # Reset hovering to avoid flakiness from plotly toolbar
    reset_hovering(app)
    # Add some additional timeout to ensure that fonts can load without
    # creating flakiness:
    app.wait_for_timeout(10000)

    assert_snapshot(app, name="custom_sequential_colors", image_threshold=0.0003)
