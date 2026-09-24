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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    rerun_app,
    wait_for_app_loaded,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    click_toggle,
    expect_markdown,
    fill_number_input,
    get_element_by_key,
    get_number_input,
    get_text_input,
    select_selectbox_option,
)
from e2e_playwright.shared.theme_utils import apply_theme_via_window


def test_clicking_a_lot_still_keeps_state(app: Page):
    """Test the widget state is correctly handled on very fast clicks.

    Related to: https://github.com/streamlit/streamlit/issues/4836
    """
    number_input_down_button = (
        app.get_by_test_id("stNumberInput").get_by_test_id("stNumberInputStepUp").first
    )
    for _ in range(40):
        number_input_down_button.click()

    expect_markdown(app, "40")


def test_doesnt_save_widget_state_on_redisplay(app: Page):
    """Test that widget state is not saved when a widget is redisplayed
    after a rerun.

    Related to: https://github.com/streamlit/streamlit/issues/3512
    """
    click_checkbox(app, "Display widgets")
    click_checkbox(app, "Show hello")
    expect_markdown(app, "hello")

    # Hide widgets:
    click_checkbox(app, "Display widgets")

    # Show widgets again:
    click_checkbox(app, "Display widgets")

    # Should not show hello again -> the widget state was not saved
    markdown_el = app.get_by_test_id("stMarkdown").filter(has_text="hello")
    expect(markdown_el).not_to_be_attached()


def test_doesnt_save_widget_state_on_redisplay_with_keyed_widget(app: Page):
    """Keyed persist_state=None widgets reset on redisplay unless a user key was
    set before first mount. That stored default is adopted on delayed first
    mount and on remount after hide, not the last widget edit. An already-
    registered remount resets both the widget UI and st.session_state[key]
    in the same run.

    Related to: https://github.com/streamlit/streamlit/issues/3512
    Related to: https://github.com/streamlit/streamlit/issues/17093
    Related to: https://github.com/streamlit/streamlit/issues/9082
    Related to: https://github.com/streamlit/streamlit/issues/17119
    """
    click_checkbox(app, "Display widgets")
    click_checkbox(app, "Show goodbye")
    expect_markdown(app, "goodbye")

    # Hide widgets:
    click_checkbox(app, "Display widgets")

    # Show widgets again:
    click_checkbox(app, "Display widgets")

    # Should not show goodbye again -> the widget state was not saved
    markdown_el = app.get_by_test_id("stMarkdown").filter(has_text="goodbye")
    expect(markdown_el).not_to_be_attached()

    expect(get_text_input(app, "input 1").locator("input").first).to_have_value(
        "input 1"
    )
    expect(get_text_input(app, "input 2").locator("input").first).to_have_value(
        "input 2"
    )

    click_toggle(app, "Show foo")
    foo_input = get_number_input(app, "Foo").locator("input").first
    expect(foo_input).to_have_value("100.00")
    expect(foo_input).not_to_have_value("0.00")
    expect_markdown(app, "You entered: 100.0")

    rerun_app(app)
    expect(foo_input).to_have_value("100.00")
    expect_markdown(app, "You entered: 100.0")

    fill_number_input(app, "Foo", 5)
    expect(foo_input).to_have_value("5.00")
    click_toggle(app, "Show foo")
    expect(app.get_by_test_id("stNumberInput").filter(has_text="Foo")).to_have_count(0)
    click_toggle(app, "Show foo")
    foo_input = get_number_input(app, "Foo").locator("input").first
    expect(foo_input).to_have_value("100.00")
    expect(foo_input).not_to_have_value("5.00")

    select_selectbox_option(app, "select delayed input", "B")
    input3 = get_text_input(app, "input 3").locator("input").first
    expect(input3).to_have_value("input 3")
    expect(app.get_by_test_id("stTextInput").filter(has_text="input 2")).to_have_count(
        0
    )

    input3.fill("edited")
    input3.press("Enter")
    wait_for_app_run(app)
    expect(input3).to_have_value("edited")

    select_selectbox_option(app, "select delayed input", "A")
    input2 = get_text_input(app, "input 2").locator("input").first
    expect(input2).to_have_value("")
    expect(input2).not_to_have_value("input 2")
    expect_markdown(app, "input2 state: ''")

    select_selectbox_option(app, "select delayed input", "B")
    input3 = get_text_input(app, "input 3").locator("input").first
    expect(input3).to_have_value("input 3")
    expect(input3).not_to_have_value("edited")


# Skip webkit since the test is flaky there. It seems like the setTimeout wrapper for
# trigger-values in WidgetStateManager.ts is not working correctly; but I cannot
# reproduce it manually in Safari.
@pytest.mark.skip_browser("webkit")
def test_click_button_after_input_change_without_losing_focus_first(app: Page):
    """Test that the input value is correctly updated when clicking a button
    right after changing the input value without losing focus first.

    Related to: https://github.com/streamlit/streamlit/issues/10007
    """

    expect_markdown(app, "Input: ")

    text_area = app.get_by_test_id("stTextArea")
    text_area_field = text_area.locator("textarea").first
    new_text = "new text_area value"
    text_area_field.fill(new_text)

    click_button(app, "Submit text_area")

    expect_markdown(app, f"Input: {new_text}")


def test_show_widget_border_when_enabled(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test `showWidgetBorder=true` config option applies to expected widgets when widgets are enabled."""
    # Apply custom theme configs using window injection
    apply_theme_via_window(
        app, base="light", showWidgetBorder=True, borderColor="mediumSlateBlue"
    )

    # Reload to apply the theme
    app.reload()
    wait_for_app_loaded(app)

    # Get the widget container
    widget_container = get_element_by_key(app, "widget_container")
    assert_snapshot(
        widget_container, name="widget_state-show_widget_border_when_enabled"
    )


def test_show_widget_border_when_disabled(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test `showWidgetBorder=true` config option applies to expected widgets when widgets are disabled."""
    # Apply custom theme configs using window injection
    apply_theme_via_window(
        app, base="light", showWidgetBorder=True, borderColor="mediumSlateBlue"
    )

    # Reload to apply the theme
    app.reload()
    wait_for_app_loaded(app)

    # Disable widgets
    click_checkbox(app, "Disable widgets")

    # Get the widget container
    widget_container = get_element_by_key(app, "widget_container")
    assert_snapshot(
        widget_container, name="widget_state-show_widget_border_when_disabled"
    )
