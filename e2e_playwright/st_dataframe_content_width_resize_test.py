# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.shared.app_utils import get_element_by_key


def _get_dataframe_container(app: Page, key: str) -> Locator:
    """Get the stDataFrame element within a keyed widget container."""
    key_container = get_element_by_key(app, key)
    return key_container.get_by_test_id("stDataFrame")


def test_content_width_dataframe_is_resizable_in_normal_layout(app: Page):
    """Test that content-width DataFrames are resizable in normal layouts.

    Regression test for https://github.com/streamlit/streamlit/issues/12683
    """
    dataframe = _get_dataframe_container(app, "normal_content_width")
    expect(dataframe).to_be_visible()
    # inline-block means resize is enabled
    expect(dataframe).to_have_css("display", "inline-block")


def test_content_width_dataframe_is_not_resizable_in_horizontal_layout(app: Page):
    """Test that content-width DataFrames are not resizable in horizontal layouts.

    This preserves the fix from PR #12682 for horizontal_alignment.
    """
    dataframe = _get_dataframe_container(app, "horizontal_content_width")
    expect(dataframe).to_be_visible()
    # flex means resize is disabled
    expect(dataframe).to_have_css("display", "flex")


def test_content_width_dataframe_is_resizable_in_centered_container(app: Page):
    """Test that content-width DataFrames are resizable in centered containers.

    Regression test for https://github.com/streamlit/streamlit/issues/12683
    """
    dataframe = _get_dataframe_container(app, "centered_content_width")
    expect(dataframe).to_be_visible()
    expect(dataframe).to_have_css("display", "inline-block")


def test_content_width_dataframe_is_resizable_in_sidebar(app: Page):
    """Test that content-width DataFrames are resizable in the sidebar."""
    dataframe = _get_dataframe_container(app, "sidebar_content_width")
    expect(dataframe).to_be_visible()
    expect(dataframe).to_have_css("display", "inline-block")


def test_content_width_dataframe_is_resizable_in_tabs(app: Page):
    """Test that content-width DataFrames are resizable inside tabs."""
    dataframe = _get_dataframe_container(app, "tab_content_width")
    expect(dataframe).to_be_visible()
    expect(dataframe).to_have_css("display", "inline-block")
