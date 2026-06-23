# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    click_form_button,
    expect_markdown,
    select_selectbox_option,
)


def get_uuids(app: Page) -> tuple[str, str]:
    markdowns = app.get_by_test_id("stMarkdown")
    in_fragment = markdowns.filter(has_text="inside fragment:")
    outside_fragment = markdowns.filter(has_text="outside: fragment")
    expect(in_fragment).to_have_count(1)
    expect(outside_fragment).to_have_count(1)

    text_in_fragment = in_fragment.text_content()
    text_outside_fragment = outside_fragment.text_content()

    assert text_in_fragment is not None
    assert text_outside_fragment is not None

    return text_in_fragment, text_outside_fragment


def expect_only_fragment_uuid_changed(
    app: Page, old_text_in_fragment: str, old_text_outside_fragment: str
):
    markdowns = app.get_by_test_id("stMarkdown")
    expect(markdowns.filter(has_text="inside fragment:")).not_to_have_text(
        old_text_in_fragment
    )
    expect(markdowns.filter(has_text="outside: fragment")).to_have_text(
        old_text_outside_fragment
    )


def test_button_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    click_button(app, "a button")

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_download_button_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    app.get_by_test_id("stDownloadButton").locator("button").click()
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_chat_input_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    chat_input_area = app.get_by_test_id("stChatInputTextArea")
    chat_input_area.type("Corgi")
    chat_input_area.press("Enter")
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_checkbox_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    click_checkbox(app, "a checkbox")

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_color_picker_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    color_block_element = app.get_by_test_id("stColorPickerBlock")
    color_block_element.click()
    app.locator('[data-baseweb="popover"]').locator("input").fill("0xFFFFFF")
    color_block_element.click()
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_date_input_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    app.get_by_test_id("stDateInput").click()
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Friday, January 2nd 1970."]'
    ).first.click()
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_multiselect_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    app.get_by_test_id("stMultiSelect").locator("input").click()
    app.locator("li").first.click()
    app.keyboard.press("Escape")
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_number_input_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    first_number_input_field = app.get_by_test_id("stNumberInput").locator("input")
    first_number_input_field.fill("10")
    first_number_input_field.press("Enter")
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_radio_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    radio = app.get_by_test_id("stRadio").get_by_test_id("stRadioOption").nth(1)
    radio.scroll_into_view_if_needed()
    radio.click(force=True)
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_selectbox_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    select_selectbox_option(app, "a selectbox", "b")

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


# TODO(vdonato): Figure out how to get this test to work. I'm currently having some
# trouble getting Playwright to correctly manipulate st.slider (although manual testing
# verifies that sliders work as expected from within fragments.
@pytest.mark.skip
def test_slider_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    slider_element = app.get_by_test_id("stSliderThumbValue")
    slider_element.click(force=True)
    slider_element.press("ArrowRight")
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_text_area_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    text_area_field = app.get_by_test_id("stTextArea").locator("textarea")
    text_area_field.fill("hello world")
    text_area_field.press("Control+Enter")
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_text_input_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    first_text_input_field = app.get_by_test_id("stTextInput").first.locator("input")
    first_text_input_field.fill("hello world")
    first_text_input_field.press("Enter")
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_time_input_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    time_input_field = app.get_by_test_id("stTimeInput").locator("input")
    time_input_field.type("00:15")
    time_input_field.press("Enter")
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_full_app_rerun(app: Page):
    """On a full rerun, verify that the uuids both inside and outside the fragment changed."""
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    app.keyboard.press("r")
    wait_for_app_run(app)

    markdowns = app.get_by_test_id("stMarkdown")
    expect(markdowns.filter(has_text="inside fragment:")).not_to_have_text(
        old_text_in_fragment
    )
    expect(markdowns.filter(has_text="outside: fragment")).not_to_have_text(
        old_text_outside_fragment
    )


def test_fragment_widget_persists_across_full_app_rerun(app: Page):
    """A widget inside a fragment retains its value after a full app rerun."""
    slider = app.get_by_role("slider", name="Fragment slider")
    slider.press("ArrowRight")
    wait_for_app_run(app)

    expect_markdown(app, "slider value: 51")

    old_app_uuid = (
        app.get_by_test_id("stMarkdown").filter(has_text="app uuid:").text_content()
    )
    assert old_app_uuid is not None

    click_button(app, "Trigger full rerun")

    expect(
        app.get_by_test_id("stMarkdown").filter(has_text="app uuid:")
    ).not_to_have_text(old_app_uuid)

    expect_markdown(app, "slider value: 51")
    expect(app.get_by_test_id("stSliderThumbValue").first).not_to_have_text("50")


def test_form_inside_fragment_submits_correctly(app: Page):
    """An st.form inside a fragment batches widget values and only applies
    them on submit.
    """
    expect_markdown(app, "not submitted")

    name_input = app.get_by_role("textbox", name="Name")
    name_input.fill("Alice")
    name_input.press("Enter")

    expect_markdown(app, "not submitted")

    click_form_button(app, "Submit form")

    expect_markdown(app, "submitted: Alice")

    expect(
        app.get_by_test_id("stMarkdown").filter(has_text="submitted:")
    ).to_have_count(1)
