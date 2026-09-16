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

from e2e_playwright.conftest import build_app_url, wait_for_app_loaded, wait_for_app_run
from e2e_playwright.shared.app_utils import expect_prefixed_markdown


def _push_history_and_popstate(page: Page, query: dict[str, str]) -> None:
    """Push a history entry and fire popstate within the current SPA session."""
    query_string = "&".join(f"{k}={v}" for k, v in query.items())
    page.evaluate(
        """(qs) => {
          const url = window.location.pathname + (qs ? `?${qs}` : '');
          window.history.pushState({}, '', url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }""",
        query_string,
    )


def test_bound_radio_reverts_on_browser_back(page: Page, app_base_url: str) -> None:
    """bind=query-params widgets follow the URL after browser back.

    Regression test for https://github.com/streamlit/streamlit/issues/13853
    """
    page.goto(build_app_url(app_base_url, query={"mock_element_id": "3"}))
    wait_for_app_loaded(page)

    expect(page).to_have_url(re.compile(r"[?&]mock_element_id=3(?:&|$)"))
    expect_prefixed_markdown(page, "Selected:", "3", exact_match=True)

    _push_history_and_popstate(page, {"mock_element_id": "5"})
    wait_for_app_run(page)

    # Default widget values are omitted from the URL.
    expect_prefixed_markdown(page, "Selected:", "5", exact_match=True)

    page.go_back()
    wait_for_app_run(page)

    expect(page).to_have_url(re.compile(r"[?&]mock_element_id=3(?:&|$)"))
    expect_prefixed_markdown(page, "Selected:", "3", exact_match=True)
