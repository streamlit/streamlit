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

import re

from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import get_markdown


def test_secret_value_display_and_styling(app: Page):
    """Test that the script-level config and secrets are loaded correctly."""
    secret_element = get_markdown(app, "Secret value: fake")
    # Check the secrets value:
    expect(secret_element).to_be_visible()

    # Check that its using the monospace font family (theme.font=monospace):
    # This needs to be a regex because the actual font-family can be a list of fonts.
    expect(secret_element).to_have_css("font-family", re.compile(r".*monospace.*"))

    # Check that the app is in dark mode (theme.base=dark):
    app_container = app.get_by_test_id("stApp")
    expect(app_container).to_have_css("color-scheme", "dark")

    # Check that the main menu is not visible (toolbarMode=minimal):
    expect(app.get_by_test_id("stMainMenu")).not_to_be_attached()
