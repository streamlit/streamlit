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


def test_display_dataframe(app: Page):
    """Test that st.write displays dataframe compatible objects via st.dataframe."""

    dataframe_element = app.get_by_test_id("stDataFrame")
    expect(dataframe_element).to_have_count(4)


def test_display_json(app: Page):
    """Test that st.write displays dicts and arrays as json data."""
    json_elements = app.get_by_test_id("stJson")
    expect(json_elements).to_have_count(6)


def test_display_help(app: Page):
    help_elements = app.get_by_test_id("stHelp")
    """Test that st.write displays objects via st.help."""
    expect(help_elements).to_have_count(3)


def test_displays_reprhtml(app: Page):
    """Test that repr_html is displayed correctly."""

    html_elements = app.get_by_test_id("stHtml")
    expect(html_elements).to_have_count(1)
    expect(html_elements.first).to_contain_text("This is an HTML tag!")


def test_display_exception(app: Page):
    """Test that st.write displays exceptions via st.exception."""
    exception_elements = app.get_by_test_id("stException")
    expect(exception_elements).to_have_count(1)
