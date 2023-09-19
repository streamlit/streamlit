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


def test_data_editor_column_types(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.data_editor render various column types correctly."""
    data_editor_elements = themed_app.get_by_test_id("stDataFrame")
    expect(data_editor_elements).to_have_count(8)

    assert_snapshot(data_editor_elements.nth(0), name=f"st_data_editor-base_types")
    assert_snapshot(data_editor_elements.nth(1), name=f"st_data_editor-numerical_types")
    assert_snapshot(data_editor_elements.nth(2), name=f"st_data_editor-datetime_types")
    assert_snapshot(data_editor_elements.nth(3), name=f"st_data_editor-list_types")
    assert_snapshot(data_editor_elements.nth(4), name=f"st_data_editor-interval_types")
    assert_snapshot(data_editor_elements.nth(5), name=f"st_data_editor-special_types")
    assert_snapshot(data_editor_elements.nth(6), name=f"st_data_editor-period_types")
    assert_snapshot(
        data_editor_elements.nth(7), name=f"st_data_editor-unsupported_types"
    )
