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

from e2e_playwright.conftest import wait_for_app_run


def test_toolbar_is_visible_outside_overflow_container(app: Page):
    """Test that the dataframe toolbar is visible even when at the very top of a restricted container."""
    wait_for_app_run(app)

    df_top = app.get_by_test_id("stDataFrame").nth(0)
    df_top.locator("canvas").nth(0).wait_for(state="visible", timeout=15000)
    df_top.hover()

    toolbar = df_top.get_by_test_id("stElementToolbar")
    wrapper = toolbar.locator("xpath=..")

    # Assert the fix: without position: fixed, this would be invisible/clipped
    expect(wrapper).to_have_css("position", "fixed", timeout=10000)
