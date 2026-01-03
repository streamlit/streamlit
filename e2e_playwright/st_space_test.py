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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import get_element_by_key


def test_space_elements_exist(app: Page):
    """Test that space elements are rendered with correct dimensions."""
    space_elements = app.get_by_test_id("stSpace")
    # We have multiple space elements in the test app
    expect(space_elements.first).to_be_attached()

    # Verify space elements have no visible content
    first_space = space_elements.first
    expect(first_space).to_have_text("")

    heights_em = [0.25, 0.5, 0.75, 2.5, 4.25, 6, 8]

    # Check the first space elements (in vertical layout, so height should
    # be set)

    def wait_condition(space: Locator, height_px: int) -> Callable[[], bool]:
        return (
            lambda: (bbox := space.bounding_box()) is not None
            and int(bbox["height"]) == height_px
        )

    for i, height_em in enumerate(heights_em):
        height_px = round(height_em * 16)
        space = space_elements.nth(i)

        wait_until(app, wait_condition(space, height_px))


def test_horizontal_container_spacing(app: Page, assert_snapshot: ImageCompareFunction):
    """Test horizontal spacing with medium and stretch in a horizontal container."""
    horizontal_container = get_element_by_key(app, "horizontal_container_space")
    expect(horizontal_container).to_be_attached()

    # Snapshot the horizontal container to show medium and stretch spacing
    assert_snapshot(horizontal_container, name="st_space_horizontal_container")


def test_vertical_container_with_stretch(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test vertical spacing including stretch in a fixed-height vertical container."""
    vertical_container = get_element_by_key(app, "vertical_container_space")
    expect(vertical_container).to_be_attached()

    # Snapshot shows 25px space, stretch space, and default small space
    assert_snapshot(vertical_container, name="st_space_vertical_container_stretch")


def test_nested_containers_with_space(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that space works correctly in nested containers with different directions."""
    # Get the nested container with outer vertical and inner horizontal
    nested_container = get_element_by_key(app, "nested_container_space")
    expect(nested_container).to_be_attached()

    # Visual snapshot to verify spacing adapts to direction in nested contexts:
    # - Outer container: vertical spacing with large and medium
    # - Inner horizontal container: horizontal stretch spacing
    assert_snapshot(nested_container, name="st_space_nested_containers")


def test_space_sizes_match_widget_heights(app: Page):
    """Test that space sizes match actual widget heights from frontend theme.

    This definitively proves frontend/backend sync by comparing rendered heights:
    - st.space("medium") height vs button height (both use minElementHeight: 2.5rem)
    - st.space("large") height vs file uploader height (both use largestElementHeight: 4.25rem)

    If this test fails, the constants have diverged between:
    - Backend: streamlit/elements/lib/layout_utils.py SIZE_TO_REM_MAPPING
    - Frontend: frontend/lib/src/theme/primitives/sizes.ts
    """
    button = get_element_by_key(app, "sync_button").locator("button")
    # Get the file uploader dropzone - this is the element that uses largestElementHeight
    uploader_dropzone = get_element_by_key(app, "sync_uploader").get_by_test_id(
        "stFileUploaderDropzone"
    )

    sync_container = get_element_by_key(app, "size_sync_test")
    space_elements = sync_container.get_by_test_id("stSpace")

    expect(button).to_be_attached()
    expect(uploader_dropzone).to_be_attached()
    expect(space_elements.first).to_be_attached()

    wait_until(
        app,
        lambda: (
            button.bounding_box() is not None
            and uploader_dropzone.bounding_box() is not None
            and space_elements.nth(0).bounding_box() is not None
            and space_elements.nth(1).bounding_box() is not None
        ),
    )

    button_box = button.bounding_box()
    dropzone_box = uploader_dropzone.bounding_box()
    medium_space_box = space_elements.nth(0).bounding_box()
    large_space_box = space_elements.nth(1).bounding_box()

    assert button_box is not None
    assert dropzone_box is not None
    assert medium_space_box is not None
    assert large_space_box is not None

    # Verify button height (frontend minElementHeight = 2.5rem = 40px)
    button_height = int(button_box["height"])
    assert button_height == 40, f"Button height is {button_height}, expected 40"

    # Verify medium space matches button height (proves SIZE_TO_REM_MAPPING sync)
    medium_space_height = int(medium_space_box["height"])
    assert medium_space_height == button_height, (
        f"Medium space height ({medium_space_height}px) doesn't match "
        f"button height ({button_height}px). This means SIZE_TO_REM_MAPPING "
        f"'medium' is out of sync with frontend sizes.ts minElementHeight."
    )

    # Verify file uploader dropzone height (frontend largestElementHeight = 4.25rem = 68px)
    dropzone_height = int(dropzone_box["height"])
    assert dropzone_height == 68, (
        f"File uploader dropzone height is {dropzone_height}, expected 68"
    )

    # Verify large space matches dropzone height (proves SIZE_TO_REM_MAPPING sync)
    # Direct comparison: both rendered heights should be exactly 68px
    large_space_height = int(large_space_box["height"])
    assert large_space_height == dropzone_height, (
        f"Large space height ({large_space_height}px) doesn't match "
        f"file uploader dropzone height ({dropzone_height}px). This means "
        f"SIZE_TO_REM_MAPPING 'large' is out of sync with frontend "
        f"sizes.ts largestElementHeight."
    )
