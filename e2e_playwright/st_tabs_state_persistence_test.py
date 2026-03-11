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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import click_toggle, get_element_by_key


def test_keyed_tabs_persist_active_tab_across_remount(app: Page):
    """Toggling a conditional element above keyed tabs shifts the delta path,
    but the active tab should be preserved via elementStates.
    """
    keyed_tabs = get_element_by_key(app, "my_tabs")

    # Click on "Details" (second tab)
    keyed_tabs.get_by_role("tab", name="Details").click()
    expect(keyed_tabs.get_by_role("tab", name="Details")).to_have_attribute(
        "aria-selected", "true"
    )

    # Toggle the conditional element above — causes a rerun and delta path shift
    click_toggle(app, "Show summary")
    expect(app.get_by_text("Here is a summary of the data")).to_be_visible()

    # The keyed tabs should still show "Details" as active
    keyed_tabs = get_element_by_key(app, "my_tabs")
    expect(keyed_tabs.get_by_role("tab", name="Details")).to_have_attribute(
        "aria-selected", "true"
    )

    # Toggle back — another rerun and delta path shift
    click_toggle(app, "Show summary")
    expect(app.get_by_text("Here is a summary of the data")).not_to_be_visible()

    # Still persisted
    keyed_tabs = get_element_by_key(app, "my_tabs")
    expect(keyed_tabs.get_by_role("tab", name="Details")).to_have_attribute(
        "aria-selected", "true"
    )


def test_unkeyed_tabs_reset_on_remount(app: Page):
    """Unkeyed tabs have no stable identity and reset to default on remount."""
    unkeyed_tabs = app.get_by_test_id("stTabs").nth(1)

    # Click on "Beta" (second tab)
    unkeyed_tabs.get_by_role("tab", name="Beta").click()
    expect(unkeyed_tabs.get_by_role("tab", name="Beta")).to_have_attribute(
        "aria-selected", "true"
    )

    # Toggle the conditional element above — causes a rerun
    click_toggle(app, "Show summary")
    expect(app.get_by_text("Here is a summary of the data")).to_be_visible()

    # The unkeyed tabs should reset to "Alpha" (default)
    unkeyed_tabs = app.get_by_test_id("stTabs").nth(1)
    expect(unkeyed_tabs.get_by_role("tab", name="Alpha")).to_have_attribute(
        "aria-selected", "true"
    )


def test_keyed_tabs_css_key_class(app: Page):
    """Keyed tabs should have the st-key-* CSS class on the outermost element."""
    keyed_tabs = get_element_by_key(app, "my_tabs")
    expect(keyed_tabs).to_be_visible()
    expect(keyed_tabs).to_have_class(re.compile(r"st-key-my_tabs"))


def test_keyed_tabs_persist_across_multiple_tab_switches(app: Page):
    """The last-selected tab should be persisted, not just the first switch."""
    keyed_tabs = get_element_by_key(app, "my_tabs")

    # Switch to "Raw Data" (third tab)
    keyed_tabs.get_by_role("tab", name="Raw Data").click()
    expect(keyed_tabs.get_by_role("tab", name="Raw Data")).to_have_attribute(
        "aria-selected", "true"
    )

    # Switch to "Details" (second tab)
    keyed_tabs.get_by_role("tab", name="Details").click()
    expect(keyed_tabs.get_by_role("tab", name="Details")).to_have_attribute(
        "aria-selected", "true"
    )

    # Trigger remount
    click_toggle(app, "Show summary")
    wait_for_app_run(app)

    # Should persist "Details" (the last one selected), not "Raw Data"
    keyed_tabs = get_element_by_key(app, "my_tabs")
    expect(keyed_tabs.get_by_role("tab", name="Details")).to_have_attribute(
        "aria-selected", "true"
    )
    expect(keyed_tabs.get_by_role("tab", name="Raw Data")).to_have_attribute(
        "aria-selected", "false"
    )
