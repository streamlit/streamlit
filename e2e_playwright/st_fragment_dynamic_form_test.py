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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run


def expect_correct_app_state(
    app: Page, num_selectboxes: int, num_text_inputs: int, num_jsons: int
):
    expect(app.get_by_test_id("stSelectbox")).to_have_count(num_selectboxes)
    expect(app.get_by_test_id("stTextInput")).to_have_count(num_text_inputs)
    expect(app.get_by_test_id("stJson")).to_have_count(num_jsons)


def test_dynamic_form(app: Page):
    expect_correct_app_state(
        app,
        num_selectboxes=1,
        num_text_inputs=0,
        num_jsons=0,
    )

    # Select a country
    app.get_by_test_id("stSelectbox").locator("input").first.click()
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").nth(1).click()
    wait_for_app_run(app)

    expect_correct_app_state(
        app,
        num_selectboxes=2,
        num_text_inputs=0,
        num_jsons=0,
    )

    # Select a state
    app.get_by_test_id("stSelectbox").locator("input").last.click()
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").nth(1).click()
    wait_for_app_run(app)

    expect_correct_app_state(
        app,
        num_selectboxes=2,
        num_text_inputs=1,
        num_jsons=0,
    )

    # Enter a city name and click submit.
    text_input_field = app.get_by_test_id("stTextInput").locator("input")
    text_input_field.fill("Berkeley")
    text_input_field.press("Enter")

    # Submit and validate output
    app.get_by_test_id("stButton").locator("button").click()
    expect_correct_app_state(
        app,
        num_selectboxes=2,
        num_text_inputs=1,
        num_jsons=1,
    )
