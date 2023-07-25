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


from playwright.sync_api import Page

from conftest import ImageCompareFunction, wait_for_app_run


def test_checkbox_widget_display(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.checkbox renders correctly."""
    checkbox_elements = themed_app.locator(".stCheckbox").all()

    assert len(checkbox_elements) == 8, "Unexpected number of checkbox elements"

    for i, element in enumerate(checkbox_elements):
        assert_snapshot(
            element.screenshot(),
            name=f"checkbox-{i}",
        )


def test_checkbox_initial_values(app: Page):
    """Test that st.checkbox has the correct initial values."""

    markdown_elements = app.locator(".stMarkdown").all_inner_texts()
    texts = [text.strip() for text in markdown_elements]

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

    assert texts == expected, "Initial values do not match expected values."


def test_checkbox_values_on_click(app: Page):
    """Test that st.checkbox updates values correctly when user clicks."""
    checkbox_elements = app.locator(".stCheckbox").all()

    for checkbox_element in checkbox_elements:
        checkbox_element.click(delay=50)
    # The app run needs to finish before we can check the values.
    wait_for_app_run(app)

    markdown_elements = app.locator(".stMarkdown").all_inner_texts()
    texts = [text.strip() for text in markdown_elements]

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
    assert texts == expected, "Post-click values do not match expected values."
