# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from e2e_playwright.shared.app_utils import expect_help_tooltip, get_expander

CHECKBOX_ELEMENTS = 11


def test_checkbox_widget_display(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.checkbox renders correctly."""
    checkbox_elements = themed_app.get_by_test_id("stCheckbox")
    expect(checkbox_elements).to_have_count(CHECKBOX_ELEMENTS)

    assert_snapshot(checkbox_elements.nth(0), name="st_checkbox-true")
    assert_snapshot(checkbox_elements.nth(1), name="st_checkbox-false")
    assert_snapshot(checkbox_elements.nth(2), name="st_checkbox-long_label")
    assert_snapshot(checkbox_elements.nth(3), name="st_checkbox-callback")
    assert_snapshot(checkbox_elements.nth(4), name="st_checkbox-false_disabled")
    assert_snapshot(checkbox_elements.nth(5), name="st_checkbox-true_disabled")
    assert_snapshot(checkbox_elements.nth(6), name="st_checkbox-hidden_label")
    assert_snapshot(checkbox_elements.nth(7), name="st_checkbox-collapsed_label")


def test_help_tooltip_works(app: Page):
    leading_indent_code_tooltip = """
    Code:

        This
        is
        a
        code
        block!"""
    element_with_help = app.get_by_test_id("stCheckbox").nth(0)
    expect_help_tooltip(app, element_with_help, leading_indent_code_tooltip)


def test_checkbox_initial_values(app: Page):
    """Test that st.checkbox has the correct initial values."""
    markdown_elements = app.get_by_test_id("stMarkdown")
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
    checkbox_elements = app.get_by_test_id("stCheckbox")
    expect(checkbox_elements).to_have_count(CHECKBOX_ELEMENTS)

    for checkbox_element in checkbox_elements.all():
        # Not sure if this is needed, but somehow it is slightly
        # flaky with the last checkbox without it.
        # It seems that it sometimes fails to click,
        # and in these cases the checkbox was not scrolled into view.
        # So, maybe thats the reason why it fails to click it.
        # But this is just a guess.
        checkbox_element.scroll_into_view_if_needed()
        checkbox_element.locator("label").first.click(delay=50, force=True)
        wait_for_app_run(app)

    markdown_elements = app.get_by_test_id("stMarkdown")
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


def test_grouped_checkboxes_height(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that grouped checkboxes have the correct height."""

    expander_details = get_expander(app, "Grouped checkboxes").get_by_test_id(
        "stExpanderDetails"
    )
    expect(expander_details.get_by_test_id("stCheckbox")).to_have_count(3)
    assert_snapshot(expander_details, name="st_checkbox-grouped_styling")
    expect(expander_details.get_by_test_id("stCheckbox").nth(0)).to_have_css(
        "height", "24px"
    )
