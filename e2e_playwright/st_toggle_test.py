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
    click_toggle,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    get_element_by_key,
    get_expander,
    get_toggle,
)

TOGGLE_ELEMENTS = 17


def test_toggle_widget_display(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.toggle renders correctly."""
    toggle_elements = themed_app.get_by_test_id("stCheckbox")
    expect(toggle_elements).to_have_count(TOGGLE_ELEMENTS)

    assert_snapshot(get_toggle(themed_app, "toggle 1 (True)"), name="st_toggle-true")
    assert_snapshot(get_toggle(themed_app, "toggle 2 (False)"), name="st_toggle-false")
    assert_snapshot(
        get_toggle(themed_app, re.compile(r"^toggle 3")),
        name="st_toggle-long_label",
    )
    assert_snapshot(
        get_toggle(themed_app, "toggle 4 (with callback)"),
        name="st_toggle-callback",
    )
    assert_snapshot(
        get_toggle(themed_app, "toggle 5 (False, disabled)"),
        name="st_toggle-false_disabled",
    )
    assert_snapshot(
        get_toggle(themed_app, "toggle 6 (True, disabled)"),
        name="st_toggle-true_disabled",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "toggle_7"), name="st_toggle-hidden_label"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "toggle_8"), name="st_toggle-collapsed_label"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "toggle_9"), name="st_toggle-markdown_label"
    )

    # Width examples
    assert_snapshot(
        get_toggle(themed_app, "toggle with content width"),
        name="st_toggle-width_content",
    )
    assert_snapshot(
        get_toggle(themed_app, "toggle with stretch width"),
        name="st_toggle-width_stretch",
    )
    assert_snapshot(
        get_toggle(themed_app, "toggle with 150px width"),
        name="st_toggle-width_150px",
    )


def test_toggle_initial_values(app: Page):
    """Test that st.toggle has the correct initial values."""
    expect_markdown(app, "toggle 1 - value: True")
    expect_markdown(app, "toggle 2 - value: False")
    expect_markdown(app, "toggle 3 - value: False")
    expect_markdown(app, "toggle 4 - value: False")
    expect_markdown(app, "toggle 4 - clicked: False")
    expect_markdown(app, "toggle 5 - value: False")
    expect_markdown(app, "toggle 6 - value: True")
    expect_markdown(app, "toggle 7 - value: False")
    expect_markdown(app, "toggle 8 - value: False")


def test_toggle_values_on_click(app: Page):
    """Test that st.toggle updates values correctly when user clicks."""
    # Click only the toggles that affect the displayed markdown values
    click_toggle(app, "toggle 1 (True)")
    click_toggle(app, "toggle 2 (False)")
    click_toggle(app, re.compile(r"^toggle 3"))
    click_toggle(app, "toggle 4 (with callback)")
    # Hidden/collapsed labels: click via key wrapper
    get_element_by_key(app, "toggle_7").locator("label").click()
    wait_for_app_run(app)
    get_element_by_key(app, "toggle_8").locator("label").click()
    wait_for_app_run(app)

    expect_markdown(app, "toggle 1 - value: False")
    expect_markdown(app, "toggle 2 - value: True")
    expect_markdown(app, "toggle 3 - value: True")
    expect_markdown(app, "toggle 4 - value: True")
    expect_markdown(app, "toggle 4 - clicked: True")
    expect_markdown(app, "toggle 5 - value: False")
    expect_markdown(app, "toggle 6 - value: True")
    expect_markdown(app, "toggle 7 - value: True")
    expect_markdown(app, "toggle 8 - value: True")


def test_grouped_toggles_height(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that grouped toggles have the correct height."""

    expander_details = get_expander(app, "Grouped toggles").get_by_test_id(
        "stExpanderDetails"
    )
    expect(expander_details.get_by_test_id("stCheckbox")).to_have_count(3)
    assert_snapshot(expander_details, name="st_toggle-grouped_styling")
    expect(get_toggle(expander_details, "toggle group - 1")).to_have_css(
        "height", "24px"
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stCheckbox")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "toggle4")).to_be_visible()


def test_dynamic_toggle_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the toggle can be updated dynamically."""
    dynamic_toggle = get_element_by_key(app, "dynamic_toggle_with_key")
    expect(dynamic_toggle).to_be_visible()

    expect(dynamic_toggle).to_contain_text("Initial dynamic toggle")

    # Check that the initial toggle state is True
    expect_prefixed_markdown(app, "Initial toggle state:", "True")

    assert_snapshot(dynamic_toggle, name="st_toggle-dynamic_initial")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_toggle, "initial help")

    # Click toggle -> state is False
    click_toggle(app, "Initial dynamic toggle")
    expect_prefixed_markdown(app, "Initial toggle state:", "False")

    # Click toggle again -> state is True
    click_toggle(app, "Initial dynamic toggle")
    expect_prefixed_markdown(app, "Initial toggle state:", "True")

    # Click the toggle to update the toggle props
    click_toggle(app, "Update toggle props")

    # new toggle is visible:
    expect(dynamic_toggle).to_contain_text("Updated dynamic toggle")

    # Check that the updated toggle state is still True.
    expect_prefixed_markdown(app, "Updated toggle state:", "True")

    dynamic_toggle.scroll_into_view_if_needed()
    assert_snapshot(dynamic_toggle, name="st_toggle-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_toggle, "updated help")

    # Click the toggle
    click_toggle(app, "Updated dynamic toggle")
    expect_prefixed_markdown(app, "Updated toggle state:", "False")
