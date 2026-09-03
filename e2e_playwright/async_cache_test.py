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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import rerun_app, wait_for_app_run
from e2e_playwright.shared.app_utils import get_button


def test_async_cache_miss_hit_spinner_and_replay(app: Page) -> None:
    get_button(app, "Run async caches").click()

    expect(app.get_by_test_id("stSpinner")).to_be_visible()
    expect(app.get_by_test_id("stSpinner")).to_contain_text("Computing async data")
    wait_for_app_run(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(app.get_by_text("Inside cache_data: 1")).to_be_visible()
    expect(app.get_by_text("Inside cache_resource: 1")).to_be_visible()
    expect(app.get_by_text("cache_data result: 1")).to_be_visible()
    expect(app.get_by_text("cache_resource result: 1")).to_be_visible()

    rerun_app(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(app.get_by_text("Inside cache_data: 1")).to_be_visible()
    expect(app.get_by_text("Inside cache_resource: 1")).to_be_visible()
    expect(app.get_by_text("cache_data result: 1")).to_be_visible()
    expect(app.get_by_text("cache_resource result: 1")).to_be_visible()
