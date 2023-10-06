# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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


def test_no_concurrent_changes(app: Page):
    counters = app.locator(".stMarkdown")
    expect(counters.first).to_have_text("0", use_inner_text=True)

    button = app.locator(".stButton")
    button.first.click()
    app.wait_for_timeout(300)

    counters = app.locator(".stMarkdown")
    c1 = counters.nth(0).inner_text()
    c2 = counters.nth(1).inner_text()
    assert c1 == c2
