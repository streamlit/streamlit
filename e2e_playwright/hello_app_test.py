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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def navigate_to_page(app: Page, index: int):
    app.get_by_test_id("stSidebarNav").locator("a").nth(index).click()
    wait_for_app_run(app)
    # Move the mouse to the top left corner to prevent any weird hover effects
    # in the screenshots
    app.mouse.move(0, 0)


def check_page_title(app: Page, title: str) -> None:
    expect(app.get_by_test_id("stMarkdown").locator("h1").nth(0)).to_contain_text(title)


def check_page_icon(app: Page, icon: str, index: int = 0) -> None:
    expect(
        app.get_by_test_id("stSidebarNavLink")
        .get_by_test_id("stIconMaterial")
        .nth(index)
    ).to_have_text(icon)


def test_home_page(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """Test that the home page of the hello app is displayed correctly."""
    check_page_title(app, "Welcome to Streamlit!")
    check_page_icon(app, "waving_hand")
    expect(app.get_by_test_id("stSidebar")).to_be_visible()
    expect(app.get_by_test_id("stSidebarNav")).to_be_visible()

    assert_snapshot(app, name="hello_app-home_page")


def test_animation_demo_page(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """Test that the animation demo page of the hello app is displayed correctly."""
    navigate_to_page(app, 1)

    check_page_title(app, "Animation Demo")
    check_page_icon(app, "animation", 1)
    # Wait for the animation to end. The animation takes 5-10 seconds to finish
    # which is a lot more than the default timeout, so we set it to a higher value
    expect(app.get_by_test_id("stButton")).to_contain_text("Re-run", timeout=25000)

    assert_snapshot(app, name="hello_app-animation_demo_page")


def test_plotting_demo_page(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """Test that the plotting demo page of the hello app is displayed correctly."""
    navigate_to_page(app, 2)

    check_page_title(app, "Plotting Demo")
    check_page_icon(app, "show_chart", 2)
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
    check_page_icon(app, "public", 3)
    # We add an additional timeout here since sometimes the loading of
    # the map takes a bit longer (probably because of the map token request).
    expect(app.get_by_test_id("stDeckGlJsonChart")).to_have_attribute(
        "height", "500", timeout=10000
    )

    # The snapshot test here is flaky, the map doesn't seem to always result
    # in the same image.
    # assert_snapshot(app, name="hello_app-mapping_demo_page")


def _load_dataframe_demo_page(app: Page):
    """Load the dataframe demo page and wait until all elements are visible."""
    navigate_to_page(app, 4)
    check_page_title(app, "DataFrame Demo")
    check_page_icon(app, "table", 4)
    expect(app.get_by_test_id("stMultiSelect")).to_be_visible()
    expect(app.get_by_test_id("stDataFrame")).to_be_visible()
    expect(
        app.get_by_test_id("stArrowVegaLiteChart").locator("canvas")
    ).to_have_attribute("height", "350")


def test_dataframe_demo_page(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """Test that the dataframe demo page of the hello app is displayed correctly."""
    _load_dataframe_demo_page(app)
    assert_snapshot(app, name="hello_app-dataframe_demo_page")


# TEST PRINTING:
# The print tests are in this suite to avoid having full-app screenshots being spread around in different suites.
# Even the smallest design change in one part of the app can make these full-screenshots fail and require renewal, which is why we want them to be
# bundled in one place. The "Dataframe Demo" page was arbitrarily chosen as a good printing candidate.


def _evaluate_match_media_print(app: Page):
    app.evaluate("matchMedia('print').matches")


# DIN A4 paper is 21cm x 29.7cm which is 595px x 842px in 72dpi;
# Use higher pixels to avoid mobile media queries to trigger but keep the ratio
portrait_width_px = 1240
portrait_height_px = 1754


def _set_portrait_dimensions(app: Page):
    app.set_viewport_size({"width": portrait_width_px, "height": portrait_height_px})


def _set_landscape_dimensions(app: Page):
    app.set_viewport_size({"width": portrait_height_px, "height": portrait_width_px})


def test_app_print_mode_portrait_with_sidebar_open(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the dataframe demo page looks correctly in print-mode with sidebar open."""
    app = themed_app
    _load_dataframe_demo_page(app)
    app.emulate_media(media="print", forced_colors="active")
    _set_portrait_dimensions(app)
    _evaluate_match_media_print(app)

    # ensure that the sidebar is visible
    expect(app.get_by_test_id("stSidebarContent")).to_be_visible()

    assert_snapshot(app, name="hello_app-print_media-portrait-sidebar_open")


def test_app_print_mode_portrait_with_sidebar_closed(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the dataframe demo page looks correctly in print-mode with sidebar closed."""
    app = themed_app
    _load_dataframe_demo_page(app)
    # close sidebar. Must be done before print-mode, because we hide the close button when printing
    app.get_by_test_id("stSidebar").hover()
    sidebar_element = app.get_by_test_id("stSidebarContent")
    sidebar_element.get_by_test_id("stBaseButton-headerNoPadding").click()
    expect(sidebar_element).not_to_be_visible()

    app.emulate_media(media="print", forced_colors="active")
    _set_portrait_dimensions(app)
    _evaluate_match_media_print(app)

    assert_snapshot(app, name="hello_app-print_media-portrait-sidebar_closed")


def test_app_print_mode_landscape_with_sidebar_open(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the dataframe demo page looks correctly in print-mode (orientation: landscape) with sidebar open."""
    app = themed_app
    _load_dataframe_demo_page(app)
    app.emulate_media(media="print", forced_colors="active")
    _set_landscape_dimensions(app)
    _evaluate_match_media_print(app)

    # ensure that the sidebar is visible
    expect(app.get_by_test_id("stSidebarContent")).to_be_visible()

    assert_snapshot(app, name="hello_app-print_media-landscape-sidebar_open")


def test_app_print_mode_landscape_with_sidebar_closed(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the dataframe demo page looks correctly in print-mode (orientation: landscape) with sidebar closed."""
    app = themed_app
    _load_dataframe_demo_page(app)
    # close sidebar. Must be done before print-mode, because we hide the close button when printing
    app.get_by_test_id("stSidebar").hover()
    sidebar_element = app.get_by_test_id("stSidebarContent")
    sidebar_element.get_by_test_id("stBaseButton-headerNoPadding").click()
    expect(sidebar_element).not_to_be_visible()

    app.emulate_media(media="print", forced_colors="active")
    _set_landscape_dimensions(app)
    _evaluate_match_media_print(app)

    assert_snapshot(app, name="hello_app-print_media-landscape-sidebar_closed")
