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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expect_help_tooltip,
    expect_markdown,
    get_element_by_key,
    get_radio,
    get_radio_option,
    select_radio_option,
)


def test_radio_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Render radios and snapshot by label/key (no index-based selection)."""
    expect(themed_app.get_by_test_id("stRadio")).to_have_count(17)

    assert_snapshot(get_radio(themed_app, "radio 1 (default)"), name="st_radio-default")
    assert_snapshot(
        get_radio(themed_app, "radio 2 (Formatted options)"),
        name="st_radio-formatted_options",
    )
    assert_snapshot(
        get_radio(themed_app, "radio 3 (no options)"), name="st_radio-no_options"
    )
    assert_snapshot(
        get_radio(themed_app, "radio 4 (disabled)"), name="st_radio-disabled"
    )
    assert_snapshot(
        get_radio(themed_app, "radio 5 (horizontal)"), name="st_radio-horizontal"
    )
    assert_snapshot(
        get_radio(themed_app, "radio 6 (options from dataframe)"),
        name="st_radio-dataframe_options",
    )
    assert_snapshot(
        get_element_by_key(themed_app, "radio_7"), name="st_radio-hidden_label"
    )
    assert_snapshot(
        get_element_by_key(themed_app, "radio_8"), name="st_radio-collapsed_label"
    )
    assert_snapshot(
        get_radio(themed_app, "radio 9 (markdown options)"),
        name="st_radio-markdown_options",
    )
    assert_snapshot(
        get_radio(themed_app, "radio 10 (with captions)"), name="st_radio-captions"
    )
    assert_snapshot(
        get_radio(themed_app, "radio 11 (horizontal, captions)"),
        name="st_radio-horizontal_captions",
    )
    assert_snapshot(
        get_radio(themed_app, "radio 12 (with callback, help)"),
        name="st_radio-callback_help",
    )
    assert_snapshot(
        get_radio(themed_app, "radio 13 (empty selection)"),
        name="st_radio-empty_selection",
    )
    assert_snapshot(
        get_radio(themed_app, re.compile(r"^radio 14")), name="st_radio-markdown_label"
    )


def test_radio_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test width examples via label targeting."""
    assert_snapshot(
        get_radio(app, "Radio with content width (default)"),
        name="st_radio-width_content",
    )
    assert_snapshot(
        get_radio(app, "Radio with stretch width"), name="st_radio-width_stretch"
    )
    assert_snapshot(
        get_radio(
            app,
            "Radio with 200px width. Label is too long to fit in the width",
        ),
        name="st_radio-width_200px",
    )


def test_help_tooltip_works(app: Page):
    element_with_help = get_radio(app, "radio 12 (with callback, help)")
    expect_help_tooltip(app, element_with_help, "help text")


def test_radio_has_correct_default_values(app: Page):
    """Verify initial markdown values using helper."""
    expect_markdown(app, "value 1: female")
    expect_markdown(app, "value 2: male")
    expect_markdown(app, "value 3: None")
    expect_markdown(app, "value 4: female")
    expect_markdown(app, "value 5: female")
    expect_markdown(app, "value 6: female")
    expect_markdown(app, "value 7: female")
    expect_markdown(app, "value 8: female")
    expect_markdown(app, "value 9: bold text")
    expect_markdown(app, "value 10: A")
    expect_markdown(app, "value 11: yes")
    expect_markdown(app, "value 12: male")
    expect_markdown(app, "radio changed: False")
    expect_markdown(app, "value 13: None")


def test_set_value_correctly_when_click(app: Page):
    """Change selections by user-visible labels and validate markdown values."""
    # radio 1 -> male
    select_radio_option(app, option=re.compile(r"^male$"), label="radio 1 (default)")

    # radio 2 already set to male; re-select to mimic previous behavior
    select_radio_option(
        app, option=re.compile(r"^Male$"), label="radio 2 (Formatted options)"
    )

    # radio 3 (no options) -> skip
    # radio 4 (disabled) -> skip

    # radio 5 -> male
    select_radio_option(app, option=re.compile(r"^male$"), label="radio 5 (horizontal)")

    # radio 6 -> male
    select_radio_option(
        app, option=re.compile(r"^male$"), label="radio 6 (options from dataframe)"
    )

    # radio 7 (hidden label) -> male via key
    get_radio_option(get_element_by_key(app, "radio_7"), re.compile(r"^male$")).click()
    wait_for_app_run(app)

    # radio 8 (collapsed label) -> male via key
    get_radio_option(get_element_by_key(app, "radio_8"), re.compile(r"^male$")).click()
    wait_for_app_run(app)

    # radio 9 (markdown options) -> italics text
    select_radio_option(app, option="italics text", label="radio 9 (markdown options)")

    # radio 10 (with captions) -> B (match at start to avoid caption text)
    select_radio_option(app, option=re.compile(r"^B"), label="radio 10 (with captions)")

    # radio 11 (horizontal, captions) -> maybe
    select_radio_option(app, option="maybe", label="radio 11 (horizontal, captions)")

    # radio 12 (with callback, help) -> keep as male (do not change)

    # radio changed -> remains False

    # radio 13 (empty selection) -> male
    select_radio_option(
        app, option=re.compile(r"^male$"), label="radio 13 (empty selection)"
    )

    # Verify expected markdowns
    expect_markdown(app, "value 1: male")
    expect_markdown(app, "value 2: male")
    expect_markdown(app, "value 3: None")
    expect_markdown(app, "value 4: female")
    expect_markdown(app, "value 5: male")
    expect_markdown(app, "value 6: male")
    expect_markdown(app, "value 7: male")
    expect_markdown(app, "value 8: male")
    expect_markdown(app, "value 9: italics text")
    expect_markdown(app, "value 10: B")
    expect_markdown(app, "value 11: maybe")
    expect_markdown(app, "value 12: male")
    expect_markdown(app, "radio changed: False")
    expect_markdown(app, "value 13: male")


def test_calls_callback_on_change(app: Page):
    """Verify callback behavior using label-based selection."""
    # Change radio 12 from male -> female
    select_radio_option(app, option="female", label="radio 12 (with callback, help)")

    expect_markdown(app, "value 12: female")
    expect_markdown(app, "radio changed: True")

    # Trigger delta path change via radio 1
    select_radio_option(app, option=re.compile(r"^male$"), label="radio 1 (default)")

    expect_markdown(app, "value 1: male")
    expect_markdown(app, "value 12: female")
    expect_markdown(app, "radio changed: False")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stRadio")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "radio12")).to_be_visible()
