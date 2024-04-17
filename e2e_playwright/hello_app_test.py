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
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def navigate_to_page(app: Page, index: int):
    app.get_by_test_id("stSidebarNav").locator("a").nth(index).click()
    wait_for_app_run(app)
    # Move the mouse to the top left corner to prevent any weird hover effects
    # in the screenshots
    app.mouse.move(0, 0)


def check_page_title(app: Page, title: str) -> Locator:
    expect(app.get_by_test_id("stMarkdown").locator("h1").nth(0)).to_contain_text(title)


def test_home_page(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """Test that the home page of the hello app is displayed correctly."""
    check_page_title(app, "Welcome to Streamlit!")
    expect(app.get_by_test_id("stSidebar")).to_be_visible()

    assert_snapshot(app, name="hello_app-home_page")


def test_animation_demo_page(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """Test that the animation demo page of the hello app is displayed correctly."""
    navigate_to_page(app, 1)

    check_page_title(app, "Animation Demo")
    # Wait for the animation to end. The animation takes 5-10 seconds to finish
    # which is a lot more than the default timeout
    expect(app.get_by_test_id("stButton")).to_contain_text("Re-run", timeout=15000)

    assert_snapshot(app, name="hello_app-animation_demo_page")


def test_plotting_demo_page(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """Test that the plotting demo page of the hello app is displayed correctly."""
    navigate_to_page(app, 2)

    check_page_title(app, "Plotting Demo")
    # The animation takes 5-10 seconds to finish, so we add
    # and additional timeout
    expect(app.get_by_test_id("stText")).to_contain_text("100% Complete", timeout=15000)
    expect(app.get_by_test_id("stProgress")).not_to_be_visible()
    expect(
        app.get_by_test_id("stArrowVegaLiteChart").locator("canvas")
    ).to_have_attribute("height", "350")

    assert_snapshot(app, name="hello_app-plotting_demo_page")


def test_mapping_demo_page(app: Page) -> None:
    """Test that the mapping demo page of the hello app is displayed correctly."""
    navigate_to_page(app, 3)

    check_page_title(app, "Mapping Demo")
    # We add an additional timeout here since sometimes the loading of
    # the map takes a bit longer (probably because of the map token request).
    expect(app.get_by_test_id("stDeckGlJsonChart")).to_have_attribute(
        "height", "500", timeout=10000
    )

    # The snapshot test here is flaky, the map doesn't seem to always result
    # in the same image.
    # assert_snapshot(app, name="hello_app-mapping_demo_page")


def test_dataframe_demo_page(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """Test that the dataframe demo page of the hello app is displayed correctly."""
    navigate_to_page(app, 4)
    check_page_title(app, "DataFrame Demo")
    expect(app.get_by_test_id("stMultiSelect")).to_be_visible()
    expect(app.get_by_test_id("stDataFrame")).to_be_visible()
    expect(
        app.get_by_test_id("stArrowVegaLiteChart").locator("canvas")
    ).to_have_attribute("height", "350")

    assert_snapshot(app, name="hello_app-dataframe_demo_page")
