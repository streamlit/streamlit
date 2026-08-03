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

GAPS = [
    None,
    "xxsmall",
    "xsmall",
    "small",
    "medium",
    "large",
    "xlarge",
    "xxlarge",
]

PIXEL_GAPS = [0, 20, 50]


def test_layouts_container_gap_size(app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot test for each top-level container in st_layouts_container_gap_size.py."""
    for gap in GAPS:
        gap_name = str(gap).lower()

        container_keys = [
            f"container-horizontal-gap-{gap_name}",
            f"container-vertical-gap-{gap_name}",
        ]

        for key in container_keys:
            locator = get_element_by_key(app, key)
            assert_snapshot(locator, name=f"st_layouts_container_gap_size-{key}")


def test_layouts_container_pixel_gap(app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot + CSS assertion for integer pixel gap variants."""
    for pixel_gap in PIXEL_GAPS:
        for orientation in ("horizontal", "vertical"):
            key = f"container-{orientation}-gap-pixel-{pixel_gap}"
            flex_block = get_element_by_key(app, key)
            # Assert row-gap / column-gap directly because browsers may
            # normalize the shorthand ``gap`` property to either one or two
            # values (e.g. ``"20px"`` vs ``"20px 20px"``).
            expect(flex_block).to_have_css("row-gap", f"{pixel_gap}px")
            expect(flex_block).to_have_css("column-gap", f"{pixel_gap}px")
            assert_snapshot(flex_block, name=f"st_layouts_container_gap_size-{key}")


def test_layouts_columns_pixel_gap(app: Page):
    """CSS assertion for the ``st.columns(gap=20)`` pixel-gap variant."""
    columns_block = (
        get_element_by_key(app, "columns-pixel-gap")
        .get_by_test_id("stHorizontalBlock")
        .nth(0)
    )
    expect(columns_block).to_have_css("row-gap", "20px")
    expect(columns_block).to_have_css("column-gap", "20px")
