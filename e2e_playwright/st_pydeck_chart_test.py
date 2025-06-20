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

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import check_top_level_class
from e2e_playwright.shared.toolbar_utils import (
    assert_fullscreen_toolbar_button_interactions,
)


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    # The pydeck chart takes a while to load so check that
    # it gets attached with an increased timeout.
    pydeck_charts = app.get_by_test_id("stDeckGlJsonChart")
    expect(pydeck_charts.first).to_be_attached(timeout=15000)

    check_top_level_class(app, "stDeckGlJsonChart")


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_st_pydeck_clicking_on_fullscreen_toolbar_button(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that clicking on fullscreen toolbar button expands the map into fullscreen."""

    # wait for mapbox to load
    wait_for_app_run(themed_app, 15000)

    assert_fullscreen_toolbar_button_interactions(
        themed_app,
        assert_snapshot=assert_snapshot,
        widget_test_id="stDeckGlJsonChart",
        filename_prefix="st_pydeck_chart",
        # The pydeck tests are a lot flakier than need be so increase the pixel threshold
        pixel_threshold=1.0,
    )


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_empty_chart(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "empty_chart_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0),
        name="st_pydeck_chart-empty",
        pixel_threshold=1.0,
    )


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_basic_chart(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "basic_chart_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0).locator("canvas").nth(0),
        name="st_pydeck_chart-san_francisco_overridden_light_theme",
        pixel_threshold=1.0,
    )


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_invalid_prop(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "invalid_prop_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0).locator("canvas").nth(1),
        name="st_pydeck_chart-invalid_prop",
        pixel_threshold=1.0,
    )


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_map_styles(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "map_styles_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0).locator("canvas").nth(1),
        name="st_pydeck_chart-style",
        pixel_threshold=1.0,
    )


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_light_style(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "light_style_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0),
        name="st_pydeck_chart-light",
        pixel_threshold=1.0,
    )


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_dark_style(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "dark_style_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0).locator("canvas").nth(0),
        name="st_pydeck_chart-dark",
        pixel_threshold=1.0,
    )


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_dimensions(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "dimensions_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0),
        name="st_pydeck_chart-custom_dimensions",
        pixel_threshold=1.0,
    )


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_mapbox(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "mapbox_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0).locator("canvas").nth(0),
        name="st_pydeck_chart-mapbox_provider",
        pixel_threshold=1.0,
    )


def select_subtest(app: Page, name: str) -> Locator:
    # Select the text in the UI:
    selectbox_input = app.get_by_test_id("stSelectbox").nth(0).locator("input")
    selectbox_input.type(name)
    selectbox_input.press("Enter")

    # The pydeck chart takes a while to load so check that
    # it gets attached with an increased timeout.
    pydeck_charts = app.get_by_test_id("stDeckGlJsonChart")
    expect(pydeck_charts).to_have_count(1, timeout=15000)

    # The map assets can take more time to load, add an extra timeout
    # to prevent flakiness.
    app.wait_for_timeout(10000)

    return pydeck_charts
