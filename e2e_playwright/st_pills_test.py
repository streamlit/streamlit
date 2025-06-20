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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_checkbox,
    click_form_button,
    expect_help_tooltip,
    expect_markdown,
    get_element_by_key,
)


def get_button_group(app: Page, index: int) -> Locator:
    return app.get_by_test_id("stButtonGroup").nth(index)


def get_pill_button(locator: Locator, text: str) -> Locator:
    return locator.get_by_test_id(re.compile("stBaseButton-pills(Active)?")).filter(
        has_text=text
    )


def test_click_multiple_pills_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test multiselect pills and take a screenshot.

    Click on same pill multiple times to test unselect.
    """

    pills = get_button_group(themed_app, 0)
    get_pill_button(pills, "📝").click()
    wait_for_app_run(themed_app)
    # click on second element to test multiselect
    get_pill_button(pills, "🪢").click()
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['📝 Text', '🪢 Graphs']")

    # click on same element to test unselect
    get_pill_button(pills, "🪢").click()
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['📝 Text']")

    # click on same element and take screenshot of multiple selected pills
    get_pill_button(pills, "🪢").click()
    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['📝 Text', '🪢 Graphs']")

    assert_snapshot(pills, name="st_pills-multiselect")


def test_click_single_icon_pill_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test icon only pills (via format_func) and take a screenshot.

    Click on same element to test unselect.
    Click on two different elements to validate single select.
    """

    pills = get_button_group(themed_app, 1)

    # the icon's span element has the respective text
    # (e.g. :material/zoom_out_map: -> zoom_out_map)
    get_pill_button(pills, "zoom_out_map").click()
    expect_markdown(themed_app, "Single selection: 3")

    # test unselect in single-select mode
    get_pill_button(pills, "zoom_out_map").click()
    expect_markdown(themed_app, "Single selection: None")

    get_pill_button(pills, "zoom_in").click()
    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Single selection: 1")

    assert_snapshot(pills, name="st_pills-singleselect_icon_only")


def test_pills_are_disabled_and_take_screenshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    pills = get_button_group(app, 3)
    for pill in pills.locator("button").all():
        expect(pill).to_have_js_property("disabled", True)
    selected_pill = get_pill_button(pills, "Air")
    selected_pill.click(force=True)
    wait_for_app_run(app)
    expect(selected_pill).not_to_have_css(
        "color", re.compile("rgb\\(\\d+, \\d+, \\d+\\)")
    )
    expect_markdown(app, "pills-disabled: None")
    assert_snapshot(pills, name="st_pills-disabled")


def test_pass_default_selections(app: Page):
    """Test that passed defaults are rendered correctly."""
    expect_markdown(app, "Multi selection: []")

    click_checkbox(app, "Set default values")
    expect_markdown(
        app, "Multi selection: ['🧰 General widgets', '📊 Charts', '🧊 3D']"
    )

    click_checkbox(app, "Set default values")
    expect_markdown(app, "Multi selection: []")


def test_selection_via_on_change_callback(app: Page):
    """Test that the on_change callback is triggered when a pill is clicked."""
    pills = get_button_group(app, 2)
    get_pill_button(pills, "Air").click()
    wait_for_app_run(app)
    expect_markdown(app, "on_change selection: Air")


def test_pills_work_in_forms(app: Page):
    expect_markdown(app, "pills-in-form: None")
    pills = get_button_group(app, 4)
    get_pill_button(pills, "Air").click()
    click_form_button(app, "Submit")
    wait_for_app_run(app)
    expect_markdown(app, "pills-in-form: Air")


def test_pills_work_with_fragments(app: Page):
    expect_markdown(app, "pills-in-fragment: None")
    pills = get_button_group(app, 5)
    get_pill_button(pills, "Air").click()
    wait_for_app_run(app)
    expect_markdown(app, "pills-in-fragment: Air")
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_pills_remount_keep_value(app: Page):
    expect_markdown(app, "pills-after-sleep: None")
    pills = get_button_group(app, 6)
    selected_pill = get_pill_button(pills, "Air")
    selected_pill.click()
    wait_for_app_run(app)
    expect_markdown(app, "pills-after-sleep: Air")
    click_button(app, "Create some elements to unmount component")
    expect_markdown(app, "pills-after-sleep: Air")


def test_help_tooltip_works(app: Page):
    expect_help_tooltip(app, get_button_group(app, 0), "This is for choosing options")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stButtonGroup")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "pills")).to_be_visible()


def test_pills_with_labels(app: Page):
    """Test that labels are rendered correctly."""

    # visible label
    visible_label = app.get_by_test_id("stWidgetLabel").filter(
        has_text="Select some options"
    )
    expect(visible_label).to_be_visible()

    # collapsed label
    markdown_el = app.get_by_test_id("stWidgetLabel").filter(
        has_text="Elements (label collapsed)"
    )
    expect(markdown_el).to_be_attached()
    expect(markdown_el).not_to_be_visible()
    expect(markdown_el).to_have_css("display", "none")

    # hidden label
    markdown_el = app.get_by_test_id("stWidgetLabel").filter(
        has_text="Elements (label hidden)"
    )
    expect(markdown_el).to_be_attached()
    expect(markdown_el).not_to_be_visible()
    expect(markdown_el).to_have_css("display", "flex")
    expect(markdown_el).to_have_css("visibility", "hidden")
