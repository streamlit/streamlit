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
import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class


@pytest.mark.skip_browser("webkit")
def test_displays_correct_number_of_elements(app: Page):
    """Test that it renders correct number of camera_input elements."""
    camera_input_widgets = app.get_by_test_id("stCameraInput")
    expect(camera_input_widgets).to_have_count(2)


@pytest.mark.only_browser("chromium")
def test_captures_photo(app: Page):
    """Test camera_input captures photo when 'Take photo' button clicked."""
    # Wait for some timeout, until fake video stream available for camera_input
    app.wait_for_timeout(3000)
    take_photo_button = app.get_by_test_id("stCameraInputButton").first
    # Capture a photo
    take_photo_button.click()
    expect(app.get_by_test_id("stImage")).to_have_count(1)


@pytest.mark.only_browser("chromium")
def test_clear_photo(app: Page):
    """Test camera_input removes photo when 'Clear photo' button clicked."""
    # Wait for some timeout, until fake video stream available for camera_input
    app.wait_for_timeout(3000)
    take_photo_button = app.get_by_test_id("stCameraInputButton").first
    # Capture a photo
    take_photo_button.click()
    expect(app.get_by_test_id("stImage")).to_have_count(1)
    remove_photo_button = app.get_by_text("Clear photo").first
    remove_photo_button.click()
    expect(app.get_by_test_id("stImage")).to_have_count(0)


@pytest.mark.skip_browser("webkit")
def test_shows_disabled_widget_correctly(
    themed_app: Page,
    assert_snapshot: ImageCompareFunction,
):
    """Test that it renders disabled camera_input widget correctly."""
    camera_input_widgets = themed_app.get_by_test_id("stCameraInput")
    expect(camera_input_widgets).to_have_count(2)
    disabled_camera_input = camera_input_widgets.nth(1)
    assert_snapshot(disabled_camera_input, name="st_camera_input-disabled")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stCameraInput")
