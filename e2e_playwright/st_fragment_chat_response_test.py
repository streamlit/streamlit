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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import click_checkbox


# Only run tests on chromium as this can otherwise create a lot of screenshots, and
# we're only using the screenshots to verify that the app state changed as expected
# rather than using them for precise visual testing anyway.
@pytest.mark.only_browser("chromium")
def test_chat_response(app: Page, assert_snapshot: ImageCompareFunction):
    # Take a screenshot of the original chart
    assert_snapshot(
        app.get_by_test_id("stVegaLiteChart"),
        name="chart_before_fragment_rerun",
    )

    # Click on the checkbox to edit the chart
    click_checkbox(app, "Exclude internal apps")

    # Take a screenshot of the modified chart
    assert_snapshot(
        app.get_by_test_id("stVegaLiteChart"),
        name="chart_after_fragment_rerun",
    )
