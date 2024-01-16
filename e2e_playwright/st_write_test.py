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


def test_displays_markdown(app: Page):
    """Test that markdown is displayed correctly."""

    # Ensure that there are 4 element containers on the page before doing assertions
    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(3)

    # Assert that the output is rendered correctly
    expect(markdown_elements.nth(0)).to_contain_text("This markdown is awesome! 😎")
    expect(markdown_elements.nth(1)).to_contain_text("This <b>HTML tag</b> is escaped!")
    expect(markdown_elements.nth(2)).to_contain_text("This HTML tag is not escaped!")


def test_display_dataframe(app: Page):
    """Test that st.write displays pyspark.sql.DataFrame as st.dataframe."""

    # Assert that there is exactly one st.dataframe component on the page
    dataframe_element = app.locator(".stDataFrame")
    expect(dataframe_element).to_have_count(1)
