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

from typing import Final

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import get_element_by_key
from e2e_playwright.shared.dataframe_utils import (
    click_on_cell,
    edit_cell_value,
    unfocus_dataframe,
)

EMPTY_STATE: Final = '{"added_rows": [], "deleted_rows": [], "edited_rows": {}}'


def _get_editor(app: Page, key: str) -> Locator:
    editor = get_element_by_key(app, key).get_by_test_id("stDataFrame").first
    expect(editor).to_be_visible()
    return editor


def _edit_first_cell(app: Page, key: str, value: str) -> None:
    editor = _get_editor(app, key)
    click_on_cell(editor, 1, 0, double_click=True, column_width="small")
    edit_cell_value(app, value)


def _expect_marker(app: Page, test_id: str, value: str) -> None:
    expect(app.locator(f"[data-testid='{test_id}']")).to_have_text(value)


def _click_button(app: Page, name: str) -> None:
    unfocus_dataframe(app)
    app.get_by_role("button", name=name).click(force=True)
    wait_for_app_run(app)


def test_keyed_fixed_editor_preserves_edits_across_source_value_changes(
    app: Page,
) -> None:
    _edit_first_cell(app, "value_editor", "5")

    _expect_marker(app, "value-result-a0", "5")
    _expect_marker(app, "value-result-b1", "20")
    _expect_marker(
        app,
        "value-editor-state",
        '{"added_rows": [], "deleted_rows": [], "edited_rows": {"0": {"a": 5}}}',
    )

    _click_button(app, "Value: update untouched cell")

    _expect_marker(app, "value-result-a0", "5")
    _expect_marker(app, "value-result-b1", "120")
    _expect_marker(
        app,
        "value-editor-state",
        '{"added_rows": [], "deleted_rows": [], "edited_rows": {"0": {"a": 5}}}',
    )

    _click_button(app, "Value: add source row")

    _expect_marker(app, "value-result-a0", "1")
    _expect_marker(app, "value-editor-state", EMPTY_STATE)


def test_edit_is_cleared_when_source_data_catches_up(app: Page) -> None:
    _edit_first_cell(app, "catchup_editor", "20")

    _expect_marker(app, "catchup-result-a0", "20")
    _expect_marker(
        app,
        "catchup-editor-state",
        '{"added_rows": [], "deleted_rows": [], "edited_rows": {"0": {"a": 20}}}',
    )

    _click_button(app, "Catchup: source to edited value")

    _expect_marker(app, "catchup-result-a0", "20")
    _expect_marker(app, "catchup-editor-state", EMPTY_STATE)

    _click_button(app, "Catchup: source moves again")

    _expect_marker(app, "catchup-result-a0", "30")
    _expect_marker(app, "catchup-editor-state", EMPTY_STATE)
