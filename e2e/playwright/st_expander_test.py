# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from conftest import ImageCompareFunction

EXPANDER_HEADER_IDENTIFIER = ".streamlit-expanderHeader"


def test_displays_expander_and_regular_containers_properly(app: Page):
    """Test that expanders and regular containers are displayed properly."""

    main_expanders = app.locator(".main [data-testid='stExpander']")
    expect(main_expanders).to_have_count(2)

    for expander in main_expanders.all():
        expect(expander.locator(EXPANDER_HEADER_IDENTIFIER)).to_be_visible()

    sidebar_expander = app.locator(
        "[data-testid='stSidebar'] [data-testid='stExpander']"
    ).first
    expect(sidebar_expander.locator(EXPANDER_HEADER_IDENTIFIER)).to_be_visible()


def test_expander_displays_correctly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that sidebar and main container expanders are displayed correctly."""
    # Focus the button, then ensure it's not cut off
    themed_app.locator(".stButton button").focus()
    assert_snapshot(themed_app.locator(".main"), name="expanders-in-main")
    assert_snapshot(
        themed_app.locator("[data-testid='stSidebar']"),
        name="expanders-in-sidebar",
    )


def test_expander_collapses_and_expands(app: Page):
    """Test that an expander collapses and expands."""
    main_expanders = app.locator(".main [data-testid='stExpander']")
    expect(main_expanders).to_have_count(2)

    expanders = main_expanders.all()
    # Starts expanded
    expander_header = expanders[0].locator(EXPANDER_HEADER_IDENTIFIER)
    expect(expander_header).to_be_visible()
    toggle = expander_header.locator("svg").first
    expect(toggle).to_be_visible()
    expander_header.click()
    toggle = expander_header.locator("svg").first
    expect(toggle).to_be_visible()

    # Starts collapsed
    expander_header = expanders[1].locator(EXPANDER_HEADER_IDENTIFIER)
    expect(expander_header).to_be_visible()
    toggle = expander_header.locator("svg").first
    expect(toggle).to_be_visible()
    expander_header.click()
    toggle = expander_header.locator("svg").first
    expect(toggle).to_be_visible()


def test_empty_expander_not_rendered(app: Page):
    """Test that an empty expander is not rendered."""
    expect(app.get_by_text("Empty expander")).not_to_be_attached()
