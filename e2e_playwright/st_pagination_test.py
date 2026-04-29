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
from e2e_playwright.shared.app_utils import (
    click_button,
    click_form_button,
    expect_markdown,
    get_element_by_key,
)


def get_pagination(page: Page, key: str) -> Locator:
    """Get pagination widget by its key."""
    container = get_element_by_key(page, key)
    return container.get_by_test_id("stPagination")


def get_prev_button(pagination: Locator) -> Locator:
    """Get the previous page button."""
    return pagination.get_by_test_id("stPaginationPrev")


def get_next_button(pagination: Locator) -> Locator:
    """Get the next page button."""
    return pagination.get_by_test_id("stPaginationNext")


def get_page_button(pagination: Locator, page_number: int) -> Locator:
    """Get a specific page button by its number."""
    return pagination.get_by_role("button", name=f"Page {page_number}", exact=True)


def test_basic_pagination_renders(app: Page):
    """Test that basic pagination renders correctly."""
    pagination = get_pagination(app, "basic")
    expect(pagination).to_be_visible()

    expect_markdown(app, "Current page: 1")

    # Verify prev is disabled on first page
    expect(get_prev_button(pagination)).to_be_disabled()
    expect(get_next_button(pagination)).not_to_be_disabled()


def test_pagination_with_default_page(app: Page):
    """Test pagination starts on the specified default page."""
    pagination = get_pagination(app, "with_default")
    expect(pagination).to_be_visible()

    expect_markdown(app, "Default page: 5")

    # Both prev and next should be enabled on middle page
    expect(get_prev_button(pagination)).not_to_be_disabled()
    expect(get_next_button(pagination)).not_to_be_disabled()


def test_navigation_via_next_button(app: Page):
    """Test navigation using the next button."""
    pagination = get_pagination(app, "basic")

    get_next_button(pagination).click()
    wait_for_app_run(app)

    expect_markdown(app, "Current page: 2")


def test_navigation_via_prev_button(app: Page):
    """Test navigation using the previous button."""
    pagination = get_pagination(app, "with_default")

    get_prev_button(pagination).click()
    wait_for_app_run(app)

    expect_markdown(app, "Default page: 4")


def test_navigation_via_page_button(app: Page):
    """Test navigation by clicking a specific page button."""
    pagination = get_pagination(app, "basic")

    # Use page 2 which is always visible regardless of responsive behavior
    get_page_button(pagination, 2).click()
    wait_for_app_run(app)

    expect_markdown(app, "Current page: 2")


def test_disabled_pagination(app: Page):
    """Test that disabled pagination cannot be interacted with."""
    pagination = get_pagination(app, "disabled")
    expect(pagination).to_be_visible()

    expect(get_prev_button(pagination)).to_be_disabled()
    expect(get_next_button(pagination)).to_be_disabled()


def test_single_page_pagination(app: Page):
    """Test pagination with only one page."""
    pagination = get_pagination(app, "single")
    expect(pagination).to_be_visible()

    expect_markdown(app, "Single page: 1")

    # Both buttons should be disabled with only one page
    expect(get_prev_button(pagination)).to_be_disabled()
    expect(get_next_button(pagination)).to_be_disabled()


def test_pagination_in_form(app: Page):
    """Test pagination works inside a form."""
    pagination = get_pagination(app, "form_pagination")
    expect(pagination).to_be_visible()

    # Navigate in the form
    get_next_button(pagination).click()
    wait_for_app_run(app)
    get_next_button(pagination).click()
    wait_for_app_run(app)

    # Submit the form
    click_form_button(app, "Submit")
    wait_for_app_run(app)

    expect_markdown(app, "Form submitted with page: 3")


def test_pagination_in_fragment(app: Page):
    """Test pagination works inside a fragment."""
    pagination = get_pagination(app, "fragment_pagination")
    expect(pagination).to_be_visible()

    get_next_button(pagination).click()
    wait_for_app_run(app)

    expect_markdown(app, "fragment-page: 2")


def test_pagination_callback(app: Page):
    """Test that on_change callback is triggered."""
    pagination = get_pagination(app, "callback_pagination")

    get_next_button(pagination).click()
    wait_for_app_run(app)

    expect_markdown(app, "callback-page: 2")


def test_pagination_session_state_control(app: Page):
    """Test controlling pagination via session state."""
    click_button(app, "Go to page 5")
    wait_for_app_run(app)

    expect_markdown(app, "controlled-page: 5")

    click_button(app, "Go to page 10")
    wait_for_app_run(app)

    expect_markdown(app, "controlled-page: 10")

    # Verify pagination UI reflects the change
    pagination = get_pagination(app, "controlled")
    expect(get_next_button(pagination)).to_be_disabled()


def test_pagination_snapshot_basic(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Take snapshot of basic pagination in light and dark modes."""
    container = get_element_by_key(themed_app, "basic_container")
    expect(container).to_be_attached()

    assert_snapshot(container, name="st_pagination-basic")


def test_pagination_snapshot_disabled(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Take snapshot of disabled pagination."""
    container = get_element_by_key(themed_app, "disabled_container")
    expect(container).to_be_attached()

    assert_snapshot(container, name="st_pagination-disabled")


def test_pagination_snapshot_max_visible(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Take snapshot of pagination with different max_visible_pages settings."""
    container = get_element_by_key(themed_app, "max_visible_container")
    expect(container).to_be_attached()

    assert_snapshot(container, name="st_pagination-max_visible")


def test_pagination_snapshot_width(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Take snapshot of pagination with different width settings."""
    container = get_element_by_key(themed_app, "width_container")
    expect(container).to_be_attached()

    assert_snapshot(container, name="st_pagination-width")
