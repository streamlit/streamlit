# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from conftest import ImageCompareFunction


def test_status_container_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.status renders correctly via screenshots."""
    status_containers = themed_app.get_by_test_id("stExpander")
    expect(status_containers).to_have_count(9)

    # Don't check screenshot for first element,
    # since we cannot reliably screenshot test the spinner icon.
    for i, element in enumerate(status_containers.all()[1:]):
        assert_snapshot(element, name=f"status-{i}")


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

    expander_header = running_status.locator(".streamlit-expanderHeader")
    # Collapse:
    expander_header.click()
    expect(running_status.get_by_text(expander_content)).not_to_be_attached()
    # Expand:
    expander_header.click()
    expect(running_status.get_by_text(expander_content)).to_be_visible()
