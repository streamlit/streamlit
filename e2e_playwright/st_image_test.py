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

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_image


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

    expect(get_image(app, "Image from jpg file.").locator("img")).to_have_attribute(
        "src", re.compile(r"^.*\.jpg$")
    )

    # GIF:
    expect(get_image(app, "Black Circle as GIF.").locator("img")).to_have_attribute(
        "src", re.compile(r"^.*\.gif$")
    )
    expect(get_image(app, "GIF as PNG.").locator("img")).to_have_attribute(
        "src", re.compile(r"^.*\.png$")
    )


def test_use_column_width_parameter(app: Page, assert_snapshot: ImageCompareFunction):
    columns_container = app.get_by_test_id("stHorizontalBlock").first
    columns_container.scroll_into_view_if_needed()
    assert_snapshot(columns_container, name="st_image-use_column_width")


def test_fullscreen_button_exists(app: Page):
    """Test that element has the fullscreen button."""
    expect(app.get_by_test_id("StyledFullScreenButton").first).to_be_attached()


def test_image_from_file(app: Page, assert_snapshot: ImageCompareFunction):
    gif_image = get_image(app, "Image from jpg file.").locator("img")
    expect(gif_image).to_have_css("width", "200px")
    expect(gif_image).to_have_attribute("src", re.compile(r"^.*\.jpg$"))
    assert_snapshot(gif_image, name="st_image-image_from_file")


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

    # TODO(lukasmasuch): This svg does not correctly work in Safari and Firefox
    # Test "Red Circle"
    # red_circle = get_image(app, "Red Circle.").locator("img")
    # expect(red_circle).to_have_css("max-width", "100%")
    # assert_snapshot(red_circle, name="st_image-svg_red_circle")

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


def test_channels_parameter(app: Page, assert_snapshot: ImageCompareFunction):
    bgr_image = get_image(app, "BGR channel (red).").locator("img")
    assert_snapshot(bgr_image, name="st_image-channels_bgr_red")

    rgb_image = get_image(app, "RGB channel (blue).").locator("img")
    assert_snapshot(rgb_image, name="st_image-channels_rgb_blue")


def test_image_list(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.image can display a list of images."""
    image_list = get_image(app, "Image list")
    assert_snapshot(image_list, name="st_image-image_list")
