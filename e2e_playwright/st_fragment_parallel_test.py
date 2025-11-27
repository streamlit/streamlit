# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""E2E tests for parallel fragment execution."""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_until


def test_all_parallel_fragments_render(app: Page):
    """Verify that all parallel fragments render their content."""
    # Wait for all fragment metrics to appear (3 parallel + 1 sequential = 4 total)
    wait_until(app, lambda: app.get_by_test_id("stMetric").count() >= 4, timeout=10000)

    # Verify all metrics are visible
    expect(app.get_by_test_id("stMetric")).to_have_count(4)

    # Verify each fragment's metric label is visible
    metrics = app.get_by_test_id("stMetric")
    expect(metrics.filter(has_text="Fragment 1")).to_be_visible()
    expect(metrics.filter(has_text="Fragment 2")).to_be_visible()
    expect(metrics.filter(has_text="Fragment 3")).to_be_visible()
    expect(metrics.filter(has_text="Sequential")).to_be_visible()


def test_parallel_fragments_show_completion_status(app: Page):
    """Verify that all fragments show their completion status."""
    # Wait for completion indicators
    wait_until(app, lambda: app.get_by_text("✓ Complete").count() >= 4, timeout=10000)

    # All 4 fragments should show "✓ Complete"
    expect(app.get_by_text("✓ Complete")).to_have_count(4)


def test_main_thread_completes_quickly(app: Page):
    """Verify that the main thread doesn't block on parallel fragments.

    The success message indicates that parallel fragments ran in the background.
    """
    # Wait for the app to finish and check for the success message
    wait_until(
        app,
        lambda: app.get_by_text(
            "✓ Main thread completed quickly - parallel fragments are running in background!"
        ).count()
        > 0,
        timeout=10000,
    )

    success_alert = app.get_by_test_id("stAlert").filter(
        has_text="Main thread completed"
    )
    expect(success_alert).to_be_visible()


def test_fragment_headers_visible(app: Page):
    """Verify the page structure and headers are correctly rendered."""
    # Wait for app to load
    wait_until(app, lambda: app.get_by_test_id("stMetric").count() >= 4, timeout=10000)

    # Check headers
    expect(app.get_by_role("heading", name="Parallel Fragments Demo")).to_be_visible()
    expect(
        app.get_by_role("heading", name="Sequential Fragment (for comparison)")
    ).to_be_visible()
    expect(app.get_by_role("heading", name="Timing Summary")).to_be_visible()


def test_parallel_fragments_in_columns(app: Page):
    """Verify that parallel fragments are displayed in columns."""
    # Wait for fragments to render
    wait_until(app, lambda: app.get_by_test_id("stMetric").count() >= 4, timeout=10000)

    # Check that we have column containers with metrics inside
    # The columns should contain the parallel fragment metrics
    columns = app.get_by_test_id("stColumn")
    expect(columns).to_have_count(3)  # 3 columns for 3 parallel fragments
