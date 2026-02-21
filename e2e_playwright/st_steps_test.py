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

from e2e_playwright.conftest import ImageCompareFunction


def test_steps_container_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.steps renders correctly via screenshots."""
    steps_containers = themed_app.get_by_test_id("stStepsContainer")
    expect(steps_containers).to_have_count(9)

    # Test various steps container configurations
    assert_snapshot(steps_containers.nth(0), name="st_steps-basic")
    assert_snapshot(steps_containers.nth(1), name="st_steps-with_label")
    assert_snapshot(steps_containers.nth(2), name="st_steps-state_examples")
    assert_snapshot(steps_containers.nth(3), name="st_steps-with_descriptions")
    assert_snapshot(steps_containers.nth(4), name="st_steps-custom_icons")
    assert_snapshot(steps_containers.nth(5), name="st_steps-with_content")
    assert_snapshot(steps_containers.nth(6), name="st_steps-collapsed")
    assert_snapshot(steps_containers.nth(7), name="st_steps-scrollable")
    assert_snapshot(steps_containers.nth(8), name="st_steps-updated")


def test_steps_with_label(app: Page):
    """Test that st.steps with label renders the label."""
    steps_containers = app.get_by_test_id("stStepsContainer")
    pipeline = steps_containers.nth(1)

    # Check label is visible
    expect(pipeline.locator("summary")).to_contain_text("My Pipeline")


def test_step_states(app: Page):
    """Test that different step states render correct icons."""
    steps_containers = app.get_by_test_id("stStepsContainer")
    state_steps = steps_containers.nth(2)

    # Check for spinner (running state)
    expect(state_steps.get_by_test_id("stStepIconSpinner")).to_be_visible()

    # Check for material icons (complete and error states)
    expect(state_steps.get_by_test_id("stStepIcon")).to_have_count(3)


def test_step_content(app: Page):
    """Test that steps can contain nested content."""
    steps_containers = app.get_by_test_id("stStepsContainer")
    content_steps = steps_containers.nth(5)

    # Check markdown content
    expect(content_steps.get_by_text("markdown")).to_be_visible()

    # Check code block
    expect(content_steps.locator(".stCodeBlock")).to_be_visible()


def test_collapsed_steps_container(app: Page):
    """Test that collapsed steps container hides content."""
    steps_containers = app.get_by_test_id("stStepsContainer")
    collapsed = steps_containers.nth(6)

    # The details element should not be open
    details = collapsed.locator("details")
    expect(details).not_to_have_attribute("open", "")


def test_steps_expand_collapse(app: Page):
    """Test that steps container can be expanded and collapsed."""
    steps_containers = app.get_by_test_id("stStepsContainer")
    pipeline = steps_containers.nth(1)

    # Initially expanded
    details = pipeline.locator("details")
    expect(details).to_have_attribute("open", "")

    # Click to collapse
    summary = pipeline.locator("summary")
    summary.click()

    # Wait for animation and check collapsed
    app.wait_for_timeout(500)
    expect(details).not_to_have_attribute("open", "")

    # Click to expand again
    summary.click()
    app.wait_for_timeout(500)
    expect(details).to_have_attribute("open", "")
