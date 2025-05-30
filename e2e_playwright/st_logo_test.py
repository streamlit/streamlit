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

from e2e_playwright.conftest import (
    ImageCompareFunction,
)


def test_logo_no_sidebar(
    themed_app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    select_subtest(themed_app, "logo_no_sidebar_subtest")

    expect(themed_app.get_by_test_id("stHeaderLogo")).to_be_visible()
    assert_snapshot(themed_app, name="logo-no_sidebar")


def test_small_logo_w_sidebar(
    themed_app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    select_subtest(themed_app, "small_logo_w_sidebar_subtest")

    expect(themed_app.get_by_test_id("stSidebar")).to_be_visible()
    expect(themed_app.get_by_test_id("stSidebarLogo")).to_be_visible()
    assert_snapshot(themed_app, name="logo-small_w_sidebar_expanded")

    themed_app.get_by_test_id("stSidebar").hover()
    themed_app.get_by_test_id("stSidebarCollapseButton").locator("button").click()

    expect(themed_app.get_by_test_id("stHeaderLogo")).to_be_visible()
    assert_snapshot(themed_app, name="logo-small_w_sidebar_collapsed")


def test_medium_logo_w_sidebar(
    themed_app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    select_subtest(themed_app, "medium_logo_w_sidebar_subtest")

    expect(themed_app.get_by_test_id("stSidebar")).to_be_visible()
    expect(themed_app.get_by_test_id("stSidebarLogo")).to_be_visible()
    assert_snapshot(themed_app, name="logo-medium_w_sidebar_expanded")

    themed_app.get_by_test_id("stSidebar").hover()
    themed_app.get_by_test_id("stSidebarCollapseButton").locator("button").click()

    expect(themed_app.get_by_test_id("stHeaderLogo")).to_be_visible()
    assert_snapshot(themed_app, name="logo-medium_w_sidebar_collapsed")


def test_large_logo_w_sidebar(
    themed_app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    select_subtest(themed_app, "large_logo_w_sidebar_subtest")

    expect(themed_app.get_by_test_id("stSidebar")).to_be_visible()
    expect(themed_app.get_by_test_id("stSidebarLogo")).to_be_visible()
    assert_snapshot(themed_app, name="logo-large_w_sidebar_expanded")

    themed_app.get_by_test_id("stSidebar").hover()
    themed_app.get_by_test_id("stSidebarCollapseButton").locator("button").click()

    expect(themed_app.get_by_test_id("stHeaderLogo")).to_be_visible()
    assert_snapshot(themed_app, name="logo-large_w_sidebar_collapsed")


def test_logo_w_sidebar_and_nav(
    themed_app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    select_subtest(themed_app, "logo_w_sidebar_and_nav_subtest")

    expect(themed_app.get_by_test_id("stSidebar")).to_be_visible()
    expect(themed_app.get_by_test_id("stSidebarLogo")).to_be_visible()
    assert_snapshot(themed_app, name="logo-navbar")


def select_subtest(app: Page, name: str) -> None:
    selectbox_input = app.get_by_test_id("stSelectbox").nth(0).locator("input")
    selectbox_input.type(name)
    selectbox_input.press("Enter")
