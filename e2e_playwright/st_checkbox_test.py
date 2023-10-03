# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def test_checkbox_widget_display(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.checkbox renders correctly."""
    checkbox_elements = themed_app.locator(".stCheckbox")
    expect(checkbox_elements).to_have_count(8)

    for i, element in enumerate(checkbox_elements.all()):
        assert_snapshot(element, name=f"checkbox-{i}")


def test_checkbox_initial_values(app: Page):
    """Test that st.checkbox has the correct initial values."""
    markdown_elements = app.locator(".stMarkdown")
    expect(markdown_elements).to_have_count(9)

    expected = [
        "checkbox 1 - value: True",
        "checkbox 2 - value: False",
        "checkbox 3 - value: False",
        "checkbox 4 - value: False",
        "checkbox 4 - clicked: False",
        "checkbox 5 - value: False",
        "checkbox 6 - value: True",
        "checkbox 7 - value: False",
        "checkbox 8 - value: False",
    ]

    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)


def test_checkbox_values_on_click(app: Page):
    """Test that st.checkbox updates values correctly when user clicks."""
    checkbox_elements = app.locator(".stCheckbox")
    expect(checkbox_elements).to_have_count(8)

    for checkbox_element in checkbox_elements.all():
        checkbox_element.click(delay=50)
        wait_for_app_run(app)

    markdown_elements = app.locator(".stMarkdown")
    expected = [
        "checkbox 1 - value: False",
        "checkbox 2 - value: True",
        "checkbox 3 - value: True",
        "checkbox 4 - value: True",
        "checkbox 4 - clicked: True",
        "checkbox 5 - value: False",
        "checkbox 6 - value: True",
        "checkbox 7 - value: True",
        "checkbox 8 - value: True",
    ]

    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)
