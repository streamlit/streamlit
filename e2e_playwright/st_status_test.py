# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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


def test_status_container_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.status renders correctly via screenshots."""
    status_containers = themed_app.get_by_test_id("stExpander")
    expect(status_containers).to_have_count(9)

    # Don't check screenshot for first element,
    # since we cannot reliably screenshot test the spinner icon.

    assert_snapshot(status_containers.nth(1), name="st_status-complete_state")
    assert_snapshot(status_containers.nth(2), name="st_status-error_state")
    assert_snapshot(status_containers.nth(3), name="st_status-collapsed")
    assert_snapshot(status_containers.nth(4), name="st_status-changed_label")
    assert_snapshot(status_containers.nth(5), name="st_status-without_cm")
    assert_snapshot(status_containers.nth(6), name="st_status-collapsed_via_update")
    assert_snapshot(status_containers.nth(7), name="st_status-empty_state")
    assert_snapshot(status_containers.nth(8), name="st_status-uncaught_exception")


def test_running_state(app: Page):
    """Test that st.status renders a spinner when in running state."""
    running_status = app.get_by_test_id("stExpander").nth(0)
    # Check if it has a spinner icon:
    expect(running_status.get_by_test_id("stExpanderIconSpinner")).to_be_visible()


def test_status_collapses_and_expands(app: Page):
    """Test that a status collapses and expands."""
    expander_content = "Doing some work..."
    running_status = app.get_by_test_id("stExpander").nth(0)
    # Starts expanded:
    expect(running_status.get_by_text(expander_content)).to_be_visible()

    expander_header = running_status.locator("summary")
    # Collapse:
    expander_header.click()
    expect(running_status.get_by_text(expander_content)).not_to_be_visible()
    # Expand:
    expander_header.click()
    expect(running_status.get_by_text(expander_content)).to_be_visible()
