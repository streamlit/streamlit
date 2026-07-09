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

import sys

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_until
from e2e_playwright.shared.app_utils import get_element_by_key
from e2e_playwright.shared.dataframe_utils import click_on_cell

COMMAND_KEY = "Meta" if sys.platform == "darwin" else "Control"


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    return ["--client.disableDataExport=true"]


def _expect_csv_export_hidden(dataframe: Locator) -> None:
    dataframe.hover()
    toolbar = dataframe.get_by_test_id("stElementToolbar")
    expect(toolbar).to_be_attached()
    expect(toolbar.get_by_label("Download as CSV")).not_to_be_attached()


def _get_read_only_dataframe(app: Page) -> Locator:
    return get_element_by_key(app, "read-only-dataframe").get_by_test_id("stDataFrame")


def _get_data_editor(app: Page) -> Locator:
    return get_element_by_key(app, "editable-data-editor").get_by_test_id("stDataFrame")


def _get_chart_container(app: Page) -> Locator:
    return get_element_by_key(app, "chart-table-view")


def test_hides_csv_export_for_dataframes_and_chart_table_view(app: Page):
    read_only_dataframe = _get_read_only_dataframe(app)
    data_editor = _get_data_editor(app)

    _expect_csv_export_hidden(read_only_dataframe)
    _expect_csv_export_hidden(data_editor)

    chart_container = _get_chart_container(app)
    chart = chart_container.get_by_test_id("stVegaLiteChart").first
    expect(chart).to_be_visible()

    toolbar = chart.locator("..").get_by_test_id("stElementToolbar")
    chart.hover(force=True)
    expect(toolbar.get_by_label("Download as PNG")).to_be_visible()

    toolbar.get_by_label("Show Data").click()

    chart_table_view = chart_container.get_by_test_id("stDataFrame")
    expect(chart_table_view).to_be_visible()
    expect(chart_table_view.get_by_label("Show chart")).to_be_visible()
    _expect_csv_export_hidden(chart_table_view)


@pytest.mark.only_browser("chromium")
def test_keeps_data_editor_clipboard_copy_enabled(app: Page):
    """Verify clipboard copy remains available where Playwright supports it."""
    app.context.grant_permissions(["clipboard-read", "clipboard-write"])

    data_editor = _get_data_editor(app)
    click_on_cell(data_editor, 1, 0, column_width="small")

    app.evaluate("navigator.clipboard.writeText('sentinel')")
    app.keyboard.press(f"{COMMAND_KEY}+c")

    # Poll until the copied cell value lands on the clipboard to avoid a fixed
    # sleep, since a successful copy has an observable clipboard change.
    wait_until(app, lambda: "Alice" in app.evaluate("navigator.clipboard.readText()"))


@pytest.mark.only_browser("chromium")
def test_disables_dataframe_clipboard_copy(app: Page):
    """Verify read-only dataframe copy is blocked where clipboard reads work."""
    app.context.grant_permissions(["clipboard-read", "clipboard-write"])

    read_only_dataframe = _get_read_only_dataframe(app)
    click_on_cell(read_only_dataframe, 1, 0, column_width="small")

    app.evaluate("navigator.clipboard.writeText('sentinel')")
    app.keyboard.press(f"{COMMAND_KEY}+c")
    # Copy is expected to be blocked, so there is no observable clipboard change
    # to poll for. Give any (unwanted) async copy a chance to run before we
    # assert the clipboard is untouched.
    app.wait_for_timeout(200)

    assert app.evaluate("navigator.clipboard.readText()") == "sentinel"
