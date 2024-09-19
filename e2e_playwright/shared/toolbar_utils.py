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

from typing import TYPE_CHECKING

from playwright.sync_api import Page, expect

if TYPE_CHECKING:
    from e2e_playwright.conftest import ImageCompareFunction


def assert_fullscreen_toolbar_button_interactions(
    app: Page,
    assert_snapshot: ImageCompareFunction,
    widget_test_id: str,
    filename_prefix: str = "",
    nth: int = 0,
    pixel_threshold: float = 0.05,
):
    """
    Shared test function to assert that clicking on fullscreen toolbar button
    expands the map into fullscreen.
    """

    widget_element = app.get_by_test_id(widget_test_id).nth(nth)
    widget_toolbar = widget_element.get_by_test_id("stElementToolbar")
    fullscreen_wrapper = app.get_by_test_id("stFullScreenFrame").nth(nth)

    fullscreen_toolbar_button = widget_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).last

    # Activate toolbar:
    widget_element.hover()
    # Check that it is visible
    expect(widget_toolbar).to_have_css("opacity", "1")

    # Click on expand to fullscreen button:
    fullscreen_toolbar_button.click()

    # Check that it is visible
    assert_snapshot(
        fullscreen_wrapper,
        name=f"{filename_prefix if filename_prefix != "" else widget_test_id}-fullscreen_expanded",
        pixel_threshold=pixel_threshold,
    )

    # Click again on fullscreen button to close fullscreen mode:
    fullscreen_toolbar_button.click()
    assert_snapshot(
        fullscreen_wrapper,
        name=f"{filename_prefix if filename_prefix != "" else widget_test_id}-fullscreen_collapsed",
        pixel_threshold=pixel_threshold,
    )
