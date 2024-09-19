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
from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import (
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
def test_pydeck_chart_selection_callback(app: Page):
    """
    Test the callback functionality of a PyDeck chart.
    """
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app)

    markdown_prefix = "PyDeck selection callback:"

    # Assert we haven't yet written anything out for the debugging state
    expect(app.get_by_text(markdown_prefix)).to_have_count(0)

    # Click on the hex that has count: 10
    click_handling_div.click(position={"x": 344, "y": 201})

    # Assert that the debug values are written out since we clicked on the map
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        "{'selection': {'indices': {'MyHexLayer': [0]}, 'objects': {'MyHexLayer': [{'count': 10, 'hex': '88283082b9fffff'}]}}}",
    )
