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


def test_displays_markdown(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that markdown is displayed correctly."""

    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(14)

    expect(markdown_elements.nth(0)).to_contain_text("Hello World")
    expect(markdown_elements.nth(1)).to_contain_text("This markdown is awesome! 😎")
    expect(markdown_elements.nth(2)).to_contain_text("This <b>HTML tag</b> is escaped!")
    expect(markdown_elements.nth(3)).to_contain_text("This HTML tag is not escaped!")
    expect(markdown_elements.nth(4)).to_contain_text("100")
    expect(markdown_elements.nth(5)).to_contain_text("None")
    expect(markdown_elements.nth(6)).to_contain_text("2021-01-01 00:00:00")
    expect(markdown_elements.nth(7)).to_contain_text("1.0")

    expect(markdown_elements.nth(8)).to_contain_text("1 * 2 - 3 = 4 `ok` !")
    expect(markdown_elements.nth(9)).to_contain_text(
        "1 * 2\n - 3\n ``` = \n````\n4 `ok` !"
    )
    assert_snapshot(markdown_elements.nth(4), name="write_int")
    assert_snapshot(markdown_elements.nth(5), name="write_none")
    assert_snapshot(markdown_elements.nth(6), name="write_datetime")
    assert_snapshot(markdown_elements.nth(7), name="write_np_float")
    assert_snapshot(markdown_elements.nth(8), name="write_single_line_monospace_block")
    assert_snapshot(markdown_elements.nth(9), name="write_multi_line_monospace_block")
    assert_snapshot(markdown_elements.nth(13), name="write_inline_code")

    expect(markdown_elements.nth(10)).to_contain_text("This is a string IO object!")
    expect(markdown_elements.nth(11)).to_contain_text("This is streamed text")
    expect(markdown_elements.nth(12)).to_contain_text("This is streamed text")
