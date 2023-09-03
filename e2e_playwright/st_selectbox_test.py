# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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


def test_selectbox_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the selectbox widgets are correctly rendered via screenshot matching."""
    selectbox_widgets = themed_app.get_by_test_id("stSelectbox")
    expect(selectbox_widgets).to_have_count(11)

    assert_snapshot(selectbox_widgets.nth(0), name="st_selectbox-default")
    assert_snapshot(selectbox_widgets.nth(1), name="st_selectbox-formatted_options")
    assert_snapshot(selectbox_widgets.nth(2), name="st_radio-no_options")
    assert_snapshot(selectbox_widgets.nth(3), name="st_radio-more_options")
    assert_snapshot(selectbox_widgets.nth(4), name="st_radio-disabled")
    assert_snapshot(selectbox_widgets.nth(5), name="st_radio-hidden_label")
    assert_snapshot(selectbox_widgets.nth(6), name="st_radio-collapsed_label")
    assert_snapshot(selectbox_widgets.nth(7), name="st_radio-callback_help")
    assert_snapshot(selectbox_widgets.nth(8), name="st_radio-empty_selection")
    assert_snapshot(
        selectbox_widgets.nth(9), name="st_radio-empty_selection_placeholder"
    )
    assert_snapshot(selectbox_widgets.nth(10), name="st_radio-dataframe_options")


def test_selectbox_has_correct_initial_values(app: Page):
    """Test that st.selectbox returns the correct initial values."""
    markdown_elements = app.locator(".stMarkdown")
    expect(markdown_elements).to_have_count(14)

    expected = [
        "value 1: male",
        "value 2: female",
        "value 3: None",
        "value 4: e2e/scripts/components_iframe.py",
        "value 5: male",
        "value 6: male",
        "value 7: male",
        "value 8: female",
        "value 9: None",
        "value 10: None",
        "value 11: male",
    ]

    for markdown_element, expected_text in zip(markdown_elements.all(), expected):
        expect(markdown_element).to_have_text(expected_text, use_inner_text=True)


# TODO:
# test_handles_option_selection
# test_handles_option_selection_via_typing
# test_empty_selection_behaves_correctly
# test_handles_callback_correctly
# test_keeps_value_on_selection_close
# test_option_dropdown_rendering
# test_shows_correct_options_via_fuzzy_search
