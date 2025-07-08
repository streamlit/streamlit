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


def test_regression_with_file_uploader_and_chat_input(app: Page):
    """Test issue described in https://github.com/streamlit/streamlit/issues/7556."""
    chat_input_element = app.get_by_test_id("stChatInputTextArea").first
    chat_input_element.type("Hello world!")
    chat_input_element.press("Enter")
    wait_for_app_run(app)
    last_chat_message = app.get_by_test_id("stChatMessageContent").last
    expect(last_chat_message).to_have_text("Good at 1", use_inner_text=True)
