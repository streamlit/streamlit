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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run


def test_reuses_a_widget_label_for_different_widget_types(app: Page):
    app.get_by_test_id("stButton").locator("button").first.click()

    # Check if the slider exists
    slider = app.get_by_test_id("stSlider")
    expect(slider).to_be_visible()

    # Check if the selectbox does not exist
    selectbox = app.get_by_test_id("stSelectbox")
    expect(selectbox).not_to_be_visible()

    # Check the text of the first markdown element
    markdown = app.get_by_test_id("stMarkdown").first
    expect(markdown).to_have_text("value 1: 25")

    # Trigger click in the center of the slider
    slider_handle = app.get_by_test_id("stSlider")
    slider_handle.hover()
    # click in middle
    app.mouse.down()

    wait_for_app_run(app)

    # Check if the selectbox exists after clicking
    selectbox = app.get_by_test_id("stSelectbox")
    expect(selectbox).to_be_visible()

    # Check if the slider no longer exists
    slider = app.get_by_test_id("stSlider")
    expect(slider).not_to_be_visible()

    # Check the text of the first markdown element after the click
    markdown = app.get_by_test_id("stMarkdown").first
    expect(markdown).to_have_text("value 1: f")
