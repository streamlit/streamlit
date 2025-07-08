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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded
from e2e_playwright.shared.app_utils import (
    click_button,
    click_toggle,
    expect_no_exception,
    get_element_by_key,
)


def test_dataframe_renders_without_crashing(app: Page):
    """Test that st.dataframe renders without crashing."""

    # Reload the page a couple of times to make sure that the dataframe
    # crash doesn't appear.
    # This test is safeguarding against potential regressions that
    # cause crashes as report in: https://github.com/streamlit/streamlit/issues/7949
    # But these crashes are usually more random, that's why we run
    # it for a couple of page reloads.
    # Also, even if there are crashes, its not gurunteed that they will
    # happen in our CI environment.
    for _ in range(5):
        dataframe_elements = app.get_by_test_id("stDataFrame")
        expect(dataframe_elements).to_have_count(8)
        expect(app.get_by_test_id("stAlertContainer")).not_to_be_attached()

        # Set use_container_width to False:
        click_toggle(app, "use_container_width")
        dataframe_elements = app.get_by_test_id("stDataFrame")
        expect(dataframe_elements).to_have_count(8)
        expect(app.get_by_test_id("stAlertContainer")).not_to_be_attached()

        # Reload the page:
        app.reload()
        wait_for_app_loaded(app)


def test_change_underlying_data_does_not_crash(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that changing the underlying data does not crash.

    Related issues: https://github.com/streamlit/streamlit/issues/10937
    """
    container = get_element_by_key(app, "change-data-test")
    expect(container).to_be_visible()

    df_element = container.get_by_test_id("stDataFrame").first
    expect(df_element).to_be_visible()

    # Change the underlying data:
    click_button(app, "Change underlying data")

    # Check that the dataframe is visible:
    expect(df_element).to_be_visible()
    # Double check that there are no exceptions:
    expect_no_exception(app)
    # Snapshot test to ensure that the dataframe shows the correct changed data:
    assert_snapshot(df_element, name="st_dataframe-changed_underlying_data")
