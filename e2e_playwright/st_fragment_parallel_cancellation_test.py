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

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import click_button


def test_parallel_st_stop_ends_script(page: Page, app_port: int) -> None:
    """Fragment A calls st.stop, should end quickly without waiting for Fragment B."""
    page.goto(f"http://localhost:{app_port}/?test=st_stop")
    wait_for_app_run(page)

    expect(page.get_by_text("Fragment A content")).to_be_visible()

    total_time_text = page.get_by_text(re.compile(r"Total time: \d+\.\d+s"))
    expect(total_time_text).to_be_visible()

    text_content = total_time_text.text_content()
    assert text_content is not None
    match = re.search(r"Total time: (\d+\.\d+)s", text_content)
    assert match is not None
    total_time = float(match.group(1))
    assert total_time < 3.0, f"Expected < 3s, got {total_time}s - st.stop didn't abort"


def test_parallel_st_rerun_restarts_app(page: Page, app_port: int) -> None:
    """Fragment calls st.rerun on first run, app restarts."""
    page.goto(f"http://localhost:{app_port}/?test=st_rerun")
    wait_for_app_run(page)

    expect(page.get_by_text("App restarted successfully")).to_be_visible()
    expect(page.get_by_text("Run count: 2")).to_be_visible()


def test_widget_interaction_during_parallel_execution(
    page: Page, app_port: int
) -> None:
    """Button click in fast fragment while slow fragment is running."""
    page.goto(f"http://localhost:{app_port}/?test=widget_interaction")
    wait_for_app_run(page)

    expect(page.get_by_text("Counter: 0")).to_be_visible()

    click_button(page, "Increment")
    wait_for_app_run(page)

    expect(page.get_by_text("Counter: 1")).to_be_visible()


def test_parallel_fragment_error_renders_in_container(
    page: Page, app_port: int
) -> None:
    """Error in Fragment A renders in A's container, Fragment B succeeds."""
    page.goto(f"http://localhost:{app_port}/?test=error_container")
    wait_for_app_run(page)

    expect(page.get_by_text("ValueError")).to_be_visible()
    expect(page.get_by_text("Test error in fragment")).to_be_visible()
    expect(page.get_by_text("Fragment B success")).to_be_visible()
