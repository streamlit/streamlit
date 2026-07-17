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

"""E2E tests for st.bottom container."""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import click_button, expect_markdown


def test_bottom_container_rendering(app: Page):
    """Verify st.bottom renders elements correctly with various patterns."""
    bottom_container = app.get_by_test_id("stBottom")
    bottom_block = app.get_by_test_id("stBottomBlockContainer")
    main_block = app.get_by_test_id("stMainBlockContainer")

    # Basic rendering
    expect(bottom_container).to_be_visible()
    expect(bottom_block).to_be_visible()
    expect(main_block).to_be_visible()

    # Button in bottom container
    bottom_button = bottom_block.get_by_role("button", name="Bottom button")
    expect(bottom_button).to_be_visible()

    # st.bottom.<element>() writes to bottom even when called from an expander
    bottom_text = bottom_block.get_by_text("Direct call: st.bottom.write()")
    expect(bottom_text).to_be_visible()

    # Content should NOT be inside the expander
    expander = main_block.get_by_test_id("stExpander")
    expect(expander).to_be_visible()
    expander_content = expander.get_by_text("Direct call: st.bottom.write()")
    expect(expander_content).to_have_count(0)

    # Context manager pattern
    context_manager_text = bottom_block.get_by_text("Context manager")
    expect(context_manager_text).to_be_visible()

    # Toolbar with chat input
    chat_input = bottom_block.locator("textarea")
    expect(chat_input).to_be_visible()
    attach_button = bottom_block.get_by_role("button", name="Attach", exact=True)
    clear_button = bottom_block.get_by_role("button", name="Clear", exact=True)
    expect(attach_button).to_be_visible()
    expect(clear_button).to_be_visible()

    # Main content is present
    main_markdown = main_block.get_by_test_id("stMarkdown")
    expect(main_markdown.first).to_contain_text("Main content above")


def test_bottom_container_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Verify the bottom container renders correctly visually."""
    app.set_viewport_size({"width": 750, "height": 600})

    bottom_container = app.get_by_test_id("stBottom")
    expect(bottom_container).to_be_visible()

    assert_snapshot(bottom_container, name="st_bottom-container")


def test_bottom_container_widget_interactions(app: Page):
    """Verify widgets in st.bottom respond to user interactions."""
    bottom_block = app.get_by_test_id("stBottomBlockContainer")

    # Click bottom button
    click_button(app, "Bottom button")
    wait_for_app_run(app)
    expect_markdown(app, "Bottom button was clicked!")

    # Click attach button in toolbar
    attach_button = bottom_block.get_by_role("button", name="Attach", exact=True)
    attach_button.click()
    wait_for_app_run(app)
    expect_markdown(app, "Attach button clicked!")
