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
import re

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


@pytest.mark.skip_browser("chromium")
def test_video_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.date_input renders correctly via screenshots matching."""
    app.wait_for_timeout(2000)
    video_elements = app.get_by_test_id("stVideo")
    expect(video_elements).to_have_count(3)

    assert_snapshot(video_elements.nth(0), name="video_element_first")
    assert_snapshot(video_elements.nth(1), name="video_element_second")
    assert_snapshot(video_elements.nth(2), name="video_element_third")


def test_video_has_correct_properties(app: Page):
    app.wait_for_timeout(2000)
    video_element = app.get_by_test_id("stVideo").nth(2)
    expect(video_element).to_be_visible()
    expect(video_element).to_have_attribute("src", re.compile(r".*media.*.mp4"))


# describe("st.video", () => {
#   before(() => {
#     // Increasing timeout since we're requesting an external video file
#     Cypress.config("defaultCommandTimeout", 10000);
#     cy.loadApp("http://localhost:3000/");
#   });
#
#   it("displays a video player", () => {
#     cy.getIndexed(".element-container .stVideo", 0).should("have.attr", "src");
#   });
#
# it("handles a start time", () => {
#   cy.getIndexed(".element-container .stVideo", 1).should("have.attr", "src");
# });

#   it("handles changes in start time", () => {
#     // Change the start time from 6 to 5
#     cy.get(".element-container .stNumberInput .step-down").click();
#
#     // Wait for the video start time to update
#     cy.wait(3000);
#
#     // Confirm video updated
#     cy.getIndexed(".element-container .stVideo", 1).matchImageSnapshot("video-updated-start");
#   });
# });
