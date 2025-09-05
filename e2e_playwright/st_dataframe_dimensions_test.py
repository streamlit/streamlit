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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import click_button


def test_data_frame_with_different_sizes(app: Page):
    """Test that st.dataframe should show different sizes as expected."""

    expected = [
        {"width": "704px", "height": "400px"},
        {"width": "250px", "height": "150px"},
        {"width": "250px", "height": "400px"},
        {"width": "704px", "height": "150px"},
        {"width": "704px", "height": "5000px"},
        {"width": "704px", "height": "400px"},
        {"width": "500px", "height": "400px"},
        {"width": "704px", "height": "400px"},
        {"width": "704px", "height": "400px"},
        {"width": "200px", "height": "400px"},
        {"width": "704px", "height": "400px"},
        {"width": "229px", "height": "400px"},
        {"width": "704px", "height": "400px"},
        {"width": "200px", "height": "100px"},
        {"width": "704px", "height": "142px"},
        {"width": "229px", "height": "142px"},
        {"width": "400px", "height": "300px"},
    ]

    dataframe_elements = app.get_by_test_id("stDataFrame")
    expect(dataframe_elements).to_have_count(17)

    for i, element in enumerate(dataframe_elements.all()):
        expected_width = expected[i]["width"]
        expected_height = expected[i]["height"]

        # Content width dataframes (indices 11 and 15) can vary between browsers/environments
        # Chromium/Linux CI: 226px, Firefox/WebKit: 229px
        if i in [11, 15]:
            actual_width_str = element.evaluate("el => getComputedStyle(el).width")
            actual_width_px = int(actual_width_str.replace("px", ""))

            assert actual_width_px in [226, 229], (
                f"Content width dataframe {i} has unexpected width {actual_width_px}px, expected 226px or 229px"
            )
        else:
            expect(element).to_have_css("width", expected_width)

        expect(element).to_have_css("height", expected_height)


def test_data_frame_resizing(app: Page):
    """Test that st.dataframe should resize as expected."""

    dataframe_element = app.get_by_test_id("stDataFrame").nth(13)
    expect(dataframe_element).to_have_css("width", "200px")
    expect(dataframe_element).to_have_css("height", "100px")

    click_button(app, "Resize dataframe")
    expect(dataframe_element).to_have_css("width", "400px")
    expect(dataframe_element).to_have_css("height", "200px")


@pytest.mark.flaky(reruns=3)
def test_data_frame_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.dataframe should render as expected with width and height."""
    stretch_dataframe = app.get_by_test_id("stDataFrame").nth(14)
    assert_snapshot(stretch_dataframe, name="st_dataframe-stretch-width")

    content_dataframe_element = app.get_by_test_id("stDataFrame").nth(15)
    assert_snapshot(content_dataframe_element, name="st_dataframe-content-width")

    fixed_dimensions_dataframe_element = app.get_by_test_id("stDataFrame").nth(16)
    assert_snapshot(
        fixed_dimensions_dataframe_element, name="st_dataframe-fixed-dimensions"
    )
