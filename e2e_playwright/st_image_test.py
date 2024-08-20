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


def test_image_display(app: Page):
    image = app.get_by_test_id("stImage").locator("img").first
    expect(image).to_have_css("height", "100px")
    expect(image).to_have_css("width", "100px")


def test_image_caption(app: Page):
    caption = app.get_by_test_id("stImage").get_by_test_id("stImageCaption").first
    expect(caption).to_contain_text("Black Square")
    expect(caption).to_have_css("width", "100px")


def test_image_and_caption_together(app: Page, assert_snapshot: ImageCompareFunction):
    image_container = app.get_by_test_id("stImageContainer").first
    assert_snapshot(image_container, name="st_image-with_caption")


def test_image_formats(app: Page):
    images = app.get_by_test_id("stImage").locator("img").all()

    expect(images[0]).to_have_attribute("src", re.compile(r"^.*\.jpg$"))
    expect(images[1]).to_have_attribute("src", re.compile(r"^.*\.png$"))
    expect(images[2]).to_have_attribute("src", re.compile(r"^.*\.jpg$"))
    expect(images[3]).to_have_attribute("src", re.compile(r"^.*\.png$"))


def test_image_sizes(app: Page, assert_snapshot: ImageCompareFunction):
    images = app.get_by_test_id("stImage").locator("img").all()

    for i in range(4, 8):
        # displays a 100x100 image when use_column_width is default, 'auto', 'never', or False
        assert_snapshot(images[i], name=f"st_image-black_square_100px_{i}")

    for i in range(8, 11):
        # displays a column-width image when use_column_width is 'always', True, or size > column
        assert_snapshot(images[i], name=f"st_image-black_square_column_{i}")


def test_svg_images(app: Page, assert_snapshot: ImageCompareFunction):
    images = app.get_by_test_id("stImage").locator("img").all()

    for i in range(11, 13):
        assert_snapshot(images[i], name=f"st_image-svg_image_{i}")


def test_gif_image(app: Page):
    gif_image = app.get_by_test_id("stImage").locator("img").nth(13)
    expect(gif_image).to_have_css("height", "100px")
    expect(gif_image).to_have_css("width", "100px")
    expect(gif_image).to_have_attribute("src", re.compile(r"^.*\.gif$"))


def test_gif_image_with_caption(app: Page, assert_snapshot: ImageCompareFunction):
    gif_container = app.get_by_test_id("stImageContainer").nth(14)
    assert_snapshot(gif_container, name="st_image-gif_with_caption")


def test_gif_as_png(app: Page):
    gif_as_png = app.get_by_test_id("stImage").locator("img").nth(15)
    expect(gif_as_png).to_have_attribute("src", re.compile(r"^.*\.png$"))


def test_fullscreen_button_exists(app: Page):
    """Test that element has the fullscreen button."""
    first_image = app.get_by_test_id("stImage").first
    expect(first_image.get_by_test_id("StyledFullScreenButton")).to_be_attached()
