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

from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.dataframe_utils import (
    calc_middle_cell_position,
    expect_canvas_to_be_stable,
    expect_canvas_to_be_visible,
    unfocus_dataframe,
)


def test_dataframe_comprehensive_interaction_sweep(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """
    Test highlights across both tables (last and Penultimate rows,
    first and Middle columns) both hovering and clicking.
    """
    rows = [3, 2]
    cols = [0, 3]

    # Both tables: st.data_editor (nth 0) and st.dataframe (nth 1)
    for table_idx in range(2):
        dataframe_element = app.get_by_test_id("stDataFrame").nth(table_idx)
        expect_canvas_to_be_visible(dataframe_element)

        # Ensure it's scrolled into view to avoid interception
        dataframe_element.scroll_into_view_if_needed()

        for row_idx in rows:
            for col_idx in cols:
                # Hover State
                unfocus_dataframe(app)
                x, y = calc_middle_cell_position(row_idx, col_idx)
                dataframe_element.hover(position={"x": x, "y": y})
                expect_canvas_to_be_stable(dataframe_element)

                assert_snapshot(
                    dataframe_element,
                    name=f"st_dataframe-table{table_idx}-r{row_idx}_c{col_idx}-hover",
                )

                # Click (Selection) State
                # Using force=True to bypass pointer-interception issues
                dataframe_element.click(position={"x": x, "y": y}, force=True)
                app.wait_for_timeout(200)
                expect_canvas_to_be_stable(dataframe_element)

                assert_snapshot(
                    dataframe_element,
                    name=f"st_dataframe-table{table_idx}-r{row_idx}_c{col_idx}-selected",
                )

    unfocus_dataframe(app)
