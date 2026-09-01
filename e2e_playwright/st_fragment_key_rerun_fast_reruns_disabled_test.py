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
    app.get_by_label("Race name").fill("  Laura  ")
    app.get_by_role("button", name="Submit race form").click()
    expect(app.get_by_text("Form callback waiting for fresh input")).to_be_visible()

    app.get_by_role("button", name="Fresh interaction").click()

    expect(get_element_by_key(app, "race_results")).to_contain_text("Form callbacks: 1")
    expect(get_element_by_key(app, "race_results")).to_contain_text(
        "Fresh callbacks: 1"
    )
    expect(get_element_by_key(app, "race_results")).to_contain_text(
        "Normalized name: Laura"
    )
    expect(get_element_by_key(app, "race_results")).to_contain_text(
        "Body saw submit: True"
    )
    expect_no_exception(app)
