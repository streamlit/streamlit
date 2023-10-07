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


def test_data_editor_input_format_rendering(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.data_editor renders various data formats correctly via snapshot testing."""
    dataframe_elements = app.get_by_test_id("stDataFrame")
    expect(dataframe_elements).to_have_count(35)

    # The data editor might require a bit more time for rendering the canvas
    app.wait_for_timeout(250)

    for i, element in enumerate(dataframe_elements.all()):
        assert_snapshot(element, name=f"st_data_editor-input_data_{i}")
