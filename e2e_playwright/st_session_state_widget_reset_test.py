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

"""Deleting a widget key from st.session_state resets the widget UI too.

See issue #16388 and the ``SessionState._pending_delete_resets`` field comment.
"""

import re

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    fill_number_input,
    get_checkbox,
    get_element_by_key,
    get_multiselect,
    get_number_input,
    get_selectbox,
    get_slider,
    get_text_input,
    select_selectbox_option,
)


def _text_input_field(app: Page, label: str) -> Locator:
    """Return the input element of a text input, so a test can read its value."""
    return get_text_input(app, label).locator("input").first


def _slider_thumb_value(app: Page, label: str) -> Locator:
    """Return the value label a slider renders above its thumb."""
    return get_slider(app, label).get_by_test_id("stSliderThumbValue")


def _fill_text_input(app: Page, label: str, value: str) -> None:
    """Fill a text input, submit it with Enter, and wait for the rerun."""
    field = _text_input_field(app, label)
    field.fill(value)
    field.press("Enter")
    wait_for_app_run(app)


def _select_multiselect_option(app: Page, label: str, option: str) -> None:
    """Select one multiselect option, close the dropdown, and wait for the rerun."""
    multiselect = get_multiselect(app, label)
    multiselect.locator("input").click()
    app.get_by_role("option", name=option, exact=True).first.click()
    app.keyboard.press("Escape")
    wait_for_app_run(app)


def _nudge_slider(app: Page) -> None:
    """Move the slider one step away from its default with the keyboard."""
    get_slider(app, "Slide").get_by_role("slider").press("ArrowRight")
    wait_for_app_run(app)


def _expect_state_value(app: Page, key: str, expected: str) -> None:
    """Assert the st.session_state readout rendered by the app."""
    expect(get_element_by_key(app, f"{key}_value")).to_have_text(f"{key}: {expected}")


def _change_every_widget(app: Page) -> None:
    _fill_text_input(app, "Text", "hello")
    fill_number_input(app, "Num", 7)
    select_selectbox_option(app, "Sel", "C")
    _select_multiselect_option(app, "Multi", "B")
    _nudge_slider(app)
    click_checkbox(app, "Check")
    _fill_text_input(app, "Bound", "bound_value")


def _expect_defaults_in_widget_ui(app: Page) -> None:
    """Assert every widget renders its default, not only the state readout.

    Without the fix the backend resolves the default while the browser keeps
    showing the deleted value, so these seven assertions fail.
    """
    expect(_text_input_field(app, "Text")).to_have_value("default")
    expect(get_number_input(app, "Num").locator("input").first).to_have_value("1")
    expect(get_selectbox(app, "Sel").locator("input").first).to_have_value("A")
    expect(
        get_multiselect(app, "Multi").get_by_role(
            "button", name=re.compile(r"^Remove ")
        )
    ).to_have_count(0)
    expect(_slider_thumb_value(app, "Slide")).to_have_text("3")
    expect(get_checkbox(app, "Check").locator("input").first).not_to_be_checked()
    expect(_text_input_field(app, "Bound")).to_have_value("default")


def _expect_defaults_in_state(app: Page) -> None:
    _expect_state_value(app, "text", "default")
    _expect_state_value(app, "num", "1")
    _expect_state_value(app, "sel", "A")
    _expect_state_value(app, "multi", "[]")
    _expect_state_value(app, "slide", "3")
    _expect_state_value(app, "check", "False")
    _expect_state_value(app, "bound", "default")


def test_delete_in_callback_resets_every_widget(app: Page) -> None:
    """A delete in a callback resets every widget, and the reset then holds.

    The scenario changes every widget once, deletes every key, and asserts the
    default in the widget UI and in the state readout. It then reruns the app to
    prove the browser does not resend the deleted value, and changes a widget
    again to prove the reset is one-shot.

    Issue #5442 claims st.slider already behaves correctly. The slider
    assertions in _expect_defaults_in_widget_ui show that it does not.
    """
    _change_every_widget(app)
    # The slider must really leave its default, or the reset assertion below
    # would hold for the wrong reason.
    expect(_slider_thumb_value(app, "Slide")).to_have_text("4")
    _expect_state_value(app, "text_changes", "1")

    click_button(app, "Delete in callback")

    _expect_defaults_in_widget_ui(app)
    _expect_defaults_in_state(app)
    # The reset must not look like a user change, so on_change must not fire.
    _expect_state_value(app, "text_changes", "1")

    # A plain rerun must not bring the deleted values back.
    click_button(app, "Noop")

    _expect_defaults_in_widget_ui(app)
    _expect_defaults_in_state(app)

    # The reset is one-shot, so the user can change a widget again.
    _fill_text_input(app, "Text", "second")

    expect(_text_input_field(app, "Text")).to_have_value("second")
    _expect_state_value(app, "text", "second")
    # on_change stays live after the reset.
    _expect_state_value(app, "text_changes", "2")


def test_delete_clears_the_url_of_a_bound_widget(app: Page) -> None:
    """A bind="query-params" widget also loses its query parameter."""
    _fill_text_input(app, "Bound", "bound_value")
    expect(app).to_have_url(re.compile(r"bound=bound_value"))

    click_button(app, "Delete in callback")

    expect(app).not_to_have_url(re.compile(r"bound="))
    expect(_text_input_field(app, "Bound")).to_have_value("default")

    # The URL must stay clear, or the next rerun seeds the deleted value back.
    click_button(app, "Noop")

    expect(app).not_to_have_url(re.compile(r"bound="))
    _expect_state_value(app, "bound", "default")


def test_script_body_delete_defers_the_reset_and_yields_to_a_change(
    app: Page,
) -> None:
    """A script-body delete resets on the next rerun, but a change beats it.

    The delete runs after the widget rendered, so both sides keep the old value
    for the rest of that run. A plain rerun then applies the reset. A user change
    that arrives before the reset is newer than the delete, so it must survive.
    """
    field = _text_input_field(app, "Body")

    _fill_text_input(app, "Body", "body1")
    _expect_state_value(app, "body", "body1")

    # The delete run keeps the old value on both sides.
    click_button(app, "Delete in script body")
    expect(field).to_have_value("body1")
    _expect_state_value(app, "body", "body1")

    # A plain rerun resends the same value, so the reset applies.
    click_button(app, "Noop")
    expect(field).to_have_value("body_default")
    _expect_state_value(app, "body", "body_default")

    # The widget still works after the reset.
    _fill_text_input(app, "Body", "body2")
    _expect_state_value(app, "body", "body2")

    # Arm the delete again, then change the widget before the reset applies.
    click_button(app, "Delete in script body")
    _fill_text_input(app, "Body", "body3")

    # The change must win over the pending delete reset, and it must hold.
    expect(field).to_have_value("body3")
    _expect_state_value(app, "body", "body3")
    click_button(app, "Noop")
    expect(field).to_have_value("body3")
    _expect_state_value(app, "body", "body3")
