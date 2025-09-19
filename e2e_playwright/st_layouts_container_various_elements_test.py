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
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key

CONTAINER_KEYS = [
    "layout-dashboard-example",
    "layout-horizontal-form",
    "layout-horizontal-expander-dataframe",
    "layout-horizontal-expander-dataframe-content-width",
    "layout-horizontal-expander-dataframe-content-width-large",
    "layout-horizontal-images-center",
    "layout-horizontal-images-distribute",
    "layout-horizontal-columns",
    "layout-horizontal-tabs",
    "layout-horizontal-content-width",
    "layout-horizontal-text-area",
    # Don't expand this one, doesn't work well with the snapshot.
    "layout-horizontal-expander-dataframe-content-width-large",
]

CONTAINER_KEYS_WITH_EXPANDERS = [
    "layout-horizontal-expander-dataframe",
    "layout-horizontal-expander-dataframe-content-width",
]


def test_layouts_container_various_elements(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Snapshot test for each top-level container in st_layouts_container_various_elements.py."""

    for key in CONTAINER_KEYS:
        locator = get_element_by_key(app, key)
        expect(locator).to_be_visible()
        assert_snapshot(locator, name=f"st_layouts_container_various_elements-{key}")


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
def test_layouts_container_with_map(app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot test for the container with map in st_layouts_container_various_elements.py."""

    # Wait for map elements to load
    map_elements = app.get_by_test_id("stDeckGlJsonChart")
    expect(map_elements).to_have_count(1, timeout=15000)
    # The map assets can take more time to load, add an extra timeout
    # to prevent flakiness.
    app.wait_for_timeout(10000)

    locator = get_element_by_key(app, "layout-horizontal-map")
    expect(locator).to_be_visible()
    # Use higher pixel threshold for containers with maps due to their flakiness
    assert_snapshot(
        locator,
        name="st_layouts_container_various_elements-layout-horizontal-map",
        pixel_threshold=1.0,
    )


def test_layouts_container_expanders(app: Page, assert_snapshot: ImageCompareFunction):
    """Test expander functionality in containers that contain expanders."""
    expect(app.get_by_test_id("stExpander")).to_have_count(3)

    for container_key in CONTAINER_KEYS_WITH_EXPANDERS:
        container = get_element_by_key(app, container_key)
        expect(container).to_be_visible()

        # Get the first (and only) expander in this container
        container_expanders = container.get_by_test_id("stExpander")
        expander = container_expanders.first
        expect(expander).to_be_visible()
        expander.click()
        app.wait_for_timeout(3000)

        assert_snapshot(
            container,
            name=f"st_layouts_container_various_elements-{container_key}-expander-opened",
        )
