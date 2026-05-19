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

"""E2E tests for parallel fragment cancellation behavior."""

from __future__ import annotations

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import build_app_url, wait_for_app_run
from e2e_playwright.shared.app_utils import click_button


def test_parallel_st_stop_ends_script(page: Page, app_base_url: str) -> None:
    """Fragment A calls st.stop, should end quickly without waiting for Fragment B."""
    page.goto(build_app_url(app_base_url, query="test=st_stop"))
    wait_for_app_run(page)

    expect(page.get_by_text("Fragment A content")).to_be_visible()
    # Fragment B should not complete due to st.stop in Fragment A
    expect(page.get_by_text("Fragment B done after 5s")).not_to_be_visible()

    total_time_text = page.get_by_text(re.compile(r"Total time: \d+\.\d+s"))
    expect(total_time_text).to_be_visible()


def test_parallel_st_rerun_restarts_app(page: Page, app_base_url: str) -> None:
    """Fragment calls st.rerun on first run, app restarts."""
    page.goto(build_app_url(app_base_url, query="test=st_rerun"))
    wait_for_app_run(page)

    expect(page.get_by_text("App restarted successfully")).to_be_visible()
    # Run 1: run_count starts at 0, incremented to 1, fragment sets to 2 and reruns
    # Run 2: run_count is 2, incremented to 3, fragment shows success
    expect(page.get_by_text("Run count: 3", exact=True)).to_be_visible()


def test_widget_interaction_during_parallel_execution(
    page: Page, app_base_url: str
) -> None:
    """Button click in fast fragment while slow fragment is running."""
    page.goto(build_app_url(app_base_url, query="test=widget_interaction"))
    wait_for_app_run(page)

    expect(page.get_by_text("Counter: 0", exact=True)).to_be_visible()

    click_button(page, "Increment")
    wait_for_app_run(page)

    expect(page.get_by_text("Counter: 1", exact=True)).to_be_visible()


def test_parallel_fragment_error_renders_in_container(
    page: Page, app_base_url: str
) -> None:
    """Error in Fragment A renders in A's container, Fragment B succeeds."""
    page.goto(build_app_url(app_base_url, query="test=error_container"))
    wait_for_app_run(page)

    expect(page.get_by_text("ValueError")).to_be_visible()
    expect(page.get_by_text("Test error in fragment")).to_be_visible()
    expect(page.get_by_text("Fragment B success")).to_be_visible()
