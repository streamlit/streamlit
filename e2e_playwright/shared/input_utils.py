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

"""Shared input helpers for Streamlit Playwright E2E tests.

These utilities centralize common input interactions and assertions used across
E2E tests, with a focus on stability and guarding against regressions from
global hotkeys.
"""

from __future__ import annotations

import string
from typing import TYPE_CHECKING

from playwright.sync_api import Locator, Page, expect

if TYPE_CHECKING:
    from collections.abc import Callable

# A curated set of characters that covers common key inputs while staying stable in
# Playwright typing semantics (no enter/tab/newline, which can submit forms or move focus).
_COMMON_TYPED_CHARACTERS = (
    string.ascii_lowercase
    + string.ascii_uppercase
    + string.digits
    + " "
    + ".,-_@/:;?!'\"()[]{}<>+=*&^%$#~`|\\"
)


def type_common_characters_into_input(
    input_locator: Locator,
    *,
    after_each: Callable[[str], None] | None = None,
) -> str:
    """Type a broad set of common characters into a focused input.

    This is intended for regression tests where we want to ensure that typing
    into an editable target remains isolated from global hotkeys.

    Parameters
    ----------
    input_locator : Locator
        The input element to type into.
    after_each : Callable[[str], None] | None, optional
        Optional callback invoked after each typed character (useful for
        asserting that global hotkey side effects did not occur), by default
        None.

    Returns
    -------
    str
        The full string that was typed.
    """
    expect(input_locator).to_be_visible()
    input_locator.click()
    input_locator.fill("")

    expected_value = ""
    for ch in _COMMON_TYPED_CHARACTERS:
        input_locator.type(ch)
        expected_value += ch
        expect(input_locator).to_have_value(expected_value)
        if after_each is not None:
            after_each(ch)

    return expected_value


def expect_global_hotkeys_not_fired(
    app: Page,
    *,
    expected_runs: int | None = None,
    runs_locator: Locator | None = None,
) -> None:
    """Assert that global hotkeys did not trigger their UI side effects.

    This helper verifies that global hotkeys such as rerun and clear-cache did
    not fire while interacting with an input widget during a test.

    Parameters
    ----------
    app : Page
        The Playwright page representing the Streamlit app under test.
    expected_runs : int | None, optional
        If provided, the expected number of script runs. When set, the function
        asserts that a corresponding UI element reflecting this count is
        visible, by default None.
    runs_locator : Locator | None, optional
        Optional locator for the element that displays the run count. If not
        provided, a default locator is derived from ``expected_runs``, by
        default None.

    Returns
    -------
    None
        This function is used for assertions and does not return a value.

    Examples
    --------
    Assert that typing did not trigger a rerun or open the clear-cache dialog:

    >>> expect_global_hotkeys_not_fired(app, expected_runs=1)
    """

    # Rerun hotkey: must not start a script run while we're typing.
    expect(app.get_by_test_id("stApp")).to_have_attribute(
        "data-test-script-state",
        "notRunning",
    )

    if expected_runs is not None:
        locator = (
            runs_locator
            if runs_locator is not None
            else app.get_by_text(f"Runs: {expected_runs}", exact=True)
        )
        expect(locator).to_be_visible()

    # Clear-cache hotkey: must not open the clear-cache dialog while we're typing.
    expect(app.get_by_test_id("stClearCacheDialog")).not_to_be_visible()
