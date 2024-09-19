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


import pytest
from playwright.sync_api import Page

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_form_button,
    expect_prefixed_markdown,
)
from e2e_playwright.shared.pydeck_utils import get_click_handling_div, wait_for_chart

# A note on browser testing strategy. We are only testing on Chromium because:
#   - Firefox seems to be failing but can't reproduce locally and video from CI
#     produces an empty element for PyDeck
#   - Webkit is too slow on CI, leading to flaky tests
#
# Getting coverage in Chromium is sufficient for now since the underlying logic
# is the same and we are not testing for browser-specific behavior.
#
# Additionally, even the deck.gl docs caution against visual tests since it
# renders to a canvas element:
# https://github.com/visgl/deck.gl/blob/master/docs/developer-guide/testing.md


@pytest.mark.only_browser("chromium")
def test_pydeck_chart_selection_in_form(app: Page):
    """
    Test the selection functionality of a PyDeck chart within a form.
    """
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app)

    # Assert we haven't yet written anything out for the debugging state
    markdown_prefix = "PyDeck-in-form selection:"
    markdown_prefix_session_state = "PyDeck-in-form selection in session state:"

    # Click on the hex that has count: 10
    click_handling_div.click(position={"x": 326, "y": 208})

    wait_for_app_run(app)

    empty_selection = "{'selection': {'indices': {}, 'objects': {}}}"
    # Nothing should be shown yet because we did not submit the form
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        empty_selection,
    )
    expect_prefixed_markdown(
        app,
        markdown_prefix_session_state,
        empty_selection,
    )

    # submit the form. The selection uses a debounce of 200ms; if we click too
    # early, the state is not updated correctly and we submit the old,
    # unselected values
    app.wait_for_timeout(210)

    click_form_button(app, "Submit")

    expected_selection = "{'selection': {'indices': {'MyHexLayer': [0]}, 'objects': {'MyHexLayer': [{'count': 10, 'hex': '88283082b9fffff'}]}}}"

    expect_prefixed_markdown(app, markdown_prefix, expected_selection)
    expect_prefixed_markdown(app, markdown_prefix_session_state, expected_selection)
