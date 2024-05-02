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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded


def _get_container_of_text(app: Page, text: str) -> Locator:
    """Get the parent container in which the passed text is located.
    The tests are written in a way that the text and the headers are put
    into the same container.
    """

    # select container we wrapped the text and headers with
    container_selector = "@data-testid='stVerticalBlock'"
    # and select only the container that has a direct div child with the given exact text match
    inner_div_text_selector = f"div[.//text()='{text}']"
    outermost_selector = f"(//div[{container_selector}]/{inner_div_text_selector})[1]"
    return app.locator(
        f"xpath={outermost_selector}",
    )


def test_match_snapshot_for_top_part_of_main_and_sidebar_blocks(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """This test just checks whether the top alignment of main/sidebar elements is correct."""
    end_of_page = app.get_by_text("End of page")
    end_of_page.scroll_into_view_if_needed()
    expect(end_of_page).to_be_visible()
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_visible()
    assert_snapshot(sidebar, name="typography-main_sidebar_top")


def test_match_snapshot_for_single_st_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the single st.markdown snapshot is correct."""
    wait_for_app_loaded(app)
    container = _get_container_of_text(app, "Headers in single st.markdown")
    assert_snapshot(container, name="typography-single_markdown")


def test_match_snapshot_for_multiple_st_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the multiple st.markdown snapshot is correct."""
    container = _get_container_of_text(app, "Headers in multiple st.markdown")
    assert_snapshot(container, name="typography-multi_markdown")


def test_match_snapshot_for_columns(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the st.markdown columns snapshot is correct."""
    container = _get_container_of_text(app, "Headers in columns")
    assert_snapshot(container, name="typography-columns_markdown")


def test_match_snapshot_for_columns_with_elements_above(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the st.markdown columns with elements above snapshot is correct."""
    container = _get_container_of_text(
        app, "Headers in columns with other elements above"
    )
    assert_snapshot(container, name="typography-columns_padded_markdown")


def test_match_snapshot_for_column_beside_widget(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the st.markdown columns beside widget snapshot is correct."""
    container = _get_container_of_text(app, "Headers in column beside widget")
    assert_snapshot(container, name="typography-column_widget_markdown")
