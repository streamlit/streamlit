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

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import click_button, expect_markdown


def _expect_initial_reruns_finished(app: Page):
    expect(app.get_by_test_id("stText")).to_have_text(
        "Being able to rerun a session is awesome!"
    )


def _expect_initial_reruns_count_text(app: Page):
    expect_markdown(app, "app run count: 4")


def test_st_rerun_restarts_the_session_when_invoked(app: Page):
    _expect_initial_reruns_finished(app)


def test_fragment_scoped_st_rerun(app: Page):
    expect(app.get_by_test_id("stText")).to_have_text(
        "Being able to rerun a session is awesome!"
    )

    # perform multiple clicks to make sure that the fragment rerun works as expected
    # and the main app content is still rendered
    for i in range(1, 10):
        click_button(app, "rerun fragment")
        expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text(
            f"fragment run count: {i * 5}"
        )
        _expect_initial_reruns_count_text(app)

    # the main apps rerun count should not have been incremented
    _expect_initial_reruns_count_text(app)


def test_rerun_works_in_try_except_block(app: Page):
    _expect_initial_reruns_finished(app)
    _expect_initial_reruns_count_text(app)

    click_button(app, "rerun try_fragment")
    # the rerun in the try-block worked as expected, so the session_state count
    # incremented
    expect_markdown(app, "app run count: 5")


def test_state_retained_on_app_scoped_rerun(app: Page):
    # Sanity check 1
    expect_markdown(app, "selectbox selection: None")

    # Click on the selectbox and select the first option.
    app.get_by_test_id("stSelectbox").first.locator("input").click()
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").first.click()
    wait_for_app_run(app)

    # Sanity check 2
    expect_markdown(app, "selectbox selection: a")

    # Rerun the fragment and verify that the selectbox kept its state
    click_button(app, "rerun whole app (from fragment)")
    expect_markdown(app, "selectbox selection: a")


# From GitHub issue #8599
def test_clears_stale_elements_correctly(app: Page):
    click_button(app, "#8599 - Bug")

    expect(app.get_by_text("#8599 - Bug")).to_have_count(1)
