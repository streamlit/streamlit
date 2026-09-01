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

"""Playwright test for fragment coalescing with fast reruns enabled."""

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import expect_no_exception, get_element_by_key


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    return ["--runner.fastReruns=true"]


def _text(app: Page, key: str) -> str:
    content = get_element_by_key(app, key).text_content()
    assert content is not None
    return content


def test_fragment_interactions_coalesce_with_replay_state(app: Page) -> None:
    source_uuid = _text(app, "fast_source_uuid")
    fresh_uuid = _text(app, "fast_fresh_uuid")
    result_uuid = _text(app, "fast_result_uuid")

    app.get_by_label("Source value").fill("  retained  ")
    app.get_by_role("button", name="Submit source").click()
    expect(
        app.get_by_text("Source callback waiting for fresh fragment input")
    ).to_be_visible()
    app.get_by_role("button", name="Fresh fragment interaction").click()

    expect(get_element_by_key(app, "fast_results")).to_contain_text(
        "Source callbacks: 1"
    )
    expect(get_element_by_key(app, "fast_results")).to_contain_text(
        "Fresh callbacks: 1"
    )
    expect(get_element_by_key(app, "fast_results")).to_contain_text(
        "Normalized value: retained"
    )
    expect(get_element_by_key(app, "fast_results")).to_contain_text(
        "Result saw submit: True"
    )
    expect(get_element_by_key(app, "fast_source_uuid")).to_have_text(source_uuid)
    expect(get_element_by_key(app, "fast_fresh_uuid")).not_to_have_text(fresh_uuid)
    expect(get_element_by_key(app, "fast_result_uuid")).not_to_have_text(result_uuid)
    expect_no_exception(app)
