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

from typing import Final

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import check_top_level_class, get_expander

EXPANDER_HEADER_IDENTIFIER = "summary"

NUMBER_OF_EXPANDERS: Final = 21


def test_expander_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that all expanders are displayed correctly via screenshot testing."""
    expander_elements = themed_app.get_by_test_id("stExpander")
    expect(expander_elements).to_have_count(NUMBER_OF_EXPANDERS)

    for expander in expander_elements.all():
        expect(expander.locator(EXPANDER_HEADER_IDENTIFIER).first).to_be_visible()

    assert_snapshot(expander_elements.nth(0), name="st_expander-sidebar_collapsed")
    assert_snapshot(expander_elements.nth(1), name="st_expander-normal_expanded")
    assert_snapshot(expander_elements.nth(2), name="st_expander-normal_collapsed")
    assert_snapshot(expander_elements.nth(3), name="st_expander-with_input")
    assert_snapshot(expander_elements.nth(4), name="st_expander-long_expanded")
    assert_snapshot(expander_elements.nth(5), name="st_expander-long_collapsed")
    assert_snapshot(expander_elements.nth(6), name="st_expander-with_material_icon")
    assert_snapshot(expander_elements.nth(7), name="st_expander-with_emoji_icon")
    assert_snapshot(expander_elements.nth(8), name="st_expander-markdown_label")
    assert_snapshot(expander_elements.nth(9), name="st_expander-nested")
    assert_snapshot(expander_elements.nth(11), name="st_expander-fixed_width")
    assert_snapshot(expander_elements.nth(12), name="st_expander-stretch_width")
    assert_snapshot(expander_elements.nth(14), name="st_expander-with_code_block")


def test_expander_collapses_and_expands(app: Page):
    """Test that an expander collapses and expands."""

    # Check that content is initially visible (starts expanded)
    expanded_expander = get_expander(app, "Normal expanded")
    expect(expanded_expander.get_by_text("I can collapse")).to_be_visible()

    # Click header to close it and check that content is no longer visible
    expander_header = expanded_expander.locator(EXPANDER_HEADER_IDENTIFIER)
    expander_header.click()
    expect(expanded_expander.get_by_text("I can collapse")).not_to_be_visible()

    # Click header again to expand it and check that content is visible again
    expander_header.click()
    expect(expanded_expander.get_by_text("I can collapse")).to_be_visible()


def test_empty_expander_rendered(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that an empty expander is rendered."""
    empty_expander = get_expander(app, "Empty")
    expect(empty_expander).to_be_visible()

    assert_snapshot(empty_expander, name="st_expander-empty")


def test_expander_session_state_set(app: Page):
    """Test that session state updates are propagated to expander content."""
    main_container = app.get_by_test_id("stMain")
    main_expanders = main_container.get_by_test_id("stExpander")
    expect(main_expanders).to_have_count(NUMBER_OF_EXPANDERS - 1)

    # Show the Number Input
    number_input_expander = get_expander(app, "With number input")
    num_input = number_input_expander.get_by_test_id("stNumberInput").locator("input")
    num_input.fill("10")
    num_input.press("Enter")
    wait_for_app_run(app)

    # Hide the Number Input
    number_input_expander.locator(EXPANDER_HEADER_IDENTIFIER).click()

    app.get_by_text("Update Num Input").click()
    wait_for_app_run(app)

    app.get_by_text("Print State Value").click()
    wait_for_app_run(app)

    text_elements = app.get_by_test_id("stText")
    expect(text_elements).to_have_count(2)

    expect(text_elements.nth(0)).to_have_text("0.0", use_inner_text=True)
    expect(text_elements.nth(1)).to_have_text("0.0", use_inner_text=True)


def test_expander_renders_icon(app: Page):
    """Test that an expander renders a material icon and an emoji icon."""
    material_icon = get_expander(app, "Material icon").get_by_test_id("stExpanderIcon")
    expect(material_icon).to_be_visible()
    expect(material_icon).to_have_text("bolt")

    emoji_icon = get_expander(app, "Emoji icon").get_by_test_id("stExpanderIcon")
    expect(emoji_icon).to_be_visible()
    expect(emoji_icon).to_have_text("🎈")


def test_expander_hover_states(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that expander hover states render correctly via snapshots."""
    # Test hover on normal collapsed expander
    normal_expander = get_expander(themed_app, "Normal collapsed")
    normal_expander.locator("summary").hover()
    assert_snapshot(normal_expander, name="st_expander-normal_collapsed_hover")

    # Test hover on collapsed expander with material icon
    material_expander = get_expander(themed_app, "Material icon")
    material_expander.locator("summary").hover()
    assert_snapshot(material_expander, name="st_expander-material_icon_collapsed_hover")

    # Test hover on expanded expander
    expanded_expander = get_expander(themed_app, "Normal expanded")
    expanded_expander.locator("summary").hover()
    assert_snapshot(expanded_expander, name="st_expander-expanded_hover")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stExpander")


def test_dynamic_expander_lazy_execution(app: Page):
    """Test that dynamic expander only executes content when open."""
    # Initially closed — lazy content should not have executed
    expect(app.get_by_text("Lazy execution count: 0")).to_be_visible()

    # Open the dynamic expander
    lazy_expander = get_expander(app, "Dynamic lazy execution")
    lazy_expander.locator("summary").click()
    wait_for_app_run(app)

    # Content should have executed once
    expect(app.get_by_text("Lazy content executed 1 times")).to_be_visible()
    expect(app.get_by_text("Lazy execution count: 1")).to_be_visible()

    # Close the expander
    lazy_expander.locator("summary").click()
    wait_for_app_run(app)

    # Count should stay at 1 — content didn't execute while closed
    expect(app.get_by_text("Lazy execution count: 1")).to_be_visible()


def test_dynamic_expander_programmatic_control(app: Page):
    """Test programmatic control of dynamic expander via session state."""
    prog_expander = get_expander(app, "Programmatic dynamic")

    # Initially closed — content not visible
    expect(prog_expander.get_by_text("Programmatically controlled")).not_to_be_visible()

    # Open via button
    app.get_by_test_id("stButton").filter(has_text="Open Dynamic").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Expander should be open with content visible
    expect(prog_expander.get_by_text("Programmatically controlled")).to_be_visible()

    # Close via button
    app.get_by_test_id("stButton").filter(has_text="Close Dynamic").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Content should not be visible
    expect(prog_expander.get_by_text("Programmatically controlled")).not_to_be_visible()


def test_dynamic_expander_nested(app: Page):
    """Test nested dynamic expanders with lazy execution."""
    # Initially both closed, neither should have executed
    expect(app.get_by_text("Nested execution - Outer: 0, Inner: 0")).to_be_visible()

    # Open outer expander — only outer should execute
    outer_expander = get_expander(app, "Outer dynamic")
    outer_expander.locator("summary").first.click()
    wait_for_app_run(app)

    expect(app.get_by_text("Outer executed 1 times")).to_be_visible()
    expect(app.get_by_text("Nested execution - Outer: 1, Inner: 0")).to_be_visible()

    # Open inner expander — both should execute (outer reruns, inner for first time)
    inner_expander = outer_expander.get_by_test_id("stExpander").filter(
        has=app.locator("summary").filter(has_text="Inner dynamic nested")
    )
    inner_expander.locator("summary").click()
    wait_for_app_run(app)

    expect(app.get_by_text("Outer executed 2 times")).to_be_visible()
    expect(app.get_by_text("Inner executed 1 times")).to_be_visible()
    expect(app.get_by_text("Nested execution - Outer: 2, Inner: 1")).to_be_visible()

    # Close inner — outer executes but inner doesn't
    inner_expander = outer_expander.get_by_test_id("stExpander").filter(
        has=app.locator("summary").filter(has_text="Inner dynamic nested")
    )
    inner_expander.locator("summary").click()
    wait_for_app_run(app)

    expect(app.get_by_text("Nested execution - Outer: 3, Inner: 1")).to_be_visible()

    # Close outer — neither executes
    outer_expander.locator("summary").first.click()
    wait_for_app_run(app)

    expect(app.get_by_text("Nested execution - Outer: 3, Inner: 1")).to_be_visible()


def test_dynamic_expander_nested_programmatic_control(app: Page):
    """Test programmatic control of nested dynamic expanders via buttons."""
    # Initially both closed
    expect(app.get_by_text("Nested execution - Outer: 0, Inner: 0")).to_be_visible()

    # Open outer via button
    app.get_by_test_id("stButton").filter(has_text="Open Outer").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    expect(app.get_by_text("Nested execution - Outer: 1, Inner: 0")).to_be_visible()

    # Open inner via button
    app.get_by_test_id("stButton").filter(has_text="Open Inner").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    expect(app.get_by_text("Nested execution - Outer: 2, Inner: 1")).to_be_visible()

    # Close inner via button
    app.get_by_test_id("stButton").filter(has_text="Close Inner").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    expect(app.get_by_text("Nested execution - Outer: 3, Inner: 1")).to_be_visible()

    # Close outer via button
    app.get_by_test_id("stButton").filter(has_text="Close Outer").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    expect(app.get_by_text("Nested execution - Outer: 3, Inner: 1")).to_be_visible()


def test_dynamic_expander_nested_state_preloading(app: Page):
    """Test that setting inner expander state before outer is opened works.

    Also verifies that widget state persists in session_state when a widget
    is temporarily unmounted (consistent with all Streamlit widgets).
    """
    # Initially both closed
    expect(app.get_by_text("Nested execution - Outer: 0, Inner: 0")).to_be_visible()

    # Set inner state before outer is rendered
    app.get_by_test_id("stButton").filter(has_text="Open Inner").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Outer still closed, neither executed
    expect(app.get_by_text("Nested execution - Outer: 0, Inner: 0")).to_be_visible()

    # Now open outer — inner should already be open because state was pre-set
    app.get_by_test_id("stButton").filter(has_text="Open Outer").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Both should execute
    expect(app.get_by_text("Nested execution - Outer: 1, Inner: 1")).to_be_visible()
    expect(app.get_by_text("Inner executed 1 times")).to_be_visible()

    # Close outer while inner is open (inner widget is unmounted)
    app.get_by_test_id("stButton").filter(has_text="Close Outer").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Neither executes while outer is closed
    expect(app.get_by_text("Nested execution - Outer: 1, Inner: 1")).to_be_visible()

    # Reopen outer — inner state was preserved in session_state while unmounted,
    # so inner should still be open (consistent with all Streamlit widget behavior)
    app.get_by_test_id("stButton").filter(has_text="Open Outer").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    expect(app.get_by_text("Nested execution - Outer: 2, Inner: 2")).to_be_visible()
    expect(app.get_by_text("Inner executed 2 times")).to_be_visible()


def test_expander_ignore_mode_does_not_trigger_rerun(app: Page):
    """Test that an expander with default on_change='ignore' does not trigger reruns."""
    rerun_text = app.get_by_text("Expander ignore rerun count:")
    expect(rerun_text).to_be_visible()
    initial_count = rerun_text.text_content()

    # Expand the ignore-mode expander
    ignore_expander = get_expander(app, "Ignore-mode expander")
    ignore_expander.locator("summary").click()

    # Rerun count should NOT have changed
    expect(rerun_text).to_have_text(initial_count or "")

    # Collapse it
    ignore_expander.locator("summary").click()

    # Still no rerun
    expect(rerun_text).to_have_text(initial_count or "")


def test_expander_callback_fires_on_toggle(app: Page):
    """Test that a callback fires when the expander is toggled."""
    # Initially callback count is 0
    expect(app.get_by_text("Callback count: 0")).to_be_visible()
    expect(app.get_by_text("Callback last state: None")).to_be_visible()

    # Expand the callback expander
    cb_expander = get_expander(app, "Callback expander")
    cb_expander.locator("summary").click()
    wait_for_app_run(app)

    # Callback should have fired, state should be True (expanded)
    expect(app.get_by_text("Callback count: 1")).to_be_visible()
    expect(app.get_by_text("Callback last state: True")).to_be_visible()

    # Collapse the callback expander
    cb_expander = get_expander(app, "Callback expander")
    cb_expander.locator("summary").click()
    wait_for_app_run(app)

    # Callback should have fired again, state should be False (collapsed)
    expect(app.get_by_text("Callback count: 2")).to_be_visible()
    expect(app.get_by_text("Callback last state: False")).to_be_visible()


def test_expander_callback_with_args_kwargs(app: Page):
    """Test that a callback with args and kwargs receives them correctly."""
    # Initially no result
    expect(app.get_by_text("Callback args result:", exact=True)).to_be_visible()

    # Expand the callback args expander
    cb_args_expander = get_expander(app, "Callback args expander")
    cb_args_expander.locator("summary").click()
    wait_for_app_run(app)

    # Callback should have received args and kwargs
    expect(app.get_by_text("Callback args result: hello-toggled-world")).to_be_visible()
