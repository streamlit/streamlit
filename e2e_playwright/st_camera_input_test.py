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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run

# Try with dialog accept
# Try with grant permissions (should work only in chromium, but doesn't work there)
# Show interactive debug example


def test_file_uploader_render_correctly(
    # app_with_camera_dialog_accepted: Page,
    app: Page,
    assert_snapshot: ImageCompareFunction,
):
    """AAAA"""
    app_with_camera_dialog_accepted = app
    # app_with_camera_dialog_accepted.on("dialog", lambda dialog: dialog.accept())
    app_with_camera_dialog_accepted.wait_for_timeout(1000)

    camera_inputs = app_with_camera_dialog_accepted.get_by_test_id("stCameraInput")
    expect(camera_inputs).to_have_count(2)
    app_with_camera_dialog_accepted.wait_for_timeout(1000)
