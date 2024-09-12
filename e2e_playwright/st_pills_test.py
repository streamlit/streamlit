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
from e2e_playwright.shared.app_utils import click_checkbox, get_markdown


def get_button_group(app: Page, index: int) -> Locator:
    return app.get_by_test_id("stButtonGroup").nth(index)


def get_pill_button(locator: Locator, text: str) -> Locator:
    return locator.get_by_test_id(re.compile("stBaseButton-pills(Active)?")).filter(
        has_text=text
    )


def test_click_multiple_pills_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test multiselect pills and take a screenshot."""

    pills = get_button_group(themed_app, 0)
    get_pill_button(pills, "📝 Text").click()
    wait_for_app_run(themed_app)
    get_pill_button(pills, "🪢 Graphs").click()
    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    text = get_markdown(themed_app, "Multi selection: \\['📝 Text', '🪢 Graphs'\\]")
    expect(text).to_be_visible()
    assert_snapshot(pills, name="st_pills-multiselect")


def test_click_single_icon_pill_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test icon only pills (via format_func) and take a screenshot."""

    pills = get_button_group(themed_app, 1)
    # the icon's span element has the respective text
    # (e.g. :material/zoom_in: -> zoom_in)
    get_pill_button(pills, "zoom_in").click()
    # take away hover focus of button
    themed_app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})
    text = get_markdown(themed_app, "Single selection: 1")
    expect(text).to_be_visible()
    assert_snapshot(pills, name="st_pills-singleselect_icon_only")


def test_pass_default_selections(app: Page):
    """Test that passed defaults are rendered correctly."""
    text = get_markdown(app, "Multi selection: None")
    expect(text).to_be_visible()

    click_checkbox(app, "Set default values")
    wait_for_app_run(app)
    text = get_markdown(
        app, "Multi selection: \\['🧰 General widgets', '📊 Charts', '🧊 3D'\\]"
    )
    expect(text).to_be_visible()

    click_checkbox(app, "Set default values")
    wait_for_app_run(app)
    text = get_markdown(app, "Multi selection: None")
    expect(text).to_be_visible()
