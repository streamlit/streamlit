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

    # Mock scrollbar measurements to ensure consistent behavior across environments
    # Different OS/browsers have different scrollbar widths which affects content width calculations
    app.add_init_script("""
        // Override scrollbar measurement to simulate overlay scrollbars (0px width)
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
            const element = originalCreateElement.call(this, tagName);
            if (tagName === 'div') {
                const originalAppendChild = element.appendChild;
                element.appendChild = function(child) {
                    const result = originalAppendChild.call(this, child);
                    // When measuring scrollbar width, make it appear as 0px (overlay scrollbars)
                    if (this.style.overflow === 'scroll' && this.style.position === 'absolute') {
                        Object.defineProperty(this, 'offsetWidth', {
                            get: function() { return 50; },
                            configurable: true
                        });
                        Object.defineProperty(child, 'offsetWidth', {
                            get: function() { return 50; },
                            configurable: true
                        });
                    }
                    return result;
                };
            }
            return element;
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
