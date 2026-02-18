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

from __future__ import annotations

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import expect_text, get_multiselect


def _get_tags(app: Page, label: str) -> Locator:
    """Return all tag locators for a multiselect widget."""
    ms = get_multiselect(app, label)
    return ms.locator('[data-baseweb="tag"]')


def _get_tag_bg(tag: Locator) -> str:
    """Get the computed background color of a tag element."""
    return tag.evaluate("el => getComputedStyle(el).backgroundColor")


def test_color_snapshots(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Visual snapshot tests for all color configurations."""
    assert_snapshot(
        get_multiselect(themed_app, "single-named-color"),
        name="st_multiselect-color_single_named",
    )
    assert_snapshot(
        get_multiselect(themed_app, "single-hex-color"),
        name="st_multiselect-color_single_hex",
    )
    assert_snapshot(
        get_multiselect(themed_app, "single-rgb-color"),
        name="st_multiselect-color_single_rgb",
    )
    assert_snapshot(
        get_multiselect(themed_app, "per-option-colors"),
        name="st_multiselect-color_per_option",
    )
    assert_snapshot(
        get_multiselect(themed_app, "per-group-colors"),
        name="st_multiselect-color_per_group",
    )
    assert_snapshot(
        get_multiselect(themed_app, "no-color-baseline"),
        name="st_multiselect-color_none_baseline",
    )
    assert_snapshot(
        get_multiselect(themed_app, "color-with-accept-new"),
        name="st_multiselect-color_accept_new",
    )
    assert_snapshot(
        get_multiselect(themed_app, "color-disabled"),
        name="st_multiselect-color_disabled",
    )


def test_single_color_tags_have_custom_background(app: Page):
    """Tags with a single color should have a custom background style applied."""
    tags = _get_tags(app, "single-named-color")
    expect(tags).to_have_count(2)

    for tag in tags.all():
        bg = _get_tag_bg(tag)
        assert bg != "", "Tag should have a computed background color"
        assert bg != "rgba(0, 0, 0, 0)", "Tag background should not be transparent"


def test_per_option_colors_are_distinct(app: Page):
    """Each tag in per-option-colors should have a different background color."""
    tags = _get_tags(app, "per-option-colors")
    expect(tags).to_have_count(3)

    backgrounds = [_get_tag_bg(tag) for tag in tags.all()]

    assert len(set(backgrounds)) == 3, (
        f"Expected 3 distinct background colors, got: {backgrounds}"
    )


def test_per_group_colors_match_group_membership(app: Page):
    """Tags within the same group should share a color; different groups differ."""
    tags = _get_tags(app, "per-group-colors")
    expect(tags).to_have_count(4)

    backgrounds = [_get_tag_bg(tag) for tag in tags.all()]

    # Apple and Banana (Fruits) should share a color
    assert backgrounds[0] == backgrounds[1], (
        f"Fruits tags should share color: {backgrounds[0]} vs {backgrounds[1]}"
    )
    # Carrot and Pea (Vegetables) should share a color
    assert backgrounds[2] == backgrounds[3], (
        f"Vegetables tags should share color: {backgrounds[2]} vs {backgrounds[3]}"
    )
    # Fruits and Vegetables should differ
    assert backgrounds[0] != backgrounds[2], (
        f"Group colors should differ: Fruits={backgrounds[0]} vs Veggies={backgrounds[2]}"
    )


def test_no_color_baseline_uses_default_styling(app: Page):
    """Tags without a color parameter should not have custom background overrides."""
    tags = _get_tags(app, "no-color-baseline")
    expect(tags).to_have_count(2)

    colored_tags = _get_tags(app, "single-named-color")
    expect(colored_tags).to_have_count(2)

    baseline_bg = _get_tag_bg(tags.first)
    colored_bg = _get_tag_bg(colored_tags.first)

    assert baseline_bg != colored_bg, (
        f"Default tags should differ from colored tags: "
        f"baseline={baseline_bg}, colored={colored_bg}"
    )


def test_color_with_accept_new_options_user_tag(app: Page):
    """User-created tags via accept_new_options should not inherit the custom color."""
    ms = get_multiselect(app, "color-with-accept-new")
    input_el = ms.locator("input")

    existing_tags = _get_tags(app, "color-with-accept-new")
    expect(existing_tags).to_have_count(1)
    existing_bg = _get_tag_bg(existing_tags.first)

    # Add a new user-created option
    input_el.click()
    input_el.fill("Mango")
    input_el.press("Enter")
    wait_for_app_run(app)

    expect_text(app, "value 7: ['Apple', 'Mango']")

    tags = _get_tags(app, "color-with-accept-new")
    expect(tags).to_have_count(2)

    new_tag_bg = _get_tag_bg(tags.nth(1))
    assert new_tag_bg != existing_bg, (
        f"User-created tag should not have custom color: "
        f"existing={existing_bg}, new={new_tag_bg}"
    )


def test_color_selection_persists_after_interaction(app: Page):
    """Selecting a new option should preserve colors on existing tags."""
    ms = get_multiselect(app, "single-hex-color")

    tags = _get_tags(app, "single-hex-color")
    expect(tags).to_have_count(2)
    initial_bg = _get_tag_bg(tags.first)

    # Select a third option
    ms.locator("input").click()
    app.get_by_role("option", name="Cherry", exact=True).click()
    wait_for_app_run(app)

    expect_text(app, "value 2: ['Apple', 'Banana', 'Cherry']")

    tags = _get_tags(app, "single-hex-color")
    expect(tags).to_have_count(3)

    for tag in tags.all():
        bg = _get_tag_bg(tag)
        assert bg == initial_bg, (
            f"Tag color should persist after interaction: expected={initial_bg}, got={bg}"
        )
