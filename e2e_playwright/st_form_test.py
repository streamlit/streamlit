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


def change_widget_values(app: Page):
    """Change the checkbox value."""
    app.get_by_test_id("stCheckbox").get_by_role("input").click()

    # Change the date input value.
    app.get_by_test_id("stDateInput").get_by_role("input").click()
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Wednesday, July 17th 2019."]'
    ).first.click()

    # Change the multiselect value.
    app.get_by_test_id("stMultiSelect").get_by_role("input").click()
    app.locator("[data-baseweb='popover'] >> li").nth(0).click()

    # Change the number input value.
    app.get_by_test_id("stNumberInput").get_by_role("input").fill("42")

    # Change the radio value.
    app.get_by_test_id("stRadio").locator('label[data-baseweb="radio"]').nth(1).click(
        force=True
    )

    # Change the selectbox value.
    app.get_by_test_id("stSelectbox").get_by_role("input").click()
    app.locator("[data-baseweb='popover']").locator("li").nth(1).click()

    # Change the select slider value.
    # app.locator('.stSlider >> [role="slider"] >> nth=0').click().type(
    #     "{ArrowRight}", delay=50
    # )

    # # Change the slider value.
    # app.locator('.stSlider >> [role="slider"] >> nth=1').click().type(
    #     "{ArrowRight}", delay=50
    # )

    # Change the color picker value.
    # color_picker = app.get_by_test_id("stColorPicker")(
    #     "[data-testid='stColorPicker'] >> div"
    # )
    # color_picker.click()
    # app.locator(".chrome-picker input").fill("#FF0000")

    # Change the text area value.
    app.get_by_test_id("stTextArea").get_by_role("textarea").fill("bar")

    # Change the text input value.
    app.get_by_test_id("stTextInput").get_by_role("input").fill("bar")

    # Change the time input value.
    app.get_by_test_id("stTimeInput").get_by_role("input").click()
    app.locator('[data-baseweb="popover"]').locator("li").nth(0).click()


def test_does_not_change_values_before_form_submitted(app: Page):
    """Query for markdown elements after the form."""
    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(12)

    # Change widget values without submitting the form.
    change_widget_values(app)

    # Assert that the values did not change.
    expect(markdown_elements.nth(0)).to_have_text("Checkbox: False")
    expect(markdown_elements.nth(1)).to_have_text("Color Picker: #000000")
    expect(markdown_elements.nth(2)).to_have_text("Date Input: 2019-07-06")
    expect(markdown_elements.nth(3)).to_have_text("Multiselect: foo")
    expect(markdown_elements.nth(4)).to_have_text("Number Input: 0.0")
    expect(markdown_elements.nth(5)).to_have_text("Radio: foo")
    expect(markdown_elements.nth(6)).to_have_text("Selectbox: foo")
    expect(markdown_elements.nth(7)).to_have_text("Select Slider: foo")
    expect(markdown_elements.nth(8)).to_have_text("Slider: 0")
    expect(markdown_elements.nth(9)).to_have_text("Text Area: foo")
    expect(markdown_elements.nth(10)).to_have_text("Text Input: foo")
    expect(markdown_elements.nth(11)).to_have_text("Time Input: 08:45:00")


def test_changes_widget_values_after_form_submitted(app: Page):
    # Change widget values and submit the form.
    change_widget_values(app)
    app.get_by_test_id("stFormSubmitButton").click()

    # Query for markdown elements after the form
    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(12)

    # Assert that the values have changed.
    expect(markdown_elements.nth(0)).to_have_text("Checkbox: True")
    # Color Picker checks are commented out due to known Cypress issues.
    # expect(markdown_elements.nth(1)).to_have_text("Color Picker: #ff0000")
    expect(markdown_elements.nth(2)).to_have_text("Date Input: 2019-07-17")
    expect(markdown_elements.nth(3)).to_have_text("Multiselect: foo, bar")
    expect(markdown_elements.nth(4)).to_have_text("Number Input: 42.0")
    expect(markdown_elements.nth(5)).to_have_text("Radio: bar")
    expect(markdown_elements.nth(6)).to_have_text("Selectbox: bar")
    # expect(markdown_elements.nth(7)).to_have_text("Select Slider: bar")
    # expect(markdown_elements.nth(8)).to_have_text("Slider: 1")
    expect(markdown_elements.nth(9)).to_have_text("Text Area: bar")
    expect(markdown_elements.nth(10)).to_have_text("Text Input: bar")
    expect(markdown_elements.nth(11)).to_have_text("Time Input: 00:00:00")
