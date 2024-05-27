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

from __future__ import annotations

from typing import Pattern

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run


def expect_exception(
    locator: Locator,
    expected_message: str | Pattern[str],
) -> None:
    """Expect an exception to be displayed in the app.

    Parameters
    ----------

    locator : Locator
        The locator to search for the exception element.

    expected_markdown : str or Pattern[str]
        The expected message to be displayed in the exception.
    """
    exception_el = locator.get_by_test_id("stException").filter(
        has_text=expected_message
    )
    expect(exception_el).to_be_visible()


def click_button(
    page: Page,
    label: str | Pattern[str],
) -> None:
    """Click a button with the given label.

    Parameters
    ----------

    page : Page
        The page to click the button on.

    label : str or Pattern[str]
        The label of the button to click.
    """
    button_element = (
        page.get_by_test_id("stButton").filter(has_text=label).locator("button")
    )
    expect(button_element).to_be_visible()

    button_element.click()
    wait_for_app_run(page)
