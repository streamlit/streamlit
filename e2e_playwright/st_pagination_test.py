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

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_form_button,
    get_element_by_key,
)


def get_pagination(app: Page, key: str) -> Locator:
    return get_element_by_key(app, key).get_by_test_id("stPagination")


def test_pagination_page_buttons_update_value(app: Page):
    """Test that clicking page buttons and arrows updates the selected page."""
    pagination = get_pagination(app, "basic_page")

    pagination.get_by_role("button", name="Page 3").click()
    wait_for_app_run(app)
    expect(app.get_by_text("basic-page: 3")).to_be_visible()
    expect(app.get_by_text("basic-page: 1")).not_to_be_visible()

    pagination = get_pagination(app, "basic_page")
    pagination.get_by_role("button", name="Next page").click()
    wait_for_app_run(app)
    expect(app.get_by_text("basic-page: 4")).to_be_visible()


def test_compact_pagination_only_shows_current_page(app: Page):
    """Test compact pagination with max_visible_pages=1."""
    pagination = get_pagination(app, "compact_page")

    expect(pagination.get_by_role("button", name="Page 5")).to_be_visible()
    expect(pagination.get_by_role("button", name="Page 1")).not_to_be_visible()


def test_disabled_pagination_cannot_change_value(app: Page):
    """Test that disabled pagination buttons cannot be interacted with."""
    pagination = get_pagination(app, "disabled_page")

    expect(pagination.get_by_role("button", name="Page 3")).to_be_disabled()
    pagination.get_by_role("button", name="Next page").click(force=True)
    expect(app.get_by_text("disabled-page: 3")).to_be_visible()
    expect(app.get_by_text("disabled-page: 4")).not_to_be_visible()


def test_pagination_works_in_forms(app: Page):
    """Test that pagination in forms updates when the form is submitted."""
    pagination = get_pagination(app, "form_page")

    pagination.get_by_role("button", name="Page 2").click()
    expect(app.get_by_text("form-page: 1")).to_be_visible()
    click_form_button(app, "Submit")
    wait_for_app_run(app)
    expect(app.get_by_text("form-page: 2")).to_be_visible()


def test_pagination_works_with_fragments(app: Page):
    """Test that pagination inside a fragment only reruns the fragment."""
    expect(app.get_by_text("Runs: 1")).to_be_visible()

    pagination = get_pagination(app, "fragment_page")
    pagination.get_by_role("button", name="Page 2").click()
    wait_for_app_run(app)

    expect(app.get_by_text("fragment-page: 2")).to_be_visible()
    expect(app.get_by_text("Runs: 1")).to_be_visible()


def test_custom_css_class_via_key(app: Page):
    """Test that pagination can have a custom CSS class via the key argument."""
    expect(get_element_by_key(app, "basic_page")).to_be_visible()
