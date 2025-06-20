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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run, wait_until
from e2e_playwright.shared.app_utils import expect_markdown
from e2e_playwright.shared.data_mocks import SHARED_TEST_CASES
from e2e_playwright.shared.dataframe_utils import (
    calc_middle_cell_position,
    expect_canvas_to_be_stable,
)


def test_dataframe_input_format_rendering(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that st.dataframe renders various data formats correctly via snapshot
    testing.
    """

    for index, test_case in enumerate(SHARED_TEST_CASES):
        number_input = app.get_by_test_id("stNumberInput").locator("input")
        number_input.fill(str(index))
        number_input.press("Enter")
        # Use more delay here to tackle some flakiness in webkit.
        # The flakiness seems to come from the app still showing the old
        # dataframe when the visibility check is done.
        wait_for_app_run(app, wait_delay=200)

        # Expect the data format being shown in the app
        expect_markdown(app, str(test_case[1].expected_data_format))

        dataframe_element = app.get_by_test_id("stDataFrame")
        expect(dataframe_element).to_be_visible()
        app.wait_for_selector("[data-testid='stDataFrame']", state="attached")
        assert_snapshot(dataframe_element, name=f"st_dataframe-input_data_{index}")


def test_empty_dataframe_hover_no_error(app: Page):
    """Test that hovering over an empty dataframe doesn't show 'This error should never happen' text."""
    # Test each empty dataframe variant (indices 0-8 in SHARED_TEST_CASES)
    for index in range(9):
        # Set the test case to an empty dataframe variant
        number_input = app.get_by_test_id("stNumberInput").locator("input")
        number_input.fill(str(index))
        number_input.press("Enter")
        wait_for_app_run(app, wait_delay=200)

        # Ensure the dataframe is visible and stable
        dataframe_element = app.get_by_test_id("stDataFrame")
        expect(dataframe_element).to_be_visible()
        expect_canvas_to_be_stable(dataframe_element)

        # Calculate position for first row using the utility function
        # First row is at row_pos=1 (row 0 is the header)
        # First column is at col_pos=0
        first_cell_x, first_row_y = calc_middle_cell_position(1, 0)

        # Hover over the first row
        dataframe_element.hover(position={"x": first_cell_x, "y": first_row_y})
        # Wait a moment for any potential tooltip to appear
        app.wait_for_timeout(1000)

        # verify no error tooltips appear
        wait_until(
            app,
            lambda: not app.get_by_text("This error should never happen").is_visible(),
        )
