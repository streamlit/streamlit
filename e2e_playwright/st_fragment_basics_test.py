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
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import rerun_app, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    click_form_button,
    expect_markdown,
    expect_no_exception,
    get_element_by_key,
    select_selectbox_option,
)


def _in_fragment_markdown(app: Page) -> Locator:
    return app.get_by_test_id("stMarkdown").filter(has_text="inside fragment:")


def _outside_fragment_markdown(app: Page) -> Locator:
    return app.get_by_test_id("stMarkdown").filter(has_text="outside: fragment")


def get_uuids(app: Page) -> tuple[str, str]:
    text_in_fragment = _in_fragment_markdown(app).text_content()
    text_outside_fragment = _outside_fragment_markdown(app).text_content()

    assert text_in_fragment is not None
    assert text_outside_fragment is not None

    return text_in_fragment, text_outside_fragment


def expect_only_fragment_uuid_changed(
    app: Page, old_text_in_fragment: str, old_text_outside_fragment: str
):
    expect(_in_fragment_markdown(app)).not_to_have_text(old_text_in_fragment)
    expect(_outside_fragment_markdown(app)).to_have_text(old_text_outside_fragment)


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
    # Center the option in the viewport so the fixed st.bottom container can't
    # cover it (a bottom-edge-aligned target gets intercepted by the bar).
    radio.evaluate("element => element.scrollIntoView({ block: 'center' })")
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

    expect(_in_fragment_markdown(app)).not_to_have_text(old_text_in_fragment)
    expect(_outside_fragment_markdown(app)).not_to_have_text(old_text_outside_fragment)


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


def test_full_rerun_after_outside_write_no_duplicates(app: Page):
    """After interacting with a fragment that writes to an outside container,
    a full app rerun must not produce duplicated content.
    """
    container = get_element_by_key(app, "shrink_container")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns).to_have_count(7)

    click_button(app, "shrink rows")
    expect(markdowns).to_have_count(4)

    rerun_app(app)
    expect(markdowns).to_have_count(7)
    expect(markdowns.first).to_have_text("shrink header")
    expect(markdowns.last).to_have_text("shrink footer")
    # No duplicated rows after the full rerun.
    expect(markdowns.filter(has_text="shrink row 0")).to_have_count(1)
    expect_no_exception(app)


def test_fragment_shrink_clears_stale_outside_elements(app: Page):
    """A fragment that reruns with fewer elements in an outside container must
    garbage-collect the removed elements, while growth keeps the footer in place.
    """
    container = get_element_by_key(app, "shrink_container")
    markdowns = container.get_by_test_id("stMarkdown")
    # header + 5 rows + footer.
    expect(markdowns).to_have_count(7)
    expect(markdowns.first).to_have_text("shrink header")
    expect(markdowns.last).to_have_text("shrink footer")
    expect(markdowns.filter(has_text="shrink row 4")).to_have_count(1)

    click_button(app, "shrink rows")

    # header + 2 rows + footer; rows 2-4 must be gone (the stale-on-shrink bug).
    expect(markdowns).to_have_count(4)
    expect(markdowns.first).to_have_text("shrink header")
    expect(markdowns.last).to_have_text("shrink footer")
    expect(markdowns.filter(has_text="shrink row 0")).to_have_count(1)
    expect(markdowns.filter(has_text="shrink row 1")).to_have_count(1)
    expect(markdowns.filter(has_text="shrink row 2")).to_have_count(0)
    expect(markdowns.filter(has_text="shrink row 4")).to_have_count(0)

    click_button(app, "grow rows")

    # Growing back must restore all rows without overwriting the footer.
    expect(markdowns).to_have_count(7)
    expect(markdowns.first).to_have_text("shrink header")
    expect(markdowns.last).to_have_text("shrink footer")
    expect(markdowns.filter(has_text="shrink row 4")).to_have_count(1)

    expect_no_exception(app)


def test_outside_container_widget_triggers_fragment_only_rerun(app: Page):
    """Clicking a widget written by a fragment into an outside container must
    trigger a fragment-only rerun — the main-script marker stays unchanged.
    """
    _, old_text_outside_fragment = get_uuids(app)
    fragment_marker = app.get_by_test_id("stMarkdown").filter(
        has_text="outside_widget_fragment ran:"
    )
    old_fragment_text = fragment_marker.text_content()
    assert old_fragment_text is not None

    # Click the button rendered in the outside container.
    container = get_element_by_key(app, "outside_widget_container")
    container.get_by_role("button", name="outside container btn").click()
    wait_for_app_run(app)

    # Fragment re-ran (its UUID changed).
    expect(fragment_marker).not_to_have_text(old_fragment_text)
    # Main script did NOT re-run.
    expect(_outside_fragment_markdown(app)).to_have_text(old_text_outside_fragment)
    expect_no_exception(app)


def test_sidebar_widget_triggers_fragment_only_rerun(app: Page):
    """Clicking a widget written by a fragment into the sidebar must trigger
    a fragment-only rerun — the main-script marker stays unchanged.
    """
    _, old_text_outside_fragment = get_uuids(app)
    fragment_marker = app.get_by_test_id("stMarkdown").filter(
        has_text="outside_widget_fragment ran:"
    )
    old_fragment_text = fragment_marker.text_content()
    assert old_fragment_text is not None

    sidebar = app.get_by_test_id("stSidebar")
    sidebar.get_by_role("button", name="sidebar btn").click()
    wait_for_app_run(app)

    expect(fragment_marker).not_to_have_text(old_fragment_text)
    expect(_outside_fragment_markdown(app)).to_have_text(old_text_outside_fragment)
    expect_no_exception(app)


def test_toplevel_sidebar_bottom_shrink_grow_interleaving(app: Page):
    """Fragments writing variable element counts into st.sidebar and st.bottom
    must garbage-collect stale rows on shrink and preserve header/footer ordering
    on grow. Exercises the _is_top_level detection branch.
    """
    sidebar = app.get_by_test_id("stSidebar")
    bottom_block = app.get_by_test_id("stBottomBlockContainer")

    sidebar_markdowns = sidebar.get_by_test_id("stMarkdown")
    bottom_markdowns = bottom_block.get_by_test_id("stMarkdown")

    # Initial state: sidebar has header + 3 rows + footer = 5 markdowns
    # (plus "sidebar header" from the outside_widget_fragment section = 6 total)
    expect(sidebar_markdowns.filter(has_text="sidebar section header")).to_have_count(1)
    expect(sidebar_markdowns.filter(has_text="sidebar section footer")).to_have_count(1)
    expect(sidebar_markdowns.filter(has_text="sidebar row")).to_have_count(3)

    # bottom: header + 3 rows + footer
    expect(bottom_markdowns.filter(has_text="bottom section header")).to_have_count(1)
    expect(bottom_markdowns.filter(has_text="bottom section footer")).to_have_count(1)
    expect(bottom_markdowns.filter(has_text="bottom row")).to_have_count(3)

    # Grow to 5
    click_button(app, "toplevel to 5")

    expect(sidebar_markdowns.filter(has_text="sidebar row")).to_have_count(5)
    expect(sidebar_markdowns.filter(has_text="sidebar section footer")).to_have_count(1)
    expect(bottom_markdowns.filter(has_text="bottom row")).to_have_count(5)
    expect(bottom_markdowns.filter(has_text="bottom section footer")).to_have_count(1)

    # Shrink to 2 — stale rows must be gone
    click_button(app, "toplevel to 2")

    expect(sidebar_markdowns.filter(has_text="sidebar row")).to_have_count(2)
    expect(sidebar_markdowns.filter(has_text="sidebar row 0")).to_have_count(1)
    expect(sidebar_markdowns.filter(has_text="sidebar row 1")).to_have_count(1)
    expect(sidebar_markdowns.filter(has_text="sidebar row 2")).to_have_count(0)
    expect(sidebar_markdowns.filter(has_text="sidebar section header")).to_have_count(1)
    expect(sidebar_markdowns.filter(has_text="sidebar section footer")).to_have_count(1)

    expect(bottom_markdowns.filter(has_text="bottom row")).to_have_count(2)
    expect(bottom_markdowns.filter(has_text="bottom row 0")).to_have_count(1)
    expect(bottom_markdowns.filter(has_text="bottom row 1")).to_have_count(1)
    expect(bottom_markdowns.filter(has_text="bottom row 2")).to_have_count(0)
    expect(bottom_markdowns.filter(has_text="bottom section header")).to_have_count(1)
    expect(bottom_markdowns.filter(has_text="bottom section footer")).to_have_count(1)

    expect_no_exception(app)


def test_parent_rerun_rebuilds_child_outside_wrapper(app: Page):
    """Rerunning a parent fragment that owns a container written to by a
    child fragment must preserve exactly one copy of each child element.
    """
    container = get_element_by_key(app, "parent_owned_container")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns).to_have_count(3)
    expect(markdowns.nth(0)).to_have_text("parent header")
    expect(markdowns.nth(1)).to_have_text("child row 0")
    expect(markdowns.nth(2)).to_have_text("child row 1")

    click_button(app, "rerun parent")

    expect(markdowns).to_have_count(3)
    expect(markdowns.nth(0)).to_have_text("parent header")
    expect(markdowns.nth(1)).to_have_text("child row 0")
    expect(markdowns.nth(2)).to_have_text("child row 1")
    expect_no_exception(app)


def test_child_rerun_preserves_parent_wrapper(app: Page):
    """Rerunning only the child fragment must preserve its outside-container
    content without duplicating or losing elements.
    """
    container = get_element_by_key(app, "parent_owned_container")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns).to_have_count(3)

    click_button(app, "rerun child")

    expect(markdowns).to_have_count(3)
    expect(markdowns.nth(0)).to_have_text("parent header")
    expect(markdowns.nth(1)).to_have_text("child row 0")
    expect(markdowns.nth(2)).to_have_text("child row 1")
    expect_no_exception(app)


def test_fragment_rerun_preserves_inscope_content_position(app: Page):
    """A fragment rerun must keep in-scope elements in the same count and order."""
    stable_a = app.get_by_test_id("stMarkdown").filter(has_text="stable item A")
    stable_b = app.get_by_test_id("stMarkdown").filter(has_text="stable item B")
    stable_c = app.get_by_test_id("stMarkdown").filter(has_text="stable item C")
    expect(stable_a).to_have_count(1)
    expect(stable_b).to_have_count(1)
    expect(stable_c).to_have_count(1)

    click_button(app, "rerun stable")

    expect(stable_a).to_have_count(1)
    expect(stable_b).to_have_count(1)
    expect(stable_c).to_have_count(1)
    expect_no_exception(app)
