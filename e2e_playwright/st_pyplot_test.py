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
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expect_warning,
    wait_for_all_images_to_be_loaded,
)
from e2e_playwright.shared.react18_utils import take_stable_snapshot


def test_displays_a_pyplot_figures(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that all pyplot figures are displayed correctly via screenshot matching."""

    # pyplot graph assertion
    expect(themed_app.get_by_test_id("stImage").last.locator("img")).to_have_attribute(
        "src", re.compile("localhost*")
    )

    pyplot_elements = themed_app.get_by_test_id("stImage").locator("img")
    expect(pyplot_elements).to_have_count(11)

    assert_snapshot(pyplot_elements.nth(0), name="st_pyplot-normal_figure")
    assert_snapshot(pyplot_elements.nth(1), name="st_pyplot-resized_figure")
    assert_snapshot(pyplot_elements.nth(2), name="st_pyplot-container_width_true")
    assert_snapshot(pyplot_elements.nth(3), name="st_pyplot-container_width_false")
    assert_snapshot(pyplot_elements.nth(4), name="st_pyplot-seaborn")
    assert_snapshot(pyplot_elements.nth(5), name="st_pyplot-seaborn_using_kwargs")

    # Snapshot testing the global object is flaky. But we anyways want to remove this,
    # functionality so we can just comment it out for now.
    # assert_snapshot(pyplot_elements.nth(6), name="st_pyplot-global_figure")  # noqa: ERA001


def test_shows_deprecation_warning(app: Page):
    """Test that the deprecation warning is displayed correctly."""
    expect_warning(app, "without providing a figure argument has been deprecated")


@pytest.mark.skip_browser("webkit")
def test_width_parameter_content(app: Page, assert_snapshot: ImageCompareFunction):
    """Test the width parameter with content option."""
    pyplot_elements = app.get_by_test_id("stImage").locator("img")
    expect(pyplot_elements).to_have_count(11)
    wait_for_all_images_to_be_loaded(app)

    content_pyplot = pyplot_elements.nth(8)
    expect(content_pyplot).to_be_visible()
    take_stable_snapshot(
        app, content_pyplot, assert_snapshot, name="st_pyplot-width_content"
    )


# Running this in webkit is a bit flaky, resulting in mismatched snapshots:
@pytest.mark.skip_browser("webkit")
def test_width_parameter_stretch(app: Page, assert_snapshot: ImageCompareFunction):
    """Test the width parameter with stretch option."""
    pyplot_elements = app.get_by_test_id("stImage").locator("img")
    expect(pyplot_elements).to_have_count(11)
    wait_for_all_images_to_be_loaded(app)

    stretch_pyplot = pyplot_elements.nth(9)
    expect(stretch_pyplot).to_be_visible()
    take_stable_snapshot(
        app, stretch_pyplot, assert_snapshot, name="st_pyplot-width_stretch"
    )


def test_width_parameter_pixel(app: Page, assert_snapshot: ImageCompareFunction):
    """Test the width parameter with pixel value."""
    pyplot_elements = app.get_by_test_id("stImage").locator("img")
    expect(pyplot_elements).to_have_count(11)
    wait_for_all_images_to_be_loaded(app)

    pixel_pyplot = pyplot_elements.nth(10)
    expect(pixel_pyplot).to_be_visible()
    take_stable_snapshot(
        app, pixel_pyplot, assert_snapshot, name="st_pyplot-width_pixel"
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stImage")
