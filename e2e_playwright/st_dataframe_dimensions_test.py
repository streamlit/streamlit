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

from playwright.sync_api import Page, expect

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
        {"width": "200px", "height": "100px"},
    ]

    dataframe_elements = app.get_by_test_id("stDataFrame")
    expect(dataframe_elements).to_have_count(12)

    for i, element in enumerate(dataframe_elements.all()):
        expect(element).to_have_css("width", expected[i]["width"])
        expect(element).to_have_css("height", expected[i]["height"])


def test_data_frame_resizing(app: Page):
    """Test that st.dataframe should resize as expected."""

    dataframe_element = app.get_by_test_id("stDataFrame").nth(11)
    expect(dataframe_element).to_have_css("width", "200px")
    expect(dataframe_element).to_have_css("height", "100px")

    click_button(app, "Resize dataframe")
    expect(dataframe_element).to_have_css("width", "400px")
    expect(dataframe_element).to_have_css("height", "200px")
