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
from e2e_playwright.shared.app_utils import expect_help_tooltip


def test_download_button_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    st_download_buttons = themed_app.get_by_test_id("stDownloadButton")
    expect(st_download_buttons).to_have_count(6)

    assert_snapshot(st_download_buttons.nth(0), name="st_download_button-regular")
    assert_snapshot(st_download_buttons.nth(1), name="st_download_button-disabled")
    assert_snapshot(
        st_download_buttons.nth(3), name="st_download_button-use_container_width_true"
    )
    assert_snapshot(
        st_download_buttons.nth(4),
        name="st_download_button-use_container_width_true_with_help",
    )
    assert_snapshot(
        st_download_buttons.nth(5),
        name="st_download_button-use_container_width_primary",
    )


def test_help_tooltip_works(app: Page):
    download_button = app.get_by_test_id("stDownloadButton").nth(4)
    expect_help_tooltip(app, download_button, "Help text")


def test_clicking_downloads_file(app: Page):
    # Start waiting for the download
    with app.expect_download() as _:
        app.get_by_test_id("stDownloadButton").nth(0).locator("button").click()

    expect(app.get_by_text("value: True")).to_have_count(1)
