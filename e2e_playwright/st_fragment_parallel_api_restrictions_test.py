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

"""E2E tests for parallel fragment API restrictions."""

from __future__ import annotations

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import click_button


def test_parallel_fragment_blocks_dialog_during_initial_run(
    page: Page, app_port: int
) -> None:
    """Parallel fragment unconditionally calling @st.dialog shows error."""
    page.goto(f"http://localhost:{app_port}/?test=dialog_block")
    wait_for_app_run(page)

    expect(
        page.get_by_text("cannot be called from a parallel fragment")
    ).to_be_visible()
    expect(page.get_by_text("@st.dialog")).to_be_visible()


def test_parallel_fragment_blocks_switch_page_during_initial_run(
    page: Page, app_port: int
) -> None:
    """Parallel fragment calling st.switch_page shows error."""
    page.goto(f"http://localhost:{app_port}/?test=switch_page_block")
    wait_for_app_run(page)

    expect(
        page.get_by_text("cannot be called from a parallel fragment")
    ).to_be_visible()
    expect(page.get_by_text("st.switch_page")).to_be_visible()


def test_parallel_fragment_allows_dialog_on_rerun(page: Page, app_port: int) -> None:
    """Parallel fragment allows dialog when triggered by button click."""
    page.goto(f"http://localhost:{app_port}/?test=dialog_allow_rerun")
    wait_for_app_run(page)

    expect(page.get_by_text("Fragment content")).to_be_visible()

    click_button(page, "Open Dialog")
    wait_for_app_run(page)

    expect(page.get_by_text("Dialog opened successfully")).to_be_visible()


def test_nested_sequential_fragment_blocks_dialog_during_parallel_batch(
    page: Page, app_port: int
) -> None:
    """Non-parallel fragment nested inside parallel fragment inherits restriction."""
    page.goto(f"http://localhost:{app_port}/?test=nested_sequential_block")
    wait_for_app_run(page)

    expect(
        page.get_by_text("cannot be called from a parallel fragment")
    ).to_be_visible()


def test_nested_parallel_fragments_both_restricted(page: Page, app_port: int) -> None:
    """Parallel fragment nested inside parallel fragment is also restricted."""
    page.goto(f"http://localhost:{app_port}/?test=nested_parallel_block")
    wait_for_app_run(page)

    expect(
        page.get_by_text("cannot be called from a parallel fragment")
    ).to_be_visible()


def test_nested_parallel_fragment_allows_dialog_on_rerun(
    page: Page, app_port: int
) -> None:
    """Nested parallel fragment allows dialog on rerun."""
    page.goto(f"http://localhost:{app_port}/?test=nested_parallel_allow_rerun")
    wait_for_app_run(page)

    expect(page.get_by_text("Inner fragment")).to_be_visible()

    click_button(page, "Open Nested Dialog")
    wait_for_app_run(page)

    expect(page.get_by_text("Nested dialog opened successfully")).to_be_visible()
