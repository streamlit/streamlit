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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import get_element_by_key, get_selectbox

# Container keys that should be tested (excluding map cases which need special handling)
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
    "layout-vertical-stretch-height",
    "layout-vertical-content-width-container-with-various-elements",
    "layout-vertical-content-width-container-with-stretch-width-dataframes",
    "layout-vertical-content-width-container-with-content-width-dataframes",
    "layout-horizontal-content-width-container-with-metrics-dataframes-line-charts",
    "narrow-fixed-width-container-with-dataframe",
]

# Container keys that have expanders to test
CONTAINER_KEYS_WITH_EXPANDERS = [
    "layout-horizontal-expander-dataframe",
    "layout-horizontal-expander-dataframe-content-width",
]

# Container keys with maps that need special handling
MAP_CONTAINER_KEYS = [
    "layout-horizontal-map",
    "layout-vertical-content-width-container-with-map",
]


def _select_case(app: Page, case_name: str) -> None:
    """Select a container case from the selectbox and wait for it to render."""
    selectbox_input = get_selectbox(app, "Select container case").locator("input")
    # Clear any existing text and type the option name
    selectbox_input.fill("")
    selectbox_input.type(case_name)
    selectbox_input.press("Enter")
    wait_for_app_run(app, wait_delay=500)


@pytest.mark.parametrize("container_key", CONTAINER_KEYS)
def test_layouts_container_various_elements(
    app: Page, assert_snapshot: ImageCompareFunction, container_key: str
):
    """Snapshot test for each top-level container in st_layouts_container_various_elements.py."""
    _select_case(app, container_key)

    locator = get_element_by_key(app, container_key)
    expect(locator).to_be_visible()
    assert_snapshot(
        locator, name=f"st_layouts_container_various_elements-{container_key}"
    )


# Firefox seems to be failing but can't reproduce locally and video produces an empty page for firefox
@pytest.mark.skip_browser("firefox")
@pytest.mark.parametrize("container_key", MAP_CONTAINER_KEYS)
def test_layouts_container_with_map(
    app: Page, assert_snapshot: ImageCompareFunction, container_key: str
):
    """Snapshot test for containers with maps in st_layouts_container_various_elements.py."""
    _select_case(app, container_key)

    # Wait for map elements to load
    map_element = app.get_by_test_id("stDeckGlJsonChart")
    expect(map_element).to_be_visible(timeout=15000)
    # The map assets can take more time to load, add an extra timeout
    # to prevent flakiness.
    app.wait_for_timeout(5000)

    locator = get_element_by_key(app, container_key)
    expect(locator).to_be_visible()
    # Use higher pixel threshold for containers with maps due to their flakiness
    assert_snapshot(
        locator,
        name=f"st_layouts_container_various_elements-{container_key}",
        pixel_threshold=1.0,
    )


@pytest.mark.parametrize("container_key", CONTAINER_KEYS_WITH_EXPANDERS)
def test_layouts_container_expanders(
    app: Page, assert_snapshot: ImageCompareFunction, container_key: str
):
    """Test expander functionality in containers that contain expanders."""
    _select_case(app, container_key)

    container = get_element_by_key(app, container_key)
    expect(container).to_be_visible()

    # Get the expander in this container
    expander = container.get_by_test_id("stExpander")
    expect(expander).to_be_visible()
    expander.click()
    wait_for_app_run(app)

    assert_snapshot(
        container,
        name=f"st_layouts_container_various_elements-{container_key}-expander-opened",
    )
