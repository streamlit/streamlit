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

from typing import Any

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction

"""
Any tests that should be tested against multiple locales should be placed here.
Because `browser_context_args` is applied by Playwright on the file level, we
should keep only tests that should be run against multiple locales in this file.

See https://playwright.dev/python/docs/test-runners#fixtures for more
information.
"""


@pytest.fixture(params=["en-US", "de-DE", "ja-JP", "ar-EG"])
def browser_context_args(
    request: pytest.FixtureRequest,
    browser_context_args: dict[str, Any],
) -> dict[str, Any]:
    """
    Parameterized fixture that runs for every test function in this module.
    Tests against 4 different locales.
    """
    locale = request.param
    return {
        **browser_context_args,
        "locale": locale,
    }


def test_range_date_calendar_picker_rendering(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the range calendar picker renders correctly via screenshots matching."""
    date_input = app.get_by_test_id("stDateInput").first
    expect(date_input).to_be_visible()
    date_input.scroll_into_view_if_needed()
    date_input.click()

    calendar_popover = app.locator('[data-baseweb="calendar"]').first

    expect(calendar_popover).to_be_visible()
    # Add a small timeout to minimize some flakiness:
    app.wait_for_timeout(500)
    calendar_popover.scroll_into_view_if_needed()

    assert_snapshot(
        calendar_popover,
        name="st_date_input-range_two_dates_calendar",
    )
