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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import expect_markdown, get_element_by_key


def test_basic_breadcrumbs_display_and_selection(app: Page) -> None:
    """Test breadcrumbs display, initial state (last item selected), and selection interactions."""
    breadcrumbs = get_element_by_key(app, "basic")

    # Verify all items are visible
    expect(breadcrumbs.get_by_text("Home")).to_be_visible()
    expect(breadcrumbs.get_by_text("Electronics")).to_be_visible()
    expect(breadcrumbs.get_by_text("Phones")).to_be_visible()
    expect(breadcrumbs.get_by_text("iPhone 15")).to_be_visible()

    # Verify initial state is last item selected (stateful widget)
    expect_markdown(app, "Basic selected: iPhone 15")

    # Verify last item is not clickable (only 3 buttons for 4 items)
    buttons = breadcrumbs.get_by_role("button")
    expect(buttons).to_have_count(3)

    # Click middle item
    breadcrumbs.get_by_role("button", name="Electronics").click()
    wait_for_app_run(app)
    expect_markdown(app, "Basic selected: Electronics")


def test_selected_item_becomes_non_clickable(app: Page) -> None:
    """Test that selecting a breadcrumb makes it non-clickable, others become clickable."""
    breadcrumbs = get_element_by_key(app, "basic")

    # Initially: 3 buttons (Home, Electronics, Phones) - last item is selected
    buttons = breadcrumbs.get_by_role("button")
    expect(buttons).to_have_count(3)

    # Click "Home" (first item)
    breadcrumbs.get_by_role("button", name="Home").click()
    wait_for_app_run(app)

    # Now "Home" is selected and non-clickable
    # Items after it (Electronics, Phones, iPhone 15) should be clickable
    buttons = breadcrumbs.get_by_role("button")
    expect(buttons).to_have_count(3)

    # Verify "Home" is no longer a button
    expect(breadcrumbs.get_by_role("button", name="Home")).to_have_count(0)

    # Verify items after "Home" are now clickable
    expect(breadcrumbs.get_by_role("button", name="Electronics")).to_be_visible()
    expect(breadcrumbs.get_by_role("button", name="Phones")).to_be_visible()
    expect(breadcrumbs.get_by_role("button", name="iPhone 15")).to_be_visible()

    # Click "Phones" (now a clickable item after selection changed)
    breadcrumbs.get_by_role("button", name="Phones").click()
    wait_for_app_run(app)
    expect_markdown(app, "Basic selected: Phones")

    # Now "Phones" is selected - Home and Electronics should be clickable
    expect(breadcrumbs.get_by_role("button", name="Home")).to_be_visible()
    expect(breadcrumbs.get_by_role("button", name="Electronics")).to_be_visible()
    expect(breadcrumbs.get_by_role("button", name="Phones")).to_have_count(0)
    expect(breadcrumbs.get_by_role("button", name="iPhone 15")).to_be_visible()


def test_disabled_breadcrumbs(app: Page) -> None:
    """Test that disabled breadcrumbs render as plain text and are non-interactive."""
    breadcrumbs = get_element_by_key(app, "disabled")

    # Disabled breadcrumbs should not render any clickable buttons
    buttons = breadcrumbs.get_by_role("button")
    expect(buttons).to_have_count(0)

    # Even disabled, initial selection should be last item (stateful)
    expect_markdown(app, "Disabled selected: Details")


def test_single_item_breadcrumbs(app: Page) -> None:
    """Test breadcrumbs with a single item has no clickable buttons."""
    breadcrumbs = get_element_by_key(app, "single")

    expect(breadcrumbs.get_by_text("Home")).to_be_visible()

    buttons = breadcrumbs.get_by_role("button")
    expect(buttons).to_have_count(0)


def test_breadcrumbs_with_icons(app: Page) -> None:
    """Test breadcrumbs with material icons display correctly."""
    breadcrumbs = get_element_by_key(app, "icons")

    expect(breadcrumbs.locator("span").filter(has_text="Home").last).to_be_visible()
    expect(breadcrumbs.locator("span").filter(has_text="Folder").last).to_be_visible()
    expect(breadcrumbs.locator("span").filter(has_text="Settings").last).to_be_visible()


def test_custom_objects(app: Page) -> None:
    """Test breadcrumbs with custom objects and format_func returns object values."""
    breadcrumbs = get_element_by_key(app, "objects")

    # Initially last item is selected
    expect_markdown(app, "Navigate to: detail.py")

    breadcrumbs.get_by_role("button", name="Users").click()
    wait_for_app_run(app)

    expect_markdown(app, "Navigate to: users.py")


def test_custom_text_separator(app: Page) -> None:
    """Test breadcrumbs with custom text separator."""
    breadcrumbs = get_element_by_key(app, "text_separator")

    # Verify items are visible
    expect(breadcrumbs.get_by_text("Home")).to_be_visible()
    expect(breadcrumbs.get_by_text("Section")).to_be_visible()

    # Verify custom separator " > " is displayed
    expect(breadcrumbs.get_by_text(" > ").first).to_be_visible()


def test_material_icon_separator(app: Page) -> None:
    """Test breadcrumbs with material icon separator."""
    breadcrumbs = get_element_by_key(app, "icon_separator")

    # Verify items are visible
    expect(breadcrumbs.get_by_text("Home")).to_be_visible()
    expect(breadcrumbs.get_by_text("Section")).to_be_visible()

    # Verify material icon separator is rendered (chevron_right icon)
    # The icon should be in the separator element
    separators = breadcrumbs.locator('[aria-hidden="true"]')
    expect(separators.first).to_be_visible()


def test_auto_truncate_on_selection(app: Page) -> None:
    """Test breadcrumbs that auto-truncate path when an item is clicked."""
    breadcrumbs = get_element_by_key(app, "truncate_breadcrumbs")

    # Initially all 4 items visible
    expect(breadcrumbs.get_by_text("Home")).to_be_visible()
    expect(breadcrumbs.get_by_text("Electronics")).to_be_visible()
    expect(breadcrumbs.get_by_text("Phones")).to_be_visible()
    expect(breadcrumbs.get_by_text("iPhone 15")).to_be_visible()

    # Verify initial path
    expect_markdown(
        app, "Truncate path: ['Home', 'Electronics', 'Phones', 'iPhone 15']"
    )

    # Click "Electronics" - should truncate to ["Home", "Electronics"]
    breadcrumbs.get_by_role("button", name="Electronics").click()
    wait_for_app_run(app)

    # Path should be truncated
    expect_markdown(app, "Truncate path: ['Home', 'Electronics']")

    # Only Home and Electronics should be visible now
    expect(breadcrumbs.get_by_text("Home")).to_be_visible()
    expect(breadcrumbs.get_by_text("Electronics")).to_be_visible()
    expect(breadcrumbs.get_by_text("Phones")).to_have_count(0)
    expect(breadcrumbs.get_by_text("iPhone 15")).to_have_count(0)

    # Click "Home" - should truncate to ["Home"]
    breadcrumbs.get_by_role("button", name="Home").click()
    wait_for_app_run(app)

    expect_markdown(app, "Truncate path: ['Home']")

    # Only Home should be visible
    expect(breadcrumbs.get_by_text("Home")).to_be_visible()
    expect(breadcrumbs.get_by_text("Electronics")).to_have_count(0)


def test_selection_parameter_by_value(app: Page) -> None:
    """Test breadcrumbs with selection parameter set by item value."""
    breadcrumbs = get_element_by_key(app, "selection_by_value")

    # Verify "Electronics" is selected (not clickable)
    expect(breadcrumbs.get_by_role("button", name="Electronics")).to_have_count(0)

    # Verify other items are clickable
    expect(breadcrumbs.get_by_role("button", name="Home")).to_be_visible()
    expect(breadcrumbs.get_by_role("button", name="Phones")).to_be_visible()
    expect(breadcrumbs.get_by_role("button", name="iPhone 15")).to_be_visible()

    # Verify selection value
    expect_markdown(app, "Selection by value: Electronics")


def test_selection_parameter_by_index(app: Page) -> None:
    """Test breadcrumbs with selection parameter set by index."""
    breadcrumbs = get_element_by_key(app, "selection_by_index")

    # Verify "Home" (index 0) is selected (not clickable)
    expect(breadcrumbs.get_by_role("button", name="Home")).to_have_count(0)

    # Verify other items are clickable
    expect(breadcrumbs.get_by_role("button", name="Electronics")).to_be_visible()
    expect(breadcrumbs.get_by_role("button", name="Phones")).to_be_visible()
    expect(breadcrumbs.get_by_role("button", name="iPhone 15")).to_be_visible()

    # Verify selection value
    expect_markdown(app, "Selection by index: Home")
