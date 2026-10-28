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

from playwright.sync_api import FloatRect, Locator, Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    rerun_app,
    wait_for_app_loaded,
    wait_for_app_run,
    wait_until,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_toggle,
    expect_help_tooltip,
    expect_markdown,
    expect_prefixed_markdown,
    get_element_by_key,
    get_radio,
    get_radio_option,
    reset_hovering,
    select_radio_option,
)

NUM_RADIO_ELEMENTS = 28


def test_radio_widget_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Render radios and snapshot by label/key (no index-based selection)."""
    expect(themed_app.get_by_test_id("stRadio")).to_have_count(NUM_RADIO_ELEMENTS)

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
    assert_snapshot(get_radio(themed_app, "radio 16 (cards)"), name="st_radio-cards")
    assert_snapshot(
        get_radio(themed_app, "radio 17 (cards, horizontal, stretch)"),
        name="st_radio-cards_horizontal",
    )


def test_radio_option_hover(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot hover on an unselected radio option.

    Hovers the unselected option so the selected option's primary fill cannot be
    mistaken for the hover style.
    """
    radio = get_radio(themed_app, "radio 1 (default)")
    # Exact match: has_text="male" also matches the selected "female" option.
    unselected = get_radio_option(radio, re.compile(r"^male$"))

    reset_hovering(themed_app)
    expect(radio.locator("[data-hovered]")).to_have_count(0)

    unselected.hover()
    expect(unselected).to_have_attribute("data-hovered", "true")
    assert_snapshot(radio, name="st_radio-option_hover")


def test_radio_cards_states(app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot disabled cards, and keyboard focus plus hover on unselected cards."""
    assert_snapshot(
        get_radio(app, "radio 18 (cards, disabled)"), name="st_radio-cards_disabled"
    )

    radio = get_radio(app, "radio 19 (cards, horizontal, empty)")
    light = get_radio_option(radio, "Light")
    system = get_radio_option(radio, "System")

    # Moving focus with the keyboard shows the focus ring; focusing the input
    # directly would not count as keyboard focus.
    light.get_by_role("radio").focus()
    app.keyboard.press("Shift+Tab")
    app.keyboard.press("Tab")
    expect(light).to_have_attribute("data-focus-visible", "true")
    system.hover()
    expect(system).to_have_attribute("data-hovered", "true")
    # Neither focus nor hover selects a card.
    expect(radio.get_by_role("radio", checked=True)).to_have_count(0)
    assert_snapshot(radio, name="st_radio-cards_states")


def _card_boxes(radio: Locator) -> list[FloatRect]:
    """Return the bounding box of each card in a radio group."""
    boxes = []
    for card in radio.get_by_test_id("stRadioOption").all():
        box = card.bounding_box()
        assert box is not None
        boxes.append(box)
    return boxes


def _assert_within_1px(values: list[float]) -> None:
    """Assert that the values differ by at most 1px."""
    assert max(values) - min(values) <= 1, values


def test_radio_cards_behavior(app: Page):
    """Cards keep radio semantics, select on a caption click, and wrap cleanly."""
    cards = get_radio(app, "radio 16 (cards)")

    # The caption sits inside the card but stays out of the accessible name.
    expect(cards).to_match_aria_snapshot(
        """
        - radiogroup "radio 16 (cards)":
          - radio "Starter"
          - radio "Pro" [checked]
          - radio "Enterprise"
        """
    )
    enterprise = cards.get_by_role("radio", name="Enterprise")
    expect(enterprise).to_have_accessible_description("Advanced controls and support.")

    # The whole card is the click target, caption included.
    cards.get_by_text("Advanced controls and support.").click()
    expect(enterprise).to_be_checked()
    expect_markdown(app, "value 16: Enterprise")
    expect(cards.get_by_role("radio", name="Pro")).not_to_be_checked()

    # Arrow keys move the selection between cards, as in the default style.
    empty = get_radio(app, "radio 19 (cards, horizontal, empty)")
    get_radio_option(empty, "Light").click()
    expect_markdown(app, "value 19: Light")
    app.keyboard.press("ArrowRight")
    expect_markdown(app, "value 19: Dark")
    expect(empty.get_by_role("radio", name="Light")).not_to_be_checked()

    # Disabled cards ignore clicks. `force` skips Playwright's wait for the
    # disabled input, so the click really lands on the card.
    disabled = get_radio(app, "radio 18 (cards, disabled)")
    expect(disabled.get_by_role("radio", name="Monthly")).to_be_disabled()
    get_radio_option(disabled, "Monthly").click(force=True)
    expect(disabled.get_by_role("radio", name="Lifetime")).to_be_checked()
    expect_markdown(app, "value 18: Lifetime")

    # Layout reads don't auto-wait like `expect`, so `wait_until` retries the
    # checks below until they pass.
    # Vertical and stretch-width cards have equal widths. Cards in a row share
    # that row's height, whatever their captions; content-width cards keep
    # their own widths.
    stretch = get_radio(app, "radio 17 (cards, horizontal, stretch)")

    def assert_equal_card_sizes() -> None:
        _assert_within_1px([box["width"] for box in _card_boxes(cards)])
        stretch_boxes = _card_boxes(stretch)
        _assert_within_1px([box["width"] for box in stretch_boxes])
        for boxes in (stretch_boxes, _card_boxes(empty)):
            _assert_within_1px([box["height"] for box in boxes])
            _assert_within_1px([box["y"] for box in boxes])

    wait_until(app, assert_equal_card_sizes)

    # In a narrow column, content-width cards wrap into more rows instead of
    # shrinking, so no title breaks onto a second line.
    narrow = get_radio(app, "radio 20 (cards, horizontal, narrow column)")

    def assert_cards_wrap_with_one_line_titles() -> None:
        assert len({round(box["y"]) for box in _card_boxes(narrow)}) > 1
        for title in ("Small", "Medium", "Large"):
            lines = narrow.get_by_text(title, exact=True).evaluate(
                "el => el.getBoundingClientRect().height"
                " / parseFloat(getComputedStyle(el).lineHeight)"
            )
            assert round(lines) == 1, (title, lines)

    wait_until(app, assert_cards_wrap_with_one_line_titles)

    # The whole card is clickable, so a caption link shows as plain text.
    expect(narrow.get_by_text("size guide", exact=False)).to_be_visible()
    expect(narrow.get_by_role("link")).to_have_count(0)


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


def test_captions_are_option_descriptions_not_labels(app: Page):
    """Captions reach assistive tech as descriptions, not as part of the name."""
    with_captions = get_radio(app, "radio 10 (with captions)")

    # The accessible name is the option text alone. Captions also render as
    # sibling nodes, which this snapshot deliberately leaves unpinned: the
    # contract under test is the names, not how caption markdown nests.
    expect(with_captions).to_match_aria_snapshot(
        """
        - radiogroup "radio 10 (with captions)":
          - radio "A" [checked]
          - radio "B"
          - radio "C"
          - radio "D"
          - radio "E"
          - radio "F"
          - radio "G"
        """
    )

    # The caption is reachable instead through aria-describedby.
    option_a = get_radio_option(with_captions, "A").get_by_role("radio")
    caption_a = with_captions.get_by_test_id("stRadioCaption").filter(
        has_text="bold text"
    )
    expect(caption_a).to_have_text("bold text")
    expect(caption_a).to_have_attribute("id", re.compile(r"\S"))
    caption_id = caption_a.get_attribute("id")
    assert caption_id is not None  # narrowed for the type checker
    # Match the caption's id as one entry rather than the whole value, so a
    # group-level description added later cannot break this.
    expect(option_a).to_have_attribute(
        "aria-describedby", re.compile(rf"(^|\s){re.escape(caption_id)}(\s|$)")
    )

    # An empty caption must not point the description at blank content.
    horizontal = get_radio(app, "radio 11 (horizontal, captions)")
    # "maybe" is the option whose caption is "".
    no_caption = get_radio_option(horizontal, "maybe").get_by_role("radio")
    expect(no_caption).not_to_have_attribute("aria-describedby")

    # A sibling in the same group still gets one, so the check above is not just
    # observing a group-wide absence.
    with_caption = get_radio_option(horizontal, "yes").get_by_role("radio")
    expect(with_caption).to_have_attribute("aria-describedby", re.compile(r"\S"))

    # The caption is not a click target: it is supplementary text outside the
    # label, so clicking it must leave the selection alone. Assert the input's
    # checked state, not the written value: a regression would trigger a rerun,
    # during which the value still reads "A".
    option_b = get_radio_option(with_captions, "B").get_by_role("radio")
    with_captions.get_by_text("italics text").click()
    expect(option_b).not_to_be_checked()
    expect(option_a).to_be_checked()

    # Clicking the label right above it does select, which proves the page was
    # live and the caption click was ignored rather than merely not seen yet.
    get_radio_option(with_captions, "B").click()
    wait_for_app_run(app)
    expect(option_b).to_be_checked()

    # Caption links stay navigable because captions sit outside the option label,
    # where React Aria cancels clicks. Assert the click survives uncancelled
    # rather than the href, which would pass even when navigation is blocked.
    # Reads defaultPrevented on document, after React's delegated handlers, then
    # suppresses the navigation itself — the same trick st_link_button_test.py
    # uses to avoid flaky popups.
    caption_link = with_captions.get_by_test_id("stRadioCaption").get_by_role(
        "link", name="link text"
    )
    # Seeded so a probe that never runs is distinguishable from a cancelled click.
    app.evaluate("() => { window.__captionLinkPrevented = 'listener never fired' }")
    app.evaluate(
        "() => document.addEventListener('click', e => {"
        "  window.__captionLinkPrevented = e.defaultPrevented;"
        "  e.preventDefault();"
        "}, {once: true})"
    )
    caption_link.click()
    assert app.evaluate("() => window.__captionLinkPrevented") is False

    # Caption and option text are both selectable: neither carries a user-select
    # rule. Check option A, not the B just clicked — react-aria's usePress sets
    # `user-select: none` inline on a pressed label and clears it after pointer-up.
    expect(caption_a).not_to_have_css("user-select", "none")
    expect(get_radio_option(with_captions, "A")).not_to_have_css("user-select", "none")


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
    expect_markdown(app, "value 15: 1")


def test_radio_custom_class_format_func_persists_after_rerun(app: Page):
    """Regression #14814: non-default radio with format_func must survive rerun."""
    select_radio_option(
        app,
        option="Option B",
        label="radio 15 (custom class format_func, gh-14814)",
    )
    wait_for_app_run(app)
    expect_markdown(app, "value 15: 2")

    rerun_app(app)
    expect_markdown(app, "value 15: 2")


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

    # radio 10 (with captions) -> B
    select_radio_option(app, option="B", label="radio 10 (with captions)")

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
    expect_markdown(app, "value 15: 1")


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
    expect_markdown(app, "value 15: 1")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stRadio")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""
    expect(get_element_by_key(app, "radio12")).to_be_visible()


def test_dynamic_radio_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the radio can be updated dynamically while keeping the state.

    This tests that:
    1. Options can be changed dynamically when a key is provided
    2. Format function can be changed dynamically
    3. Selection resets to default when selected value is removed from options
    4. Selection is preserved when the selected value exists in new options

    Note: When using dynamic options with a key, the selection is preserved only
    if the formatted value (after applying format_func) exists in the new options.

    Initial options: [apple, banana, mango, orange] with format_func=capitalize, index=0 (default: apple)
    Updated options: [mango, papaya, grape, apple] with format_func=capitalize, index=1 (default: papaya)
    """
    dynamic_radio = get_element_by_key(app, "dynamic_radio_with_key")
    expect(dynamic_radio).to_be_visible()

    # Initial state
    expect(dynamic_radio).to_contain_text("Initial dynamic radio")
    expect_prefixed_markdown(app, "Initial radio value:", "apple")
    assert_snapshot(dynamic_radio, name="st_radio-dynamic_initial")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_radio, "initial help")

    # --- Test 1: Selection RESETS when value is removed from options ---
    # Select "banana" (only exists in initial options, NOT in updated)
    select_radio_option(app, option="Banana", label="Initial dynamic radio")
    expect_prefixed_markdown(app, "Initial radio value:", "banana")

    # Toggle to update props - options change from [apple, banana, mango, orange]
    # to [mango, papaya, grape, apple]. "banana" is NOT in updated options.
    click_toggle(app, "Update radio props")

    # Updated radio is visible
    expect(dynamic_radio).to_contain_text("Updated dynamic radio")

    # Selection should RESET to "papaya" (default at index=1) since "banana" is not in updated options
    expect_prefixed_markdown(app, "Updated radio value:", "papaya")
    # Negative assertion: ensure "banana" is NOT selected after toggle (regression check)
    expect(dynamic_radio).not_to_contain_text("Banana")

    dynamic_radio.scroll_into_view_if_needed()
    assert_snapshot(dynamic_radio, name="st_radio-dynamic_updated")

    # Check that the help tooltip is correct:
    expect_help_tooltip(app, dynamic_radio, "updated help")

    # --- Test 2: Selection PRESERVED when value exists in both option sets ---
    # Select "mango" - it exists in BOTH option sets at different indices:
    # Initial: index 2 (displayed "Mango"), Updated: index 0 (displayed "Mango")
    # Neither is the default. This ensures we're testing true preservation.
    select_radio_option(app, option="Mango", label="Updated dynamic radio")
    expect_prefixed_markdown(app, "Updated radio value:", "mango")

    # Toggle back to initial options - "mango" exists in initial too
    click_toggle(app, "Update radio props")
    expect(dynamic_radio).to_contain_text("Initial dynamic radio")

    # Selection should be PRESERVED since "mango" is in both option sets
    # If this was reset, it would show "apple" (initial default), not "mango"
    expect_prefixed_markdown(app, "Initial radio value:", "mango")


# --- Query param binding tests ---


def test_radio_query_param_seeding(page: Page, app_port: int):
    """Test that radio value can be seeded from URL query params."""
    page.goto(f"http://localhost:{app_port}/?bound_radio=dog")
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "bound radio value:", "dog")
    # Guard against cross-widget pollution
    expect(page).not_to_have_url(re.compile(r"[?&]bound_radio_fmt="))
    expect(page).not_to_have_url(re.compile(r"[?&]bound_radio_clear="))


def test_radio_query_param_updates_url(app: Page):
    """Test that changing a bound radio updates the URL."""
    select_radio_option(app, option="dog", label="Bound radio")
    wait_for_app_run(app)

    expect(app).to_have_url(re.compile(r"[?&]bound_radio=dog"))
    expect_prefixed_markdown(app, "bound radio value:", "dog")


def test_radio_query_param_default_override(page: Page, app_port: int):
    """Test radio with query param: seed then revert to default clears param."""
    page.goto(f"http://localhost:{app_port}/?bound_radio=bird")
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "bound radio value:", "bird")

    # Change back to default ("cat", index 0)
    select_radio_option(page, option="cat", label="Bound radio")
    wait_for_app_run(page)

    # Query param should be removed since value is back to default
    expect(page).not_to_have_url(re.compile(r"[?&]bound_radio="))
    expect_prefixed_markdown(page, "bound radio value:", "cat")


def test_radio_query_param_invalid_value(page: Page, app_port: int):
    """Test that invalid URL values are cleared and widget uses default."""
    page.goto(f"http://localhost:{app_port}/?bound_radio=invalid_option")
    wait_for_app_loaded(page)

    # Widget should show default value ("cat"), invalid param should be cleared
    expect_prefixed_markdown(page, "bound radio value:", "cat")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_radio="))
    # Guard against cross-widget pollution
    expect(page).not_to_have_url(re.compile(r"[?&]bound_radio_fmt="))
    expect(page).not_to_have_url(re.compile(r"[?&]bound_radio_clear="))


def test_radio_query_param_format_func(page: Page, app_port: int):
    """Test that formatted option string works in URL."""
    # The format_func is str.upper, so options in URL are "CAT" and "DOG"
    page.goto(f"http://localhost:{app_port}/?bound_radio_fmt=DOG")
    wait_for_app_loaded(page)

    expect_prefixed_markdown(page, "bound radio fmt value:", "dog")


def test_radio_query_param_clearable_empty_value(page: Page, app_port: int):
    """Test that empty URL value clears a clearable radio to None."""
    page.goto(f"http://localhost:{app_port}/?bound_radio_clear=")
    wait_for_app_loaded(page)

    # Clearable radio should accept the empty value and show None
    expect_prefixed_markdown(page, "bound radio clear value:", "None")


def test_radio_query_param_clearable_invalid_value(page: Page, app_port: int):
    """Test that invalid value on clearable radio resets to None default."""
    page.goto(f"http://localhost:{app_port}/?bound_radio_clear=invalid")
    wait_for_app_loaded(page)

    # Invalid value should reset to default (None for clearable widget)
    expect_prefixed_markdown(page, "bound radio clear value:", "None")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_radio_clear="))


def test_radio_query_param_non_clearable_empty_value(page: Page, app_port: int):
    """Test that empty URL value is rejected for non-clearable radio."""
    page.goto(f"http://localhost:{app_port}/?bound_radio=")
    wait_for_app_loaded(page)

    # Non-clearable radio should reject empty value, show default "cat"
    expect_prefixed_markdown(page, "bound radio value:", "cat")
    expect(page).not_to_have_url(re.compile(r"[?&]bound_radio="))


def test_radio_on_change_ignore(app: Page):
    """Test that on_change='ignore' suppresses rerun, updates bound query params
    on commit, and sends the buffered value on the next rerun.
    """
    expect(app.get_by_text("Runs: 1", exact=True)).to_be_visible()
    expect_prefixed_markdown(app, "Ignore radio value:", "alpha")
    # Default is omitted from the URL.
    expect(app).not_to_have_url(re.compile(r"[?&]ignore_radio="))

    ignore_radio = get_radio(app, "Ignore change radio")

    # Choosing an option updates the URL without rerunning the app.
    select_radio_option(app, option="beta", label="Ignore change radio")

    # Catch a delayed rerun that select_radio_option's wait might miss.
    wait_for_app_run(app)

    expect(app.get_by_text("Runs: 1", exact=True)).to_be_visible()
    expect(app.get_by_text("Runs: 2", exact=True)).not_to_be_visible()
    expect(get_radio_option(ignore_radio, "beta").get_by_role("radio")).to_be_checked()
    expect_prefixed_markdown(app, "Ignore radio value:", "alpha")
    expect(app).to_have_url(re.compile(r"[?&]ignore_radio=beta"))

    # A later rerun should send the buffered value.
    app.get_by_role("button", name="Apply ignore radio", exact=True).click()
    wait_for_app_run(app)

    expect(app.get_by_text("Runs: 2", exact=True)).to_be_visible()
    expect(app.get_by_text("Ignore radio value: beta", exact=True)).to_be_visible()
    expect(
        app.get_by_text("Applied ignore radio value: beta", exact=True)
    ).to_be_visible()

    # Bound ignore-mode values persist across reload via the URL.
    app.reload()
    wait_for_app_loaded(app)
    expect(get_radio_option(ignore_radio, "beta").get_by_role("radio")).to_be_checked()
    expect_prefixed_markdown(app, "Ignore radio value:", "beta")
