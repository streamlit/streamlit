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


def test_dataframe_column_types_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.dataframe renders various column types correctly via screenshot matching."""
    elements = themed_app.get_by_test_id("stDataFrame")
    expect(elements).to_have_count(8)

    # The dataframe component might require a bit more time for rendering the canvas
    themed_app.wait_for_timeout(250)

    assert_snapshot(elements.nth(0), name="st_dataframe-base_types")
    assert_snapshot(elements.nth(1), name="st_dataframe-numerical_types")
    assert_snapshot(elements.nth(2), name="st_dataframe-datetime_types")
    assert_snapshot(elements.nth(3), name="st_dataframe-list_types")
    assert_snapshot(elements.nth(4), name="st_dataframe-interval_types")
    assert_snapshot(elements.nth(5), name="st_dataframe-special_types")
    assert_snapshot(elements.nth(6), name="st_dataframe-period_types")
    assert_snapshot(elements.nth(7), name="st_dataframe-unsupported_types")
