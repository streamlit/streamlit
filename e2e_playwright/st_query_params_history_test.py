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

import re

from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import click_button, click_checkbox


def test_repeated_query_param_assignment_does_not_push_history(app: Page):
    """Re-assigning the same query param on rerun must not add a history entry.

    Regression test for https://github.com/streamlit/streamlit/issues/9878
    """
    expect(app).to_have_url(re.compile(r"[?&]number=1(?:&|$)"))

    history_length_before = app.evaluate("window.history.length")

    click_checkbox(app, "Toggle this")

    expect(app).to_have_url(re.compile(r"[?&]number=1(?:&|$)"))
    expect(app).not_to_have_url(re.compile(r"number=1.*number=1"))
    history_length_after_noop = app.evaluate("window.history.length")
    assert history_length_after_noop == history_length_before, (
        f"history.length grew from {history_length_before} to {history_length_after_noop}"
    )

    click_button(app, "Set extra param")

    expect(app).to_have_url(re.compile(r"[?&]extra=yes(?:&|$)"))
    history_length_after_change = app.evaluate("window.history.length")
    assert history_length_after_change == history_length_before + 1, (
        "history.length did not grow after a real query-param change: "
        f"before={history_length_before}, after={history_length_after_change}"
    )
