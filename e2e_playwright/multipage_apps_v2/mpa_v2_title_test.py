# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    wait_for_app_run,
)

expected_page_order = ["a", "1_page__2"]


def get_page_link(
    app: Page, page_name: str, page_order: list[str] = expected_page_order
):
    return (
        app.get_by_test_id("stSidebarNav").locator("a").nth(page_order.index(page_name))
    )


def test_can_switch_between_pages_by_clicking_on_sidebar_links(app: Page):
    """Test that we can switch between pages by clicking on sidebar links."""
    nav = app.get_by_test_id("stSidebarNav")
    for i, title in enumerate(expected_page_order):
        expect(nav.locator("a").nth(i)).to_contain_text(title)

    get_page_link(app, "1_page__2").click()
    wait_for_app_run(app)
    expect(app).to_have_title("1_page__2")
