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


def test_disabling_checkbox_disables_other(app: Page):
    checkbox_elements = app.locator("[type='checkbox']")
    expect(checkbox_elements).to_have_count(2)

    first_checkbox = checkbox_elements.nth(0)
    second_checkbox = checkbox_elements.nth(1)

    expect(first_checkbox).to_have_attribute("aria-checked", "true")
    expect(second_checkbox).to_have_attribute("aria-checked", "false")

    app.locator("[data-baseweb='checkbox']").nth(1).click()
    wait_for_app_run(app)

    expect(first_checkbox).to_have_attribute("aria-checked", "false")
    expect(second_checkbox).to_have_attribute("aria-checked", "true")
