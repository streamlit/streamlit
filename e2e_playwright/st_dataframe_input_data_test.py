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
from e2e_playwright.shared.app_utils import expect_markdown, wait_for_app_run
from e2e_playwright.shared.data_mocks import SHARED_TEST_CASES


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
