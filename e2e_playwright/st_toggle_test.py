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


def test_toggle_widget_display(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.toggle renders correctly."""
    toggle_elements = themed_app.locator(".stCheckbox")
    expect(toggle_elements).to_have_count(8)

    for i, element in enumerate(toggle_elements.all()):
        assert_snapshot(element, name=f"toggle-{i}")


def test_toggle_initial_values(app: Page):
    """Test that st.toggle has the correct initial values."""
    markdown_elements = app.locator(".stMarkdown")
    expect(markdown_elements).to_have_count(9)

    expected = [
        "toggle 1 - value: True",
        "toggle 2 - value: False",
        "toggle 3 - value: False",
        "toggle 4 - value: False",
        "toggle 4 - clicked: False",
        "toggle 5 - value: False",
        "toggle 6 - value: True",
        "toggle 7 - value: False",
        "toggle 8 - value: False",
    ]

    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)


def test_toggle_values_on_click(app: Page):
    """Test that st.toggle updates values correctly when user clicks."""
    toggle_elements = app.locator(".stCheckbox")
    expect(toggle_elements).to_have_count(8)

    for toggle_element in toggle_elements.all():
        toggle_element.click(delay=50)
        wait_for_app_run(app)

    markdown_elements = app.locator(".stMarkdown")
    expected = [
        "toggle 1 - value: False",
        "toggle 2 - value: True",
        "toggle 3 - value: True",
        "toggle 4 - value: True",
        "toggle 4 - clicked: True",
        "toggle 5 - value: False",
        "toggle 6 - value: True",
        "toggle 7 - value: True",
        "toggle 8 - value: True",
    ]

    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)
