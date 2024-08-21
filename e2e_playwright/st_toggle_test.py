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
from e2e_playwright.shared.app_utils import get_expander

TOGGLE_ELEMENTS = 11


def test_toggle_widget_display(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.toggle renders correctly."""
    toggle_elements = themed_app.get_by_test_id("stCheckbox")
    expect(toggle_elements).to_have_count(TOGGLE_ELEMENTS)

    assert_snapshot(toggle_elements.nth(0), name="st_toggle-true")
    assert_snapshot(toggle_elements.nth(1), name="st_toggle-false")
    assert_snapshot(toggle_elements.nth(2), name="st_toggle-long_label")
    assert_snapshot(toggle_elements.nth(3), name="st_toggle-callback")
    assert_snapshot(toggle_elements.nth(4), name="st_toggle-false_disabled")
    assert_snapshot(toggle_elements.nth(5), name="st_toggle-true_disabled")
    assert_snapshot(toggle_elements.nth(6), name="st_toggle-hidden_label")
    assert_snapshot(toggle_elements.nth(7), name="st_toggle-collapsed_label")


def test_toggle_initial_values(app: Page):
    """Test that st.toggle has the correct initial values."""
    markdown_elements = app.get_by_test_id("stMarkdown")
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
    toggle_elements = app.get_by_test_id("stCheckbox")
    expect(toggle_elements).to_have_count(TOGGLE_ELEMENTS)

    for toggle_element in toggle_elements.all():
        # Not sure if this is needed, but somehow it is slightly
        # flaky with the last toggle without it.
        # It seems that it sometimes fails to click,
        # and in these cases the toggle was not scrolled into view.
        # So, maybe thats the reason why it fails to click it.
        # But this is just a guess.
        toggle_element.scroll_into_view_if_needed()
        toggle_element.locator("label").click(delay=50, force=True)
        wait_for_app_run(app)

    markdown_elements = app.get_by_test_id("stMarkdown")
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


def test_grouped_toggles_height(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that grouped toggles have the correct height."""

    expander_details = get_expander(app, "Grouped toggles").get_by_test_id(
        "stExpanderDetails"
    )
    expect(expander_details.get_by_test_id("stCheckbox")).to_have_count(3)
    assert_snapshot(expander_details, name="st_toggle-grouped_styling")
    expect(expander_details.get_by_test_id("stCheckbox").nth(0)).to_have_css(
        "height", "24px"
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    expect(app.get_by_test_id("stCheckbox").first).to_have_class("stCheckbox")
