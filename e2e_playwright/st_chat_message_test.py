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

from e2e_playwright.conftest import ImageCompareFunction, rerun_app
from e2e_playwright.shared.app_utils import check_top_level_class


def test_renders_chat_messages_correctly_1(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test if the chat messages render correctly"""
    # Wait a bit more to allow all images to load:
    chat_message_elements = themed_app.get_by_test_id("stChatMessage")
    expect(chat_message_elements).to_have_count(16)

    # rerun to populate session state chat message
    rerun_app(themed_app)

    expect(chat_message_elements).to_have_count(18)
    for i, element in enumerate(chat_message_elements.all()):
        element.scroll_into_view_if_needed()
        expect(element).to_be_in_viewport()
        # Wait a bit more to allow the avatar images to load:
        themed_app.wait_for_timeout(100)
        assert_snapshot(element, name=f"st_chat_message-{i}")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stChatMessage")
