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


def test_basic_breadcrumbs_display_and_click(app: Page) -> None:
    """Test breadcrumbs display, initial state, and click interactions."""
    breadcrumbs = get_element_by_key(app, "basic")

    # Verify all items are visible
    expect(breadcrumbs.get_by_text("Home")).to_be_visible()
    expect(breadcrumbs.get_by_text("Electronics")).to_be_visible()
    expect(breadcrumbs.get_by_text("Phones")).to_be_visible()
    expect(breadcrumbs.get_by_text("iPhone 15")).to_be_visible()

    # Verify initial state is None
    expect_markdown(app, "Basic clicked: None")

    # Verify last item is not clickable (only 3 buttons for 4 items)
    buttons = breadcrumbs.get_by_role("button")
    expect(buttons).to_have_count(3)

    # Click first item
    breadcrumbs.get_by_role("button", name="Home").click()
    wait_for_app_run(app)
    expect_markdown(app, "Basic clicked: Home")

    # Click middle item
    breadcrumbs.get_by_role("button", name="Electronics").click()
    wait_for_app_run(app)
    expect_markdown(app, "Basic clicked: Electronics")


def test_disabled_breadcrumbs(app: Page) -> None:
    """Test that disabled breadcrumbs do not respond to clicks."""
    breadcrumbs = get_element_by_key(app, "disabled")

    home_button = breadcrumbs.get_by_role("button", name="Home")
    home_button.click(force=True)
    wait_for_app_run(app)

    expect_markdown(app, "Disabled clicked: None")


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

    breadcrumbs.get_by_role("button", name="Users").click()
    wait_for_app_run(app)

    expect_markdown(app, "Navigate to: users.py")
