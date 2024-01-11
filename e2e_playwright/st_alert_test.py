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


def test_alert_displays_an_error_message(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    alert_elements = themed_app.get_by_test_id("stAlert")
    expect(alert_elements.nth(0)).to_have_text("This is an error")

    assert_snapshot(alert_elements.nth(0), name="st_alert_error")


def test_alert_displays_a_warning_message(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    alert_elements = themed_app.get_by_test_id("stAlert")
    expect(alert_elements.nth(1)).to_have_text("This is a warning")

    assert_snapshot(alert_elements.nth(1), name="st_alert_warning")


def test_alert_displays_an_info_message(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    alert_elements = themed_app.get_by_test_id("stAlert")
    expect(alert_elements.nth(2)).to_have_text("This is an info message")

    assert_snapshot(alert_elements.nth(2), name="st_alert_info")


def test_alert_displays_a_success_message(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    alert_elements = themed_app.get_by_test_id("stAlert")
    expect(alert_elements.nth(3)).to_have_text("This is a success message")

    assert_snapshot(alert_elements.nth(3), name="st_alert_success")
