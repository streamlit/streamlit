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


from typing import Literal

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import (
    click_button,
    click_form_button,
    expect_prefixed_markdown,
)
from e2e_playwright.shared.pydeck_utils import (
    get_click_handling_div,
    wait_for_chart,
)

# The pydeck tests are a lot flakier than need be so increase the pixel threshold
PIXEL_THRESHOLD = 1.0

EMPTY_SELECTION = "{'selection': {'indices': {}, 'objects': {}}}"


def _set_selection_mode(app: Page, mode: Literal["single-object", "multi-object"]):
    app.get_by_test_id("stSelectbox").nth(0).locator("input").click()
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").nth(1 if mode == "multi-object" else 0).click()

    wait_for_app_run(app, wait_delay=5000)


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
def test_pydeck_chart_multiselect_interactions_and_return_values(app: Page):
    """
    Test single selection, multi selection, and deselection all function
    properly and return the expected values in both session_state and as a
    return of st.pydeck.
    """
    _set_selection_mode(app, "multi-object")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)
    markdown_prefix_session_state = "session_state.managed_map:"
    markdown_prefix = "managed_map selection:"

    # Assert we haven't yet written anything out for the debugging state
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        EMPTY_SELECTION,
    )
    expect_prefixed_markdown(
        app,
        markdown_prefix_session_state,
        EMPTY_SELECTION,
    )

    # Click on the hex that has count: 10
    click_handling_div.click(position={"x": 344, "y": 201})

    first_point_selection = "{'selection': {'indices': {'MyHexLayer': [0]}, 'objects': {'MyHexLayer': [{'count': 10, 'hex': '88283082b9fffff'}]}}}"
    # Assert the values returned are correct for the point we selected
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        first_point_selection,
    )
    expect_prefixed_markdown(
        app,
        markdown_prefix_session_state,
        first_point_selection,
    )

    # Multiselect and click the hex that has count: 100
    click_handling_div.click(position={"x": 417, "y": 229})

    second_point_selection = "{'selection': {'indices': {'MyHexLayer': [0, 2]}, 'objects': {'MyHexLayer': [{'count': 10, 'hex': '88283082b9fffff'}, {'count': 100, 'hex': '88283082a9fffff'}]}}}"
    # Now we assert that the values include the new point we selected as well as
    # the previous one
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        second_point_selection,
    )
    expect_prefixed_markdown(
        app,
        markdown_prefix_session_state,
        second_point_selection,
    )

    # Deselect everything by clicking away from an object in a layer
    click_handling_div.click(position={"x": 0, "y": 0})

    # Assert that we have deselected everything
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        EMPTY_SELECTION,
    )
    expect_prefixed_markdown(
        app,
        markdown_prefix_session_state,
        EMPTY_SELECTION,
    )


@pytest.mark.only_browser("chromium")
def test_pydeck_chart_single_select_interactions_and_return_values(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """
    Test single selection and deselection all function properly and return the
    expected values in both session_state and as a return of st.pydeck.
    """
    _set_selection_mode(app, "single-object")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)
    markdown_prefix_session_state = "session_state.managed_map:"
    markdown_prefix = "managed_map selection:"

    # Click on the hex that has count: 10
    click_handling_div.click(position={"x": 344, "y": 201})
    point_selection = "{'selection': {'indices': {'MyHexLayer': [0]}, 'objects': {'MyHexLayer': [{'count': 10, 'hex': '88283082b9fffff'}]}}}"
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        point_selection,
    )
    expect_prefixed_markdown(
        app,
        markdown_prefix_session_state,
        point_selection,
    )

    # Click the hex that has count: 100
    click_handling_div.click(position={"x": 417, "y": 229})

    point_selection = "{'selection': {'indices': {'MyHexLayer': [2]}, 'objects': {'MyHexLayer': [{'count': 100, 'hex': '88283082a9fffff'}]}}}"
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        point_selection,
    )
    expect_prefixed_markdown(
        app,
        markdown_prefix_session_state,
        point_selection,
    )

    # Click on the hex that has count: 10
    click_handling_div.click(position={"x": 344, "y": 201})
    point_selection = "{'selection': {'indices': {'MyHexLayer': [0]}, 'objects': {'MyHexLayer': [{'count': 10, 'hex': '88283082b9fffff'}]}}}"
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        point_selection,
    )
    expect_prefixed_markdown(
        app,
        markdown_prefix_session_state,
        point_selection,
    )

    # Deselect everything by clicking away from an object in a layer
    click_handling_div.click(position={"x": 0, "y": 0})

    # Assert that we have deselected everything
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        EMPTY_SELECTION,
    )
    expect_prefixed_markdown(
        app,
        markdown_prefix_session_state,
        EMPTY_SELECTION,
    )

    # Scatterplot checks
    click_handling_div = get_click_handling_div(app, nth=4)
    click_handling_div.scroll_into_view_if_needed()

    # Click on the scatterplot point with the biggest size
    click_handling_div.click(position={"x": 279, "y": 331})

    wait_for_app_run(app, wait_delay=5000)

    # Assert that we have deselected everything
    assert_snapshot(
        click_handling_div,
        name="st_pydeck_chart_select-scatterplot-single-selection",
        pixel_threshold=PIXEL_THRESHOLD,
    )


@pytest.mark.only_browser("chromium")
def test_pydeck_chart_multiselect_has_consistent_visuals(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """
    Test that no selection, single selection, multi selection, and deselection
    all look visually correct.
    """
    _set_selection_mode(app, "multi-object")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)

    assert_snapshot(
        click_handling_div,
        name="st_pydeck_chart_select-no-selections",
        pixel_threshold=PIXEL_THRESHOLD,
    )

    # Click on the hex that has count: 10
    click_handling_div.click(position={"x": 344, "y": 201})

    wait_for_app_run(app, wait_delay=5000)

    assert_snapshot(
        click_handling_div,
        name="st_pydeck_chart_select-single-selection",
        pixel_threshold=PIXEL_THRESHOLD,
    )

    # Multiselect and click the hex that has count: 100
    click_handling_div.click(position={"x": 417, "y": 229})

    wait_for_app_run(app, wait_delay=5000)

    assert_snapshot(
        click_handling_div,
        name="st_pydeck_chart_select-multi-selection",
        pixel_threshold=PIXEL_THRESHOLD,
    )

    # Deselect everything by clicking away from an object in a layer
    click_handling_div.click(position={"x": 0, "y": 0})

    wait_for_app_run(app, wait_delay=5000)

    # Assert that we have deselected everything
    assert_snapshot(
        click_handling_div,
        name="st_pydeck_chart_select-deselected",
        pixel_threshold=PIXEL_THRESHOLD,
    )


@pytest.mark.only_browser("chromium")
def test_pydeck_chart_selection_state_remains_after_unmounting(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """
    Test that no selection, single selection, multi selection, and deselection
    all look visually correct.
    """
    _set_selection_mode(app, "multi-object")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)

    # Click on the hex that has count: 10
    click_handling_div.click(position={"x": 344, "y": 201})

    wait_for_app_run(app, wait_delay=5000)

    # Multiselect and click the hex that has count: 100
    click_handling_div.click(position={"x": 417, "y": 229})

    wait_for_app_run(app, wait_delay=5000)

    click_button(app, "Create some elements to unmount component")
    wait_for_app_run(app, wait_delay=5000)

    wait_for_chart(app)

    assert_snapshot(
        click_handling_div,
        name="st_pydeck_chart_selection_state_remains_after_unmounting",
    )


@pytest.mark.only_browser("chromium")
def test_pydeck_chart_selection_callback(app: Page):
    """
    Test the callback functionality of a PyDeck chart.
    """
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=1)

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


@pytest.mark.only_browser("chromium")
def test_pydeck_chart_selection_in_form(app: Page):
    """
    Test the selection functionality of a PyDeck chart within a form.
    """
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=2)

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
    expect(app.get_by_test_id("stForm")).not_to_contain_text("Error")


@pytest.mark.only_browser("chromium")
def test_pydeck_chart_selection_in_fragment(app: Page):
    """
    Test the selection functionality of a PyDeck chart within a fragment.
    """
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=3)

    # Check that the main script has run once (the initial run)
    expect(app.get_by_text("Runs: 1")).to_be_visible()

    # Assert we haven't yet written anything out for the debugging state
    markdown_prefix = "PyDeck-in-fragment selection:"

    # Nothing should be shown yet because we did do anything yet
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        "{'selection': {'indices': {}, 'objects': {}}}",
    )

    # Click on the hex that has count: 10
    click_handling_div.click(position={"x": 344, "y": 201})

    # Assert that the debug values are written out since we clicked on the map
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        "{'selection': {'indices': {'MyHexLayer': [0]}, 'objects': {'MyHexLayer': [{'count': 10, 'hex': '88283082b9fffff'}]}}}",
    )

    # Check that the main script has not re-run
    expect(app.get_by_text("Runs: 1")).to_be_visible()
