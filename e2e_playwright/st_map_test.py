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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_st_map_has_consistent_visuals(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    maps = themed_app.get_by_test_id("stDeckGlJsonChart")
    expect(maps).to_have_count(4)

    # wait for mapbox to load
    wait_for_app_run(themed_app, 15000)

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        maps.nth(0),
        name="st_map-empty",
        pixel_threshold=1.0,
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


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    expect(app.get_by_test_id("stDeckGlJsonChart").first).to_have_class(
        "stDeckGlJsonChart"
    )
