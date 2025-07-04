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

import re

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_until,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expect_no_skeletons,
    get_element_by_key,
    get_image,
    goto_app,
)

IMAGE_ELEMENTS_USING_MEDIA_ENDPOINT = 37


def check_image_source_error_count(messages: list[str], expected_count: int):
    """Check that the expected number of image source error messages are logged."""
    assert (
        len(
            [
                message
                for message in messages
                if "Client Error: Image source error" in message
            ]
        )
        == expected_count
    )


def test_image_display(app: Page):
    first_image = get_image(app, "Black Square as JPEG.").locator("img")
    expect(first_image).to_have_css("height", "100px")
    expect(first_image).to_have_css("width", "100px")


def test_image_caption(app: Page):
    caption = (
        get_image(app, "Black Square as JPEG.").get_by_test_id("stImageCaption").first
    )
    expect(caption).to_contain_text("Black Square")
    expect(caption).to_have_css("width", "100px")


def test_image_and_caption_together(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    first_image = get_image(themed_app, "Black Square as JPEG.").get_by_test_id(
        "stImageContainer"
    )
    assert_snapshot(first_image, name="st_image-with_caption")


def test_image_formats(app: Page):
    expect(get_image(app, "Black Square as JPEG.").locator("img")).to_have_attribute(
        "src", re.compile(r"^.*\.jpg$")
    )
    expect(get_image(app, "Black Square as PNG.").locator("img")).to_have_attribute(
        "src", re.compile(r"^.*\.png$")
    )
    expect(
        get_image(app, "Black Square with no output format specified.").locator("img")
    ).to_have_attribute("src", re.compile(r"^.*\.jpg$"))
    expect(
        get_image(app, "Transparent Black Square.").locator("img")
    ).to_have_attribute("src", re.compile(r"^.*\.png$"))

    expect(
        get_image(app, "Image from jpg file (str).").locator("img")
    ).to_have_attribute("src", re.compile(r"^.*\.jpg$"))

    expect(
        get_image(app, "Image from jpg file (Path).").locator("img")
    ).to_have_attribute("src", re.compile(r"^.*\.jpg$"))

    # GIF:
    expect(get_image(app, "Black Circle as GIF.").locator("img")).to_have_attribute(
        "src", re.compile(r"^.*\.gif$")
    )
    expect(get_image(app, "GIF as PNG.").locator("img")).to_have_attribute(
        "src", re.compile(r"^.*\.png$")
    )


def test_use_column_width_parameter(app: Page, assert_snapshot: ImageCompareFunction):
    columns_container = (
        get_element_by_key(app, "use_column_width")
        .get_by_test_id("stHorizontalBlock")
        .first
    )
    expect(columns_container).to_be_visible()
    columns_container.scroll_into_view_if_needed()
    expect_no_skeletons(columns_container)
    assert_snapshot(columns_container, name="st_image-use_column_width")

    expect(app.get_by_test_id("stMainBlockContainer")).to_contain_text(
        "The use_column_width parameter has been deprecated and will be removed in a "
        "future release. Please utilize the use_container_width parameter instead."
    )


def test_st_image_use_container_width_parameter(
    app: Page, assert_snapshot: ImageCompareFunction
):
    columns_container = (
        get_element_by_key(app, "use_container_width")
        .get_by_test_id("stHorizontalBlock")
        .first
    )
    expect(columns_container).to_be_visible()
    columns_container.scroll_into_view_if_needed()
    expect_no_skeletons(columns_container)
    assert_snapshot(columns_container, name="st_image-use_container_width")


def test_fullscreen_button_exists(app: Page):
    """Test that element has the fullscreen button."""
    expect(app.get_by_role("button", name="Fullscreen").first).to_be_attached()


def test_image_from_file_str(app: Page, assert_snapshot: ImageCompareFunction):
    image = get_image(app, "Image from jpg file (str).").locator("img")
    expect(image).to_have_css("width", "200px")
    expect(image).to_have_attribute("src", re.compile(r"^.*\.jpg$"))
    assert_snapshot(image, name="st_image-image_from_file_str")


def test_image_from_file_path(app: Page, assert_snapshot: ImageCompareFunction):
    image = get_image(app, "Image from jpg file (Path).").locator("img")
    expect(image).to_have_css("width", "200px")
    expect(image).to_have_attribute("src", re.compile(r"^.*\.jpg$"))
    assert_snapshot(image, name="st_image-image_from_file_path")


def test_gif_image(app: Page, assert_snapshot: ImageCompareFunction):
    gif_image = get_image(app, "Black Circle as GIF.").locator("img")
    expect(gif_image).to_have_css("height", "100px")
    expect(gif_image).to_have_css("width", "100px")
    expect(gif_image).to_have_attribute("src", re.compile(r"^.*\.gif$"))

    assert_snapshot(gif_image, name="st_image-gif_image")


def test_svg_images(app: Page, assert_snapshot: ImageCompareFunction):
    # Test "Text SVG with meta tags"
    meta_tag_svg = get_image(app, "Text SVG with meta tags.").locator("img")
    expect(meta_tag_svg).to_have_css("max-width", "100%")
    assert_snapshot(meta_tag_svg, name="st_image-svg_with_meta_tags")

    # Test "Red Circle with internal dimensions"
    red_circle_internal_dim = get_image(
        app, "Red Circle with internal dimensions."
    ).locator("img")
    expect(red_circle_internal_dim).to_have_css("max-width", "100%")
    assert_snapshot(
        red_circle_internal_dim, name="st_image-svg_red_circle_internal_dim"
    )

    # Test "Red Circle with width 300"
    red_circle_300 = get_image(app, "Red Circle with width 300.").locator("img")
    expect(red_circle_300).to_have_css("width", "300px")
    assert_snapshot(red_circle_300, name="st_image-svg_red_circle_300")

    # Test Yellow Green Rectangle variations
    ygr_50 = get_image(app, "Yellow Green Rectangle with x 50.").locator("img")
    expect(ygr_50).to_have_css("width", "100px")
    assert_snapshot(ygr_50, name="st_image-svg_yellow_green_rectangle_50")

    ygr_50_300 = get_image(
        app, "Yellow Green Rectangle with x 50 and width 300."
    ).locator("img")
    expect(ygr_50_300).to_have_css("width", "300px")
    assert_snapshot(ygr_50_300, name="st_image-svg_yellow_green_rectangle_50_300")

    # Test yellow rectangle (respects viewbox)
    ygr_0 = get_image(app, "Yellow Green Rectangle with x 0.").locator("img")
    expect(ygr_0).to_have_css("width", "100px")
    assert_snapshot(ygr_0, name="st_image-svg_yellow_green_rectangle_0")

    ygr_0_300 = get_image(
        app, "Yellow Green Rectangle with x 0 and width 300."
    ).locator("img")
    expect(ygr_0_300).to_have_css("width", "300px")
    assert_snapshot(ygr_0_300, name="st_image-svg_yellow_green_rectangle_0_300")

    ygr_100 = get_image(app, "Yellow Green Rectangle with x 100.").locator("img")
    expect(ygr_100).to_have_css("width", "100px")
    assert_snapshot(ygr_100, name="st_image-svg_yellow_green_rectangle_100")

    ygr_100_300 = get_image(
        app, "Yellow Green Rectangle with x 100 and width 300."
    ).locator("img")
    expect(ygr_100_300).to_have_css("width", "300px")
    assert_snapshot(ygr_100_300, name="st_image-svg_yellow_green_rectangle_100_300")


def set_fullscreen(app: Page, image_wrapper: Locator, open: bool):
    fullscreen_button = image_wrapper.get_by_role(
        "button", name="Fullscreen" if open else "Close fullscreen"
    )
    expect(fullscreen_button).to_be_visible()
    fullscreen_button.click()
    # Wait for the animation to finish
    app.wait_for_timeout(1000)


# SVGs without width or height are not rendered correctly in Firefox
@pytest.mark.skip_browser("firefox")
def test_svg_viewbox_only(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that SVGs with only viewBox are rendered correctly."""
    all_images = app.locator("div[data-testid='stImage']")
    start_index = 17
    end_index = start_index + 2

    for i in range(start_index, end_index):
        image = all_images.nth(i).get_by_test_id("stImageContainer")
        assert_snapshot(image, name=f"st_image-svg_viewbox_only_{i - start_index}")

        set_fullscreen(app, all_images.nth(i).locator(".."), True)
        image = all_images.nth(i).get_by_test_id("stImageContainer").locator("img")
        assert_snapshot(
            image, name=f"st_image-svg_viewbox_only_fullscreen_{i - start_index}"
        )

        set_fullscreen(app, all_images.nth(i).locator(".."), False)


def test_channels_parameter(app: Page, assert_snapshot: ImageCompareFunction):
    bgr_image = get_image(app, "BGR channel (red).").locator("img")
    assert_snapshot(bgr_image, name="st_image-channels_bgr_red")

    rgb_image = get_image(app, "RGB channel (blue).").locator("img")
    assert_snapshot(rgb_image, name="st_image-channels_rgb_blue")


def test_image_list(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.image can display a list of images."""
    image_list = get_image(app, "Image list")
    assert_snapshot(image_list, name="st_image-image_list")


def test_image_list_overflow(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.image can display a list of images."""
    image_list = get_image(app, "Overflow")
    assert_snapshot(image_list, name="st_image-image_list_overflow")


def test_markdown_caption_support(app: Page, assert_snapshot: ImageCompareFunction):
    image_element = (
        get_element_by_key(app, "image_with_markdown_caption")
        .get_by_test_id("stImage")
        .first
    )
    assert_snapshot(image_element, name="st_image-markdown_caption_support")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stImage")


def test_image_source_error(app: Page, app_port: int):
    """Test `st.image` source error."""
    # Ensure image source request return a 404 status
    app.route(
        f"http://localhost:{app_port}/media/**",
        lambda route: route.fulfill(
            status=404, headers={"Content-Type": "text/plain"}, body="Not Found"
        ),
    )

    # Capture console messages
    messages = []
    app.on("console", lambda msg: messages.append(msg.text))

    # Navigate to the app
    goto_app(app, f"http://localhost:{app_port}")

    # Wait until the expected error is logged, indicating CLIENT_ERROR was sent
    wait_until(
        app,
        lambda: check_image_source_error_count(
            messages, IMAGE_ELEMENTS_USING_MEDIA_ENDPOINT
        ),
        timeout=10000,
    )
