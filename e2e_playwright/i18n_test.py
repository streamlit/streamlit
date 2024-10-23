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

import pytest
from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction

"""
Any tests that should be tested against multiple locales should be placed here.
Because `browser_context_args` is applied by Playwright on the file level, we
should keep only tests that should be run against multiple locales in this file.

See https://playwright.dev/python/docs/test-runners#fixtures for more
information.
"""


@pytest.fixture(scope="function", params=["en-US", "de-DE", "ja-JP", "ar-EG"])
def browser_context_args(request, browser_context_args):
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
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the range calendar picker renders correctly via screenshots matching."""
    themed_app.get_by_test_id("stDateInput").nth(0).click()
    assert_snapshot(
        themed_app.locator('[data-baseweb="calendar"]').first,
        name="st_date_input-range_two_dates_calendar",
    )
