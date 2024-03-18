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

from e2e_playwright.conftest import ImageCompareFunction


def test_show_columns_horizontally_when_viewport_allows(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """shows columns horizontally when viewport > 640"""
    themed_app.set_viewport_size({"width": 641, "height": 800})
    horizontal_blocks = themed_app.get_by_test_id("stHorizontalBlock")
    expect(horizontal_blocks).to_have_count(2)

    assert_snapshot(horizontal_blocks.nth(0), name="columns-layout-horizontal")


def test_show_columns_vertically_when_viewport_requires(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """stacks columns vertically when viewport <= 640"""
    themed_app.set_viewport_size({"width": 640, "height": 800})
    horizontal_blocks = themed_app.get_by_test_id("stHorizontalBlock")
    expect(horizontal_blocks).to_have_count(2)

    assert_snapshot(horizontal_blocks.nth(0), name="columns-layout-vertical")


def test_columns_always_take_up_space(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """columns still takes up space with no elements present"""
    horizontal_blocks = themed_app.get_by_test_id("stHorizontalBlock")
    expect(horizontal_blocks).to_have_count(2)

    assert_snapshot(horizontal_blocks.nth(1), name="columns-with-one-element")
