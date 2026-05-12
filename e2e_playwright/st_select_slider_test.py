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
    wait_for_app_loaded,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_form_button,
    click_toggle,
    expect_help_tooltip,
    expect_prefixed_markdown,
    get_element_by_key,
    get_expander,
    get_slider,
    reset_hovering,
)

NUM_SELECT_SLIDERS = 20


def test_select_slider_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    expect(themed_app.get_by_test_id("stSlider")).to_have_count(NUM_SELECT_SLIDERS)

    assert_snapshot(
        get_element_by_key(themed_app, "first_select_slider"),
        name="st_select_slider-regular_with_help_and_format_func",
    )
    assert_snapshot(
        get_slider(themed_app, "Label 5 (disabled)"),
        name="st_select_slider-disabled",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "select_slider_hidden"),
        name="st_select_slider-hidden_label",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "select_slider_collapsed"),
        name="st_select_slider-label_collapsed",
    )
    assert_snapshot(
        # The label for this slider contains Markdown formatting and dynamic content,
        # making it difficult to match with a simple string. Use a regex pattern to
        # reliably select the slider by matching the beginning of the label.
        get_slider(themed_app, re.compile(r"^Label 12")),
        name="st_select_slider-markdown_label",
    )
    assert_snapshot(
        get_slider(themed_app, "Label 13 - Width 300px"),
        name="st_select_slider-width_300px",
    )
    assert_snapshot(
        get_slider(themed_app, "Label 14 - Width Stretch"),
        name="st_select_slider-width_stretch",
    )
    assert_snapshot(
        get_slider(themed_app, "Label 15 - Markdown in options"),
        name="st_select_slider-markdown_in_options",
    )


def test_help_tooltip_works(app: Page):
    element_with_help = get_element_by_key(app, "first_select_slider")
    expect_help_tooltip(app, element_with_help, "Help in a select slider")


def test_select_slider_contains_correct_format_func_value_and_in_session_state(
    app: Page,
):
    expect(app.get_by_text("Value 1: ('orange', 'blue')")).to_have_count(2)
    first_slider = get_element_by_key(app, "first_select_slider")
    first_slider.hover()
    # click in middle
    app.mouse.down()

    # Move mouse to 500, 0 pixels on the screen to simulate dragging left
    app.mouse.move(500, 0)
    app.mouse.up()
    wait_for_app_run(app)

    expect(app.get_by_text("Value 1: ('orange', 'yellow')")).to_have_count(2)


def test_using_arrow_keys_on_select_slider_produces_correct_values(app: Page):
    expect(app.get_by_text("Value 1: ('orange', 'blue')")).to_have_count(2)
    first_slider = get_element_by_key(app, "first_select_slider")
    first_slider.hover()
    # click in middle
    app.mouse.down()

    # Move slider once to right
    app.keyboard.press("ArrowRight")
    wait_for_app_run(app)
    expect(app.get_by_text("Value 1: ('orange', 'blue')")).to_have_count(2)

    # Move slider once to left
    app.keyboard.press("ArrowLeft")
    wait_for_app_run(app)

    expect(app.get_by_text("Value 1: ('orange', 'green')")).to_have_count(2)


def test_select_slider_calls_callback(app: Page):
    expect(app.get_by_text("Value 8: 1")).to_be_visible()
    expect(app.get_by_text("Select slider changed: False")).to_be_visible()
    slider = get_element_by_key(app, "select_slider8")
    # click in middle
    slider.click()
    wait_for_app_run(app)
    expect(app.get_by_text("Hello world")).to_be_visible()
    expect_prefixed_markdown(app, "Value 8:", "3")
    expect_prefixed_markdown(app, "Select slider changed:", "True")


def test_select_slider_label_realigns_when_expander_opens(app: Page):
    expander = get_expander(app, "Expander")
    expander.locator("summary").click()
    expander.locator("summary").click()

    slider_in_expander = get_slider(app, "Label 9 (expander)")
    expect(
        slider_in_expander.get_by_test_id("stSliderThumbValue").first
    ).not_to_have_css("left", "0px")


def test_select_slider_works_in_forms(app: Page):
    expect(app.get_by_text("select_slider-in-form selection: 1")).to_be_visible()
    slider = get_slider(app, "Label 10 (form)")
    # click in middle
    slider.click()

    # The value is not submitted so the value should not have changed yet
    expect_prefixed_markdown(app, "select_slider-in-form selection:", "1")

    # need to wait for the actual component value to update and then submit
    app.wait_for_timeout(200)
    click_form_button(app, "Submit")

    expect_prefixed_markdown(app, "select_slider-in-form selection:", "3")


def test_select_slider_works_with_fragments(app: Page):
    expect_prefixed_markdown(app, "Runs:", "1")
    expect_prefixed_markdown(app, "select_slider-in-fragment selection:", "1")
    slider = get_slider(app, "Label 11 (fragment)")
    # click in middle
    slider.click()
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "select_slider-in-fragment selection:", "3")
    expect_prefixed_markdown(app, "Runs:", "1")


@pytest.mark.skip_browser("firefox")  # Firefox runs into sub-pixel flakiness
def test_dynamic_select_slider_props_and_options(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the select slider can be updated dynamically while keeping the state.

    Also tests dynamic options: "green" exists in both option sets at different indices:
    - Initial: index 3 (out of 5: red, orange, yellow, green, blue)
    - Updated: index 0 (out of 3: green, blue, purple)
    When selecting "green" and toggling, the value should be preserved but thumb position changes.
    """
    dynamic_select_slider = get_element_by_key(app, "dynamic_select_slider_with_key")
    expect(dynamic_select_slider).to_be_visible()

    expect(dynamic_select_slider).to_contain_text("Initial dynamic select slider")
    expect_prefixed_markdown(app, "Initial select slider value:", "orange")

    reset_hovering(app)
    assert_snapshot(dynamic_select_slider, name="st_select_slider-dynamic_initial")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_select_slider, "initial help")

    # Move to "green" (index 3 in initial options: red, orange, yellow, green, blue)
    # This tests that shared options are preserved when toggling.
    # Clicking the slider track moves to center (~index 2 = "yellow"), then ArrowRight to "green"
    dynamic_select_slider.click()
    # Wait for the click to register and focus to be set before sending key
    wait_for_app_run(app)
    dynamic_select_slider.press("ArrowRight")  # yellow -> green
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Initial select slider value:", "green")

    # Click the toggle to update the select slider props AND options
    # Options change from [red, orange, yellow, green, blue] to [green, blue, purple]
    # "green" exists in both but at different positions (index 3 -> index 0)
    click_toggle(app, "Update select slider props")

    # New select slider is visible:
    expect(dynamic_select_slider).to_contain_text("Updated dynamic select slider")

    # "green" should be preserved because it exists in the new options
    # The slider thumb should have moved to the left (index 0 in new options)
    expect_prefixed_markdown(app, "Updated select slider value:", "green")

    dynamic_select_slider.scroll_into_view_if_needed()
    reset_hovering(app)
    assert_snapshot(dynamic_select_slider, name="st_select_slider-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_select_slider, "updated help")

    # Move slider to test it still works after options change.
    # Click moves to center (~"blue" at index 1), then ArrowRight moves to "purple" (index 2)
    dynamic_select_slider.click()
    # Wait for the click to register and focus to be set before sending key
    wait_for_app_run(app)
    dynamic_select_slider.press("ArrowRight")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Updated select slider value:", "purple")


def test_no_rerun_on_drag(app: Page):
    """Test that moving the slider does not trigger a rerun."""
    runs_text = app.get_by_text("Runs: 1")
    expect(runs_text).to_be_visible()

    slider = get_element_by_key(app, "select_slider8")
    slider.hover()
    # click in middle and drag
    app.mouse.down()
    app.mouse.move(0, 0)
    wait_for_app_run(app)

    # The number of runs should not have changed
    expect(runs_text).to_be_visible()


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stSlider")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "select_slider8")).to_be_visible()


def test_select_slider_tick_bar_visibility(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that the tick bar is visible when the slider is hovered."""
    slider = get_element_by_key(app, "first_select_slider")
    expect(slider).to_be_visible()
    slider.hover()
    expect(slider.get_by_test_id("stSliderTickBar")).to_be_visible()
    assert_snapshot(slider, name="st_select_slider-tick_bar_visibility")


def test_select_slider_range_dynamic_options_resets_on_invalid(app: Page):
    """Test that range slider resets entirely when either value becomes invalid after options change."""
    range_slider = get_element_by_key(app, "dynamic_range_select_slider")
    expect(range_slider).to_be_visible()

    # Initially default range is ("alpha", "echo")
    # Options are ["alpha", "bravo", "charlie", "delta", "echo"]
    expect_prefixed_markdown(app, "Dynamic range selection:", "('alpha', 'echo')")

    # Toggle to enable alternative options ["charlie", "delta", "echo"]
    # "alpha" is NOT in new options -> entire range resets to new default ("charlie", "echo")
    click_toggle(app, "Enable alternative range options")
    expect_prefixed_markdown(app, "Dynamic range selection:", "('charlie', 'echo')")
    # Negative assertion: "alpha" should not be preserved (it's not in new options)
    markdown_element = app.get_by_test_id("stMarkdown").filter(
        has_text=re.compile(r"Dynamic range selection:")
    )
    expect(markdown_element).not_to_contain_text("'alpha'")


# --- Query Param Binding Tests ---


def test_select_slider_query_param_seeding(page: Page, app_base_url: str):
    """Test that select_slider value can be seeded from URL query params."""
    page.goto(build_app_url(app_base_url, query={"bound_color": "blue"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound color:", "blue")
    expect(page).to_have_url(re.compile(r"bound_color=blue"))


def test_select_slider_query_param_seeding_range(page: Page, app_base_url: str):
    """Test that select_slider range can be seeded via repeated URL params."""
    page.goto(
        build_app_url(app_base_url, query={"bound_color_range": ["red", "violet"]})
    )
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound color range:", "('red', 'violet')")
    expect(page).to_have_url(
        re.compile(r"bound_color_range=red&bound_color_range=violet")
    )


def test_select_slider_query_param_invalid_value_resets(page: Page, app_base_url: str):
    """Test that invalid URL option reverts to default."""
    # bound_color has default "green"
    page.goto(build_app_url(app_base_url, query={"bound_color": "invalid"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound color:", "green")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_color="))


def test_select_slider_query_param_range_partial_invalid(page: Page, app_base_url: str):
    """Test range with one invalid value auto-corrects to fallback."""
    # bound_color_range has default ("orange", "indigo")
    # "red" is valid, "invalid" falls back to the default for that position
    page.goto(
        build_app_url(app_base_url, query={"bound_color_range": ["red", "invalid"]})
    )
    wait_for_app_loaded(page)

    # The invalid position falls back to its default index (position 1 → "indigo")
    expect_prefixed_markdown(page, "Bound color range:", "('red', 'indigo')")


def test_select_slider_query_param_format_func(page: Page, app_base_url: str):
    """Test that format_func options work in URL."""
    # bound_formatted uses format_func=str.upper, so URL options are uppercase
    page.goto(build_app_url(app_base_url, query={"bound_formatted": "LG"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound formatted:", "lg")
    expect(page).to_have_url(re.compile(r"bound_formatted=LG"))


def test_select_slider_query_param_updates_url(app: Page):
    """Test that interacting with a bound select_slider updates the URL."""
    slider = get_element_by_key(app, "bound_color")
    slider.hover()
    app.mouse.down()

    # Move slider to the right to change from default ("green")
    app.keyboard.press("ArrowRight")
    wait_for_app_run(app)

    expect_prefixed_markdown(app, "Bound color:", "blue")
    expect(app).to_have_url(re.compile(r"[?&]bound_color=blue"))


def test_select_slider_query_param_default_override(page: Page, app_base_url: str):
    """Test that URL overrides default, and reverting to default clears the URL param."""
    # bound_color has default "green"; seed with "blue" (one step right)
    page.goto(build_app_url(app_base_url, query={"bound_color": "blue"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound color:", "blue")
    expect(page).to_have_url(re.compile(r"bound_color=blue"))

    # Click center of 7-option slider to snap to middle option ("green" = default)
    slider = get_element_by_key(page, "bound_color")
    slider.click()
    wait_for_app_run(page)

    expect_prefixed_markdown(page, "Bound color:", "green")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_color="))


def test_select_slider_query_param_zero_width_range(page: Page, app_base_url: str):
    """Test that zero-width range (duplicate values) works correctly."""
    page.goto(
        build_app_url(app_base_url, query={"bound_color_range": ["blue", "blue"]})
    )
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound color range:", "('blue', 'blue')")
    expect(page).to_have_url(
        re.compile(r"bound_color_range=blue&bound_color_range=blue")
    )


def test_select_slider_query_param_single_value_on_range_resets(
    page: Page, app_base_url: str
):
    """Test that a single URL value for a range select_slider resets to default."""
    # bound_color_range is a range slider with default=("orange", "indigo")
    page.goto(build_app_url(app_base_url, query={"bound_color_range": "blue"}))
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "Bound color range:", "('orange', 'indigo')")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_color_range="))


def test_select_slider_query_param_both_invalid_range(page: Page, app_base_url: str):
    """Test that range with both values invalid resets to default."""
    # bound_color_range default is ("orange", "indigo")
    page.goto(
        build_app_url(
            app_base_url, query={"bound_color_range": ["invalid1", "invalid2"]}
        )
    )
    wait_for_app_loaded(page)

    # Both values invalid -> falls back to default for both positions
    expect_prefixed_markdown(page, "Bound color range:", "('orange', 'indigo')")
    # Default value should not remain in URL
    expect(page).not_to_have_url(re.compile(r"[?&]bound_color_range="))


def test_select_slider_query_param_empty_value_rejected(page: Page, app_base_url: str):
    """Test that empty URL param is rejected for non-clearable select_slider."""
    page.goto(build_app_url(app_base_url, query={"bound_color": ""}))
    wait_for_app_loaded(page)

    # Should use default ("green")
    expect_prefixed_markdown(page, "Bound color:", "green")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_color="))
