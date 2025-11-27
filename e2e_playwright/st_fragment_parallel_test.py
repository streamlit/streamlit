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

"""E2E tests for parallel fragment execution.

These tests verify that fragments with parallel=True do not block the main thread,
allowing the script to continue execution while fragments run in background threads.
"""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_until


def test_main_thread_not_blocked_by_parallel_fragments(app: Page):
    """Verify that the main thread completes quickly despite fragment sleeps.

    The app creates 3 parallel fragments that each sleep for 0.3s.
    If running sequentially, this would take 0.9s+ for the main thread.
    With parallel execution, the main thread should complete much faster
    since the sleeps happen in background threads.

    The app verifies timing internally and writes "parallel_execution_verified"
    if the main thread completed faster than expected for sequential execution.
    """
    # Wait for the parallel execution verification message
    wait_until(
        app,
        lambda: app.get_by_text("parallel_execution_verified").count() > 0,
        timeout=10000,
    )

    expect(app.get_by_text("parallel_execution_verified")).to_be_visible()


def test_page_structure_renders_correctly(app: Page):
    """Verify the page structure is correctly rendered with columns."""
    # Verify header is visible
    expect(app.get_by_role("heading", name="Parallel Fragments Demo")).to_be_visible()

    # Verify we have 3 column containers for the 3 parallel fragments
    columns = app.get_by_test_id("stColumn")
    expect(columns).to_have_count(3)

    # Verify main thread timing info is displayed
    expect(app.get_by_text("main_thread_time:")).to_be_visible()
