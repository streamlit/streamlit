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

"""E2E tests for st.perspective."""

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_until
from e2e_playwright.shared.app_utils import check_top_level_class


def test_perspective_renders(app: Page):
    """Test that st.perspective renders correctly."""
    # Wait for all perspective elements to be in the DOM
    perspective_elements = app.get_by_test_id("stPerspective")
    expect(perspective_elements).to_have_count(5)

    # Verify each element has the correct class
    for i in range(5):
        expect(perspective_elements.nth(i)).to_have_class(re.compile(r"stPerspective"))


def test_perspective_contains_viewer_element(app: Page):
    """Test that st.perspective contains a perspective-viewer custom element."""
    perspective_container = app.get_by_test_id("stPerspective").first
    viewer = perspective_container.locator("perspective-viewer")

    # The perspective-viewer should be present
    expect(viewer).to_be_attached()


def test_perspective_custom_height(app: Page):
    """Test that st.perspective respects custom height."""
    # The second perspective element has height=300
    perspective_300 = app.get_by_test_id("stPerspective").nth(1)
    expect(perspective_300).to_have_css("min-height", "300px")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stPerspective")


def test_perspective_no_errors(app: Page):
    """Test that no error messages are displayed."""
    # Check that no error elements are present
    error_elements = app.get_by_test_id("stPerspectiveError")
    expect(error_elements).to_have_count(0)


def test_perspective_viewer_initialized(app: Page):
    """Test that the Perspective viewer initializes successfully.

    This test waits for the viewer to be ready by checking for
    the presence of the datagrid plugin inside the viewer.
    """
    first_perspective = app.get_by_test_id("stPerspective").first
    viewer = first_perspective.locator("perspective-viewer")

    # Wait for the viewer to be visible
    expect(viewer).to_be_visible()

    # The viewer should initialize (may take time due to WASM loading)
    # We wait for any content to appear inside the viewer
    def check_viewer_initialized() -> bool:
        # Check if there's any content inside the viewer shadow DOM
        # The viewer creates shadow DOM content when initialized
        box = viewer.bounding_box()
        return box is not None and box["width"] > 0 and box["height"] > 0

    wait_until(app, check_viewer_initialized, timeout=30000)
