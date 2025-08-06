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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import click_button


def test_data_frame_with_different_sizes(app: Page):
    """Test that st.dataframe should show different sizes as expected."""

    # Mock the document font size to ensure consistent behavior across environments
    # This prevents content width calculations from varying due to browser font size differences
    app.add_init_script("""
        // Mock getComputedStyle to return consistent 16px font size for document element
        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = function(element, pseudoElement) {
            const computedStyle = originalGetComputedStyle.call(this, element, pseudoElement);
            if (element === document.documentElement) {
                // Return a proxy that overrides fontSize property
                return new Proxy(computedStyle, {
                    get(target, prop) {
                        if (prop === 'fontSize') {
                            return '16px';
                        }
                        return target[prop];
                    }
                });
            }
            return computedStyle;
        };
    """)

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
        {"width": "704px", "height": "3537px"},
        {"width": "704px", "height": "142px"},
        {"width": "229px", "height": "142px"},
        {"width": "400px", "height": "300px"},
    ]

    dataframe_elements = app.get_by_test_id("stDataFrame")
    expect(dataframe_elements).to_have_count(18)

    for i, element in enumerate(dataframe_elements.all()):
        expect(element).to_have_css("width", expected[i]["width"])
        expect(element).to_have_css("height", expected[i]["height"])


def test_data_frame_resizing(app: Page):
    """Test that st.dataframe should resize as expected."""

    dataframe_element = app.get_by_test_id("stDataFrame").nth(13)
    expect(dataframe_element).to_have_css("width", "200px")
    expect(dataframe_element).to_have_css("height", "100px")

    click_button(app, "Resize dataframe")
    expect(dataframe_element).to_have_css("width", "400px")
    expect(dataframe_element).to_have_css("height", "200px")


def test_data_frame_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.dataframe should render as expected with width and height."""
    stretch_dataframe = app.get_by_test_id("stDataFrame").nth(15)
    assert_snapshot(stretch_dataframe, name="stretch_dataframe")

    content_dataframe_element = app.get_by_test_id("stDataFrame").nth(16)
    assert_snapshot(content_dataframe_element, name="content_dataframe")

    fixed_dimensions_dataframe_element = app.get_by_test_id("stDataFrame").nth(17)
    assert_snapshot(
        fixed_dimensions_dataframe_element, name="fixed_dimensions_dataframe"
    )
