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

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import get_button


def test_skeleton_context_manager_instant(app: Page):
    """Test context manager mode clears skeleton immediately."""
    # Initially no success message
    expect(app.get_by_text("Context manager completed!")).not_to_be_visible()

    # Click the button to run the context manager
    get_button(app, "Run skeleton context manager (instant)").click()

    # Wait for app to finish running
    wait_for_app_run(app)

    # Success message should appear (skeleton was cleared)
    expect(app.get_by_text("Context manager completed!")).to_be_visible()
    # Skeleton should be gone after context manager exits
    expect(app.get_by_test_id("stSkeleton")).not_to_be_visible()


def test_skeleton_context_manager_with_delay(app: Page):
    """Test context manager mode shows skeleton during delay then clears."""
    # Click the button to run the context manager
    get_button(app, "Run skeleton context manager (with delay)").click()

    # Skeleton should appear while processing
    expect(app.get_by_test_id("stSkeleton")).to_be_visible(timeout=2000)

    # Wait for app to finish running - use expect with longer timeout
    # since wait_for_app_run doesn't accept timeout
    expect(app.get_by_text("Data loaded after delay!")).to_be_visible(timeout=5000)
    # Skeleton should be gone after context manager exits
    expect(app.get_by_test_id("stSkeleton")).not_to_be_visible()


def test_skeleton_context_manager_with_exception(app: Page):
    """Test context manager mode clears skeleton even on exception."""
    # Click the button to run the context manager that raises exception
    get_button(app, "Run skeleton context manager (with exception)").click()

    # Wait for error message with longer timeout for processing
    expect(app.get_by_text("Exception caught - skeleton was cleared")).to_be_visible(
        timeout=3000
    )
    # Skeleton should be gone even after exception
    expect(app.get_by_test_id("stSkeleton")).not_to_be_visible()


def test_skeleton_standalone_replacement(app: Page):
    """Test standalone mode replaces skeleton with content."""
    # Click the button to run standalone mode
    get_button(app, "Run skeleton standalone mode").click()

    # Skeleton should appear while loading (before dataframe replaces it)
    expect(app.get_by_test_id("stSkeleton")).to_be_visible(timeout=2000)

    # Wait for dataframe to appear (skeleton replaced)
    expect(app.get_by_test_id("stDataFrame")).to_be_visible(timeout=5000)
    # Original skeleton should be gone (replaced by dataframe)
    expect(app.get_by_test_id("stSkeleton")).not_to_be_visible()


def test_skeleton_standalone_clear(app: Page):
    """Test standalone mode clears skeleton with empty()."""
    # Click the button to run standalone clear
    get_button(app, "Run skeleton standalone clear").click()

    # Wait for info message (skeleton was cleared)
    expect(app.get_by_text("Skeleton was cleared with empty()")).to_be_visible(
        timeout=3000
    )
    # Skeleton should be gone after empty() call
    expect(app.get_by_test_id("stSkeleton")).not_to_be_visible()


def test_skeleton_in_fragment(app: Page):
    """Test skeleton works correctly within a fragment."""
    # Click button to test fragment
    get_button(app, "Test skeleton in fragment").click()

    # Skeleton should appear inside the fragment while processing
    expect(app.get_by_test_id("stSkeleton")).to_be_visible(timeout=2000)

    # Wait for the fragment to complete
    expect(app.get_by_text("Fragment completed!")).to_be_visible(timeout=3000)

    # The rerun fragment button should be visible
    expect(app.get_by_role("button", name="Rerun fragment", exact=True)).to_be_visible()
    # Skeleton should be gone after fragment completes
    expect(app.get_by_test_id("stSkeleton")).not_to_be_visible()
