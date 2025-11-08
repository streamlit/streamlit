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

import re

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    click_checkbox,
    click_form_button,
    click_toggle,
    expect_markdown,
    expect_prefixed_markdown,
    get_button_group,
    get_element_by_key,
    get_markdown,
)


def get_feedback_icon_buttons(locator: Locator, type: str | None = None) -> Locator:
    elements = locator.get_by_test_id(
        re.compile("stBaseButton-borderlessIcon(Active)?")
    )
    if type:
        elements = elements.filter(has_text=type)
    return elements


def get_feedback_icon_button(
    locator: Locator, type: str | None = None, index: int = 0
) -> Locator:
    return get_feedback_icon_buttons(locator, type).nth(index)


def test_click_thumbsup_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Create snapshot of thumbs feedback (enabled & disabled)."""

    container = get_element_by_key(themed_app, "thumbs_container")
    expect(container).to_be_attached()

    thumbs = get_button_group(themed_app, "thumbs_container")
    expect(thumbs).to_be_attached()
    get_feedback_icon_button(thumbs, "thumb_up").click()
    wait_for_app_run(themed_app)

    # Hover over the hover test feedback to show hover state
    hover_test_button = get_feedback_icon_button(
        get_button_group(themed_app, "thumbs_feedback_hover_test"), "thumb_down"
    )
    hover_test_button.hover()

    assert_snapshot(container, name="st_feedback-thumbs")


def test_clicking_on_faces_shows_sentiment_via_on_change_callback_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Create snapshot of faces feedback (enabled & disabled)."""

    container = get_element_by_key(themed_app, "faces_container")
    expect(container).to_be_attached()

    faces = get_button_group(themed_app, "faces_container")
    get_feedback_icon_button(faces, "sentiment_satisfied").click()
    wait_for_app_run(themed_app)
    text = get_markdown(themed_app, "Faces sentiment: 3")
    expect(text).to_be_attached()

    # Hover over the hover test feedback to show hover state
    hover_test_button = get_feedback_icon_button(
        get_button_group(themed_app, "faces_feedback_hover_test"),
        "sentiment_very_satisfied",
    )
    hover_test_button.hover()

    assert_snapshot(container, name="st_feedback-faces")


def test_clicking_on_stars_shows_sentiment_and_take_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Create snapshot of stars feedback (enabled & disabled)."""

    container = get_element_by_key(themed_app, "stars_container")
    expect(container).to_be_attached()

    stars = get_button_group(themed_app, "stars_container")
    get_feedback_icon_button(stars, "star", 3).click()
    wait_for_app_run(themed_app)
    text = get_markdown(themed_app, "Star sentiment: 3")
    expect(text).to_be_attached()

    # Hover over the hover test feedback to show hover state
    hover_test_button = get_feedback_icon_button(
        get_button_group(themed_app, "stars_feedback_hover_test"), "star", 4
    )
    hover_test_button.hover()

    assert_snapshot(container, name="st_feedback-stars")


def test_feedback_buttons_are_disabled(app: Page):
    """Test that feedback buttons are disabled when `disabled=True` and that
    they cannot be interacted with.
    """

    container = get_element_by_key(app, "stars_container")
    expect(container).to_be_attached()

    stars = get_button_group(app, "star_feedback_disabled")
    star_buttons = get_feedback_icon_buttons(stars)
    for star_button in star_buttons.all():
        expect(star_button).to_have_js_property("disabled", True)
    selected_button = star_buttons.nth(4)
    selected_button.click(force=True)
    expect(selected_button).not_to_have_css(
        "color", re.compile("rgb\\(\\d+, \\d+, \\d+\\)")
    )
    # the feedback value was set to 3 via session state
    text = get_markdown(app, "feedback-disabled: 3")
    expect(text).to_be_attached()


def test_pass_default_selections(app: Page):
    """Test that passed defaults are rendered correctly."""
    expect_markdown(app, "Star sentiment: None")

    click_checkbox(app, "Set default value")
    expect_markdown(app, "Star sentiment: 2")

    click_checkbox(app, "Set default value")
    expect_markdown(app, "Star sentiment: None")


def test_feedback_works_in_forms(app: Page):
    expect(app.get_by_text("feedback-in-form: None")).to_be_visible()

    container = app.get_by_test_id("stForm")
    expect(container).to_be_attached()

    thumbs = get_button_group(app, "feedback_in_form")
    get_feedback_icon_button(thumbs, "thumb_up").click()
    expect(app.get_by_text("feedback-in-form: None")).to_be_visible()
    click_form_button(app, "Submit")
    wait_for_app_run(app)

    text = get_markdown(app, "feedback-in-form: 1")
    expect(text).to_be_attached()


def test_feedback_works_with_fragments(app: Page):
    expect(app.get_by_text("Runs: 1")).to_be_visible()
    expect(app.get_by_text("feedback-in-fragment: None")).to_be_visible()

    thumbs = get_button_group(app, "fragment_feedback")
    get_feedback_icon_button(thumbs, "thumb_up").click()
    wait_for_app_run(app)

    expect(app.get_by_text("feedback-in-fragment: 1")).to_be_visible()
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_feedback_remount_keep_value(app: Page):
    """Test that `st.feedback` remounts correctly without resetting value."""

    expect(app.get_by_text("feedback-after-sleep: None")).to_be_visible()

    thumbs = get_button_group(app, "after_sleep_feedback")
    selected_button = get_feedback_icon_button(thumbs, "thumb_up")
    selected_button.click()
    wait_for_app_run(app)
    expect(app.get_by_text("feedback-after-sleep: 1")).to_be_visible()
    expect(selected_button).to_have_css(
        "color", re.compile("rgb\\(\\d+, \\d+, \\d+\\)")
    )
    click_button(app, "Create some elements to unmount component")
    expect(selected_button).to_have_css(
        "color", re.compile("rgb\\(\\d+, \\d+, \\d+\\)")
    )
    expect(app.get_by_text("feedback-after-sleep: 1")).to_be_visible()


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""

    check_top_level_class(app, "stButtonGroup")


def test_custom_css_class_via_key(app: Page):
    """Test that the element can have a custom css class via the key argument."""

    expect(get_element_by_key(app, "faces_feedback")).to_be_visible()


def test_feedback_width_examples(app: Page, assert_snapshot: ImageCompareFunction):
    """Test feedback widgets with different width configurations."""

    # Test thumbs width examples
    thumbs_content = get_element_by_key(app, "thumbs_content_width")
    assert_snapshot(thumbs_content, name="st_feedback-thumbs_width_content")

    thumbs_stretch = get_element_by_key(app, "thumbs_stretch_width")
    assert_snapshot(thumbs_stretch, name="st_feedback-thumbs_width_stretch")

    thumbs_300px = get_element_by_key(app, "thumbs_300px_width")
    assert_snapshot(thumbs_300px, name="st_feedback-thumbs_width_300px")


def test_dynamic_feedback_props(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that the feedback can be updated dynamically while keeping the state."""
    feedback_widget = get_button_group(app, "dynamic_feedback_widget")
    expect(feedback_widget).to_be_visible()

    # Initial state
    assert_snapshot(feedback_widget, name="st_feedback-dynamic_initial")
    expect_prefixed_markdown(app, "Initial feedback value:", "2")

    # Click to change selection
    get_feedback_icon_button(feedback_widget, None, 3).click()

    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Initial feedback value:", "3")

    # Update props via toggle
    click_toggle(app, "Update feedback props")

    # Value persisted
    expect_prefixed_markdown(app, "Updated feedback value:", "3")

    feedback_widget.scroll_into_view_if_needed()
    assert_snapshot(feedback_widget, name="st_feedback-dynamic_updated")

    # Click a different value
    get_feedback_icon_button(feedback_widget, None, 4).click()

    wait_for_app_run(app)
    expect_prefixed_markdown(app, "Updated feedback value:", "4")
