# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from e2e_playwright.conftest import wait_for_app_run


def test_expandable_state(app: Page):
    """Test whether expander state is not retained for a distinct expander."""
    app.get_by_test_id("stButton").nth(0).locator("button").click()
    wait_for_app_run(app, wait_delay=500)
    app.get_by_test_id("stExpander").locator("summary").click()
    expect(app.get_by_test_id("stExpanderDetails")).to_contain_text("b0_write")

    # Wait for a short moment for the expander to finish expanding:
    app.wait_for_timeout(500)

    app.get_by_test_id("stButton").nth(1).locator("button").click()
    wait_for_app_run(app, wait_delay=500)

    expect(app.get_by_test_id("stExpanderDetails")).not_to_contain_text("b0_write")
    expect(app.get_by_test_id("stExpanderDetails")).to_be_hidden()
