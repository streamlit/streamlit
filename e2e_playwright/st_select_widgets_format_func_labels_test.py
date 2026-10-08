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

from __future__ import annotations

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import rerun_app, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_form_button,
    expect_prefixed_markdown,
    get_multiselect,
    get_radio,
    get_radio_option,
    get_selectbox,
    get_slider,
    select_radio_option,
    select_selectbox_option,
)


def test_selection_survives_format_func_label_changes(app: Page):
    """Selections survive reruns after their formatted labels change.

    Regression test for https://github.com/streamlit/streamlit/issues/17175: the
    frontend resends the labels it was last given, so the backend must push the
    new labels or a later rerun resets the selection.
    """
    select_selectbox_option(app, "selectbox with changing labels", "E (0)")
    expect_prefixed_markdown(app, "selectbox value:", "E")

    multiselect = get_multiselect(app, "multiselect with changing labels")
    # Select one option at a time. The first click schedules a rerun; on WebKit
    # that rerun can close the listbox before the next click or Escape.
    for option in ["F (0)", "D (0)"]:
        multiselect.locator("input").click()
        app.get_by_role("option", name=option, exact=True).click()
        expect(multiselect.locator(f'span[title="{option}"]')).to_be_visible()
        app.keyboard.press("Escape")
        wait_for_app_run(app)
    expect_prefixed_markdown(app, "multiselect value:", "['F', 'D']")

    select_radio_option(app, "E (0)", label="radio with changing labels")
    expect_prefixed_markdown(app, "radio value:", "E")

    slider = get_slider(app, "select slider with changing labels")
    slider.get_by_role("slider").press("ArrowRight")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "select slider value:", "E")

    click_button(app, "Bump label count")
    selectbox_input = get_selectbox(app, "selectbox with changing labels").locator(
        "input"
    )
    expect(selectbox_input).to_have_value("E (1)")
    expect(multiselect.locator('span[title="F (1)"]')).to_be_visible()
    expect(multiselect.locator('span[title="D (1)"]')).to_be_visible()
    radio = get_radio(app, "radio with changing labels")
    expect(get_radio_option(radio, "E (1)").get_by_role("radio")).to_be_checked()
    expect(slider.get_by_test_id("stSliderThumbValue")).to_contain_text("E (1)")
    expect_prefixed_markdown(app, "selectbox value:", "E")
    expect_prefixed_markdown(app, "multiselect value:", "['F', 'D']")
    expect_prefixed_markdown(app, "radio value:", "E")
    expect_prefixed_markdown(app, "select slider value:", "E")

    # The bump already pushed the new labels. This rerun resends those
    # labels, and the selection must stay on the same options.
    rerun_app(app)
    expect_prefixed_markdown(app, "selectbox value:", "E")
    expect_prefixed_markdown(app, "multiselect value:", "['F', 'D']")
    expect_prefixed_markdown(app, "radio value:", "E")
    expect_prefixed_markdown(app, "select slider value:", "E")
    expect(selectbox_input).to_have_value("E (1)")
    expect(multiselect.locator('span[title="F (0)"]')).to_have_count(0)
    expect(multiselect.locator('span[title="D (0)"]')).to_have_count(0)
    expect(radio.get_by_text("E (0)", exact=True)).to_have_count(0)
    expect(radio.get_by_text("D (0)", exact=True)).to_have_count(0)
    expect(get_radio_option(radio, "E (1)").get_by_role("radio")).to_be_checked()
    expect(slider.get_by_test_id("stSliderThumbValue")).to_contain_text("E (1)")
    expect(slider.get_by_text("E (0)", exact=True)).to_have_count(0)
    expect(slider.get_by_text("D (0)", exact=True)).to_have_count(0)
    expect(slider.get_by_text("F (0)", exact=True)).to_have_count(0)


def test_pending_form_selectbox_keeps_option_when_labels_change(app: Page):
    """A form selection updates its label before submit and survives submit."""
    selectbox = get_selectbox(app, "pending form selectbox")
    selectbox_input = selectbox.locator("input")
    selectbox_input.click()
    selectbox_input.press("ArrowDown")
    dropdown = app.get_by_test_id("stSelectboxVirtualDropdown")
    expect(dropdown).to_be_visible()
    # Filter instead of scrolling a virtualized list. A form selection does
    # not rerun, so this does not use the helper that waits for an app run.
    selectbox_input.fill("E (0)")
    dropdown.get_by_role("option", name="E (0)", exact=True).click()
    expect(selectbox_input).to_have_value("E (0)")
    # The form has not been submitted, so the script value is still empty.
    expect_prefixed_markdown(app, "pending form value:", "None")

    click_button(app, "Bump label count")
    expect(selectbox_input).to_have_value("E (1)")
    expect_prefixed_markdown(app, "pending form value:", "None")

    click_form_button(app, "Submit pending form")
    expect_prefixed_markdown(app, "pending form value:", "E")
    expect(selectbox_input).to_have_value("E (1)")
