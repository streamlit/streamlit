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


def test_data_editor_index_types(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.data_editor renders various index types correctly."""
    dataframe_elements = themed_app.get_by_test_id("stDataFrame")
    expect(dataframe_elements).to_have_count(7)

    assert_snapshot(dataframe_elements.nth(0), name="st_data_editor-string_index")
    assert_snapshot(dataframe_elements.nth(1), name="st_data_editor-float64_index")
    assert_snapshot(dataframe_elements.nth(2), name="st_data_editor-int64_index")
    assert_snapshot(dataframe_elements.nth(3), name="st_data_editor-uint64_index")
    assert_snapshot(dataframe_elements.nth(4), name="st_data_editor-date_index")
    assert_snapshot(dataframe_elements.nth(5), name="st_data_editor-time_index")
    assert_snapshot(dataframe_elements.nth(6), name="st_data_editor-datetime_index")
