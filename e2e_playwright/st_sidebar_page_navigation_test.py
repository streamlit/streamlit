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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import (
    wait_for_app_loaded,
    wait_for_app_run,
    wait_until,
)


def _sidebar_nav_link(app: Page, name: str) -> Locator:
    return app.get_by_test_id("stSidebarNavLink").filter(has_text=name)


def test_explicit_sidebar_state_applies_only_on_page_navigation(app: Page) -> None:
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Establish the pre-existing user preference that should keep winning on
    # initial loads and reloads.
    app.evaluate("window.localStorage.setItem('stSidebarCollapsed-', 'false')")

    _sidebar_nav_link(app, "Collapsed").click()
    wait_for_app_run(app)
    expect(sidebar).to_have_attribute("aria-expanded", "false")
    expect(
        app.get_by_test_id("stHeading").filter(has_text="Collapsed page")
    ).to_be_visible()

    # The page-entry override survives a same-page rerun and a desktop resize.
    app.get_by_role("button", name="Rerun collapsed page").click()
    wait_for_app_run(app)
    expect(sidebar).to_have_attribute("aria-expanded", "false")
    app.set_viewport_size({"width": 1100, "height": 800})
    expect(sidebar).to_have_attribute("aria-expanded", "false")

    # Page configuration must not overwrite the user-owned storage value.
    wait_until(
        app,
        lambda: (
            app.evaluate("window.localStorage.getItem('stSidebarCollapsed-')")
            == "false"
        ),
    )

    # A browser reload is not an in-app page transition, so the stored user
    # preference continues to win over the page's initial config.
    app.reload()
    wait_for_app_loaded(app)
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Re-entering the collapsed page applies its explicit state again.
    _sidebar_nav_link(app, "Expanded").click()
    wait_for_app_run(app)
    _sidebar_nav_link(app, "Collapsed").click()
    wait_for_app_run(app)
    expect(sidebar).to_have_attribute("aria-expanded", "false")

    # Force-expand direction (issue #12065 is bidirectional): entering a page
    # whose explicit state is "expanded" must expand a collapsed sidebar, even
    # over a persisted collapsed preference. The sidebar is still collapsed here,
    # so navigate via the main-content button rather than a (hidden) nav link.
    app.evaluate("window.localStorage.setItem('stSidebarCollapsed-', 'true')")
    app.get_by_role("button", name="Switch to expanded page").click()
    wait_for_app_run(app)
    expect(
        app.get_by_test_id("stHeading").filter(has_text="Expanded page")
    ).to_be_visible()
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # The page-entry override must not overwrite the user's stored preference.
    wait_until(
        app,
        lambda: (
            app.evaluate("window.localStorage.getItem('stSidebarCollapsed-')") == "true"
        ),
    )

    # A page without explicit config uses the persisted preference: the stored
    # collapsed value now wins on entry to the unconfigured page.
    _sidebar_nav_link(app, "Unconfigured").click()
    wait_for_app_run(app)
    expect(sidebar).to_have_attribute("aria-expanded", "false")
