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

"""E2E regression tests for element hash memo optimization.

These tests verify that the element hash memo optimization doesn't break expected
behavior when identical content is sent on consecutive reruns.
"""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    expect_markdown,
    get_button,
    get_slider,
    get_text_input,
)


def test_setvalue_oneshot_preserved_on_rerun(app: Page):
    """Test that setValue=True commands are delivered even when the protobuf hash matches.

    This verifies that text_input with a programmatic value is correctly set
    on every rerun, not cached/skipped due to hash matching.
    """
    # Initial state
    expect_markdown(app, "Text input counter: 1")
    text_input = get_text_input(app, "Programmatic value input")
    text_input_field = text_input.locator("input").first
    expect(text_input_field).to_have_value("fixed_value")

    # Click rerun button multiple times and verify value is preserved
    for expected_counter in range(2, 5):
        click_button(app, "Trigger rerun")
        expect_markdown(app, f"Text input counter: {expected_counter}")
        # Value should still be "fixed_value", not cleared or stale
        expect(text_input_field).to_have_value("fixed_value")


def test_slider_setvalue_preserved_on_rerun(app: Page):
    """Test that slider setValue commands are delivered even when the protobuf hash matches.

    Similar to text_input test, but for slider widget.
    """
    # Initial state
    expect_markdown(app, "Slider counter: 1")
    slider = get_slider(app, "Programmatic slider")
    # The slider should show value 50
    expect(slider).to_contain_text("50")

    # Click rerun button multiple times and verify value is preserved
    for expected_counter in range(2, 5):
        click_button(app, "Trigger slider rerun")
        expect_markdown(app, f"Slider counter: {expected_counter}")
        # Value should still be 50, not reset to default
        expect(slider).to_contain_text("50")


def test_balloons_animate_on_each_run(app: Page):
    """Test that balloons animate on each script run, not cached.

    Verifies that st.balloons() triggers animation on every button click,
    not skipped due to hash matching.
    """
    balloons = app.get_by_test_id("stBalloons")

    # Initially no balloons visible
    expect(balloons).to_have_count(0)

    # Click button to show balloons
    get_button(app, "Show balloons").click()

    # Wait for balloons to appear (don't wait for full app run since balloons are transient)
    expect(balloons).to_have_count(1)
    expect(app.get_by_text("Balloons shown: 1")).to_be_visible()

    # Wait for app to finish running
    wait_for_app_run(app)

    # Click button again - should trigger new animation
    # Note: We don't check that balloons disappeared since they may still be animating
    get_button(app, "Show balloons").click()

    # Balloons should appear again (new animation, not cached)
    # The counter should increment to 2
    expect(app.get_by_text("Balloons shown: 2")).to_be_visible()

    wait_for_app_run(app)


def test_spinner_time_updates_on_rerun(app: Page):
    """Test that spinner elapsed time resets/continues correctly on new runs.

    Verifies that the spinner with show_time=True displays updating time
    and doesn't show frozen/stale values from previous runs.
    """
    # Click to start spinner with show_time
    get_button(app, "Run spinner with time").click()

    spinner = app.get_by_test_id("stSpinner")
    expect(spinner).to_be_visible()
    expect(spinner).to_contain_text("Loading with time...")
    expect(spinner).to_contain_text("seconds")

    # Capture initial time text
    initial_text = spinner.text_content()

    # Wait a bit and verify time updates (not frozen)
    app.wait_for_timeout(300)
    updated_text = spinner.text_content()
    assert initial_text != updated_text, "Spinner time should be updating"

    # Wait for spinner to complete
    wait_for_app_run(app)
    expect(spinner).to_have_count(0)

    # Start spinner again via rerun button
    get_button(app, "Run spinner with time").click()

    # Spinner should appear with fresh timing (time should reset or start fresh)
    expect(spinner).to_be_visible()
    expect(spinner).to_contain_text("Loading with time...")

    # The time display should be present and updating
    new_spinner_text = spinner.text_content()
    assert "seconds" in new_spinner_text, "Spinner should show time"

    # Wait and verify it's still updating (not frozen from previous run)
    app.wait_for_timeout(300)
    newer_text = spinner.text_content()
    assert new_spinner_text != newer_text, (
        "Spinner time should continue updating on new run"
    )
