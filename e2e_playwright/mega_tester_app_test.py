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

import re
from typing import TYPE_CHECKING

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import IframedPage, rerun_app, wait_for_app_run, wait_until
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    click_toggle,
    expect_no_skeletons,
    fill_number_input,
    get_checkbox,
    get_number_input,
    get_text_input,
    open_popover,
    select_radio_option,
    select_selectbox_option,
)

if TYPE_CHECKING:
    from playwright.sync_api import ConsoleMessage, FrameLocator

    from e2e_playwright.shared.app_target import AppTarget


def is_expected_error(
    msg: ConsoleMessage, browser_name: str, *, uses_csp: bool
) -> bool:
    """Check if a console error is expected and should be ignored."""

    # Mapbox error is expected and should be ignored:
    if (
        msg.text == "Failed to load resource: net::ERR_CONNECTION_REFUSED"
        and "events.mapbox.com" in msg.location["url"]
    ):
        return True

    # There is an expected error with pydeck and firefox related to WebGL rendering
    # This seems to be an issue with firefox used with playwright:
    if re.search(r"deck:.*is null undefined", msg.text) and browser_name == "firefox":
        return True

    # deck.gl's luma.gl 9.3+ logs an error when WebGL2 is unavailable (headless Firefox CI):
    if (
        re.search(r"deck:.*Failed to create WebGL context", msg.text)
        and browser_name == "firefox"
    ):
        return True

    # TODO(lukasmasuch): Investigate why firefox is running into this eval issue:
    if (
        (
            "settings blocked a JavaScript eval (script-src) from being executed"
            in msg.text
        )
        and browser_name == "firefox"
        and uses_csp
    ):
        return True

    # TODO(lukasmasuch): Investigate why webkit is running into this blob: issue:
    return bool(
        msg.text == "Failed to load resource"
        and re.match(r"blob:https?://", msg.location["url"]) is not None
        and browser_name == "webkit"
        and uses_csp
    )


@pytest.mark.external_test(upload_test_assets=True)
def test_no_console_errors(app_target: AppTarget, browser_name: str) -> None:
    """Test that the app does not log any console errors."""
    console_errors = []

    def on_console_message(msg: ConsoleMessage) -> None:
        # Possible message types: "log", "debug", "info", "error", "warning", ...
        if msg.type == "error" and not is_expected_error(
            msg, browser_name, uses_csp=False
        ):
            # Each console message has text, location, etc.
            console_errors.append(
                {
                    "message": msg.text,
                    "url": msg.location["url"],
                    "line": msg.location["lineNumber"],
                    "column": msg.location["columnNumber"],
                }
            )

    app_target.page.on("console", on_console_message)

    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(app_target.locator_context, timeout=25000)

    # There should be only one exception in the app:
    expect(app_target.get_by_test_id("stException")).to_have_count(1)

    # Check that title is visible:
    expect(app_target.get_by_text("🎈 Mega tester app", exact=True)).to_be_visible()

    # There should be no unexpected console errors:
    assert not console_errors, "Console errors were logged " + str(console_errors)


def test_mega_tester_app_in_iframe(iframed_app: IframedPage, browser_name: str) -> None:
    """Test that the mega tester app can be loaded within an iframe with CSP."""
    console_errors = []

    def on_console_message(msg: ConsoleMessage) -> None:
        # Possible message types: "log", "debug", "info", "error", "warning", ...
        if msg.type == "error" and not is_expected_error(
            msg, browser_name, uses_csp=True
        ):
            # Each console message has text, location, etc.
            console_errors.append(
                {
                    "message": msg.text,
                    "url": msg.location["url"],
                    "line": msg.location["lineNumber"],
                    "column": msg.location["columnNumber"],
                }
            )

    page: Page = iframed_app.page
    page.on("console", on_console_message)

    frame_locator: FrameLocator = iframed_app.open_app(None)

    wait_for_app_run(frame_locator)
    page.wait_for_load_state()

    # Make sure that all elements are rendered and no skeletons are shown:
    expect_no_skeletons(frame_locator, timeout=25000)

    # Check that title is visible:
    expect(frame_locator.get_by_text("🎈 Mega tester app", exact=True)).to_be_visible()
    expect(frame_locator.get_by_test_id("stException")).to_have_count(1)

    # Check that there are no dialogs (e.g. with errors) visible:
    expect(frame_locator.get_by_test_id("stDialog")).to_have_count(0)

    # There should be no unexpected console errors:
    assert not console_errors, "Console errors were logged " + str(console_errors)


@pytest.mark.performance
@pytest.mark.repeat(5)  # only repeat 5 times since otherwise it would take too long
def test_mega_tester_app_rendering_performance(app: Page) -> None:
    """Test the performance of the mega tester app rendering."""
    # Rerun the app 5 times:
    for _ in range(5):
        rerun_app(app)


@pytest.mark.external_test(upload_test_assets=True)
def test_mega_tester_app_renders_expected_content(app_target: AppTarget) -> None:
    expect_no_skeletons(app_target.locator_context, timeout=25000)

    expect(app_target.get_by_text("🎈 Mega tester app", exact=True)).to_be_visible()
    mandatory_headings = [
        "Packages and magic",
        "Map and media elements",
        "Data display elements",
        "Chart elements",
        "Custom UI elements",
        "Input widgets",
        "Text elements",
        "Block elements",
        "Navigation elements",
        "Streamlit context",
        "Utility elements",
        "Stop behavior",
    ]
    for heading in mandatory_headings:
        expect(
            app_target.get_by_role("heading", name=heading, exact=True)
        ).to_be_visible()

    authentication_heading = app_target.get_by_role(
        "heading", name="Authentication", exact=True
    )
    wait_until(
        app_target.page,
        lambda: authentication_heading.count() in {0, 1},
        timeout=10000,
    )
    if authentication_heading.count() == 1:
        expect(authentication_heading).to_be_visible()

    # Packages + magic: verify semantic content, not just section presence.
    expect(app_target.get_by_test_id("stDataFrame").first).to_contain_text("Python")
    expect(app_target.get_by_test_id("stDataFrame").first).to_contain_text("Streamlit")
    expect(
        app_target.get_by_test_id("stCode").filter(has_text="Abracowdabra")
    ).to_be_visible()
    expect(app_target.get_by_text("Magic bare expression", exact=True)).to_be_visible()

    # Media and data display.
    expect(app_target.get_by_text("Generated image", exact=True)).to_be_visible()
    expect(app_target.get_by_test_id("stImage").first).to_be_visible()
    expect(app_target.get_by_test_id("stAudio").first).to_be_visible()
    expect(
        app_target.get_by_role("button", name="Download data as CSV", exact=True)
    ).to_be_visible()
    column_config_heading = app_target.get_by_role(
        "heading", name="Column config matrix", exact=True
    )
    if column_config_heading.count() == 1:
        expect(column_config_heading).to_be_visible()
        # Column headers can be virtualized/off-screen; assert presence rather than visibility.
        expect(app_target.get_by_text("TextColumn", exact=True)).to_have_count(1)
        expect(app_target.get_by_test_id("stTable")).to_be_visible()
    metric_cards = app_target.get_by_test_id("stMetric")
    expect(metric_cards.first).to_contain_text("Metric")
    expect(metric_cards.first).to_contain_text("42")
    expect(metric_cards.first).to_contain_text("2")
    expect(metric_cards.filter(has_text="Metric positive")).to_have_count(1)
    expect(metric_cards.filter(has_text="Metric negative")).to_have_count(1)
    expect(metric_cards.filter(has_text="Metric neutral")).to_have_count(1)
    expect(
        app_target.get_by_test_id("stJson").filter(has_text="timezone").first
    ).to_be_visible()

    # Charts: ensure multiple concrete chart outputs rendered.
    # The mega tester app always renders at least four Vega charts.
    vega_charts = app_target.get_by_test_id("stVegaLiteChart")
    expect(vega_charts.nth(3)).to_be_visible()
    expect(vega_charts.first).to_be_visible()
    plotly_charts = app_target.get_by_test_id("stPlotlyChart")
    wait_until(
        app_target.page,
        lambda: plotly_charts.count() in {0, 1},
        timeout=10000,
    )
    if plotly_charts.count() == 1:
        expect(plotly_charts.first).to_be_visible()
    else:
        expect(plotly_charts).to_have_count(0)
    expect(app_target.get_by_test_id("stGraphVizChart").first).to_be_visible()

    # Custom UI: verify HTML component iframe and unsafe markdown output.
    custom_html_iframe = app_target.locator(
        "iframe[srcdoc*='Bold green HTML text']"
    ).first
    expect(custom_html_iframe).to_be_visible()
    expect(custom_html_iframe).to_have_attribute(
        "srcDoc", re.compile(r"Bold green HTML text|Click me")
    )
    expect(app_target.get_by_text("Unsafe markdown HTML", exact=True)).to_be_visible()

    # Text elements should render concrete messages.
    expect(
        app_target.get_by_role("heading", name="Title with tooltip", exact=True)
    ).to_be_visible()
    expect(app_target.get_by_text("Warning", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Warning with icon", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Error", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Error with icon", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Info", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Info with icon", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Success", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Success with icon", exact=True)).to_be_visible()
    expect(
        app_target.get_by_role("heading", name="Header with blue divider", exact=True)
    ).to_be_visible()
    expect(
        app_target.get_by_role(
            "heading", name="Header with rainbow divider", exact=True
        )
    ).to_be_visible()
    expect(app_target.get_by_test_id("stException")).to_contain_text(
        "Example exception"
    )
    expect(
        app_target.get_by_role("link", name="Link button", exact=True)
    ).to_be_visible()

    # Inputs + blocks + utility content.
    expect(app_target.get_by_text("Textbox", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Number", exact=True)).to_be_visible()
    expect(
        app_target.get_by_role("button", name=re.compile(r"Button primary"))
    ).to_be_visible()
    expect(
        app_target.get_by_role("button", name=re.compile(r"Button tertiary"))
    ).to_be_visible()
    expect(app_target.get_by_text("Accept new options", exact=True)).to_be_visible()
    file_uploader_mode = app_target.get_by_text("File uploader mode", exact=True)
    if file_uploader_mode.count() == 1:
        expect(file_uploader_mode).to_be_visible()
    expect(app_target.get_by_text("Dialog width", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Dialog dismissible", exact=True)).to_be_visible()
    show_camera_input = app_target.get_by_text("Show camera input", exact=True)
    if show_camera_input.count() == 1:
        expect(show_camera_input).to_be_visible()
    wide_mode = app_target.get_by_text("Wide mode", exact=True)
    if wide_mode.count() == 1:
        expect(wide_mode).to_be_visible()
    expect(app_target.get_by_text("Sidebar widgets", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Sidebar expander", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Sidebar write API", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Selectbox", exact=True)).to_be_visible()
    expect(app_target.get_by_role("tab", name="Tab A", exact=True)).to_be_visible()
    expect(app_target.get_by_role("tab", name="Tab B", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Expander", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Bordered left column", exact=True)).to_be_visible()
    expect(
        app_target.get_by_text("Bordered container content", exact=True)
    ).to_be_visible()
    expect(app_target.get_by_text("Echo", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Text before stop", exact=True)).to_be_visible()
    expect(app_target.get_by_text("Text after stop", exact=True)).to_be_visible()

    # Negatives for initial state.
    expect(app_target.get_by_test_id("stDialog")).to_have_count(0)
    expect(app_target.get_by_text("Form submitted", exact=True)).to_have_count(0)

    if app_target.get_by_role("heading", name="PDF element", exact=True).count() == 1:
        pdf_container = app_target.get_by_test_id("pdf-container").first
        expect(pdf_container).to_be_visible(timeout=30000)
        expect(pdf_container.get_by_test_id("pdf-loading")).to_be_hidden(timeout=30000)
        expect(pdf_container.locator('[data-index="0"]').first).to_be_visible(
            timeout=30000
        )


def test_mega_tester_app_interactions_validate_behavior(app: Page) -> None:
    textbox = get_text_input(app, "Textbox")
    textbox.locator("input").first.fill("Ada")
    textbox.locator("input").first.press("Enter")
    wait_for_app_run(app)
    expect(textbox.locator("input").first).to_have_value("Ada")

    fill_number_input(app, "Number", 7)
    number_input = get_number_input(app, "Number")
    expect(number_input.locator("input").first).to_have_value(re.compile(r"7"))

    click_checkbox(app, "Checkbox")
    expect(get_checkbox(app, "Checkbox").locator("input").first).to_be_checked()

    select_radio_option(app, option="dog", label="Radio")
    expect(
        app.get_by_test_id("stRadio")
        .filter(has_text="Radio")
        .get_by_role("radio", name="dog", exact=True)
    ).to_be_checked()

    click_toggle(app, "Accept new options")
    wait_for_app_run(app)
    select_selectbox_option(app, "Selectbox", "dog")
    expect(
        app.get_by_test_id("stSelectbox").filter(has_text="Selectbox")
    ).to_contain_text("dog")

    form_text = get_text_input(app, "Form text")
    form_text.locator("input").first.fill("hello")
    app.get_by_role("button", name="Submit form").first.click()
    expect(app.get_by_text("Form submitted", exact=True)).to_be_visible()

    click_button(app, "Write stream")
    expect(app.get_by_text("lorem ipsum", exact=False)).to_be_visible()
    expect(app.get_by_text("dolor sit amet", exact=False)).to_be_visible()

    app.get_by_role("button", name=re.compile(r"Button primary")).first.click()
    wait_for_app_run(app)
    expect(
        app.get_by_text("You pressed the primary button", exact=True)
    ).to_be_visible()
    app.get_by_role("button", name=re.compile(r"Button tertiary")).first.click()
    wait_for_app_run(app)
    expect(
        app.get_by_text("You pressed the tertiary button", exact=True)
    ).to_be_visible()

    # Expander should hide content until opened.
    expect(app.get_by_text("Expander content", exact=True)).to_be_hidden()
    app.get_by_text("Expander", exact=True).click()
    expect(app.get_by_text("Expander content", exact=True)).to_be_visible()
    expect(app.get_by_text("Sidebar expander content", exact=True)).to_be_hidden()
    app.get_by_text("Sidebar expander", exact=True).click()
    expect(app.get_by_text("Sidebar expander content", exact=True)).to_be_visible()

    # Popover content should only appear when opened.
    expect(app.get_by_test_id("stPopoverBody")).to_have_count(0)
    popover_container = open_popover(app, "Popover")
    expect(popover_container).to_contain_text("Popover content")

    # Tab content should switch when selecting tabs.
    expect(app.get_by_text("Tab A content", exact=True)).to_be_visible()
    app.get_by_role("tab", name="Tab B", exact=True).click()
    expect(app.get_by_text("Tab B content", exact=True)).to_be_visible()

    click_button(app, "Open dialog item 1")
    expect(app.get_by_test_id("stDialog")).to_have_count(1)
    dialog_reason = get_text_input(app, "Dialog reason")
    dialog_reason.locator("input").first.fill("because")
    click_button(app, "Submit dialog")
    expect(
        app.get_by_text("Dialog result item=1 reason=because", exact=True)
    ).to_be_visible()
    expect(app.get_by_test_id("stDialog")).to_have_count(0)

    select_selectbox_option(app, "Navigation position", "hidden")
    expect(app.get_by_text("Home page", exact=True)).to_be_visible()
    expect(app.get_by_test_id("stSidebarNav")).not_to_be_visible()
    expect(app.get_by_test_id("stTopNavLink")).to_have_count(0)

    select_selectbox_option(app, "Navigation position", "sidebar")
    expect(app.get_by_test_id("stSidebarNav")).to_be_visible()
    app.get_by_test_id("stSidebarNavLink").filter(has_text="About").first.click()
    wait_for_app_run(app)
    expect(app.get_by_text("About page", exact=True)).to_be_visible()
    app.get_by_test_id("stSidebarNavLink").filter(has_text="Contact").first.click()
    wait_for_app_run(app)
    expect(app.get_by_text("Contact page", exact=True)).to_be_visible()

    click_toggle(app, "Many pages")
    expect(
        app.get_by_test_id("stSidebarNavLink").filter(has_text="About")
    ).to_have_count(0)
    # Flatten sections so Logs is always directly clickable.
    click_toggle(app, "Navigation sections")
    app.get_by_test_id("stSidebarNavLink").filter(
        has_text="Data visualizations"
    ).first.click()
    wait_for_app_run(app)
    expect(app.get_by_text("Data visualizations page", exact=True)).to_be_visible()

    select_selectbox_option(app, "Navigation position", "top")
    expect(app.get_by_test_id("stSidebarNav")).not_to_be_visible()
    top_nav_items = app.locator(
        '[data-testid="stTopNavLink"], [data-testid="stTopNavSection"]'
    )
    expect(top_nav_items.first).to_be_visible()

    expect(app.get_by_test_id("stChatInput")).to_have_count(1)
    click_toggle(app, "Show chat input at bottom")
    wait_for_app_run(app)
    expect(app.get_by_test_id("stChatInput")).to_have_count(1)

    expect(app.get_by_text("Text after stop", exact=True)).to_be_visible()
    click_button(app, "Run st.stop")
    expect(app.get_by_text("Text before stop", exact=True)).to_be_visible()
    # Negative: content after st.stop should not be rendered after button click.
    expect(app.get_by_text("Text after stop", exact=True)).to_have_count(0)

    click_toggle(app, "Disable widgets")
    expect(get_text_input(app, "Textbox").locator("input").first).to_be_disabled()
