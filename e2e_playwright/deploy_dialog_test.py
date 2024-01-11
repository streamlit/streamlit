# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from e2e_playwright.conftest import ImageCompareFunction


def test_deploy_button_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    deploy_button = themed_app.get_by_test_id("stDeployButton")
    deploy_button.click()

    # Make sure that deploy dialog is properly displayed
    # Before taking screenshot
    deploy_dialog = themed_app.get_by_test_id("stDeployDialog")
    expect(deploy_dialog).to_be_visible()
    expect(deploy_dialog.locator("img")).to_have_count(2)
    expect(deploy_dialog.locator("img").nth(0)).to_be_visible()

    assert_snapshot(deploy_dialog, name="deploy_dialog")
