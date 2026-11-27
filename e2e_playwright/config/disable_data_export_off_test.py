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

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.config.disable_data_export_test import (
    COMMAND_KEY,
    _chart_toolbar,
    _get_chart_container,
    _get_data_editor,
    _get_echarts_container,
    _get_exception,
    _get_mermaid_frame,
    _get_plotly,
    _get_read_only_dataframe,
)
from e2e_playwright.conftest import wait_for_app_run, wait_until
from e2e_playwright.shared.app_utils import get_element_by_key
from e2e_playwright.shared.dataframe_utils import click_on_cell


def _expect_csv_export_visible(dataframe: Locator) -> None:
    dataframe.hover()
    toolbar = dataframe.get_by_test_id("stElementToolbar")
    expect(toolbar.get_by_label("Download as CSV")).to_be_visible()


def _expect_copy_allowed(app: Page, grid: Locator, expected: str) -> None:
    click_on_cell(grid, 1, 0, column_width="small")
    app.evaluate("navigator.clipboard.writeText('sentinel')")
    app.keyboard.press(f"{COMMAND_KEY}+c")

    wait_until(
        app,
        lambda: expected in app.evaluate("navigator.clipboard.readText()"),
    )


def _expect_cut_clears_editor(app: Page, grid: Locator) -> None:
    click_on_cell(grid, 2, 0, column_width="small")
    app.keyboard.press(f"{COMMAND_KEY}+x")
    wait_for_app_run(app)
    expect(get_element_by_key(app, "editor-value")).not_to_contain_text("Bob")


def test_shows_export_and_copy_controls(app: Page):
    read_only_dataframe = _get_read_only_dataframe(app)
    data_editor = _get_data_editor(app)

    _expect_csv_export_visible(read_only_dataframe)
    _expect_csv_export_visible(data_editor)

    chart_container = _get_chart_container(app)
    chart = chart_container.get_by_test_id("stVegaLiteChart").first
    expect(chart).to_be_visible()
    expect(chart.locator("canvas, svg").first).to_be_visible()

    toolbar = _chart_toolbar(chart)
    chart.hover(force=True)
    expect(toolbar.get_by_label("Download as PNG")).to_be_visible()
    expect(toolbar.get_by_label("Copy Vega-Lite spec")).to_be_visible()
    expect(toolbar.get_by_label("Show Data")).to_be_visible()

    code_block = get_element_by_key(app, "code-block").get_by_test_id("stCode")
    expect(code_block).to_be_visible()
    code_block.hover()
    expect(code_block.get_by_label("Copy to clipboard")).to_be_visible()

    json_element = get_element_by_key(app, "json").get_by_test_id("stJson")
    expect(json_element).to_be_visible()
    expect(json_element.locator(".copy-icon")).not_to_have_count(0)

    plotly = _get_plotly(app)
    plotly.scroll_into_view_if_needed()
    expect(plotly.locator(".main-svg, canvas").first).to_be_visible()
    plotly.hover()
    expect(plotly.get_by_role("button", name="Download plot as a PNG")).to_be_visible()

    echarts_container = _get_echarts_container(app)
    echarts = echarts_container.get_by_test_id("stEChartsChart")
    echarts.scroll_into_view_if_needed()
    expect(echarts.locator("canvas")).to_be_visible()
    echarts.hover()
    expect(
        echarts_container.get_by_role("button", name="Download as PNG")
    ).to_be_visible()

    mermaid_frame = _get_mermaid_frame(app)
    mermaid_frame.scroll_into_view_if_needed()
    expect(
        mermaid_frame.get_by_test_id("stMermaidChart").locator("img")
    ).to_be_visible()
    mermaid_frame.hover()
    mermaid_toolbar = mermaid_frame.get_by_test_id("stElementToolbar")
    expect(
        mermaid_toolbar.get_by_role("button", name="Download as PNG")
    ).to_be_visible()
    expect(
        mermaid_toolbar.get_by_role("button", name="Copy to clipboard")
    ).to_be_visible()

    exception = _get_exception(app)
    exception.scroll_into_view_if_needed()
    expect(exception.get_by_role("button", name="Copy")).to_be_visible()
    expect(exception.get_by_role("link", name="Ask Google")).to_be_visible()
    expect(exception.get_by_role("link", name="Ask ChatGPT")).to_be_visible()


@pytest.mark.only_browser("chromium")
def test_allows_dataframe_clipboard_copy(app: Page):
    """Copy from a dataframe writes cell text. Chromium-only: reliable clipboard access."""
    app.context.grant_permissions(["clipboard-read", "clipboard-write"])
    _expect_copy_allowed(app, _get_read_only_dataframe(app), "Alice")


@pytest.mark.only_browser("chromium")
def test_cut_clears_data_editor_cell(app: Page):
    """Cut from the data editor clears the cell. Chromium-only: reliable clipboard access."""
    app.context.grant_permissions(["clipboard-read", "clipboard-write"])
    _expect_cut_clears_editor(app, _get_data_editor(app))
