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

import re

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    get_markdown,
)


def get_button_group(app: Page, index: int) -> Locator:
    return app.get_by_test_id("stButtonGroup").nth(index)


def get_pill_button(locator: Locator, text: str) -> Locator:
    return locator.get_by_test_id(re.compile("stBaseButton-pills(Active)?")).filter(
        has_text=text
    )


def test_click_pills_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    pills = get_button_group(themed_app, 0)
    get_pill_button(pills, "📝 Text").click()
    wait_for_app_run(themed_app)
    get_pill_button(pills, "🪢 Graphs").click()
    text = get_markdown(themed_app, "Multi selection: \\['📝 Text', '🪢 Graphs'\\]")
    expect(text).to_be_attached()
    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    assert_snapshot(pills, name="st_pills-multiselect")
