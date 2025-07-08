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

import pytest
from playwright.sync_api import Page

from e2e_playwright.shared.app_utils import (
    click_button,
    expect_prefixed_markdown,
)


@pytest.mark.browser_context_args(timezone_id="Europe/Berlin")
def test_timezone(app: Page):
    """Test that the timezone is correctly set."""
    expect_prefixed_markdown(app, "Timezone name:", "Europe/Berlin")


@pytest.mark.browser_context_args(timezone_id="Asia/Yerevan")
def test_timezone_offset(app: Page):
    """Test that the timezone offset is correctly set."""
    expect_prefixed_markdown(app, "Timezone offset:", "-240")


@pytest.mark.browser_context_args(locale="it-IT")
def test_locale(app: Page):
    """Test that the locale correctly set."""
    expect_prefixed_markdown(app, "Locale primary language:", "it-IT")


def test_url(app: Page, app_port: int):
    """Test that the URL is correctly set."""
    expected_url = f"http://localhost:{app_port}"
    expect_prefixed_markdown(app, "Full url:", expected_url)


@pytest.mark.browser_context_args(timezone_id="Europe/Paris")
def test_rerun_preserves_context(app: Page):
    """Test that the timezone is preserved after a rerun."""
    # Check the initial timezone
    expect_prefixed_markdown(app, "Timezone name:", "Europe/Paris")

    # Click the rerun button
    click_button(app, "Trigger rerun")

    # Check that the timezone is still correct after rerun
    expect_prefixed_markdown(app, "Timezone name:", "Europe/Paris")


def test_theme_type(themed_app: Page, app_theme: str):
    """Test that the theme.type is correctly set."""
    if app_theme == "light_theme":
        expected_value = "light"
    elif app_theme == "dark_theme":
        expected_value = "dark"
    else:
        raise ValueError(f"Unrecognized app_theme fixture value: {app_theme}")

    expect_prefixed_markdown(themed_app, "Theme type:", expected_value)
