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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    expect_markdown,
    get_element_by_key,
    get_expander,
)


def test_basic_steps_render_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Steps form one continuous timeline that an empty step terminates."""
    basic_steps = get_element_by_key(themed_app, "steps_basic")
    # The expanded step settles asynchronously, so wait for its content before
    # capturing the timeline.
    expect(basic_steps.get_by_text("Parsed the request")).to_be_visible()

    assert_snapshot(basic_steps, name="st_expander-step_basic")


def test_step_variants_render_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test the remaining step scenarios via screenshots."""
    broken_chain = get_element_by_key(app, "steps_broken_chain")
    expect(broken_chain.get_by_text("First chain content")).to_be_visible()

    assert_snapshot(
        get_element_by_key(app, "steps_status"), name="st_expander-step_status_states"
    )
    assert_snapshot(broken_chain, name="st_expander-step_broken_chain")

    empty_between = get_element_by_key(app, "steps_empty_between")
    expect(empty_between.get_by_text("Segment two content")).to_be_visible()
    # The divider step has no connector, so the timeline reads as two segments.
    divider = empty_between.get_by_test_id("stExpander").filter(
        has_text="Segment divider"
    )
    expect(divider.get_by_test_id("stExpanderStepConnector")).to_have_count(0)
    assert_snapshot(empty_between, name="st_expander-step_empty_between")

    assert_snapshot(
        get_element_by_key(app, "steps_custom_gap"), name="st_expander-step_custom_gap"
    )
    assert_snapshot(
        get_element_by_key(app, "steps_scrollable"), name="st_expander-step_scrollable"
    )
    assert_snapshot(
        get_element_by_key(app, "steps_params"), name="st_expander-step_with_params"
    )


def test_step_with_content_collapses_and_expands(app: Page):
    """A step with content toggles on click; a step without content does not."""
    collapsible = get_expander(app, "Searching for information")
    header = collapsible.locator("summary")
    expect(header).to_have_attribute("aria-expanded", "false")
    expect(collapsible.get_by_text("Collapsed step content")).not_to_be_visible()

    header.click()
    expect(header).to_have_attribute("aria-expanded", "true")
    expect(collapsible.get_by_text("Collapsed step content")).to_be_visible()

    header.click()
    expect(header).to_have_attribute("aria-expanded", "false")

    # The empty step is not a disclosure control at all, so clicking its label
    # must not turn it into one.
    empty_step = app.get_by_test_id("stExpander").filter(has_text="Generating response")
    empty_step.get_by_text("Generating response").click()
    expect(empty_step.locator("summary")).to_have_count(0)
    expect(empty_step.get_by_test_id("stExpanderStepConnector")).to_have_count(0)


def test_step_reveals_chevron_on_hover(app: Page):
    """Hovering a collapsible step swaps its icon for a chevron."""
    step = get_expander(app, "Searching for information")
    chevron = step.get_by_test_id("stExpanderStepChevron")
    state_icon = step.get_by_test_id("stExpanderStepIcon")

    expect(chevron).not_to_be_visible()
    expect(state_icon).to_be_visible()

    step.locator("summary").hover()
    expect(chevron).to_be_visible()
    expect(state_icon).not_to_be_visible()


def test_step_reveals_chevron_on_keyboard_focus_and_toggles_with_enter(app: Page):
    """Keyboard focus reveals the chevron and Enter toggles the step."""
    first_step = get_expander(app, "Understanding the question")
    second_step = get_expander(app, "Searching for information")

    # Tabbing from the first step moves focus to the second one, which gives us
    # a real :focus-visible state (unlike a programmatic focus() call).
    first_step.locator("summary").focus()
    app.keyboard.press("Tab")

    expect(second_step.get_by_test_id("stExpanderStepChevron")).to_be_visible()
    expect(second_step.get_by_test_id("stExpanderStepIcon")).not_to_be_visible()

    app.keyboard.press("Enter")
    expect(second_step.locator("summary")).to_have_attribute("aria-expanded", "true")
    expect(second_step.get_by_text("Collapsed step content")).to_be_visible()


def test_step_status_states_are_announced(app: Page):
    """Each status state picks its own icon and is part of the accessible name."""
    running = get_expander(app, "Loading data")
    expect(running.locator("summary")).to_have_accessible_name("Loading data — running")
    expect(running.get_by_test_id("stSpinnerIcon")).to_be_visible()

    # st.status transitions to "complete" when the context manager exits.
    completed = get_expander(app, "Fetching results")
    expect(completed.locator("summary")).to_have_accessible_name(
        "Fetching results — complete"
    )
    expect(completed.get_by_text("check_circle", exact=True)).to_be_visible()

    # .update(state="error") re-renders the step in the error state.
    updated = get_expander(app, "Update target")
    expect(updated.locator("summary")).to_have_accessible_name("Update target — error")
    expect(updated.get_by_text("error", exact=True)).to_be_visible()

    # A step-style expander has no progress state, so nothing is appended to
    # the accessible name computed from its label.
    stateless = get_expander(app, "Searching for information")
    expect(stateless.locator("summary")).to_have_accessible_name(
        "Searching for information"
    )


def test_keyed_step_persists_expanded_state_and_reruns(app: Page):
    """A keyed step keeps its state across reruns and can notify the backend."""
    step = get_expander(app, "Keyed step")
    header = step.locator("summary")
    expect(header).to_have_attribute("aria-expanded", "false")

    header.click()
    wait_for_app_run(app)
    expect(header).to_have_attribute("aria-expanded", "true")
    expect_markdown(app, "Keyed step expanded: True")

    # The expanded state has to survive a rerun that does not touch the step.
    click_button(app, "Rerun")
    expect(get_expander(app, "Keyed step").locator("summary")).to_have_attribute(
        "aria-expanded", "true"
    )
    expect_markdown(app, "Keyed step expanded: True")
