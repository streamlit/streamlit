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
    get_markdown,
)


def get_button_group(app: Page, key: str) -> Locator:
    return get_element_by_key(app, key).get_by_test_id("stButtonGroup").first


def get_segment_button(locator: Locator, text: str) -> Locator:
    return locator.get_by_test_id(
        re.compile("stBaseButton-segmented_control(Active)?")
    ).filter(has_text=text)


def test_click_multiple_segmented_control_button_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test multi-select segmented control and take a screenshot.

    Click on the same button multiple times to test unselect.
    """

    segmented_control = get_button_group(
        themed_app, "segmented_control_multi_selection"
    )
    get_segment_button(segmented_control, "Foobar").click()
    wait_for_app_run(themed_app)

    # click on second element to test multiselect
    get_segment_button(segmented_control, "📊 Charts").click()
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['Foobar', '📊 Charts']")

    # click on same element to test unselect
    get_segment_button(segmented_control, "📊 Charts").click()
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['Foobar']")

    # click on same element and take screenshot of multiple selected segmented control buttons
    get_segment_button(segmented_control, "📊 Charts").click()
    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(themed_app)
    expect_markdown(themed_app, "Multi selection: ['Foobar', '📊 Charts']")

    assert_snapshot(segmented_control, name="st_segmented_control-multiselect")


def test_click_single_segment_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test single select segmented control and take a screenshot.

    Click on same element to test unselect.
    Click on two different elements to validate single select.
    """

    segmented_control = get_button_group(
        themed_app, "segmented_control_single_selection"
    )
    get_segment_button(segmented_control, "Foobar").click()
    text = get_markdown(themed_app, "Single selection: Foobar")
    expect(text).to_be_visible()

    assert_snapshot(segmented_control, name="st_segmented_control-singleselect")

    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(themed_app)
    text = get_markdown(themed_app, "Single selection: Foobar")
    expect(text).to_be_visible()

    # test unselect in single-select mode
    get_segment_button(segmented_control, "Foobar").click()
    text = get_markdown(themed_app, "Single selection: None")
    expect(text).to_be_visible()


def test_click_single_icon_segment_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test icon only segmented control (via format_func) and take a screenshot.

    Click on same element to test unselect.
    Click on two different elements to validate single select.
    """
    segmented_control = get_button_group(
        themed_app, "segmented_control_single_icon_selection"
    )

    # the icon's span element has the respective text
    # (e.g. :material/zoom_out_map: -> zoom_out_map)
    get_segment_button(segmented_control, "zoom_out_map").click()
    text = get_markdown(themed_app, "Single icon selection: 3")
    expect(text).to_be_visible()

    get_segment_button(segmented_control, "zoom_in").click()
    text = get_markdown(themed_app, "Single icon selection: 1")
    expect(text).to_be_visible()

    assert_snapshot(
        segmented_control, name="st_segmented_control-singleselect_icon_only"
    )

    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    wait_for_app_run(themed_app)
    text = get_markdown(themed_app, "Single icon selection: 1")
    expect(text).to_be_visible()

    # test unselect in single-select mode
    get_segment_button(segmented_control, "zoom_in").click()
    text = get_markdown(themed_app, "Single icon selection: None")
    expect(text).to_be_visible()


def test_pass_default_selections(app: Page):
    """Test that passed defaults are rendered correctly."""
    expect_markdown(app, "Multi selection: []")

    click_checkbox(app, "Set default values")
    wait_for_app_run(app)
    expect_markdown(
        app,
        "Multi selection: ['Foobar', '🧰 General widgets']",
    )

    click_checkbox(app, "Set default values")
    wait_for_app_run(app)
    expect_markdown(app, "Multi selection: []")


def test_selection_via_on_change_callback(app: Page):
    """Test that the on_change callback is triggered when a segmented control butoon is clicked."""
    segmented_control = get_button_group(app, "segmented_control_on_change")
    get_segment_button(segmented_control, "Sadness").click()
    wait_for_app_run(app)
    expect_markdown(app, "on_change selection: Sadness")
    expect(segmented_control.get_by_text("Select an emotion:")).to_be_visible()


def test_segmented_control_are_disabled_and_label_collapsed(app: Page):
    segmented_control = get_button_group(app, "segmented_control_disabled")
    for button in segmented_control.locator("button").all():
        expect(button).to_have_js_property("disabled", True)
    selected_button = get_segment_button(segmented_control, "Sadness")
    selected_button.click(force=True)
    wait_for_app_run(app)
    expect(selected_button).not_to_have_css(
        "color", re.compile("rgb\\(\\d+, \\d+, \\d+\\)")
    )
    expect_markdown(app, "segmented-control-disabled: None")
    expect(segmented_control.get_by_text("Select an emotion:")).not_to_be_visible()


def test_segmented_control_work_in_forms(app: Page):
    expect_markdown(app, "segmented-control-in-form: []")
    segmented_control = get_button_group(app, "segmented_control_in_form")
    get_segment_button(segmented_control, "Sadness").click()
    click_form_button(app, "Submit")
    wait_for_app_run(app)
    expect_markdown(app, "segmented-control-in-form: ['Sadness']")


def test_segmented_control_work_with_fragments(app: Page):
    expect_markdown(app, "segmented-control-in-fragment: None")
    segmented_control = get_button_group(app, "segmented_control_in_fragment")
    get_segment_button(segmented_control, "Sadness").click()
    wait_for_app_run(app)
    expect_markdown(app, "segmented-control-in-fragment: Sadness")
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_segmented_control_remount_keep_value(app: Page):
    expect_markdown(app, "segmented-control-after-sleep: None")
    segmented_control = get_button_group(app, "segmented_control_after_sleep")
    selected_button = get_segment_button(segmented_control, "Sadness")
    selected_button.click()
    wait_for_app_run(app)
    expect_markdown(app, "segmented-control-after-sleep: Sadness")
    click_button(app, "Create some elements to unmount component")
    expect_markdown(app, "segmented-control-after-sleep: Sadness")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stButtonGroup")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "segmented_control_multi_selection")).to_be_visible()


def test_help_tooltip(app: Page):
    expect_help_tooltip(
        app,
        get_button_group(app, "segmented_control_multi_selection"),
        "You can choose multiple options",
    )
