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


from __future__ import annotations

from typing import Literal

import pytest
from playwright.sync_api import Locator, Page, Position, expect

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
    click_point,
    get_click_handling_div,
    wait_for_chart,
)

# The pydeck tests are a lot flakier than need be so increase the pixel threshold
PIXEL_THRESHOLD = 1.0

# Common selection values
EMPTY_SELECTION = "{'selection': {'indices': {}, 'objects': {}}}"
FIRST_POINT_SELECTION = (
    "{'selection': {'indices': {'MyHexLayer': [0]}, "
    "'objects': {'MyHexLayer': [{'count': 10, 'hex': '88283082b9fffff'}]}}}"
)
SECOND_POINT_SELECTION = (
    "{'selection': {'indices': {'MyHexLayer': [2]}, "
    "'objects': {'MyHexLayer': [{'count': 100, 'hex': '88283082a9fffff'}]}}}"
)
MULTI_SELECTION = (
    "{'selection': {'indices': {'MyHexLayer': [0, 2]}, "
    "'objects': {'MyHexLayer': [{'count': 10, 'hex': '88283082b9fffff'}, "
    "{'count': 100, 'hex': '88283082a9fffff'}]}}}"
)


FIRST_POINT_COORDS: Position = {"x": 344.0, "y": 201.0}
SECOND_POINT_COORDS: Position = {"x": 417.0, "y": 229.0}
DESELECT_COORDS: Position = {"x": 0.0, "y": 0.0}
SCATTERPLOT_POINT_COORDS: Position = {"x": 279.0, "y": 331.0}
# Coordinates for the form test (slightly different from FIRST_POINT_COORDS)
FORM_POINT_COORDS: Position = {"x": 326.0, "y": 208.0}

# Standard wait delay for app runs after interactions
STANDARD_WAIT_DELAY = 5000


def _select_chart_type(app: Page, chart_type: str):
    """Select the chart type to display."""
    button_text_map = {
        "basic": "Basic Chart",
        "callback": "With Callback",
        "form": "In Form",
        "fragment": "In Fragment",
        "scatterplot": "Scatterplot",
    }

    button_text = button_text_map.get(chart_type, "Basic Chart")
    click_button(app, button_text)


def _set_selection_mode(app: Page, mode: Literal["single-object", "multi-object"]):
    """Set the selection mode for the PyDeck chart."""
    app.get_by_test_id("stSelectbox").nth(0).locator("input").click()
    selection_dropdown = app.locator('[data-baseweb="popover"]').first
    selection_dropdown.locator("li").nth(1 if mode == "multi-object" else 0).click()

    # click elsewhere to close the dropdown
    app.get_by_test_id("stApp").click(position={"x": 0, "y": 0})

    wait_for_app_run(app, wait_delay=STANDARD_WAIT_DELAY)


def _click_point_and_verify_selection(
    app: Page,
    click_handling_div: Locator,
    coords: Position,
    expected_selection: str,
    markdown_prefix: str = "managed_map selection:",
    markdown_prefix_session_state: str | None = "session_state.managed_map:",
    wait_delay: int = STANDARD_WAIT_DELAY,
):
    """Helper function to click on a point and verify the selection."""
    click_point(click_handling_div, coords)

    wait_for_app_run(app, wait_delay=wait_delay)

    if markdown_prefix:
        expect_prefixed_markdown(
            app,
            markdown_prefix,
            expected_selection,
        )

    if markdown_prefix_session_state:
        expect_prefixed_markdown(
            app,
            markdown_prefix_session_state,
            expected_selection,
        )


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
@pytest.mark.flaky(reruns=4)
def test_pydeck_chart_multiselect_interactions_and_return_values(app: Page):
    """
    Test single selection, multi selection, and deselection all function
    properly and return the expected values in both session_state and as a
    return of st.pydeck.
    """
    _select_chart_type(app, "basic")
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
    _click_point_and_verify_selection(
        app, click_handling_div, FIRST_POINT_COORDS, FIRST_POINT_SELECTION
    )

    # Multiselect and click the hex that has count: 100
    _click_point_and_verify_selection(
        app, click_handling_div, SECOND_POINT_COORDS, MULTI_SELECTION
    )

    # Deselect everything by clicking away from an object in a layer
    _click_point_and_verify_selection(
        app, click_handling_div, DESELECT_COORDS, EMPTY_SELECTION
    )


@pytest.mark.only_browser("chromium")
def test_pydeck_chart_single_select_interactions_and_return_values(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """
    Test single selection and deselection all function properly and return the
    expected values in both session_state and as a return of st.pydeck.
    """
    _select_chart_type(app, "basic")
    _set_selection_mode(app, "single-object")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)

    # Click on the hex that has count: 10
    _click_point_and_verify_selection(
        app, click_handling_div, FIRST_POINT_COORDS, FIRST_POINT_SELECTION
    )

    # Click the hex that has count: 100
    _click_point_and_verify_selection(
        app, click_handling_div, SECOND_POINT_COORDS, SECOND_POINT_SELECTION
    )

    # Click on the hex that has count: 10 again
    _click_point_and_verify_selection(
        app, click_handling_div, FIRST_POINT_COORDS, FIRST_POINT_SELECTION
    )

    # Deselect everything by clicking away from an object in a layer
    _click_point_and_verify_selection(
        app, click_handling_div, DESELECT_COORDS, EMPTY_SELECTION
    )

    # Scatterplot checks
    _select_chart_type(app, "scatterplot")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)

    # Click on the scatterplot point with the biggest size
    click_point(click_handling_div, SCATTERPLOT_POINT_COORDS)

    wait_for_app_run(app, wait_delay=STANDARD_WAIT_DELAY)

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
    _select_chart_type(app, "basic")
    _set_selection_mode(app, "multi-object")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)

    assert_snapshot(
        click_handling_div,
        name="st_pydeck_chart_select-no-selections",
        pixel_threshold=PIXEL_THRESHOLD,
    )

    # Click on the hex that has count: 10
    click_point(click_handling_div, FIRST_POINT_COORDS)

    wait_for_app_run(app, wait_delay=STANDARD_WAIT_DELAY)

    assert_snapshot(
        click_handling_div,
        name="st_pydeck_chart_select-single-selection",
        pixel_threshold=PIXEL_THRESHOLD,
    )

    # Multiselect and click the hex that has count: 100
    click_point(click_handling_div, SECOND_POINT_COORDS)

    wait_for_app_run(app, wait_delay=STANDARD_WAIT_DELAY)

    assert_snapshot(
        click_handling_div,
        name="st_pydeck_chart_select-multi-selection",
        pixel_threshold=PIXEL_THRESHOLD,
    )

    # Deselect everything by clicking away from an object in a layer
    click_point(click_handling_div, DESELECT_COORDS)

    wait_for_app_run(app, wait_delay=STANDARD_WAIT_DELAY)

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
    _select_chart_type(app, "basic")
    _set_selection_mode(app, "multi-object")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)

    # Click on the hex that has count: 10
    click_point(click_handling_div, FIRST_POINT_COORDS)

    wait_for_app_run(app, wait_delay=STANDARD_WAIT_DELAY)

    # Multiselect and click the hex that has count: 100
    click_point(click_handling_div, SECOND_POINT_COORDS)

    wait_for_app_run(app, wait_delay=STANDARD_WAIT_DELAY)

    click_button(app, "Create some elements to unmount component")
    wait_for_app_run(app, wait_delay=STANDARD_WAIT_DELAY)

    wait_for_chart(app)

    assert_snapshot(
        click_handling_div,
        name="st_pydeck_chart_selection_state_remains_after_unmounting",
        pixel_threshold=PIXEL_THRESHOLD,
    )


@pytest.mark.only_browser("chromium")
@pytest.mark.flaky(reruns=4)
def test_pydeck_chart_selection_callback(app: Page):
    """Test the callback functionality of a PyDeck chart."""
    _select_chart_type(app, "callback")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)

    markdown_prefix = "PyDeck selection callback:"

    # Assert we haven't yet written anything out for the debugging state
    expect(app.get_by_text(markdown_prefix)).to_have_count(0)

    # Click on the hex that has count: 10
    _click_point_and_verify_selection(
        app,
        click_handling_div,
        FIRST_POINT_COORDS,
        FIRST_POINT_SELECTION,
        markdown_prefix,
        markdown_prefix_session_state=None,
    )


@pytest.mark.only_browser("chromium")
def test_pydeck_chart_selection_in_form(app: Page):
    """Test the selection functionality of a PyDeck chart within a form."""
    _select_chart_type(app, "form")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)

    # Assert we haven't yet written anything out for the debugging state
    markdown_prefix = "PyDeck-in-form selection:"
    markdown_prefix_session_state = "PyDeck-in-form selection in session state:"

    # Click on the hex that has count: 10
    click_point(click_handling_div, FORM_POINT_COORDS)

    wait_for_app_run(app)

    # Nothing should be shown yet because we did not submit the form
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

    # submit the form. The selection uses a debounce of 200ms; if we click too
    # early, the state is not updated correctly and we submit the old,
    # unselected values
    app.wait_for_timeout(210)

    click_form_button(app, "Submit")

    expect_prefixed_markdown(app, markdown_prefix, FIRST_POINT_SELECTION)
    expect_prefixed_markdown(app, markdown_prefix_session_state, FIRST_POINT_SELECTION)
    expect(app.get_by_test_id("stForm")).not_to_contain_text("Error")


@pytest.mark.only_browser("chromium")
def test_pydeck_chart_selection_in_fragment(app: Page):
    """Test the selection functionality of a PyDeck chart within a fragment."""
    _select_chart_type(app, "fragment")
    wait_for_chart(app)

    click_handling_div = get_click_handling_div(app, nth=0)

    # Check that the main script has run twice (the initial run, and the run
    # after selecting the Fragment type)
    expect(app.get_by_text("Runs: 2")).to_be_visible()

    # Assert we haven't yet written anything out for the debugging state
    markdown_prefix = "PyDeck-in-fragment selection:"

    # Nothing should be shown yet because we did do anything yet
    expect_prefixed_markdown(
        app,
        markdown_prefix,
        EMPTY_SELECTION,
    )

    # Click on the hex that has count: 10
    _click_point_and_verify_selection(
        app,
        click_handling_div,
        FIRST_POINT_COORDS,
        FIRST_POINT_SELECTION,
        markdown_prefix,
        markdown_prefix_session_state=None,
    )

    # Check that the main script has not re-run any additional times.
    expect(app.get_by_text("Runs: 2")).to_be_visible()
