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

from e2e_playwright.conftest import ImageCompareFunction


def test_dataframe_pd_styler(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.dataframe supports styling and display values via Pandas Styler."""
    elements = themed_app.get_by_test_id("stDataFrame")
    expect(elements).to_have_count(6)

    # The dataframe component might require a bit more time for rendering the canvas
    themed_app.wait_for_timeout(250)

    assert_snapshot(elements.nth(0), name="st_dataframe-styler_value_formatting")
    assert_snapshot(elements.nth(1), name="st_dataframe-styler_background_color")
    assert_snapshot(elements.nth(2), name="st_dataframe-styler_background_and_font")
    assert_snapshot(elements.nth(3), name="st_dataframe-styler_gradient")
    assert_snapshot(elements.nth(4), name="st_dataframe-styler_link_display_value")
    assert_snapshot(elements.nth(5), name="st_dataframe-column_config_over_styler")
