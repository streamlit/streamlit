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
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.shared.app_utils import (
    click_form_button,
    expect_no_exception,
    get_element_by_key,
)
from e2e_playwright.shared.input_utils import (
    expect_global_hotkeys_not_fired,
    type_common_characters_into_input,
)


def section(app: Page, heading_name: str) -> Locator:
    """Return the stLayoutWrapper that contains the given heading.

    Uses a containment filter to scope DOM queries to the specific section.
    """
    heading = app.get_by_role("heading", name=heading_name, exact=True)
    return app.locator("[data-testid='stLayoutWrapper']").filter(has=heading).first


def test_empty_content_does_not_crash(app: Page) -> None:
    """CCv2 should allow empty component definitions (no js/html/css) without errors."""
    empty_container = get_element_by_key(app, "empty_component_container")
    expect(empty_container.get_by_role("heading", name="Empty content")).to_be_visible()
    expect_no_exception(app)
    expect(empty_container.get_by_test_id("stBidiComponentRegular")).to_have_count(1)
    expect(empty_container.get_by_text("After empty component")).to_be_visible()


def test_stateful_interactions(app: Page) -> None:
    # Initial values
    stateful = section(app, "Stateful")
    expect(stateful.get_by_label("Range").first).to_have_value("50")
    expect(stateful.get_by_label("Text").first).to_have_value("Text input")

    expect(
        stateful.get_by_text("Result: {'range': None, 'text': None}")
    ).to_be_visible()
    expect(stateful.get_by_text("session_state: {}")).to_be_visible()
    expect(stateful.get_by_text("Range change count: 0")).to_be_visible()
    expect(stateful.get_by_text("Text change count: 0")).to_be_visible()

    # Change Range value (only range changes)
    stateful.get_by_label("Range").first.fill("10")
    expect(stateful.get_by_label("Range").first).to_have_value("10")
    expect(
        stateful.get_by_text("Result: {'range': '10', 'text': None}")
    ).to_be_visible()
    expect(stateful.get_by_text("session_state: {'range': '10'}")).to_be_visible()
    expect(stateful.get_by_text("Range change count: 1")).to_be_visible()
    expect(stateful.get_by_text("Text change count: 0")).to_be_visible()

    # Change Text value (only text changes)
    stateful.get_by_label("Text").first.fill("Hello")
    expect(stateful.get_by_label("Text").first).to_have_value("Hello")
    expect(
        stateful.get_by_text("Result: {'range': '10', 'text': 'Hello'}")
    ).to_be_visible()
    expect(
        stateful.get_by_text("session_state: {'range': '10', 'text': 'Hello'}")
    ).to_be_visible()
    expect(stateful.get_by_text("Range change count: 1")).to_be_visible()
    expect(stateful.get_by_text("Text change count: 1")).to_be_visible()

    # Trigger an unrelated rerun via a Streamlit button; values remain
    app.get_by_text("st.button trigger").click()
    expect(
        stateful.get_by_text("Result: {'range': '10', 'text': 'Hello'}")
    ).to_be_visible()
    expect(stateful.get_by_text("session_state: {'range': '10', 'text': 'Hello'}"))
    expect(stateful.get_by_text("Range change count: 1")).to_be_visible()
    expect(stateful.get_by_text("Text change count: 1")).to_be_visible()


def test_trigger_interactions(app: Page) -> None:
    """Test the interactions with trigger callbacks and state in the Bidi Component."""
    trigger = section(app, "Trigger")

    # Bidi components load JS/HTML in an iframe; allow extra time on slower browsers
    expect(trigger.get_by_text("Foo count: 0")).to_be_visible(timeout=10000)
    expect(trigger.get_by_text("Bar count: 0")).to_be_visible()
    expect(trigger.get_by_text("Result: {'foo': None, 'bar': None}")).to_be_visible()
    expect(trigger.get_by_text("Session state: {}")).to_be_visible()

    trigger.get_by_text("Trigger foo").click()
    expect(trigger.get_by_text("Foo count: 1")).to_be_visible()
    expect(trigger.get_by_text("Bar count: 0")).to_be_visible()
    expect(trigger.get_by_text("Result: {'foo': True, 'bar': None}")).to_be_visible()
    expect(trigger.get_by_text("Session state: {'foo': True}"))

    trigger.get_by_text("Trigger bar").click()
    expect(trigger.get_by_text("Foo count: 1")).to_be_visible()
    expect(trigger.get_by_text("Bar count: 1")).to_be_visible()
    expect(trigger.get_by_text("Result: {'foo': None, 'bar': True}")).to_be_visible()
    expect(trigger.get_by_text("Session state: {'bar': True}"))

    # Trigger foo again so it has a different value from bar
    trigger.get_by_text("Trigger foo").click()
    expect(trigger.get_by_text("Foo count: 2")).to_be_visible()
    expect(trigger.get_by_text("Bar count: 1")).to_be_visible()
    expect(trigger.get_by_text("Result: {'foo': True, 'bar': None}")).to_be_visible()
    expect(trigger.get_by_text("Session state: {'foo': True}"))

    trigger.get_by_text("Trigger both").click()
    expect(trigger.get_by_text("Foo count: 3")).to_be_visible()
    expect(trigger.get_by_text("Bar count: 2")).to_be_visible()
    expect(trigger.get_by_text("Result: {'foo': True, 'bar': True}")).to_be_visible()
    expect(trigger.get_by_text("Session state: {'foo': True, 'bar': True}"))

    # Trigger a streamlit button to ensure the trigger values in the Bidi Component get reset
    trigger.get_by_text("st.button trigger").click()
    expect(trigger.get_by_text("Foo count: 3")).to_be_visible()
    expect(trigger.get_by_text("Bar count: 2")).to_be_visible()
    expect(trigger.get_by_text("Result: {'foo': None, 'bar': None}")).to_be_visible()
    expect(trigger.get_by_text("Session state: {}"))


def test_form_interactions_deferred_until_submit(app: Page) -> None:
    form = section(
        app,
        "Form context (defer state; triggers ignored by CCv2 semantics)",
    )

    # Initial state
    expect(app.get_by_text("Runs: 1", exact=True)).to_be_visible()
    expect(form.get_by_text("Form Text changes: 0")).to_be_visible()
    expect(form.get_by_text("Form Clicked count: 0")).to_be_visible()

    # Before submitting the form, interactions should NOT trigger a rerun.
    form.get_by_text("Set text (Form)").click()
    expect(app.get_by_text("Runs: 1", exact=True)).to_be_visible()
    expect(form.get_by_text("Form Text changes: 0")).to_be_visible()

    # Triggers are disallowed in forms for CCv2; this must be a no-op.
    form.get_by_text("Trigger click (Form)").click()
    expect(app.get_by_text("Runs: 1", exact=True)).to_be_visible()
    expect(form.get_by_text("Form Clicked count: 0")).to_be_visible()

    # Also the displayed state should still be empty before submit.
    expect(form.get_by_text("Form session state: {}"))

    # Submit the form and verify rerun + updates (only stateful changes apply).
    click_form_button(app, "Submit Form")

    expect(app.get_by_text("Runs: 2", exact=True)).to_be_visible()
    # Trigger callback remains unchanged due to no-op in form.
    expect(form.get_by_text("Form Text changes: 1")).to_be_visible()
    expect(form.get_by_text("Form Clicked count: 0")).to_be_visible()

    # Session state should now contain values set by the component.
    expect(form.get_by_text("Form session state:")).not_to_have_text(
        "Form session state: {}"
    )
    expect(form.get_by_text("Form session state:")).to_contain_text("text")


def test_fragment_interactions_rerun_only_fragment(app: Page) -> None:
    fragment = section(app, "Fragment context (partial reruns and local counters)")

    # Initial state for fragments
    expect(app.get_by_text("Runs: 1", exact=True)).to_be_visible()
    expect(fragment.get_by_text("Fragment session state: {}"))
    expect(fragment.get_by_text("Fragment Text changes: 0")).to_be_visible()
    expect(fragment.get_by_text("Fragment Clicked count: 0")).to_be_visible()

    # Interact inside fragment: should update fragment content and callbacks,
    # but NOT increment global runs.
    fragment.get_by_text("Set text (Fragment)").click()
    # Fragment state updates immediately
    expect(fragment.get_by_text("Fragment session state:")).not_to_have_text(
        "Fragment session state: {}"
    )
    expect(fragment.get_by_text("Fragment Text changes: 1")).to_be_visible()
    # Assert Runs remains 1
    expect(app.get_by_text("Runs: 1", exact=True)).to_be_visible()

    fragment.get_by_text("Trigger click (Fragment)").click()
    # Trigger inside fragment updates fragment-local UI/state; full Runs remains 1.
    expect(fragment.get_by_text("Fragment Clicked count: 1")).to_be_visible()
    expect(app.get_by_text("Runs: 1", exact=True)).to_be_visible()


def test_basic_initial_and_submission(app: Page) -> None:
    basic = section(app, "Basic (broad CSS + mixed state/trigger)")

    # Initial defaults from the component's HTML
    expect(basic.get_by_label("Range")).to_have_value("20")
    expect(basic.get_by_label("Text")).to_have_value("Text input")

    # Verify initial result/session_state reflects provided defaults
    result = basic.get_by_text("Result:")
    expect(result).to_contain_text("'formValues'")
    expect(result).to_contain_text("'range': 20")
    expect(result).to_contain_text("'text': 'Text input'")
    expect(result).to_contain_text("'clicked': None")

    session_state = basic.get_by_text("session_state:")
    expect(session_state).to_contain_text("'formValues'")
    expect(session_state).to_contain_text("'range': 20")
    expect(session_state).to_contain_text("'text': 'Text input'")
    expect(basic.get_by_text("Click count: 0")).to_be_visible()

    # Change inputs then submit the form and ensure stateful value updates
    basic.get_by_label("Range").fill("55")
    basic.get_by_label("Text").fill("Updated")
    basic.get_by_role("button", name="Submit form").click()

    result = basic.get_by_text("Result:")
    expect(result).to_contain_text("'clicked': True")
    expect(result).to_contain_text("'formValues'")
    expect(result).to_contain_text("'range': '55'")
    expect(result).to_contain_text("'text': 'Updated'")

    session_state = basic.get_by_text("session_state:")
    expect(session_state).to_contain_text("'clicked': True")
    expect(session_state).to_contain_text("'formValues'")
    expect(session_state).to_contain_text("'range': '55'")
    expect(session_state).to_contain_text("'text': 'Updated'")
    expect(basic.get_by_text("Click count: 1")).to_be_visible()


def test_typing_in_component_input_does_not_trigger_global_hotkeys(app: Page) -> None:
    hotkey = section(app, "Global hotkey interface")

    # This input is component-owned HTML <input>, not a Streamlit widget.
    text_input = hotkey.get_by_label("Hotkey Text")
    runs_text = hotkey.get_by_text("Hotkey runs: 1", exact=True)

    hotkey.scroll_into_view_if_needed()
    text_input.focus()

    expect_global_hotkeys_not_fired(app, expected_runs=1, runs_locator=runs_text)

    typed = type_common_characters_into_input(
        text_input,
        after_each=lambda _ch: expect_global_hotkeys_not_fired(
            app,
            expected_runs=1,
            runs_locator=runs_text,
        ),
    )
    expect(text_input).to_have_value(typed)


def test_arrow_serialization_works(app: Page) -> None:
    """Verify the consolidated Arrow component renders expected content."""
    arrow = section(app, "Arrow serialization")
    expect(arrow.get_by_text("Cols: a")).to_be_visible()
    expect(arrow.get_by_text('Rows: {"a": 1},{"a": 2},{"a": 3}')).to_be_visible()
    expect(arrow.get_by_text("Cols2: b")).to_be_visible()
    expect(arrow.get_by_text('Rows2: {"b": 4},{"b": 5},{"b": 6}')).to_be_visible()
    expect(arrow.get_by_text("Label: Hello World")).to_be_visible()
