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

from e2e_playwright.conftest import wait_for_app_run


def get_uuids(app: Page):
    expect(app.get_by_test_id("stMarkdown")).to_have_count(2)

    fragment_1_text = app.get_by_test_id("stMarkdown").first.text_content()
    fragment_2_text = app.get_by_test_id("stMarkdown").last.text_content()

    return fragment_1_text, fragment_2_text


def test_fragments_rerun_correctly_during_full_app_run(app: Page):
    """Test that fragments can send fragment-bound reruns during full app runs.

    Click on the full app rerun button and immediately click on the second
    fragment button. This will send a rerun message bound to the fragment while
    the full app run is still executing. The expectation is that the full app
    run is still continuing and the following fragments are also registered
    and executing correctly.
    """

    app.get_by_test_id("stButton").locator("button").filter(
        has_text="Full app rerun"
    ).click()

    # wait until first fragment is finished
    sleep_time_of_fragment = 3500
    app.wait_for_timeout(sleep_time_of_fragment)

    app.get_by_test_id("stButton").locator("button").nth(1).click()
    wait_for_app_run(app)

    expect(
        app.get_by_test_id("stMarkdown").filter(has_text="uuid in fragment 1").first
    ).to_be_attached()
    expect(
        app.get_by_test_id("stMarkdown").filter(has_text="uuid in fragment 2").first
    ).to_be_attached()
    expect(
        app.get_by_test_id("stMarkdown").filter(has_text="uuid in fragment 3").first
    ).to_be_attached()
