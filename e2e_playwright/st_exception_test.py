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
from e2e_playwright.shared.app_utils import check_top_level_class


def test_st_exception_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    expect(themed_app.get_by_test_id("stException").nth(0)).to_contain_text(
        "RuntimeError: This exception message is awesome!"
    )

    # Click the button that raises the exception
    button = themed_app.get_by_test_id("stButton").nth(0).locator("button")
    button.click()
    wait_for_app_run(themed_app)

    for i in range(4):
        assert_snapshot(
            themed_app.get_by_test_id("stException").nth(i), name=f"st_exception-{i}"
        )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stException")
