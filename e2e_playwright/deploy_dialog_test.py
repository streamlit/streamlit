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
from e2e_playwright.shared.app_utils import wait_for_all_images_to_be_loaded


def test_deploy_button_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    deploy_button = themed_app.get_by_test_id("stAppDeployButton")
    deploy_button.click()

    # Make sure that deploy dialog is properly displayed
    # Before taking screenshot
    deploy_dialog = themed_app.get_by_test_id("stDialog")
    expect(deploy_dialog).to_be_visible()
    expect(
        deploy_dialog.get_by_test_id("stDeployDialogCommunityCloudIcon")
    ).to_be_visible()
    expect(
        deploy_dialog.get_by_test_id("stDeployDialogCustomDeploymentIcon")
    ).to_be_visible()

    wait_for_all_images_to_be_loaded(themed_app)

    # Make a snapshot of the dialog window
    assert_snapshot(deploy_dialog.get_by_role("dialog"), name="deploy_dialog")
