# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from e2e_playwright.conftest import (
    ImageCompareFunction,
    build_app_url,
    rerun_app,
    wait_for_app_loaded,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_form_button,
    click_toggle,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    get_element_by_key,
    get_slider,
    reset_focus,
    reset_hovering,
    tab_until_focused,
)

NUM_SLIDER_WIDGETS = 37


def test_slider_rendering(themed_app: Page, assert_snapshot: ImageCompareFunction):
    st_sliders = themed_app.get_by_test_id("stSlider")
    expect(st_sliders).to_have_count(NUM_SLIDER_WIDGETS)

    assert_snapshot(
        get_slider(themed_app, "Label 1"), name="st_slider-regular_with_format"
    )
    assert_snapshot(get_slider(themed_app, "Label 4"), name="st_slider-disabled")
    assert_snapshot(
        get_element_by_key(themed_app, "slider_5"), name="st_slider-hidden_label"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "slider_6"), name="st_slider-label_collapsed"
    )
    assert_snapshot(
        get_slider(themed_app, "Label 7"), name="st_slider-labels_overlap_slider"
    )
    assert_snapshot(
        get_slider(themed_app, "Slider 12 (time-value)"), name="st_slider-time_value"
    )
    assert_snapshot(
        get_slider(themed_app, "Label 13 - Overlapping on the left"),
        name="st_slider-overlap_left",
    )
    assert_snapshot(
        get_slider(themed_app, "Label 14 - Overlapping near the left"),
        name="st_slider-overlap_near_left",
    )
    assert_snapshot(
        get_slider(themed_app, "Label 15 - Overlapping on the right"),
        name="st_slider-overlap_right",
    )
    assert_snapshot(
        get_slider(themed_app, "Label 16 - Overlapping near the right"),
        name="st_slider-overlap_near_right",
    )
    assert_snapshot(
        get_slider(themed_app, "Label 17 - Overlapping near the center"),
        name="st_slider-overlap_near_center",
    )
    assert_snapshot(
        get_slider(themed_app, re.compile(r"^Label 18")),
        name="st_slider-markdown_label",
    )
    assert_snapshot(
        get_slider(themed_app, "Label 19 - Width 300px"), name="st_slider-width_300px"
    )
    assert_snapshot(
        get_slider(themed_app, "Label 20 - Width Stretch"),
        name="st_slider-width_stretch",
    )
    assert_snapshot(
        get_slider(themed_app, "Slider with compact format"),
        name="st_slider-compact_format",
    )
    assert_snapshot(
        get_slider(themed_app, "Slider with localized date format"),
        name="st_slider-localized_date_format",
    )


def test_help_tooltip_works(app: Page):
    element_with_help = get_slider(app, "Label 1")
    expect_help_tooltip(app, element_with_help, "This is some help tooltip!")


def test_help_tooltip_is_keyboard_accessible(app: Page):
    """Test that slider help tooltips can be opened via keyboard focus."""
    slider = get_slider(app, "Label 1")
    slider.scroll_into_view_if_needed()

    # Ensure no stale tooltip from hover/focus state:
    reset_hovering(app)
    reset_focus(app)

    help_button = slider.get_by_role("button", name="Help for Label 1")
    tab_until_focused(app, help_button)
    expect(help_button).to_be_focused()

    tooltip = app.get_by_test_id("stTooltipContent")
    expect(tooltip).to_be_visible()
    expect(tooltip).to_have_text("This is some help tooltip!")

    # Blur to close:
    reset_focus(app)
    expect(tooltip).not_to_be_attached()


def test_slider_in_expander(app: Page, assert_snapshot: ImageCompareFunction):
    expect_markdown(app, "Value B: 10000")
    expect_prefixed_markdown(app, "Range Value B:", "(10000, 25000)")
    # Target by label at page scope to avoid container scoping issues
    first_slider_in_expander = get_slider(app, "Label B")
    second_slider_in_expander = get_slider(app, "Range B")

    first_slider_in_expander.hover()
    # click in middle
    app.mouse.down()
    app.mouse.up()
    wait_for_app_run(app)

    second_slider_in_expander.hover()
    # click in middle
    app.mouse.down()
    app.mouse.up()
    wait_for_app_run(app)

    expect_markdown(app, "Value B: 17500")
    expect_prefixed_markdown(app, "Range Value B:", "(17500, 25000)")

    assert_snapshot(first_slider_in_expander, name="st_slider-in_expander_regular")
    assert_snapshot(second_slider_in_expander, name="st_slider-in_expander_range")


def test_slider_contains_correct_format_func_value_and_in_session_state(
    app: Page,
):
    expect_prefixed_markdown(
        app,
        "Value 1:",
        "(datetime.date(2019, 8, 1), datetime.date(2019, 9, 1))",
    )
    slider = get_slider(app, "Label 1")
    slider.hover()
    # click in middle
    app.mouse.down()

    # Move mouse to 0, 0 pixels on the screen to simulate dragging left
    app.mouse.move(0, 0)
    app.mouse.up()
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Value 1:",
        "(datetime.date(2019, 8, 1), datetime.date(2019, 8, 1))",
    )


def test_using_arrow_keys_on_slider_produces_correct_values(
    app: Page, assert_snapshot: ImageCompareFunction
):
    expect_prefixed_markdown(
        app,
        "Value 1:",
        "(datetime.date(2019, 8, 1), datetime.date(2019, 9, 1))",
    )
    slider = get_slider(app, "Label 1")
    slider.hover()
    # click in middle
    app.mouse.down()

    # Move slider once to right
    app.keyboard.press("ArrowRight")
    wait_for_app_run(app)
    expect_prefixed_markdown(
        app,
        "Value 1:",
        "(datetime.date(2019, 8, 1), datetime.date(2020, 7, 3))",
    )

    # Move slider once to left
    app.keyboard.press("ArrowLeft")
    wait_for_app_run(app)

    expect_prefixed_markdown(
        app,
        "Value 1:",
        "(datetime.date(2019, 8, 1), datetime.date(2020, 7, 2))",
    )

    # Screenshot to test that the tickbar shows then focused.
    assert_snapshot(slider, name="st_slider-tickbar_focused")


def test_slider_calls_callback(app: Page):
    expect(app.get_by_text("Value 8: 25")).to_be_visible()
    expect(app.get_by_text("Slider changed: False")).to_be_visible()
    slider = get_slider(app, "Label 8")
    # click in middle
    slider.click()

    wait_for_app_run(app)
    expect(app.get_by_text("Value 8: 50")).to_be_visible()
    expect(app.get_by_text("Slider changed: True")).to_be_visible()


def test_slider_works_in_forms(app: Page):
    expect(app.get_by_text("slider-in-form selection: 25")).to_be_visible()
    slider = get_slider(app, "Label 9")
    # click in middle
    slider.click()

    # The value is not submitted so the value should not have changed yet
    expect(app.get_by_text("slider-in-form selection: 25")).to_be_visible()

    # need to wait for the actual component value to update and then submit
    app.wait_for_timeout(200)
    click_form_button(app, "Submit")

    expect(app.get_by_text("slider-in-form selection: 50")).to_be_visible()


def test_slider_works_with_fragments(app: Page):
    expect(app.get_by_text("Runs: 1")).to_be_visible()
    expect(app.get_by_text("slider-in-fragment selection: 25")).to_be_visible()
    slider = get_slider(app, "Label 10")
    # click in middle
    slider.click()

    wait_for_app_run(app)
    expect(app.get_by_text("slider-in-fragment selection: 50")).to_be_visible()
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_slider_with_float_formatting(app: Page, assert_snapshot: ImageCompareFunction):
    slider = get_slider(app, "Slider 11 (formatted float)")
    slider.hover()
    app.mouse.down()
    app.mouse.up()

    # Move slider once to right
    app.keyboard.press("ArrowRight")
    wait_for_app_run(app)
    reset_hovering(app)
    reset_focus(app)
    expect(app.get_by_text("Slider 11: 0.8")).to_be_visible()
    assert_snapshot(slider, name="st_slider-float_formatting")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stSlider")


def test_no_rerun_on_drag(app: Page):
    """Test that moving the slider does not trigger a rerun."""
    runs_text = app.get_by_text("Runs: 1")
    expect(runs_text).to_be_visible()

    slider = get_slider(app, "Label 8")
    slider.hover()
    # click in middle and drag
    app.mouse.down()
    app.mouse.move(0, 0)
    wait_for_app_run(app)

    # The number of runs should not have changed
    expect(runs_text).to_be_visible()


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "slider8")).to_be_visible()


@pytest.mark.performance
def test_slider_interaction_performance(app: Page):
    """
    Test a simple interaction with a slider to ensure it is performant.
    As of writing, a simple slider interaction effectively causes a full page
    re-render.
    """
    slider = get_element_by_key(app, "slider_5")
    slider.hover()
    # click in middle
    app.mouse.down()

    # Move mouse to 0, 0 pixels on the screen to simulate dragging left
    app.mouse.move(0, 0)
    app.mouse.up()
    wait_for_app_run(app)
    expect(app.get_by_text("Value 5: 0")).to_be_visible()


def test_slider_tick_bar_visibility(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the tick bar is visible when the slider is hovered."""
    slider = get_slider(app, "Label 1")
    slider.hover()
    expect(slider.get_by_test_id("stSliderTickBar")).to_be_visible()

    assert_snapshot(slider, name="st_slider-tick_bar_visibility")


def test_dynamic_slider_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the slider can be updated dynamically while keeping the state."""
    dynamic_slider = get_element_by_key(app, "dynamic_slider_with_key")
    expect(dynamic_slider).to_be_visible()

    expect(dynamic_slider).to_contain_text("Initial dynamic slider")
    expect_prefixed_markdown(app, "Initial slider value:", "25")

    assert_snapshot(dynamic_slider, name="st_slider-dynamic_initial")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_slider, "initial help")

    # Click to change value
    dynamic_slider.click()
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Initial slider value:", "50")

    # Click the toggle to update the slider props
    click_toggle(app, "Update slider props")

    # new slider is visible:
    expect(dynamic_slider).to_contain_text("Updated dynamic slider")

    # Ensure the previously entered value remains visible
    expect_prefixed_markdown(app, "Updated slider value:", "50")

    dynamic_slider.scroll_into_view_if_needed()
    assert_snapshot(dynamic_slider, name="st_slider-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_slider, "updated help")

    # Click in the middle and move slider once to right
    dynamic_slider.click()
    dynamic_slider.press("ArrowRight")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Updated slider value:", "51")


# --- Query Param Binding Tests ---


def test_slider_query_param_seeding_int(page: Page, app_base_url: str):
    """Test that slider integer value can be seeded from URL query params."""
    page.goto(build_app_url(app_base_url, query={"bound_int": "75"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound int value:", "75")
    expect(page).to_have_url(re.compile(r"bound_int=75"))


def test_slider_query_param_seeding_float(page: Page, app_base_url: str):
    """Test that slider float value can be seeded from URL query params."""
    page.goto(build_app_url(app_base_url, query={"bound_float": "0.3"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound float value:", "0.3")
    expect(page).to_have_url(re.compile(r"bound_float=0.3"))


def test_slider_query_param_seeding_range(page: Page, app_base_url: str):
    """Test that range slider can be seeded via repeated URL params."""
    page.goto(build_app_url(app_base_url, query={"bound_range": ["10", "90"]}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound range value:", "(10, 90)")
    expect(page).to_have_url(re.compile(r"bound_range=10&bound_range=90"))


def test_slider_query_param_out_of_range_resets_to_default(
    page: Page, app_base_url: str
):
    """Test that out-of-range URL value resets slider to default."""
    # bound_int has min=0, max=100, default=50
    page.goto(build_app_url(app_base_url, query={"bound_int": "999"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound int value:", "50")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_int="))

    # Below min
    page.goto(build_app_url(app_base_url, query={"bound_int": "-50"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound int value:", "50")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_int="))


def test_slider_query_param_range_partial_out_of_bounds(page: Page, app_base_url: str):
    """Test that range with one out-of-bounds value resets entire range to default."""
    # bound_range has min=0, max=100, default=(25, 75)
    # First value valid, second out of bounds
    page.goto(build_app_url(app_base_url, query={"bound_range": ["30", "150"]}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound range value:", "(25, 75)")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_range="))


def test_slider_query_param_single_value_on_range_resets(page: Page, app_base_url: str):
    """Test that a single URL value for a range slider resets to default."""
    # bound_range is a range slider with default=(25, 75)
    page.goto(build_app_url(app_base_url, query={"bound_range": "50"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound range value:", "(25, 75)")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_range="))


def test_slider_query_param_updates_url(app: Page):
    """Test that interacting with a bound slider updates the URL."""
    slider = get_element_by_key(app, "bound_int")
    slider.hover()
    app.mouse.down()

    # Move slider to the right to change the value from the default (50)
    app.keyboard.press("ArrowRight")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Bound int value:", "51")
    expect(app).to_have_url(re.compile(r"[?&]bound_int=51"))


def test_slider_query_param_default_override(page: Page, app_base_url: str):
    """Test that seeding a non-default value works and reverting clears param."""
    # Seed bound_float (default=0.5) with a non-default value
    page.goto(build_app_url(app_base_url, query={"bound_float": "0.3"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound float value:", "0.3")
    expect(page).to_have_url(re.compile(r"bound_float=0.3"))

    # Interact to set it back to the default (0.5 is at the midpoint)
    slider = get_element_by_key(page, "bound_float")
    slider.click()
    wait_for_app_run(page)

    # Default value should not remain in URL
    expect_prefixed_markdown(page, "Bound float value:", "0.5")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_float="))


def test_slider_query_param_invalid_non_numeric(page: Page, app_base_url: str):
    """Test that non-numeric URL value is rejected and slider uses default."""
    page.goto(build_app_url(app_base_url, query={"bound_int": "notanumber"}))
    wait_for_app_loaded(page)

    # Slider should use default (50), invalid param should be cleared
    expect_prefixed_markdown(page, "Bound int value:", "50")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_int="))


def test_slider_query_param_empty_value_rejected(page: Page, app_base_url: str):
    """Test that empty URL param is rejected for non-clearable slider."""
    page.goto(build_app_url(app_base_url, query={"bound_int": ""}))
    wait_for_app_loaded(page)

    # Slider should use default (50), empty param should be cleared
    expect_prefixed_markdown(page, "Bound int value:", "50")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_int="))


# --- Date/time/datetime slider ISO URL tests ---


def test_slider_query_param_date_iso_seeding(page: Page, app_base_url: str):
    """Test that a date slider can be seeded with an ISO date string."""
    page.goto(build_app_url(app_base_url, query={"bound_date": "2024-03-20"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound date value:", "2024-03-20")
    expect(page).to_have_url(re.compile(r"bound_date=2024-03-20"))


def test_slider_query_param_time_iso_seeding(page: Page, app_base_url: str):
    """Test that a time slider can be seeded with an ISO time string."""
    page.goto(build_app_url(app_base_url, query={"bound_time": "09:30"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound time value:", "09:30:00")
    expect(page).to_have_url(re.compile(r"bound_time=09%3A30"))


def test_slider_query_param_datetime_iso_seeding(page: Page, app_base_url: str):
    """Test that a datetime slider can be seeded with an ISO datetime string."""
    page.goto(build_app_url(app_base_url, query={"bound_datetime": "2024-03-20T09:30"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound datetime value:", "2024-03-20 09:30:00")
    expect(page).to_have_url(re.compile(r"bound_datetime=2024-03-20T09%3A30"))


def test_slider_query_param_date_range_iso_seeding(page: Page, app_base_url: str):
    """Test that a date range slider can be seeded with ISO date strings."""
    page.goto(
        build_app_url(
            app_base_url,
            query={"bound_date_range": ["2021-06-01", "2023-12-15"]},
        )
    )
    wait_for_app_loaded(page)

    expect_prefixed_markdown(
        page,
        "Bound date range value:",
        "(datetime.date(2021, 6, 1), datetime.date(2023, 12, 15))",
    )
    expect(page).to_have_url(
        re.compile(r"bound_date_range=2021-06-01&bound_date_range=2023-12-15")
    )


def test_slider_query_param_date_default_not_in_url(app: Page):
    """Test that a date slider at its default value does not show in URL."""
    expect(app).not_to_have_url(re.compile(r"[?&]bound_date="))


def test_slider_query_param_date_invalid_iso_resets(page: Page, app_base_url: str):
    """Test that an invalid ISO date resets the slider to default."""
    page.goto(build_app_url(app_base_url, query={"bound_date": "not-a-date"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound date value:", "2023-06-15")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_date="))


def test_slider_query_param_date_updates_url_with_iso(app: Page):
    """Test that interacting with a date slider updates the URL with ISO format."""
    slider = get_element_by_key(app, "bound_date")
    slider.get_by_role("slider").press("ArrowRight")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Bound date value:", "2023-06-16")
    expect(app).to_have_url(re.compile(r"bound_date=2023-06-16"))


def test_slider_query_param_time_updates_url_with_iso(app: Page):
    """Test that interacting with a time slider updates the URL with ISO format."""
    slider = get_element_by_key(app, "bound_time")
    slider.get_by_role("slider").press("ArrowRight")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Bound time value:", "12:15:00")
    expect(app).to_have_url(re.compile(r"bound_time=12%3A15"))


def test_slider_query_param_datetime_updates_url_with_iso(app: Page):
    """Test that interacting with a datetime slider updates the URL with ISO format.

    The default (2023-06-15 14:30) is between step boundaries (step=1day from
    midnight). BaseWeb quantizes to the nearest boundary on interaction, so
    ArrowRight produces 2023-06-17 00:00 rather than 2023-06-16 14:30.
    """
    slider = get_element_by_key(app, "bound_datetime")
    slider.get_by_role("slider").press("ArrowRight")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Bound datetime value:", "2023-06-17 00:00:00")
    expect(app).to_have_url(re.compile(r"bound_datetime=2023-06-17T00%3A00"))


# --- Second-resolution slider tests ---


def test_slider_query_param_time_seconds_iso_seeding(page: Page, app_base_url: str):
    """Test that a time slider with seconds-step can be seeded with HH:MM:SS."""
    page.goto(build_app_url(app_base_url, query={"bound_time_secs": "09:30:30"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound time secs value:", "09:30:30")
    expect(page).to_have_url(re.compile(r"bound_time_secs=09%3A30%3A30"))


def test_slider_query_param_datetime_seconds_iso_seeding(page: Page, app_base_url: str):
    """Test that a datetime slider with seconds-step can be seeded with seconds."""
    page.goto(
        build_app_url(
            app_base_url, query={"bound_datetime_secs": "2024-03-20T09:30:30"}
        )
    )
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound datetime secs value:", "2024-03-20 09:30:30")
    expect(page).to_have_url(re.compile(r"bound_datetime_secs=2024-03-20T09%3A30%3A30"))


# --- Session state vs URL value collision tests ---


def test_slider_url_value_wins_over_session_state_on_initial_load(
    page: Page, app_base_url: str
):
    """On initial load, URL value takes priority over pre-set session_state."""
    page.goto(build_app_url(app_base_url, query={"bound_ss": "75"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound ss value:", "75")
    expect(page).to_have_url(re.compile(r"bound_ss=75"))


def test_slider_session_state_wins_when_no_url_value(app: Page):
    """Without URL value, session_state pre-set (30) wins over widget default (0)."""
    expect_prefixed_markdown(app, "Bound ss value:", "30")
    # Session-state pre-set doesn't push to URL without user interaction
    expect(app).not_to_have_url(re.compile(r"bound_ss="))


def test_slider_ui_value_wins_on_rerun_and_syncs_url(page: Page, app_base_url: str):
    """After initial load, interacting with the widget updates session_state and URL."""
    page.goto(build_app_url(app_base_url, query={"bound_ss": "75"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound ss value:", "75")

    slider = get_element_by_key(page, "bound_ss")
    slider.get_by_role("slider").press("ArrowRight")
    wait_for_app_run(page)

    expect_prefixed_markdown(page, "Bound ss value:", "76")
    expect(page).to_have_url(re.compile(r"bound_ss=76"))

    # Rerun the app — UI/session_state value should persist, not revert to
    # the session_state pre-set (30) or the original URL value (75)
    rerun_app(page)

    expect_prefixed_markdown(page, "Bound ss value:", "76")
    expect(page).to_have_url(re.compile(r"bound_ss=76"))
