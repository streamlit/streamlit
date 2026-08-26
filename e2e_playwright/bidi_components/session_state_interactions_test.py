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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    expect_exception,
    expect_no_exception,
    get_element_by_key,
)


def test_session_state_interactions_flow(app: Page) -> None:
    # Locate the component by its key and its internal elements
    component = get_element_by_key(app, "my_text_input")
    label = component.locator("label")
    input_el = component.locator("input#txt")

    # 1) Initial render
    expect(label).to_have_text("Enter something")
    expect(input_el).to_have_value("Initial Text")
    expect_no_exception(app)

    # 2) User submit (type + Enter)
    input_el.fill("Foo")
    input_el.press("Enter")
    wait_for_app_run(app)
    expect(input_el).to_have_value("Foo")
    expect_no_exception(app)

    # 3) Python updates flow back to the component
    click_button(app, "Make it say Hello World")
    expect(input_el).to_have_value("Hello World")

    # 4) Clear via Python
    click_button(app, "Clear text")
    expect(input_el).to_have_value("")

    # 5) Post-mount mutation error when modifying session_state
    click_button(app, "Should throw an error")
    expect_exception(app, "cannot be modified")

    # 6) Recovery after error (valid user submit works again)
    input_el.fill("Bar")
    input_el.press("Enter")
    wait_for_app_run(app)
    expect(input_el).to_have_value("Bar")
    expect_no_exception(app)
