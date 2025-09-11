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

import re

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_form_button,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    get_element_by_key,
    get_slider,
)


def test_slider_rendering(themed_app: Page, assert_snapshot: ImageCompareFunction):
    st_sliders = themed_app.get_by_test_id("stSlider")
    expect(st_sliders).to_have_count(24)

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


def test_help_tooltip_works(app: Page):
    element_with_help = get_slider(app, "Label 1")
    expect_help_tooltip(app, element_with_help, "This is some help tooltip!")


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


def test_using_arrow_keys_on_slider_produces_correct_values(app: Page):
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
    # click in middle
    app.mouse.down()

    # Move slider once to right
    app.keyboard.press("ArrowRight")
    wait_for_app_run(app)
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
