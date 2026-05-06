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
from collections.abc import Callable

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_toggle,
    expect_help_tooltip,
    expect_prefixed_markdown,
    get_camera_input,
    get_element_by_key,
)

NUM_CAMERA_INPUT_WIDGETS = 5


def check_dimensions_func(camera_input: Locator) -> Callable[[], bool]:
    def check_dimensions() -> bool:
        bbox = camera_input.get_by_test_id(
            "stCameraInputWebcamStyledBox"
        ).bounding_box()
        return bbox is not None and bbox["width"] > 0 and bbox["height"] > 0

    return check_dimensions


@pytest.mark.skip_browser("webkit")
def test_displays_correct_number_of_elements(app: Page):
    """Test that it renders correct number of camera_input elements."""
    camera_input_widgets = app.get_by_test_id("stCameraInput")
    expect(camera_input_widgets).to_have_count(NUM_CAMERA_INPUT_WIDGETS)


@pytest.mark.only_browser("chromium")
def test_captures_photo(app: Page):
    """Test camera_input captures photo when 'Take photo' button clicked."""
    camera = get_camera_input(app, "Label1")
    take_photo_button = camera.get_by_test_id("stCameraInputButton").first
    # Wait until the fake video stream is ready (button becomes enabled)
    expect(take_photo_button).to_be_enabled()
    # Capture a photo
    take_photo_button.click()
    expect(app.get_by_test_id("stImage")).to_have_count(1)


@pytest.mark.only_browser("chromium")
def test_clear_photo(app: Page):
    """Test camera_input removes photo when 'Clear photo' button clicked."""
    camera = get_camera_input(app, "Label1")
    take_photo_button = camera.get_by_test_id("stCameraInputButton").first
    expect(take_photo_button).to_be_enabled()
    # Capture a photo
    take_photo_button.click()
    expect(app.get_by_test_id("stImage")).to_have_count(1)
    remove_photo_button = camera.get_by_text("Clear photo").first
    remove_photo_button.click()
    expect(app.get_by_test_id("stImage")).to_have_count(0)


@pytest.mark.skip_browser("webkit")
def test_shows_disabled_widget_correctly(
    themed_app: Page,
    assert_snapshot: ImageCompareFunction,
):
    """Test that it renders disabled camera_input widget correctly."""
    camera_input_widgets = themed_app.get_by_test_id("stCameraInput")
    expect(camera_input_widgets).to_have_count(NUM_CAMERA_INPUT_WIDGETS)
    disabled_camera_input = get_camera_input(themed_app, "Label2")

    # The width is debounced in this component, so we need to wait until the
    # webcam view has a non-zero width/height
    check_dimensions = check_dimensions_func(disabled_camera_input)

    wait_until(themed_app, check_dimensions)
    assert_snapshot(disabled_camera_input, name="st_camera_input-disabled")


# Webkit CI camera permission issue
@pytest.mark.skip_browser("webkit")
def test_take_photo_button_styling(app: Page):
    """Test that the Take Photo button is rendered properly when active/disabled."""
    camera_input_widgets = app.get_by_test_id("stCameraInput")
    expect(camera_input_widgets).to_have_count(NUM_CAMERA_INPUT_WIDGETS)

    # Active button styling
    active_camera_input = get_camera_input(app, "Label1")

    # Wait for debounced webcam dimensions to stabilize before checking styles
    check_dimensions = check_dimensions_func(active_camera_input)
    wait_until(app, check_dimensions)

    take_photo_button = active_camera_input.get_by_test_id("stCameraInputButton")

    # Check that the button is enabled and has the correct cursor
    expect(take_photo_button).to_be_enabled()
    expect(take_photo_button).to_have_css("cursor", "pointer")

    # Check that the button is styled correctly when hovered over.
    # Re-hover before each CSS assertion because Firefox can lose the :hover
    # state between sequential expect() calls when the webcam layout reflows.
    take_photo_button.scroll_into_view_if_needed()
    take_photo_button.hover()
    expect(take_photo_button).to_have_css("color", "rgb(255, 75, 75)")
    take_photo_button.hover()
    expect(take_photo_button).to_have_css("border-color", "rgb(255, 75, 75)")
    take_photo_button.hover()
    expect(take_photo_button).to_have_css("background-color", "rgb(255, 255, 255)")

    # Disabled button styling
    disabled_camera_input = get_camera_input(app, "Label2")
    take_photo_button = disabled_camera_input.get_by_test_id("stCameraInputButton")

    # Check that the button is disabled and has the correct cursor
    expect(take_photo_button).to_be_disabled()
    expect(take_photo_button).to_have_css("cursor", "not-allowed")

    # Check that the button is styled correctly when hovered over
    take_photo_button.hover()
    expect(take_photo_button).to_have_css("color", "rgba(49, 51, 63, 0.4)")
    expect(take_photo_button).to_have_css("border-color", "rgba(49, 51, 63, 0.2)")
    expect(take_photo_button).to_have_css("background-color", "rgb(255, 255, 255)")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stCameraInput")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "camera_input_1")).to_be_visible()


@pytest.mark.skip_browser("webkit")
def test_camera_input_widths(
    app: Page,
    assert_snapshot: ImageCompareFunction,
):
    camera_input_widgets = app.get_by_test_id("stCameraInput")
    expect(camera_input_widgets).to_have_count(NUM_CAMERA_INPUT_WIDGETS)

    stretch_camera = get_camera_input(app, "Width Stretch")
    pixel_width_camera = get_camera_input(app, "Width 300px")

    # The width is debounced in this component, so we need to wait until the
    # webcam view has a non-zero width/height
    check_dimensions = check_dimensions_func(stretch_camera)
    wait_until(app, check_dimensions)
    assert_snapshot(stretch_camera, name="st_camera_input-width_stretch")

    check_dimensions = check_dimensions_func(pixel_width_camera)
    wait_until(app, check_dimensions)
    assert_snapshot(pixel_width_camera, name="st_camera_input-width_300px")


@pytest.mark.skip_browser(
    "webkit"  # Webkit CI camera permission issue
)
def test_dynamic_camera_input_props(app: Page):
    """Test that the camera input can be updated dynamically while keeping the state."""
    # Hide the header to avoid the header toolbar from interfering with hover action below:
    app.add_style_tag(
        content="""
    .stAppHeader {
        display: none;
    }
    """
    )

    dynamic_camera_input = get_element_by_key(app, "dynamic_camera_input_with_key")
    expect(dynamic_camera_input).to_be_visible()

    # Make sure its rendered correctly before checking the state:
    check_dimensions = check_dimensions_func(
        dynamic_camera_input.get_by_test_id("stCameraInput")
    )
    wait_until(app, check_dimensions)

    # Check initial state
    expect(dynamic_camera_input).to_contain_text("Initial dynamic camera input")
    expect_prefixed_markdown(app, "Initial camera input value:", "False")

    # Check that the help tooltip is correct:
    app.wait_for_timeout(
        3000  # Camera input can be a bit unstable and change its height slightly delayed.
    )
    dynamic_camera_input.scroll_into_view_if_needed()
    expect_help_tooltip(app, dynamic_camera_input, "initial help")

    # Click the toggle to update the camera input props
    click_toggle(app, "Update camera input props")
    wait_until(app, check_dimensions)

    # Check updated state
    expect(dynamic_camera_input).to_contain_text("Updated dynamic camera input")

    # The value should still be False (no photo taken)
    expect_prefixed_markdown(app, "Updated camera input value:", "False")

    # Check width manually since we cannot get stable screenshots:
    expect(dynamic_camera_input).to_have_css("width", "300px")

    # Check that the help tooltip is correct:
    app.wait_for_timeout(
        3000  # Camera input can be a bit unstable and change its height slightly delayed.
    )
    dynamic_camera_input.scroll_into_view_if_needed()
    expect_help_tooltip(app, dynamic_camera_input, "updated help")
