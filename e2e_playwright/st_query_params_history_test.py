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

from e2e_playwright.conftest import build_app_url, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    expect_prefixed_markdown,
    get_radio_option,
    goto_app,
    select_radio_option,
)


def test_repeated_query_param_assignment_does_not_push_history(app: Page):
    """Re-assigning the same query param on rerun must not add a history entry.

    Regression test for https://github.com/streamlit/streamlit/issues/9878
    """
    expect(app).to_have_url(re.compile(r"[?&]number=1(?:&|$)"))

    history_length_before = app.evaluate("window.history.length")

    click_checkbox(app, "Toggle this")

    expect(app).to_have_url(re.compile(r"[?&]number=1(?:&|$)"))
    # Guard against the param being appended again instead of replaced.
    expect(app).not_to_have_url(re.compile(r"number=1(&.*)?&number="))
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


def test_same_page_query_params_sync_on_browser_back_forward(
    app: Page, app_base_url: str
) -> None:
    """st.query_params reflects URL after same-page browser back/forward.

    Regression test for https://github.com/streamlit/streamlit/issues/13963
    """
    goto_app(app, build_app_url(app_base_url, path="/query-params"))

    click_button(app, "Increment Query Param")
    click_button(app, "Increment Query Param")

    expect(app).to_have_url(re.compile(r"[?&]value=2(?:&|$)"))
    expect_prefixed_markdown(app, "Query params:", "{'value': '2'}", exact_match=True)

    app.go_back()
    wait_for_app_run(app)

    expect(app).to_have_url(re.compile(r"[?&]value=1(?:&|$)"))
    expect_prefixed_markdown(app, "Query params:", "{'value': '1'}", exact_match=True)

    # The next rerun must use the post-back params, not stale App state.
    click_button(app, "Increment Query Param")

    expect(app).to_have_url(re.compile(r"[?&]value=2(?:&|$)"))
    expect_prefixed_markdown(app, "Query params:", "{'value': '2'}", exact_match=True)

    app.go_back()
    wait_for_app_run(app)

    expect(app).to_have_url(re.compile(r"[?&]value=1(?:&|$)"))
    expect_prefixed_markdown(app, "Query params:", "{'value': '1'}", exact_match=True)

    app.go_forward()
    wait_for_app_run(app)

    expect(app).to_have_url(re.compile(r"[?&]value=2(?:&|$)"))
    expect_prefixed_markdown(app, "Query params:", "{'value': '2'}", exact_match=True)


def test_bound_widget_follows_url_on_browser_back_and_forward(
    app: Page, app_base_url: str
) -> None:
    """Bound widgets restore sticky non-default URL values on back and forward.

    Selecting a radio option replaces the current history entry, so this test
    clicks the Increment Query Param button to push distinct entries that each
    carry a different non-default ``number``. The default ``1`` is never the
    restore target.

    Regression test for https://github.com/streamlit/streamlit/issues/13853
    """
    goto_app(
        app, build_app_url(app_base_url, path="/query-params", query={"number": "3"})
    )

    expect(app).to_have_url(re.compile(r"[?&]number=3(?:&|$)"))
    expect_prefixed_markdown(app, "Selected:", "3", exact_match=True)

    # Entry A: ?number=3 → push Entry B: ?number=3&value=1
    click_button(app, "Increment Query Param")
    # replaceState on B: ?number=5&value=1 (5 is non-default, so it stays)
    select_radio_option(app, "5", label="Number")
    # push Entry C: ?number=5&value=2
    click_button(app, "Increment Query Param")

    expect(app).to_have_url(re.compile(r"[?&]number=5(?:&|$)"))
    expect(app).to_have_url(re.compile(r"[?&]value=2(?:&|$)"))
    expect_prefixed_markdown(app, "Selected:", "5", exact_match=True)
    expect(get_radio_option(app, "5").get_by_role("radio")).to_be_checked()

    # History reruns must replaceState, not push a duplicate entry.
    history_length_before_back = app.evaluate("window.history.length")

    app.go_back()
    wait_for_app_run(app)

    expect(app).to_have_url(re.compile(r"[?&]number=5(?:&|$)"))
    expect(app).to_have_url(re.compile(r"[?&]value=1(?:&|$)"))
    expect_prefixed_markdown(app, "Selected:", "5", exact_match=True)
    expect(get_radio_option(app, "5").get_by_role("radio")).to_be_checked()

    app.go_back()
    wait_for_app_run(app)

    expect(app).to_have_url(re.compile(r"[?&]number=3(?:&|$)"))
    expect(app).not_to_have_url(re.compile(r"[?&]value="))
    expect_prefixed_markdown(app, "Selected:", "3", exact_match=True)
    expect(get_radio_option(app, "3").get_by_role("radio")).to_be_checked()

    app.go_forward()
    wait_for_app_run(app)

    expect(app).to_have_url(re.compile(r"[?&]number=5(?:&|$)"))
    expect(app).to_have_url(re.compile(r"[?&]value=1(?:&|$)"))
    expect_prefixed_markdown(app, "Selected:", "5", exact_match=True)
    expect(get_radio_option(app, "5").get_by_role("radio")).to_be_checked()
    history_length_after_nav = app.evaluate("window.history.length")
    assert history_length_after_nav == history_length_before_back, (
        "history.length grew during back/forward; a history rerun pushed "
        f"instead of replacing: before={history_length_before_back}, "
        f"after={history_length_after_nav}"
    )

    # Next rerun must use the restored URL, not stale widget state.
    click_button(app, "Increment Query Param")

    expect(app).to_have_url(re.compile(r"[?&]number=5(?:&|$)"))
    expect(app).to_have_url(re.compile(r"[?&]value=2(?:&|$)"))
    expect_prefixed_markdown(app, "Selected:", "5", exact_match=True)
