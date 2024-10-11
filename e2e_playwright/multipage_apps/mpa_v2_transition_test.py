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


def test_v1_to_v2_transition(app: Page):
    """Tests that Streamlit migrates from v1 to v2 progressively"""
    headings = app.get_by_test_id("stHeading")
    # expect the main page element to show in the beginning
    expect(headings.nth(0)).to_contain_text("Main Page")
    # expect the page 3 element to show
    # this also shows a different default page is written
    expect(headings.nth(1)).to_contain_text("Page 3")

    # expect the main page to continue running once the page completes
    markdowns = app.get_by_test_id("stMarkdown")
    expect(markdowns.nth(1)).to_contain_text("End of Main Page")
