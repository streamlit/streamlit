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

from typing import Final

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import check_top_level_class, get_expander

EXPANDER_HEADER_IDENTIFIER = "summary"

NUMBER_OF_EXPANDERS: Final = 14


def test_expander_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that all expanders are displayed correctly via screenshot testing."""
    expander_elements = themed_app.get_by_test_id("stExpander")
    expect(expander_elements).to_have_count(NUMBER_OF_EXPANDERS)

    for expander in expander_elements.all():
        expect(expander.locator(EXPANDER_HEADER_IDENTIFIER).first).to_be_visible()

    assert_snapshot(expander_elements.nth(0), name="st_expander-sidebar_collapsed")
    assert_snapshot(expander_elements.nth(1), name="st_expander-normal_expanded")
    assert_snapshot(expander_elements.nth(2), name="st_expander-normal_collapsed")
    assert_snapshot(expander_elements.nth(3), name="st_expander-with_input")
    assert_snapshot(expander_elements.nth(4), name="st_expander-long_expanded")
    assert_snapshot(expander_elements.nth(5), name="st_expander-long_collapsed")
    assert_snapshot(expander_elements.nth(6), name="st_expander-with_material_icon")
    assert_snapshot(expander_elements.nth(7), name="st_expander-with_emoji_icon")
    assert_snapshot(expander_elements.nth(8), name="st_expander-markdown_label")
    assert_snapshot(expander_elements.nth(9), name="st_expander-nested")
    assert_snapshot(expander_elements.nth(11), name="st_expander-fixed_width")
    assert_snapshot(expander_elements.nth(12), name="st_expander-stretch_width")


def test_expander_collapses_and_expands(app: Page):
    """Test that an expander collapses and expands."""

    # Check that content is initially visible (starts expanded)
    expanded_expander = get_expander(app, "Normal expanded")
    expect(expanded_expander.get_by_text("I can collapse")).to_be_visible()

    # Click header to close it and check that content is no longer visible
    expander_header = expanded_expander.locator(EXPANDER_HEADER_IDENTIFIER)
    expander_header.click()
    expect(expanded_expander.get_by_text("I can collapse")).not_to_be_visible()

    # Click header again to expand it and check that content is visible again
    expander_header.click()
    expect(expanded_expander.get_by_text("I can collapse")).to_be_visible()


def test_empty_expander_rendered(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that an empty expander is rendered."""
    empty_expander = get_expander(app, "Empty")
    expect(empty_expander).to_be_visible()

    assert_snapshot(empty_expander, name="st_expander-empty")


def test_expander_session_state_set(app: Page):
    """Test that session state updates are propagated to expander content."""
    main_container = app.get_by_test_id("stMain")
    main_expanders = main_container.get_by_test_id("stExpander")
    expect(main_expanders).to_have_count(NUMBER_OF_EXPANDERS - 1)

    # Show the Number Input
    number_input_expander = get_expander(app, "With number input")
    num_input = number_input_expander.get_by_test_id("stNumberInput").locator("input")
    num_input.fill("10")
    num_input.press("Enter")
    wait_for_app_run(app)

    # Hide the Number Input
    number_input_expander.locator(EXPANDER_HEADER_IDENTIFIER).click()

    app.get_by_text("Update Num Input").click()
    wait_for_app_run(app)

    app.get_by_text("Print State Value").click()
    wait_for_app_run(app)

    text_elements = app.get_by_test_id("stText")
    expect(text_elements).to_have_count(2)

    expect(text_elements.nth(0)).to_have_text("0.0", use_inner_text=True)
    expect(text_elements.nth(1)).to_have_text("0.0", use_inner_text=True)


def test_expander_renders_icon(app: Page):
    """Test that an expander renders a material icon and an emoji icon."""
    material_icon = get_expander(app, "Material icon").get_by_test_id("stExpanderIcon")
    expect(material_icon).to_be_visible()
    expect(material_icon).to_have_text("bolt")

    emoji_icon = get_expander(app, "Emoji icon").get_by_test_id("stExpanderIcon")
    expect(emoji_icon).to_be_visible()
    expect(emoji_icon).to_have_text("🎈")


def test_expander_hover_states(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that expander hover states render correctly via snapshots."""
    # Test hover on normal collapsed expander
    normal_expander = get_expander(themed_app, "Normal collapsed")
    normal_expander.locator("summary").hover()
    assert_snapshot(normal_expander, name="st_expander-normal_collapsed_hover")

    # Test hover on collapsed expander with material icon
    material_expander = get_expander(themed_app, "Material icon")
    material_expander.locator("summary").hover()
    assert_snapshot(material_expander, name="st_expander-material_icon_collapsed_hover")

    # Test hover on expanded expander
    expanded_expander = get_expander(themed_app, "Normal expanded")
    expanded_expander.locator("summary").hover()
    assert_snapshot(expanded_expander, name="st_expander-expanded_hover")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stExpander")
