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

from e2e_playwright.conftest import ImageCompareFunction, rerun_app, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    click_form_button,
    expect_markdown,
    expect_no_exception,
    get_button,
    get_element_by_key,
    select_selectbox_option,
)


def _click_button_centered(app: Page, label: str) -> None:
    """Scroll a button to the viewport center before clicking.

    The app has many sections, so buttons lower on the page can be covered
    by the fixed ``st.bottom`` bar or the header. Centering avoids this.
    """
    button = get_button(app, label)
    button.evaluate("el => el.scrollIntoView({ block: 'center' })")
    button.click()
    wait_for_app_run(app)


def _in_fragment_markdown(app: Page) -> Locator:
    return app.get_by_test_id("stMarkdown").filter(has_text="inside fragment:")


def _outside_fragment_markdown(app: Page) -> Locator:
    return app.get_by_test_id("stMarkdown").filter(has_text="outside: fragment")


def get_uuids(app: Page) -> tuple[str, str]:
    in_fragment = _in_fragment_markdown(app)
    outside_fragment = _outside_fragment_markdown(app)
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
    expect(_in_fragment_markdown(app)).not_to_have_text(old_text_in_fragment)
    expect(_outside_fragment_markdown(app)).to_have_text(old_text_outside_fragment)


def test_button_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    _click_button_centered(app, "a button")

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
    color_block_element.evaluate("el => el.scrollIntoView({ block: 'center' })")
    color_block_element.click()
    app.locator('[data-baseweb="popover"]').locator("input").fill("0xFFFFFF")
    color_block_element.click()
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_date_input_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    date_input = app.get_by_test_id("stDateInput")
    date_input.evaluate("el => el.scrollIntoView({ block: 'center' })")
    date_input.click()
    app.locator(
        '[data-baseweb="calendar"] [aria-label^="Choose Friday, January 2nd 1970."]'
    ).first.click()
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_multiselect_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    multiselect = app.get_by_test_id("stMultiSelect").locator("input")
    multiselect.evaluate("el => el.scrollIntoView({ block: 'center' })")
    multiselect.click()
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
    radio.evaluate("el => el.scrollIntoView({ block: 'center' })")
    radio.click()
    wait_for_app_run(app)

    expect_only_fragment_uuid_changed(
        app, old_text_in_fragment, old_text_outside_fragment
    )


def test_selectbox_in_fragment(app: Page):
    old_text_in_fragment, old_text_outside_fragment = get_uuids(app)

    selectbox = app.get_by_test_id("stSelectbox").filter(has_text="a selectbox")
    selectbox.evaluate("el => el.scrollIntoView({ block: 'center' })")
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
    form_status = app.get_by_test_id("stMarkdown").filter(has_text="not submitted")
    form_status.scroll_into_view_if_needed()
    expect(form_status).to_have_count(1)

    name_input = app.get_by_role("textbox", name="Name")
    name_input.scroll_into_view_if_needed()
    name_input.fill("Alice")

    # Filling the field must not apply the value yet — the form batches input
    # until the submit button is clicked. (We avoid pressing Enter here: in a
    # single-input form Enter submits, which races on webkit and is flaky.)
    expect(form_status).to_have_count(1)

    click_form_button(app, "Submit form")

    submitted = app.get_by_test_id("stMarkdown").filter(has_text="submitted:")
    expect(submitted).to_have_count(1)
    expect(submitted).to_have_text("submitted: Alice")


def test_full_rerun_after_outside_write_no_duplicates(app: Page):
    """After interacting with a fragment that writes to an outside container,
    a full app rerun must not produce duplicated content.
    """
    container = get_element_by_key(app, "shrink_container")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns).to_have_count(7)

    _click_button_centered(app, "shrink rows")
    expect(markdowns).to_have_count(4)

    rerun_app(app)
    # session_state retains shrink_count=2, so the count stays at 4.
    expect(markdowns).to_have_count(4)
    expect(markdowns.first).to_have_text("shrink header")
    expect(markdowns.last).to_have_text("shrink footer")
    expect(markdowns.filter(has_text="shrink row 0")).to_have_count(1)


def test_fragment_interleaved_with_main_writes_in_outside_container(app: Page):
    """A fragment and the main script interleave writes into one outside container.

    The main-script header and footer keep their slots across fragment reruns while
    the fragment's content updates in place (no reordering, no duplication).
    """
    container = get_element_by_key(app, "outside_interleaved")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns).to_have_count(3)
    expect(markdowns.first).to_have_text("interleaved header")
    expect(markdowns.last).to_have_text("interleaved footer")

    fragment_markdown = markdowns.filter(has_text="interleaved fragment:")
    old_fragment_text = fragment_markdown.text_content()

    _click_button_centered(app, "rerun interleaved")

    expect(fragment_markdown).not_to_have_text(old_fragment_text or "")
    expect(markdowns.first).to_have_text("interleaved header")
    expect(markdowns.last).to_have_text("interleaved footer")
    # Element count must stay constant — extra elements would indicate the
    # wrapper cursor wasn't reset between fragment reruns.
    expect(container.get_by_test_id("stMarkdown")).to_have_count(3)

    _click_button_centered(app, "rerun interleaved")
    expect(container.get_by_test_id("stMarkdown")).to_have_count(3)

    expect_no_exception(app)


def test_two_fragments_write_into_same_outside_container(app: Page):
    """Two fragments write into the same outside container via distinct wrappers.

    Rerunning one fragment updates only its own content; the other fragment's
    content and the interleaved non-fragment writes keep their position.
    """
    container = get_element_by_key(app, "two_fragments_container")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns).to_have_count(5)
    expect(markdowns.first).to_have_text("two-fragments header")
    expect(markdowns.last).to_have_text("two-fragments footer")

    first_markdown = markdowns.filter(has_text="first writer fragment:")
    second_markdown = markdowns.filter(has_text="second writer fragment:")
    old_first_text = first_markdown.text_content()
    old_second_text = second_markdown.text_content()

    _click_button_centered(app, "rerun first writer")

    expect(first_markdown).not_to_have_text(old_first_text or "")
    expect(second_markdown).to_have_text(old_second_text or "")
    expect(markdowns.first).to_have_text("two-fragments header")
    expect(markdowns.last).to_have_text("two-fragments footer")
    expect(container.get_by_test_id("stMarkdown")).to_have_count(5)

    expect_no_exception(app)


def test_fragment_writes_into_sidebar(app: Page):
    """A fragment writes into the sidebar via ``with st.sidebar:`` and via
    ``st.sidebar.markdown(...)``.

    The main-script header and footer keep their slots while the fragment's
    content updates in place across reruns.
    """
    sidebar = app.get_by_test_id("stSidebar")
    markdowns = sidebar.get_by_test_id("stMarkdown")

    with_block_markdown = markdowns.filter(has_text="sidebar with-block:")
    direct_markdown = markdowns.filter(has_text="sidebar direct:")
    expect(with_block_markdown).to_have_count(1)
    expect(direct_markdown).to_have_count(1)
    old_with_block_text = with_block_markdown.text_content()
    old_direct_text = direct_markdown.text_content()

    _click_button_centered(app, "rerun sidebar")

    expect(with_block_markdown).not_to_have_text(old_with_block_text or "")
    expect(direct_markdown).not_to_have_text(old_direct_text or "")
    expect(with_block_markdown).to_have_count(1)
    expect(direct_markdown).to_have_count(1)

    expect_no_exception(app)


def test_fragment_writes_into_bottom_container(app: Page):
    """A fragment writes directly into the bottom container, updating in
    place across reruns without duplicating elements.
    """
    bottom = app.get_by_test_id("stBottom")
    markdowns = bottom.get_by_test_id("stMarkdown")

    fragment_markdown = markdowns.filter(has_text="bottom fragment:")
    expect(fragment_markdown).to_have_count(1)
    old_fragment_text = fragment_markdown.text_content()

    _click_button_centered(app, "rerun bottom")

    expect(fragment_markdown).not_to_have_text(old_fragment_text or "")
    expect(fragment_markdown).to_have_count(1)

    expect_no_exception(app)


def test_fragment_fills_empty_placeholder(app: Page):
    """The ``outside.empty()`` placeholder is claimed during the full run and filled
    by the fragment, updating in place across reruns.
    """
    container = get_element_by_key(app, "empty_container")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns).to_have_count(2)
    expect(markdowns.first).to_have_text("empty-pattern header")

    placeholder_markdown = markdowns.filter(has_text="empty placeholder:")
    old_placeholder_text = placeholder_markdown.text_content()

    _click_button_centered(app, "rerun empty pattern")

    expect(placeholder_markdown).not_to_have_text(old_placeholder_text or "")
    expect(markdowns.first).to_have_text("empty-pattern header")
    expect(container.get_by_test_id("stMarkdown")).to_have_count(2)

    expect_no_exception(app)


def test_fragment_nested_container_in_outside_container(app: Page):
    """A fragment creates a nested container inside an outside container and writes
    into it, updating in place across reruns without duplicating elements.
    """
    container = get_element_by_key(app, "nested_container")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns).to_have_count(2)
    expect(markdowns.first).to_have_text("nested header")

    fragment_markdown = markdowns.filter(has_text="nested fragment:")
    old_fragment_text = fragment_markdown.text_content()

    _click_button_centered(app, "rerun nested")

    expect(fragment_markdown).not_to_have_text(old_fragment_text or "")
    expect(markdowns.first).to_have_text("nested header")
    expect(container.get_by_test_id("stMarkdown")).to_have_count(2)
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

    _click_button_centered(app, "shrink rows")

    # header + 2 rows + footer; rows 2-4 must be gone (the stale-on-shrink bug).
    expect(markdowns).to_have_count(4)
    expect(markdowns.first).to_have_text("shrink header")
    expect(markdowns.last).to_have_text("shrink footer")
    expect(markdowns.filter(has_text="shrink row 0")).to_have_count(1)
    expect(markdowns.filter(has_text="shrink row 1")).to_have_count(1)
    expect(markdowns.filter(has_text="shrink row 2")).to_have_count(0)
    expect(markdowns.filter(has_text="shrink row 4")).to_have_count(0)

    _click_button_centered(app, "grow rows")

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

    container = get_element_by_key(app, "outside_widget_container")
    container.get_by_role("button", name="outside container btn").click()
    wait_for_app_run(app)

    expect(fragment_marker).not_to_have_text(old_fragment_text)
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


def test_toplevel_sidebar_shrink_grow_interleaving(app: Page):
    """Fragments writing variable element counts into st.sidebar must
    garbage-collect stale rows on shrink and preserve header/footer ordering
    on grow.
    """
    sidebar = app.get_by_test_id("stSidebar")
    sidebar_markdowns = sidebar.get_by_test_id("stMarkdown")

    expect(sidebar_markdowns.filter(has_text="sidebar section header")).to_have_count(1)
    expect(sidebar_markdowns.filter(has_text="sidebar section footer")).to_have_count(1)
    expect(sidebar_markdowns.filter(has_text="sidebar row")).to_have_count(3)

    _click_button_centered(app, "toplevel to 5")

    expect(sidebar_markdowns.filter(has_text="sidebar row")).to_have_count(5)
    expect(sidebar_markdowns.filter(has_text="sidebar section footer")).to_have_count(1)

    _click_button_centered(app, "toplevel to 2")

    expect(sidebar_markdowns.filter(has_text="sidebar row")).to_have_count(2)
    expect(sidebar_markdowns.filter(has_text="sidebar row 0")).to_have_count(1)
    expect(sidebar_markdowns.filter(has_text="sidebar row 1")).to_have_count(1)
    expect(sidebar_markdowns.filter(has_text="sidebar row 2")).to_have_count(0)
    expect(sidebar_markdowns.filter(has_text="sidebar section header")).to_have_count(1)
    expect(sidebar_markdowns.filter(has_text="sidebar section footer")).to_have_count(1)

    expect_no_exception(app)


def test_parent_rerun_rebuilds_child_outside_wrapper(app: Page):
    """Rerunning a parent fragment that owns a container written to by a
    child fragment must preserve exactly one copy of each child element,
    because the parent's body calls child_fragment() during its rerun.
    """
    container = get_element_by_key(app, "parent_owned_container")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns).to_have_count(3)
    expect(markdowns.nth(0)).to_have_text("parent header")
    expect(markdowns.nth(1)).to_have_text("child row 0")
    expect(markdowns.nth(2)).to_have_text("child row 1")

    _click_button_centered(app, "rerun parent")

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

    _click_button_centered(app, "rerun child")

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

    _click_button_centered(app, "rerun stable")

    expect(stable_a).to_have_count(1)
    expect(stable_b).to_have_count(1)
    expect(stable_c).to_have_count(1)
    expect_no_exception(app)


def test_outside_container_transparent_wrapper(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """The transparent wrapper block adds no visible border or padding — the
    fragment's content appears inline with non-fragment content in the same container.
    """
    container = get_element_by_key(app, "visual_container")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns).to_have_count(3)
    expect(markdowns.nth(0)).to_have_text("visual header")
    expect(markdowns.nth(1)).to_have_text("visual fragment")
    expect(markdowns.nth(2)).to_have_text("visual footer")

    assert_snapshot(
        container, name="st_fragment_basics-outside_container_transparent_wrapper"
    )


def test_widget_in_outside_container_triggers_fragment_rerun(app: Page):
    """Clicking a widget that a fragment rendered into an outside container reruns
    only the fragment, not the full app.
    """
    container = get_element_by_key(app, "widget_outside_container")
    markdowns = container.get_by_test_id("stMarkdown")
    expect(markdowns.first).to_have_text("widget-outside header")
    expect(markdowns.last).to_have_text("widget-outside footer")

    fragment_markdown = markdowns.filter(has_text="widget-outside fragment:")
    old_fragment_text = fragment_markdown.text_content()

    app_marker = app.get_by_test_id("stMarkdown").filter(has_text="app-level marker:")
    old_app_marker_text = app_marker.text_content()

    _click_button_centered(app, "outside button")

    # Fragment content updated (fragment reran).
    expect(fragment_markdown).not_to_have_text(old_fragment_text or "")
    # The button's conditional output appeared.
    expect(markdowns.filter(has_text="button clicked:")).to_have_count(1)
    # App-level marker unchanged (no full rerun).
    expect(app_marker).to_have_text(old_app_marker_text or "")
    # Header and footer preserved.
    expect(markdowns.first).to_have_text("widget-outside header")
    expect(markdowns.last).to_have_text("widget-outside footer")

    expect_no_exception(app)
