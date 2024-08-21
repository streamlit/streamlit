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

from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import click_checkbox, expect_markdown


def test_clicking_a_lot_still_keeps_state(app: Page):
    """Test the the widget state is correctly handled on very fast clicks.
    Related to: https://github.com/streamlit/streamlit/issues/4836
    """
    number_input_down_button = app.get_by_test_id("stNumberInput").locator(
        "stNumberInputStepUp"
    )
    for _ in range(40):
        number_input_down_button.click()

    expect_markdown(app, "40")


def test_doesnt_save_widget_state_on_redisplay(app: Page):
    """Test that widget state is not saved when a widget is redisplayed
    after a rerun.

    Related to: https://github.com/streamlit/streamlit/issues/3512
    """
    click_checkbox(app, "Display widgets")
    click_checkbox(app, "Show hello")
    expect_markdown(app, "hello")

    # Hide widgets:
    click_checkbox(app, "Display widgets")

    # Show widgets again:
    click_checkbox(app, "Display widgets")

    # Should not show hello again -> the widget state was not saved
    markdown_el = app.get_by_test_id("stMarkdown").filter(has_text="hello")
    expect(markdown_el).not_to_be_attached()


def test_doesnt_save_widget_state_on_redisplay_with_keyed_widget(app: Page):
    """Test that widget state is not saved when a keyed widget is redisplayed
    after a rerun.

    Related to: https://github.com/streamlit/streamlit/issues/3512
    """
    click_checkbox(app, "Display widgets")
    click_checkbox(app, "Show goodbye")
    expect_markdown(app, "goodbye")

    # Hide widgets:
    click_checkbox(app, "Display widgets")

    # Show widgets again:
    click_checkbox(app, "Display widgets")

    # Should not show goodbye again -> the widget state was not saved
    markdown_el = app.get_by_test_id("stMarkdown").filter(has_text="goodbye")
    expect(markdown_el).not_to_be_attached()
