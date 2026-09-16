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

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import click_button, expect_prefixed_markdown


def test_same_page_query_params_sync_on_browser_back_forward(app: Page) -> None:
    """st.query_params reflects URL after same-page browser back/forward.

    Regression test for https://github.com/streamlit/streamlit/issues/13963
    """
    click_button(app, "Increment Query Param")
    wait_for_app_run(app)
    click_button(app, "Increment Query Param")
    wait_for_app_run(app)

    expect(app).to_have_url(re.compile(r"[?&]value=2(?:&|$)"))
    expect_prefixed_markdown(app, "Query params:", "{'value': '2'}")

    app.go_back()
    wait_for_app_run(app)

    expect(app).to_have_url(re.compile(r"[?&]value=1(?:&|$)"))
    expect_prefixed_markdown(app, "Query params:", "{'value': '1'}")
    expect(app.get_by_text("{'value': '2'}", exact=True)).not_to_be_visible()

    app.go_forward()
    wait_for_app_run(app)

    expect(app).to_have_url(re.compile(r"[?&]value=2(?:&|$)"))
    expect_prefixed_markdown(app, "Query params:", "{'value': '2'}")
    expect(app.get_by_text("{'value': '1'}", exact=True)).not_to_be_visible()
