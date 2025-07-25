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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import get_element_by_key, get_expander

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
    "layout-horizontal-map",
    "layout-horizontal-content-width",
]

CONTAINER_KEYS_WITH_EXPANDERS = [
    "layout-horizontal-expander-dataframe",
    "layout-horizontal-expander-dataframe-content-width",
    "layout-horizontal-expander-dataframe-content-width-large",
]


def test_layouts_container_various_elements(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Snapshot test for each top-level container in st_layouts_container_various_elements.py."""
    wait_for_app_run(app)
    for key in CONTAINER_KEYS:
        locator = get_element_by_key(app, key)
        assert_snapshot(locator, name=f"st_layouts_container_various_elements-{key}")


def test_layouts_container_expanders(app: Page, assert_snapshot: ImageCompareFunction):
    """Test expander functionality in containers that contain expanders."""
    wait_for_app_run(app)
    expect(app.get_by_test_id("stExpander")).to_have_count(3)

    for container_key in CONTAINER_KEYS_WITH_EXPANDERS:
        container = get_element_by_key(app, container_key)

        expect(container).to_be_visible()

        expander = get_expander(container, "Expand me")
        expander_header = expander.locator("summary").first
        expect(expander_header).to_be_visible()

        expander_header.click()

        assert_snapshot(
            expander,
            name=f"st_layouts_container_various_elements-{container_key}-expander-opened",
        )
