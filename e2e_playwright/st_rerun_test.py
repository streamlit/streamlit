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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_toggle,
    expect_markdown,
    expect_prefixed_markdown,
    get_radio,
    get_text_input,
    get_toggle,
    select_radio_option,
    select_selectbox_option,
)


def _expect_initial_reruns_finished(app: Page):
    expect(app.get_by_test_id("stText")).to_have_text(
        "Being able to rerun a session is awesome!"
    )


def _expect_initial_reruns_count_text(app: Page):
    expect_prefixed_markdown(app, "app run count:", "4")


def _expect_body_level_rerun_widget_writes(app: Page):
    expect_prefixed_markdown(app, "Select1 write:", "Spam", exact_match=True)
    expect_prefixed_markdown(app, "Select2 write:", "Bacon", exact_match=True)
    expect_prefixed_markdown(app, "Select3 write:", "Sausage", exact_match=True)
    expect_prefixed_markdown(app, "toggle after write:", "True", exact_match=True)


def test_st_rerun_restarts_the_session_when_invoked(app: Page):
    _expect_initial_reruns_finished(app)


def test_fragment_scoped_st_rerun(app: Page):
    expect(app.get_by_test_id("stText")).to_have_text(
        "Being able to rerun a session is awesome!"
    )

    # perform multiple clicks to make sure that the fragment rerun works as expected
    # and the main app content is still rendered
    for i in range(1, 10):
        click_button(app, "rerun fragment")
        expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text(
            f"fragment run count: {i * 5}"
        )
        _expect_initial_reruns_count_text(app)

    # the main apps rerun count should not have been incremented
    _expect_initial_reruns_count_text(app)


def test_rerun_works_in_try_except_block(app: Page):
    _expect_initial_reruns_finished(app)
    _expect_initial_reruns_count_text(app)

    click_button(app, "rerun try_fragment")
    # the rerun in the try-block worked as expected, so the session_state count
    # incremented
    expect_prefixed_markdown(app, "app run count:", "5")


def test_state_retained_on_app_scoped_rerun(app: Page):
    # Sanity check 1
    expect_prefixed_markdown(app, "selectbox selection:", "None")

    # Click on the selectbox and select the first option.
    select_selectbox_option(app, "i should retain my state", "a")

    # Sanity check 2
    expect_markdown(app, "selectbox selection: a")

    # Rerun the fragment and verify that the selectbox kept its state
    click_button(app, "rerun whole app (from fragment)")
    expect_markdown(app, "selectbox selection: a")


# From GitHub issue #8599
def test_clears_stale_elements_correctly(app: Page):
    click_button(app, "#8599 - Bug")

    expect(app.get_by_text("#8599 - Bug")).to_have_count(1)


def test_st_rerun_in_widget_callback_preserves_widget_values(app: Page):
    """st.rerun() in a widget callback reruns without discarding widget values.

    One scenario test, since every step builds on the previous page state and e2e
    runs are expensive. Exact body-run counts are deliberately left to the AppTest
    in session_state_test.py: an assertion on the rendered run count here could
    match the intermediate value of a double run before the second run lands.
    """
    _expect_initial_reruns_finished(app)

    # Give a widget that no callback touches a value, so we can watch it survive
    # an interaction on a different widget.
    untouched_field = (
        get_text_input(app, "untouched by callbacks").locator("input").first
    )
    untouched_field.focus()
    untouched_field.fill("keep me")
    untouched_field.blur()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "untouched text:", "keep me", exact_match=True)

    # Typing here fires a callback that calls st.rerun().
    callback_field = get_text_input(app, "rerun from callback").locator("input").first
    callback_field.focus()
    callback_field.fill("hello")
    callback_field.press("Enter")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "callback count:", "1", exact_match=True)
    # The rerun takes effect: it interrupts the callback body.
    expect_prefixed_markdown(app, "resumed after rerun:", "False", exact_match=True)
    # The interacting widget keeps the value the user just entered...
    expect_prefixed_markdown(app, "callback text:", "hello", exact_match=True)
    # ...and so does every other widget in the app.
    expect_prefixed_markdown(app, "untouched text:", "keep me", exact_match=True)

    # A trigger is delivered to its callback and is not replayed to the body of
    # the rerun it queued.
    click_button(app, "rerun from button callback")
    expect_prefixed_markdown(app, "callback count:", "2", exact_match=True)
    expect_prefixed_markdown(app, "button in body:", "False", exact_match=True)
    expect_prefixed_markdown(app, "callback text:", "hello", exact_match=True)


def test_body_level_st_rerun_preserves_widget_values(app: Page):
    """Widgets after a body-level st.rerun() keep their values and the UI matches.

    Covers GitHub issue #3533: Python return values after the rerun used to reset
    to defaults while the radio/toggle UI still showed the previous selection.
    """
    _expect_initial_reruns_finished(app)
    _expect_initial_reruns_count_text(app)

    select_radio_option(app, "Spam", label="Select1")
    select_radio_option(app, "Bacon", label="Select2")
    select_radio_option(app, "Sausage", label="Select3")
    click_toggle(app, "Toggle after rerun")
    _expect_body_level_rerun_widget_writes(app)

    click_button(app, "body-level rerun")
    _expect_body_level_rerun_widget_writes(app)

    # Visible radio/toggle state must match the writes (no UI desync).
    select2 = get_radio(app, "Select2")
    expect(select2.get_by_role("radio", name="Bacon")).to_be_checked()
    expect(select2.get_by_role("radio", name="Egg")).not_to_be_checked()
    expect(
        get_radio(app, "Select3").get_by_role("radio", name="Sausage")
    ).to_be_checked()
    expect(get_toggle(app, "Toggle after rerun").locator("input")).to_be_checked()

    # Count is stable once the rerun finishes. Radio/toggle clicks and
    # st.rerun() also increment it, so this does not assert an exact value.
    count_markdown = app.get_by_test_id("stMarkdownContainer").filter(
        has_text="app run count:"
    )
    count_after_first = count_markdown.inner_text()
    wait_for_app_run(app)
    expect(count_markdown).to_have_text(count_after_first)

    click_button(app, "body-level rerun")
    expect(count_markdown).not_to_have_text(count_after_first)
    _expect_body_level_rerun_widget_writes(app)
