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
    """Test that st.steps renders correctly via screenshots.

    Verifies visual appearance across different configurations and themes.
    """
    steps_containers = themed_app.get_by_test_id("stSteps")
    expect(steps_containers).to_have_count(7)

    # Test various steps container configurations
    assert_snapshot(steps_containers.nth(0), name="st_steps-basic")
    assert_snapshot(steps_containers.nth(1), name="st_steps-state_examples")
    assert_snapshot(steps_containers.nth(2), name="st_steps-with_descriptions")
    assert_snapshot(steps_containers.nth(3), name="st_steps-custom_icons")
    assert_snapshot(steps_containers.nth(4), name="st_steps-with_content")
    assert_snapshot(steps_containers.nth(5), name="st_steps-scrollable")
    assert_snapshot(steps_containers.nth(6), name="st_steps-updated")


def test_step_states(app: Page):
    """Test that different step states render correct icons."""
    steps_containers = app.get_by_test_id("stSteps")
    state_steps = steps_containers.nth(1)

    # Check for spinner (running state) - uses stSpinnerIcon from DynamicIcon
    expect(state_steps.get_by_test_id("stSpinnerIcon")).to_be_visible()

    # Check for material icons inside the steps list
    # Uses stIconMaterial from MaterialFontIcon component
    # complete (check_circle) + error (error) + default (circle) = 3 icons inside stStepsList
    steps_list = state_steps.get_by_test_id("stStepsList")
    expect(steps_list.get_by_test_id("stIconMaterial")).to_have_count(3)


def test_step_content(app: Page):
    """Test that steps can contain nested content."""
    steps_containers = app.get_by_test_id("stSteps")
    content_steps = steps_containers.nth(4)

    # Check markdown content - use stMarkdown test ID for precision
    expect(content_steps.get_by_test_id("stMarkdown")).to_be_visible()

    # Check code block - uses stCode test ID
    expect(content_steps.get_by_test_id("stCode")).to_be_visible()
