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


def test_anchor_scrolling(app: Page):
    """Test that anchor scrolling works correctly in multipage apps in a new
    tab.
    """
    # The app opens in a new tab, so we need to wait for that new page
    # to be created.
    with app.context.expect_page() as new_page_info:
        app.get_by_text("Open new tab").click()

    new_page = new_page_info.value
    new_page.wait_for_load_state()

    # Assert that the app in the new tab scrolls to the header `My title 2`
    expect(new_page.get_by_text("My title 2")).to_be_in_viewport()
