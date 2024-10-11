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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import click_button, click_checkbox


def get_uuids(app: Page):
    expect(app.get_by_test_id("stMarkdown")).to_have_count(2)

    text_in_fragment = app.get_by_test_id("stMarkdown").first.text_content()
    text_outside_fragment = app.get_by_test_id("stMarkdown").last.text_content()

    return text_in_fragment, text_outside_fragment


def expect_only_fragment_uuid_changed(
    app: Page, old_text_in_fragment: str, old_text_outside_fragment: str
):
    expect(app.get_by_test_id("stMarkdown").first).not_to_have_text(
        old_text_in_fragment
    )
    expect(app.get_by_test_id("stMarkdown").last).to_have_text(
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

    app.get_by_test_id("stRadio").locator('label[data-baseweb="radio"]').nth(1).click(
        force=True
    )
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_selectbox_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    app.get_by_test_id("stSelectbox").locator("input").click()
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").nth(1).click()
    app.get_by_test_id("stSelectbox").locator("input").click()
    wait_for_app_run(app)

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

    first_text_input_field = app.get_by_test_id("stTextInput").locator("input")
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

    expect(app.get_by_test_id("stMarkdown").first).not_to_have_text(
        old_text_in_fragment
    )
    expect(app.get_by_test_id("stMarkdown").last).not_to_have_text(
        old_text_outside_fragment
    )
