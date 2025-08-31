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
import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_checkbox,
    expect_help_tooltip,
    expect_markdown,
    get_checkbox,
    get_element_by_key,
    get_expander,
)

CHECKBOX_ELEMENTS = 15


def test_checkbox_widget_display(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.checkbox renders correctly."""
    checkbox_elements = themed_app.get_by_test_id("stCheckbox")
    expect(checkbox_elements).to_have_count(CHECKBOX_ELEMENTS)

    assert_snapshot(
        get_checkbox(themed_app, "checkbox 1 (True)"), name="st_checkbox-true"
    )
    assert_snapshot(
        get_checkbox(themed_app, "checkbox 2 (False)"), name="st_checkbox-false"
    )
    assert_snapshot(
        get_checkbox(
            themed_app,
            re.compile(r"^checkbox 3"),
        ),
        name="st_checkbox-long_label",
    )
    assert_snapshot(
        get_checkbox(themed_app, "checkbox 4 (with callback)"),
        name="st_checkbox-callback",
    )
    assert_snapshot(
        get_checkbox(themed_app, "checkbox 5 (False, disabled)"),
        name="st_checkbox-false_disabled",
    )
    assert_snapshot(
        get_checkbox(themed_app, "checkbox 6 (True, disabled)"),
        name="st_checkbox-true_disabled",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "checkbox_7"),
        name="st_checkbox-hidden_label",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "checkbox_8"),
        name="st_checkbox-collapsed_label",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "checkbox_9"),
        name="st_checkbox-markdown_label",
    )

    # Width examples
    assert_snapshot(
        get_checkbox(themed_app, "checkbox with content width"),
        name="st_checkbox-width_content",
    )
    assert_snapshot(
        get_checkbox(themed_app, "checkbox with stretch width"),
        name="st_checkbox-width_stretch",
    )
    assert_snapshot(
        get_checkbox(themed_app, "checkbox with 200px width"),
        name="st_checkbox-width_200px",
    )


def test_help_tooltip_works(app: Page):
    leading_indent_code_tooltip = """
    Code:

        This
        is
        a
        code
        block!"""
    element_with_help = get_checkbox(app, "checkbox 1 (True)")
    expect_help_tooltip(app, element_with_help, leading_indent_code_tooltip)


def test_checkbox_initial_values(app: Page):
    """Test that st.checkbox has the correct initial values."""
    expect_markdown(app, "checkbox 1 - value: True")
    expect_markdown(app, "checkbox 2 - value: False")
    expect_markdown(app, "checkbox 3 - value: False")
    expect_markdown(app, "checkbox 4 - value: False")
    expect_markdown(app, "checkbox 4 - clicked: False")
    expect_markdown(app, "checkbox 5 - value: False")
    expect_markdown(app, "checkbox 6 - value: True")
    expect_markdown(app, "checkbox 7 - value: False")
    expect_markdown(app, "checkbox 8 - value: False")


def test_checkbox_values_on_click(app: Page):
    """Test that st.checkbox updates values correctly when user clicks."""
    # Click only the checkboxes that affect the displayed markdown values
    click_checkbox(app, "checkbox 1 (True)")
    click_checkbox(app, "checkbox 2 (False)")
    click_checkbox(app, re.compile(r"^checkbox 3"))
    click_checkbox(app, "checkbox 4 (with callback)")

    # Hidden/collapsed labels: click via key wrapper
    get_element_by_key(app, "checkbox_7").locator("label").click()
    wait_for_app_run(app)
    get_element_by_key(app, "checkbox_8").locator("label").click()
    wait_for_app_run(app)

    expect_markdown(app, "checkbox 1 - value: False")
    expect_markdown(app, "checkbox 2 - value: True")
    expect_markdown(app, "checkbox 3 - value: True")
    expect_markdown(app, "checkbox 4 - value: True")
    expect_markdown(app, "checkbox 4 - clicked: True")
    expect_markdown(app, "checkbox 5 - value: False")
    expect_markdown(app, "checkbox 6 - value: True")
    expect_markdown(app, "checkbox 7 - value: True")
    expect_markdown(app, "checkbox 8 - value: True")


def test_grouped_checkboxes_height(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that grouped checkboxes have the correct height."""

    expander_details = get_expander(app, "Grouped checkboxes").get_by_test_id(
        "stExpanderDetails"
    )
    expect(expander_details.get_by_test_id("stCheckbox")).to_have_count(3)
    assert_snapshot(expander_details, name="st_checkbox-grouped_styling")
    expect(get_checkbox(expander_details, "checkbox group - 1")).to_have_css(
        "height", "24px"
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stCheckbox")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "checkbox4")).to_be_visible()
