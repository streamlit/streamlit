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

import re
from typing import Any, cast

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_date_input

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


@pytest.fixture
def locale(browser_context_args: dict[str, Any]) -> str:
    """The locale the browser context for this test run was created with."""
    # browser_context_args is dict[str, Any]; the value is a str because the
    # fixture above put it there.
    return cast("str", browser_context_args["locale"])


def test_single_date_calendar_picker_rendering(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the single-date calendar picker renders correctly via screenshots matching."""
    date_input = get_date_input(app, "Single date")
    date_input.scroll_into_view_if_needed()
    date_input.get_by_test_id("stDateInputField").get_by_role(
        "spinbutton"
    ).first.click()

    calendar_popover = app.get_by_test_id("stDateInputCalendar")

    expect(calendar_popover).to_be_visible()
    # Add a small timeout to minimize some flakiness:
    app.wait_for_timeout(500)
    calendar_popover.scroll_into_view_if_needed()

    assert_snapshot(
        calendar_popover,
        name="st_date_input-single_date_calendar",
    )


# The quick-select presets keep this exact wording for en-* locales; every other
# locale gets its labels from Intl.RelativeTimeFormat instead.
EN_QUICK_SELECT_LABELS = [
    "Past Week",
    "Past Month",
    "Past 3 Months",
    "Past 6 Months",
    "Past Year",
    "Past 2 Years",
]


def test_range_quick_select_rendering(
    app: Page, assert_snapshot: ImageCompareFunction, locale: str
):
    """Test that the range quick-select preset labels are localized."""
    date_input = get_date_input(app, "Range with quick select")
    date_input.scroll_into_view_if_needed()
    date_input.get_by_test_id("stDateInputField").get_by_role(
        "spinbutton"
    ).first.click()

    # The trigger is named after the visible "Date range" row label plus the
    # selected preset. That label is still English (localizing the popover's
    # static strings needs a message catalog we don't have), so anchoring on
    # its prefix keeps this selector stable across locales.
    app.get_by_role("button", name=re.compile(r"^Date range")).click()

    quick_select_popover = app.get_by_test_id("stDateInputQuickSelectPopover")
    expect(quick_select_popover).to_be_visible()

    options = quick_select_popover.get_by_role("option")
    expect(options).to_have_count(len(EN_QUICK_SELECT_LABELS))

    if locale.startswith("en"):
        expect(options).to_have_text(EN_QUICK_SELECT_LABELS)
    else:
        # Guards against a silent regression back to English without pinning the
        # test to one ICU version's wording. "Past" prefixes all six English
        # labels, so its absence covers the whole set.
        expect(quick_select_popover).not_to_contain_text("Past")

    # Add a small timeout to minimize some flakiness:
    app.wait_for_timeout(500)

    assert_snapshot(
        quick_select_popover,
        name="st_date_input-range_quick_select",
    )
