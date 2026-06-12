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

from playwright.sync_api import Page

from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    expect_markdown,
    select_selectbox_option,
)


def _expect_initial_state(app: Page) -> None:
    expect_markdown(app, "full runs: 1")
    expect_markdown(app, "chart: US (chart runs: 1)")
    expect_markdown(app, "metrics: stats for US (metrics runs: 1)")
    expect_markdown(app, "poke runs: 1")
    expect_markdown(app, "table runs: 1")


def test_signal_callback_reruns_watchers_and_nothing_else(app: Page):
    """Changing a widget with a signal callback reruns the signal's watchers
    in place — including chained watchers — without a full app rerun.
    """
    _expect_initial_state(app)

    select_selectbox_option(app, "Country", "CA")

    # Both watchers reran with the new value: chart_panel directly, and
    # metrics_row through the chained stats signal sent from chart_panel.
    expect_markdown(app, "chart: CA (chart runs: 2)")
    expect_markdown(app, "metrics: stats for CA (metrics runs: 2)")
    # Nothing else reran: no full app run, and the non-watcher fragments
    # kept their counters.
    expect_markdown(app, "full runs: 1")
    expect_markdown(app, "poke runs: 1")
    expect_markdown(app, "table runs: 1")

    # A second fire keeps working against the same registrations.
    select_selectbox_option(app, "Country", "DE")
    expect_markdown(app, "chart: DE (chart runs: 3)")
    expect_markdown(app, "metrics: stats for DE (metrics runs: 3)")
    expect_markdown(app, "full runs: 1")


def test_signal_callback_suppresses_enclosing_fragment(app: Page):
    """A value widget inside a non-watcher fragment with a signal callback
    reruns the watchers but not its own enclosing fragment.
    """
    _expect_initial_state(app)

    click_checkbox(app, "Poke country")

    # The signal's watchers ran (with the unchanged country value)...
    expect_markdown(app, "chart: US (chart runs: 2)")
    expect_markdown(app, "metrics: stats for US (metrics runs: 2)")
    # ...but the checkbox's enclosing fragment was suppressed, and no full
    # rerun happened.
    expect_markdown(app, "poke runs: 1")
    expect_markdown(app, "full runs: 1")


def test_fragment_function_as_callback_reruns_only_that_fragment(app: Page):
    """A button with a fragment function as its callback reruns just that
    fragment, from anywhere on the page.
    """
    _expect_initial_state(app)

    click_button(app, "Reload table")

    expect_markdown(app, "table runs: 2")
    # Nothing else reran — not the app, not the signal watchers.
    expect_markdown(app, "full runs: 1")
    expect_markdown(app, "chart: US (chart runs: 1)")
    expect_markdown(app, "metrics: stats for US (metrics runs: 1)")
    expect_markdown(app, "poke runs: 1")
