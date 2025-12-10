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

from e2e_playwright.conftest import ImageCompareFunction


def test_code_block_copy_button_overlap(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """
    Test that the copy button does not obscure the end of a long line of code
    when scrolled to the right.
    """
    # Wait for the app to be fully loaded and the code block to appear
    code_block = app.get_by_test_id("stCode").first
    expect(code_block).to_be_visible()

    # Get the internal <pre> element which handles the scrolling
    pre_element = code_block.locator("pre")

    # Scroll to the very end of the code block horizontally
    pre_element.evaluate("element => element.scrollLeft = element.scrollWidth")

    # Hover over the code block to make the copy button appear
    code_block.hover()

    assert_snapshot(code_block, name="st_code-scrolled_end_overlap_check")
