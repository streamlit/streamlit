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

import time

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    wait_for_app_run,
)

expected_page_order = [
    "Page A: default",
    "Page B: wide",
    "Page C: centered",
    "Page D: dynamic",
    "Page E: fragment",
]


def get_page_link(
    app: Page, page_name: str, page_order: list[str] = expected_page_order
):
    return (
        app.get_by_test_id("stSidebarNav").locator("a").nth(page_order.index(page_name))
    )


def test_default_page_centered(app: Page):
    """Test that page keeps default layout when switched back."""
    get_page_link(app, "Page B: wide").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "wide"
    )

    get_page_link(app, "Page A: default").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "narrow"
    )


def test_page_dynamic_layout(app: Page):
    """Test that page with dynamic layout keeps last layout when switched back."""
    # centered layout should be preserved
    get_page_link(app, "Page D: dynamic").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "narrow"
    )

    get_page_link(app, "Page B: wide").click()
    wait_for_app_run(app)
    get_page_link(app, "Page D: dynamic").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "narrow"
    )

    # wide layout should be preserved
    app.get_by_text("wide button").click()
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "wide"
    )
    get_page_link(app, "Page C: centered").click()
    wait_for_app_run(app)
    get_page_link(app, "Page D: dynamic").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "wide"
    )


def test_page_with_fragment_and_dynamic_layout(app: Page):
    """Test that page with fragment and dynamic layout keeps last layout when switched back."""
    # centered layout should be preserved
    get_page_link(app, "Page E: fragment").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "narrow"
    )

    app.get_by_text("wide button").click()
    # wait for fragment to rerun
    time.sleep(1)
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "wide"
    )

    # visit another page
    get_page_link(app, "Page A: default").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "narrow"
    )
    # wide layout should be preserved
    get_page_link(app, "Page E: fragment").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "wide"
    )

    app.get_by_text("centered button").click()
    # wait for fragment to rerun
    time.sleep(1)
    expect(app.get_by_test_id("stAppViewContainer")).to_have_attribute(
        "data-layout", "narrow"
    )
