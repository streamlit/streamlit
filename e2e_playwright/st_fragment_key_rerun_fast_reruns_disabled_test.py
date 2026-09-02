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

"""Playwright test for callback replay coalescing with fast reruns disabled."""

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import expect_no_exception, get_element_by_key


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    return ["--runner.fastReruns=false"]


def test_fresh_input_coalesces_with_main_script_callback_replay(app: Page) -> None:
    body_runs_text = (
        get_element_by_key(app, "coalescing_results")
        .get_by_text("Body runs:", exact=False)
        .text_content()
    )
    assert body_runs_text is not None
    initial_body_runs = int(body_runs_text.rsplit(": ", 1)[1])
    app.get_by_label("Submitted name").fill("  Laura  ")
    app.get_by_role("button", name="Submit coalescing form").click()
    expect(app.get_by_text("Form callback waiting for fresh input")).to_be_visible()

    app.get_by_role("button", name="Fresh interaction").click()

    results = get_element_by_key(app, "coalescing_results")
    expect(
        results.get_by_text(f"Body runs: {initial_body_runs + 1}", exact=True)
    ).to_be_visible()
    expect(results.get_by_text("Form callbacks: 1", exact=True)).to_be_visible()
    expect(results.get_by_text("Fresh callbacks: 1", exact=True)).to_be_visible()
    expect(results.get_by_text("Normalized name: Laura", exact=True)).to_be_visible()
    expect(results.get_by_text("Body saw submit: True", exact=True)).to_be_visible()
    expect_no_exception(app)
