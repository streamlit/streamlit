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


# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
# PLEASE DO NOT ADD MORE TESTS TO THIS FILE
# This test relies on the fact the server is not aware of MPAv2 until the first
# run of the app. Adding more tests to this file will break this assumption.
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
def test_widget_does_not_trigger_callbacks(app: Page):
    """Tests the widget state does not trigger callbacks"""
    expect(app.get_by_text("test_value: False")).to_be_attached()

    app.get_by_text("Checkbox 2").click()
    wait_for_app_run(app)
    expect(app.get_by_text("test_value: False")).to_be_attached()

    app.get_by_text("Checkbox 1").click()
    wait_for_app_run(app)
    expect(app.get_by_text("test_value: True")).to_be_attached()
