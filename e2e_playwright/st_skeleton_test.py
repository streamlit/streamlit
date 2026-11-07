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
    get_button,
    get_element_by_key,
    get_toggle,
)


def test_skeleton_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot test for static skeleton element."""
    # Get the first skeleton (the one under "Static Skeleton" heading)
    skeleton = app.get_by_test_id("stSkeletonElement").first
    expect(skeleton).to_be_visible()
    assert_snapshot(skeleton, name="st_skeleton-default")


def test_skeleton_default_height(app: Page):
    """Test that a skeleton without an explicit height uses the standard
    element height (theme.sizes.minElementHeight == 2.5rem == 40px).
    """
    skeleton = get_element_by_key(app, "default_skeleton").get_by_test_id(
        "stSkeletonElement"
    )
    expect(skeleton).to_be_visible()
    expect(skeleton).to_have_css("height", "40px")


def test_skeleton_width_configurations(app: Page):
    """Test skeleton with different width configurations."""
    # 1 static + 1 default + 2 width + 1 in form
    expect(app.get_by_test_id("stSkeletonElement")).to_have_count(5)

    # The fixed width skeleton (200px) should be visible and have correct width.
    fixed_width_skeleton = get_element_by_key(
        app, "fixed_width_skeleton"
    ).get_by_test_id("stSkeletonElement")
    expect(fixed_width_skeleton).to_be_visible()
    expect(fixed_width_skeleton).to_have_css("width", "200px")

    # The stretch width skeleton should be visible.
    stretch_width_skeleton = get_element_by_key(
        app, "stretch_width_skeleton"
    ).get_by_test_id("stSkeletonElement")
    expect(stretch_width_skeleton).to_be_visible()


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


def test_skeleton_context_manager_with_delay(app: Page):
    """Test context manager mode shows skeleton during delay then clears."""
    # Scope the skeleton-count assertions to the delayed context manager's keyed
    # container, so the test does not depend on the total number of static
    # skeletons rendered elsewhere in the app.
    cm_skeletons = get_element_by_key(app, "delay_cm_container").get_by_test_id(
        "stLoadingBlockSkeleton"
    )
    expect(cm_skeletons).to_have_count(0)

    # Click the button to run the context manager
    get_button(app, "Run skeleton context manager (with delay)").click()

    # The block is new in this run, so its skeleton reserves space right away.
    expect(cm_skeletons).to_have_count(1, timeout=3000)

    # The success message appears after the skeleton clears...
    expect(app.get_by_text("Data loaded after delay!")).to_be_visible(timeout=10000)
    # ...and the skeleton must be gone, because the block drew nothing.
    expect(cm_skeletons).to_have_count(0)


def test_skeleton_context_manager_with_exception(app: Page):
    """Test context manager mode clears skeleton even on exception."""
    # Click the button to run the context manager that raises exception
    get_button(app, "Run skeleton context manager (with exception)").click()

    # Wait for error message with longer timeout for processing
    # (the script has a 0.7s sleep before raising the exception)
    expect(app.get_by_text("Exception caught - skeleton was cleared")).to_be_visible(
        timeout=10000
    )


def test_skeleton_standalone_replacement(app: Page):
    """Test standalone mode replaces skeleton with content."""
    # Wait for the app to finish any previous runs
    wait_for_app_run(app)

    # Click the button to run standalone mode
    button = get_button(app, "Run skeleton standalone mode")
    button.click()

    # Wait for the app to run (this includes the 1s sleep in the script)
    wait_for_app_run(app)

    # Wait for dataframe to appear (skeleton replaced)
    expect(app.get_by_test_id("stDataFrame")).to_be_visible(timeout=5000)


def test_skeleton_standalone_clear(app: Page):
    """Test standalone mode clears skeleton with empty()."""
    # Click the button to run standalone clear
    get_button(app, "Run skeleton standalone clear").click()

    # Wait for info message (skeleton was cleared)
    expect(app.get_by_text("Skeleton was cleared with empty()")).to_be_visible(
        timeout=3000
    )


def test_skeleton_in_fragment(app: Page):
    """Test skeleton works correctly within a fragment."""
    # Click button to test fragment
    get_button(app, "Test skeleton in fragment").click()

    # Wait for the fragment to complete - fragment has a 1s sleep inside a skeleton
    # context manager, so we need a longer timeout
    expect(app.get_by_text("Fragment completed!")).to_be_visible(timeout=10000)

    # The rerun fragment button should be visible
    expect(app.get_by_role("button", name="Rerun fragment", exact=True)).to_be_visible()


def test_skeleton_in_form(app: Page):
    """Test skeleton works correctly within a form."""
    # Verify skeleton is visible in the form
    form = app.get_by_test_id("stForm")
    expect(form).to_be_visible()

    # Skeleton should be in the form
    skeleton_in_form = form.get_by_test_id("stSkeletonElement")
    expect(skeleton_in_form).to_be_visible()

    # Submit the form
    form.get_by_role("button", name="Submit").click()
    wait_for_app_run(app)

    # The skeleton should be replaced with success message
    expect(form.get_by_text("Form submitted!")).to_be_visible()
    # Skeleton should be gone (replaced)
    expect(skeleton_in_form).not_to_be_visible()


def test_skeleton_keeps_previous_content_while_reloading(app: Page):
    """A skeleton covers the previous run's content instead of replacing it.

    On a cache miss, the previous content stays mounted under the skeleton and
    is updated in place. The cached function's spinner text becomes the
    skeleton's label instead of a second loading indicator.
    """
    container = get_element_by_key(app, "cached_skeleton_container")
    # Click without waiting for the run, so the first-load skeleton is observable.
    get_toggle(app, "Show cached report").click()

    # First load: nothing to keep, so the skeleton reserves the space.
    expect(container.get_by_test_id("stLoadingBlockSkeleton")).to_be_visible()
    expect(container.get_by_text("Report version 0")).to_be_visible(timeout=5000)
    expect(container.get_by_test_id("stLoadingBlockSkeleton")).not_to_be_attached()

    # Cache miss: the previous report stays mounted, covered by the skeleton.
    get_button(app, "Load next report version").click()
    overlay = container.get_by_test_id("stPendingSkeleton")
    expect(overlay).to_be_visible(timeout=3000)
    expect(overlay.get_by_text("Loading report...")).to_be_visible()
    expect(container.get_by_text("Report version 0")).to_be_attached()
    expect(container.get_by_test_id("stSpinner")).not_to_be_attached()

    expect(container.get_by_text("Report version 1")).to_be_visible(timeout=5000)
    expect(overlay).not_to_be_attached()

    # Cached rerun: the report updates in place without a skeleton.
    click_button(app, "Rerun skeleton report")
    expect(container.get_by_text("Report version 1")).to_be_visible()
    expect(overlay).not_to_be_attached()


def test_fragment_loading_skeleton_covers_content_on_fragment_rerun(app: Page):
    """A fragment with loading="skeleton" covers its content on a slow rerun.

    The first load shows the skeleton in place of the fragment. A fragment-only
    rerun that misses the cache keeps the previous content mounted under the
    skeleton overlay and updates it in place.
    """
    container = get_element_by_key(app, "fragment_skeleton_container")
    # Click without waiting for the run, so the first-load skeleton is observable.
    get_toggle(app, "Show fragment report").click()

    skeleton = container.get_by_test_id("stLoadingBlockSkeleton")
    expect(skeleton).to_be_visible()
    expect(container.get_by_text("Fragment report version 0")).to_be_visible(
        timeout=5000
    )
    expect(skeleton).not_to_be_attached()

    report = container.get_by_test_id("stMarkdown")
    report.evaluate("element => { element.dataset.testKept = 'true' }")

    get_button(app, "Load next fragment report").click()
    overlay = container.get_by_test_id("stPendingSkeleton")
    expect(overlay).to_be_visible(timeout=3000)
    expect(container.get_by_text("Fragment report version 0")).to_be_attached()

    expect(container.get_by_text("Fragment report version 1")).to_be_visible(
        timeout=5000
    )
    expect(overlay).not_to_be_attached()
    # The report element was updated in place instead of being remounted.
    expect(report).to_have_attribute("data-test-kept", "true")
