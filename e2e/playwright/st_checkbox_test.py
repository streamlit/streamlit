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

from conftest import ImageCompareFunction


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
        "value 1: True",
        "value 2: False",
        "value 3: False",
        "value 4: False",
        "checkbox clicked: False",
        "value 5: False",
        "value 6: True",
        "value 7: False",
        "value 8: False",
    ]

    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)


def test_checkbox_values_on_click(app: Page):
    """Test that st.checkbox updates values correctly when user clicks."""
    checkbox_elements = app.locator(".stCheckbox")
    expect(checkbox_elements).to_have_count(8)

    for checkbox_element in checkbox_elements.all():
        checkbox_element.click(delay=50)

    markdown_elements = app.locator(".stMarkdown")
    expected = [
        "value 1: False",
        "value 2: True",
        "value 3: True",
        "value 4: True",
        "checkbox clicked: True",
        "value 5: False",
        "value 6: True",
        "value 7: True",
        "value 8: True",
    ]

    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)
