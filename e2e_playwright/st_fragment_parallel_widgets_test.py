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

"""E2E tests for parallel fragment widgets and error handling (E4, E5, E6)."""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_loaded, wait_for_app_run
from e2e_playwright.shared.app_utils import click_button, expect_exception


def test_e4_widget_interaction_during_parallel_execution(app: Page):
    """E4: Widgets in early-completing fragments respond while others still run.

    A fast fragment with a button finishes in <0.2s. A slow fragment sleeps 5s.
    Clicking the button before the slow fragment finishes should increment the counter.
    """
    wait_for_app_loaded(app)

    expect(app.get_by_text("e4_count: 0")).to_be_visible()

    click_button(app, "e4_increment")
    wait_for_app_run(app)

    expect(app.get_by_text("e4_count: 1")).to_be_visible()
    expect(app.get_by_text("e4_count: 0")).not_to_be_attached()


def test_e5_fragment_rerun_isolation(app: Page):
    """E5: Clicking a widget in one parallel fragment does not rerun the other.

    Fragment A has a button. Fragment B tracks its run count.
    After clicking A's button, only A should rerun — B's run count stays at 1.
    """
    wait_for_app_loaded(app)

    b_runs_el = app.get_by_text("e5_b_runs: 1")
    expect(b_runs_el).to_be_visible()

    b_ts_el = app.get_by_text("e5_b_ts:")
    b_ts_before = b_ts_el.text_content()

    click_button(app, "e5_click_a")
    wait_for_app_run(app)

    expect(app.get_by_text("e5_a_clicks: 1")).to_be_visible()

    # Fragment B should not have rerun — its run count and timestamp stay the same
    expect(app.get_by_text("e5_b_runs: 1")).to_be_visible()
    b_ts_after = app.get_by_text("e5_b_ts:").text_content()
    assert b_ts_before == b_ts_after, (
        f"Fragment B timestamp changed from {b_ts_before} to {b_ts_after} — "
        "it should not have rerun"
    )


def test_e6_error_renders_inline_in_failing_fragment(app: Page):
    """E6: An exception in one parallel fragment renders inline; others succeed."""
    wait_for_app_loaded(app)

    expect_exception(app, "e6_deliberate_error")
    expect(app.get_by_text("e6_success")).to_be_visible()
