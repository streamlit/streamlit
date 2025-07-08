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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def test_st_empty(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.empty doesn't take any space on screen."""
    expect(app.get_by_test_id("stEmpty")).to_have_count(1)

    assert_snapshot(
        app.get_by_test_id("stVerticalBlock"), name="st_empty-no_vertical_space_taken"
    )


def test_st_empty_as_a_container(app: Page, assert_snapshot: ImageCompareFunction):
    expect(app.get_by_text("Hello")).to_be_visible()

    app.get_by_test_id("stButton").nth(0).get_by_role("button").click()
    wait_for_app_run(app)

    expect(app.get_by_text("Hello")).to_have_count(0)
    expect(app.get_by_test_id("stVegaLiteChart")).to_have_count(1)

    app.get_by_test_id("stButton").nth(1).get_by_role("button").click()
    wait_for_app_run(app)

    expect(app.get_by_test_id("stVegaLiteChart")).to_have_count(0)
    expect(app.get_by_text("This is one element")).to_have_count(1)
    expect(app.get_by_text("This is another")).to_have_count(1)

    app.get_by_test_id("stButton").nth(2).get_by_role("button").click()
    wait_for_app_run(app)

    expect(app.get_by_text("This is one element")).to_have_count(0)
    expect(app.get_by_text("This is another")).to_have_count(0)

    assert_snapshot(
        app.get_by_test_id("stVerticalBlock"), name="st_empty-order_after_replacement"
    )
