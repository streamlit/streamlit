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
from e2e_playwright.shared.app_utils import click_checkbox, click_toggle


def change_widget_values(app: Page):
    """Change the checkbox value."""
    # Get the first form:
    form_1 = app.get_by_test_id("stForm").nth(0)
    click_checkbox(app, "Checkbox")

    # Change the date input value.
    form_1.get_by_test_id("stDateInput").locator("input").click()
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Wednesday, July 17th 2019."]'
    ).first.click()

    # Change the multiselect value.
    form_1.get_by_test_id("stMultiSelect").locator("input").click()
    app.locator("[data-baseweb='popover'] >> li").nth(0).click()

    # Change the number input value.
    form_1.get_by_test_id("stNumberInput").locator("input").fill("42")

    # Change the radio value.
    form_1.get_by_test_id("stRadio").locator('label[data-baseweb="radio"]').nth(
        1
    ).click(force=True)

    # Change the selectbox value.
    form_1.get_by_test_id("stSelectbox").locator("input").click()
    app.locator("[data-baseweb='popover']").locator("li").nth(1).click()

    # Change the select slider value.
    form_1.get_by_test_id("stSlider").nth(0).get_by_role("slider").press("ArrowRight")

    # Change the slider value.
    form_1.get_by_test_id("stSlider").nth(1).get_by_role("slider").press("ArrowRight")

    # Change the text area value.
    form_1.get_by_test_id("stTextArea").locator("textarea").fill("bar")

    # Change the text input value.
    form_1.get_by_test_id("stTextInput").locator("input").fill("bar")

    # Change the time input value.
    form_1.get_by_test_id("stTimeInput").locator("input").click()
    app.locator('[data-baseweb="popover"]').locator("li").nth(0).click()

    # Change the toggle value.
    click_toggle(app, "Toggle Input")


def test_does_not_change_values_before_form_submitted(app: Page):
    """Query for markdown elements after the form."""
    markdown_elements = app.get_by_test_id("stMarkdown")

    # Change widget values without submitting the form.
    change_widget_values(app)

    # Assert that the values did not change.
    expect(markdown_elements.nth(0)).to_have_text("Checkbox: False")
    expect(markdown_elements.nth(1)).to_have_text("Date Input: 2019-07-06")
    expect(markdown_elements.nth(2)).to_have_text("Multiselect: foo")
    expect(markdown_elements.nth(3)).to_have_text("Number Input: 0.0")
    expect(markdown_elements.nth(4)).to_have_text("Radio: foo")
    expect(markdown_elements.nth(5)).to_have_text("Selectbox: foo")
    expect(markdown_elements.nth(6)).to_have_text("Select Slider: foo")
    expect(markdown_elements.nth(7)).to_have_text("Slider: 0")
    expect(markdown_elements.nth(8)).to_have_text("Text Area: foo")
    expect(markdown_elements.nth(9)).to_have_text("Text Input: foo")
    expect(markdown_elements.nth(10)).to_have_text("Time Input: 08:45:00")
    expect(markdown_elements.nth(11)).to_have_text("Toggle Input: False")


def test_changes_widget_values_after_form_submitted(app: Page):
    # Change widget values and submit the form.
    change_widget_values(app)
    app.get_by_test_id("stFormSubmitButton").nth(0).locator("button").click()
    wait_for_app_run(app)

    # Query for markdown elements after the form
    markdown_elements = app.get_by_test_id("stMarkdown")

    # Assert that the values have changed.
    expect(markdown_elements.nth(0)).to_have_text("Checkbox: True")
    expect(markdown_elements.nth(1)).to_have_text("Date Input: 2019-07-17")
    expect(markdown_elements.nth(2)).to_have_text("Multiselect: foo, bar")
    expect(markdown_elements.nth(3)).to_have_text("Number Input: 42.0")
    expect(markdown_elements.nth(4)).to_have_text("Radio: bar")
    expect(markdown_elements.nth(5)).to_have_text("Selectbox: bar")
    expect(markdown_elements.nth(6)).to_have_text("Select Slider: bar")
    expect(markdown_elements.nth(7)).to_have_text("Slider: 1")
    expect(markdown_elements.nth(8)).to_have_text("Text Area: bar")
    expect(markdown_elements.nth(9)).to_have_text("Text Input: bar")
    expect(markdown_elements.nth(10)).to_have_text("Time Input: 00:00:00")
    expect(markdown_elements.nth(11)).to_have_text("Toggle Input: True")


def test_form_with_stretched_button(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Tests if the form with stretched submit button renders correctly."""
    form_2 = themed_app.get_by_test_id("stForm").nth(1)

    assert_snapshot(form_2, name="st_form-with_stretched_submit_button")

    submit_buttons = form_2.get_by_test_id("stFormSubmitButton")
    expect(submit_buttons).to_have_count(2)

    submit_button = submit_buttons.nth(0)
    submit_button.hover()
    expect(themed_app.get_by_test_id("stTooltipContent")).to_have_text(
        "Submit by clicking"
    )


def test_borderless_form(app: Page, assert_snapshot: ImageCompareFunction):
    """Tests if the borderless form (border=False) renders correctly."""
    form_3 = app.get_by_test_id("stForm").nth(2)

    assert_snapshot(form_3, name="st_form-borderless")
