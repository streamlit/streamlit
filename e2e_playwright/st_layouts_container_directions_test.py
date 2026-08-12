# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key

CONTAINER_KEYS = [
    "container-horizontal-basic",
    "container-vertical-basic",
    "container-horizontal-fixed-width-and-stretch-element",
    "container-horizontal-fixed-height-element",
    "container-vertical-fixed-width-and-stretch-element",
    "container-vertical-fixed-height-element",
    "container-horizontal-no-wrap",
    "container-horizontal-wrap",
]


def test_layouts_container_directions(app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot test for each top-level container in st_layouts_container_directions.py."""
    for key in CONTAINER_KEYS:
        locator = get_element_by_key(app, key)
        assert_snapshot(locator, name=f"st_layouts_container_directions-{key}")


def test_horizontal_no_wrap_container_scrolls(app: Page):
    """A horizontal container with wrap=False scrolls horizontally instead of wrapping."""
    no_wrap_container = get_element_by_key(app, "container-horizontal-no-wrap")
    # The no-wrap container keeps its elements in a single, horizontally
    # scrollable row.
    expect(no_wrap_container).to_have_css("overflow-x", "auto")
    expect(no_wrap_container).to_have_css("flex-wrap", "nowrap")

    # The comparison container with wrap=True wraps onto additional rows and
    # must not become horizontally scrollable.
    wrap_container = get_element_by_key(app, "container-horizontal-wrap")
    expect(wrap_container).to_have_css("flex-wrap", "wrap")
    expect(wrap_container).not_to_have_css("overflow-x", "auto")
