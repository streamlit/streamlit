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
from e2e_playwright.shared.toolbar_utils import (
    assert_fullscreen_toolbar_button_interactions,
)

MAP_ELEMENT_COUNT = 5


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_st_map_has_consistent_visuals(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    maps = themed_app.get_by_test_id("stDeckGlJsonChart")
    expect(maps).to_have_count(MAP_ELEMENT_COUNT, timeout=15000)

    # The map assets can take more time to load, add an extra timeout
    # to prevent flakiness.
    themed_app.wait_for_timeout(10000)

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        maps.nth(0),
        name="st_map-empty",
        pixel_threshold=1.0,
    )

    assert_snapshot(
        maps.nth(0).locator(".mapboxgl-ctrl-group").nth(0),
        name="st_map-zoom_controls",
    )

    # Hover on the zoom out button
    maps.nth(0).locator(".mapboxgl-ctrl-zoom-out").hover()
    assert_snapshot(
        maps.nth(0).locator(".mapboxgl-ctrl-group").nth(0),
        name="st_map-zoom_out_hover",
    )

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        maps.nth(1).locator("canvas").nth(1),
        name="st_map-simple_map",
        pixel_threshold=1.0,
    )

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        maps.nth(2).locator("canvas").nth(1),
        name="st_map-simple_map_with_zoom",
        pixel_threshold=1.0,
    )

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        maps.nth(3).locator("canvas").nth(1),
        name="st_map-map_with_color_and_size_layers",
        pixel_threshold=1.0,
    )

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        maps.nth(4),
        name="st_map-width_and_height",
        pixel_threshold=1.0,
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    # Wait for map to be loaded:
    expect(app.get_by_test_id("stDeckGlJsonChart")).to_have_count(
        MAP_ELEMENT_COUNT, timeout=15000
    )

    check_top_level_class(app, "stDeckGlJsonChart")


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_st_map_clicking_on_fullscreen_toolbar_button(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that clicking on fullscreen toolbar button expands the map into fullscreen."""

    expect(app.get_by_test_id("stDeckGlJsonChart")).to_have_count(
        MAP_ELEMENT_COUNT, timeout=15000
    )
    # The map assets can take more time to load, add an extra timeout
    # to prevent flakiness.
    app.wait_for_timeout(10000)

    assert_fullscreen_toolbar_button_interactions(
        app,
        assert_snapshot=assert_snapshot,
        widget_test_id="stDeckGlJsonChart",
        filename_prefix="st_map",
        # The pydeck tests are a lot flakier than need be so increase the pixel threshold
        pixel_threshold=1.0,
    )
