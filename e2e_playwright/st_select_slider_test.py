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

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import expect_help_tooltip


def test_select_slider_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    st_select_sliders = themed_app.get_by_test_id("stSlider")
    expect(st_select_sliders).to_have_count(11)

    assert_snapshot(
        st_select_sliders.nth(0),
        name="st_select_slider-regular_with_help_and_format_func",
    )
    assert_snapshot(st_select_sliders.nth(4), name="st_select_slider-disabled")
    assert_snapshot(st_select_sliders.nth(5), name="st_select_slider-hidden_label")
    assert_snapshot(st_select_sliders.nth(6), name="st_select_slider-label_collapsed")


def test_help_tooltip_works(app: Page):
    element_with_help = app.get_by_test_id("stSlider").nth(0)
    expect_help_tooltip(app, element_with_help, "Help in a select slider")


def test_select_slider_contains_correct_format_func_value_and_in_session_state(
    app: Page,
):
    expect(app.get_by_text("Value 1: ('orange', 'blue')")).to_have_count(2)
    first_slider = app.get_by_test_id("stSlider").nth(0)
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
    first_slider = app.get_by_test_id("stSlider").nth(0)
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
    slider = app.get_by_test_id("stSlider").nth(7)
    slider.hover()
    # click in middle
    app.mouse.down()

    wait_for_app_run(app)
    expect(app.get_by_text("Hello world")).to_be_visible()
    expect(app.get_by_text("Value 8: 3")).to_be_visible()
    expect(app.get_by_text("Select slider changed: True")).to_be_visible()


def test_select_slider_label_realigns_when_expander_opens(app: Page):
    app.get_by_test_id("stExpander").locator("summary").click()
    app.get_by_test_id("stExpander").locator("summary").click()
    expect(app.get_by_test_id("stSliderThumbValue").nth(11)).not_to_have_css(
        "left", "0px"
    )


def test_select_slider_works_in_forms(app: Page):
    expect(app.get_by_text("select_slider-in-form selection: 1")).to_be_visible()
    slider = app.get_by_test_id("stSlider").nth(9)
    slider.hover()
    # click in middle
    app.mouse.down()

    # The value is not submitted so the value should not have changed yet
    expect(app.get_by_text("select_slider-in-form selection: 1")).to_be_visible()

    # need to wait for the actual component value to update and then submit
    app.wait_for_timeout(200)
    app.get_by_test_id("baseButton-secondaryFormSubmit").click()
    wait_for_app_run(app)

    expect(app.get_by_text("select_slider-in-form selection: 3")).to_be_visible()


def test_select_slider_works_with_fragments(app: Page):
    expect(app.get_by_text("Runs: 1")).to_be_visible()
    expect(app.get_by_text("select_slider-in-fragment selection: 1")).to_be_visible()
    slider = app.get_by_test_id("stSlider").nth(10)
    slider.hover()
    # click in middle
    app.mouse.down()

    wait_for_app_run(app)
    expect(app.get_by_text("select_slider-in-fragment selection: 3")).to_be_visible()
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    expect(app.get_by_test_id("stSlider").first).to_have_class("stSlider")
