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
from e2e_playwright.shared.app_utils import check_top_level_class


def test_data_editor_supports_various_configurations(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Screenshot test that st.data_editor supports various configuration options."""
    # The dataframe config test is already testing with themed apps, so using the
    # default theme only is fine here.
    elements = app.get_by_test_id("stDataFrame")
    expect(elements).to_have_count(22)

    # The dataframe component might require a bit more time for rendering the canvas
    app.wait_for_timeout(500)

    assert_snapshot(elements.nth(0), name="st_data_editor-disabled_all_columns")
    assert_snapshot(elements.nth(1), name="st_data_editor-disabled_two_columns")
    assert_snapshot(elements.nth(2), name="st_data_editor-hide_index")
    assert_snapshot(elements.nth(3), name="st_data_editor-show_index")
    assert_snapshot(elements.nth(4), name="st_data_editor-custom_column_order")
    assert_snapshot(elements.nth(5), name="st_data_editor-column_labels")
    assert_snapshot(elements.nth(6), name="st_data_editor-hide_columns")
    assert_snapshot(elements.nth(7), name="st_data_editor-set_column_width")
    assert_snapshot(elements.nth(8), name="st_data_editor-help_tooltips")
    assert_snapshot(elements.nth(9), name="st_data_editor-text_column")
    assert_snapshot(elements.nth(10), name="st_data_editor-number_column")
    assert_snapshot(elements.nth(11), name="st_data_editor-checkbox_column")
    assert_snapshot(elements.nth(12), name="st_data_editor-selectbox_column")
    assert_snapshot(elements.nth(13), name="st_data_editor-link_column")
    assert_snapshot(elements.nth(14), name="st_data_editor-datetime_column")
    assert_snapshot(elements.nth(15), name="st_data_editor-date_column")
    assert_snapshot(elements.nth(16), name="st_data_editor-time_column")
    assert_snapshot(elements.nth(17), name="st_data_editor-progress_column")
    assert_snapshot(elements.nth(18), name="st_data_editor-list_column")
    assert_snapshot(elements.nth(19), name="st_data_editor-bar_chart_column")
    assert_snapshot(elements.nth(20), name="st_data_editor-line_chart_column")
    assert_snapshot(elements.nth(21), name="st_data_editor-image_column")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stDataFrame")
