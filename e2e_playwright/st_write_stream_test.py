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

from e2e_playwright.conftest import ImageCompareFunction, rerun_app, wait_for_app_run


def test_stream_generator(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that `st.write_stream` can correctly streams content.
    This also tests that the return value can be rendered via `st.write`.
    """

    button_element = app.get_by_test_id("stButton").locator("button").first
    button_element.click()

    wait_for_app_run(app)

    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(2)
    # Wait for the second element to appear
    expect(markdown_elements.nth(1)).to_contain_text("This is the end of the stream.")

    # Check that the dataframe is visible:
    expect(app.get_by_test_id("stDataFrame")).to_be_visible()

    main_container = app.get_by_test_id("stVerticalBlock").nth(0)
    assert_snapshot(main_container.nth(0), name="st_write_stream-generator_output")

    expect(app.get_by_test_id("stVerticalBlock")).to_have_count(1)

    # Test that the rerun will output the same elements via st.write:
    rerun_app(app)

    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(2)
    # Wait for the second element to appear
    expect(markdown_elements.nth(1)).to_contain_text("This is the end of the stream.")

    # Check that the dataframe is visible:
    expect(app.get_by_test_id("stDataFrame")).to_be_visible()

    expect(app.get_by_test_id("stVerticalBlock")).to_have_count(1)

    main_container = app.get_by_test_id("stVerticalBlock").nth(0)
    # Test with the same snapshot name to make sure the output is the same:
    assert_snapshot(main_container.nth(0), name="st_write_stream-generator_output")
