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
import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run

# Try with dialog accept
# Try with grant permissions (should work only in chromium, but doesn't work there)
# Show interactive debug example


@pytest.mark.skip_browser("webkit")
def test_camera_input_video_stream(
    app: Page,
    assert_snapshot: ImageCompareFunction,
    launch_with_camera_options_firefox,
    launch_with_camera_options_chromium,
):
    """Test to check that camera video stream works"""
    app.wait_for_timeout(1000)
    camera_inputs = app.get_by_test_id("stCameraInput")
    expect(camera_inputs).to_have_count(2)
    camera_input_take_photo = app.get_by_test_id("stCameraInputButton").first
    app.wait_for_timeout(1000)
    camera_input_take_photo.click()
    app.wait_for_timeout(1000)
