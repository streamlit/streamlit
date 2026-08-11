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
from e2e_playwright.shared.app_utils import (
    expect_exception,
    expect_no_exception,
    expect_warning,
    get_element_by_key,
)
from e2e_playwright.shared.dataframe_utils import (
    click_on_cell,
    edit_cell_value,
    expect_canvas_to_be_visible,
    select_row,
    unfocus_dataframe,
)

EMPTY_STATE: Final = '{"added_rows": [], "deleted_rows": [], "edited_rows": {}}'


def _get_editor(app: Page, key: str) -> Locator:
    editor = get_element_by_key(app, key).get_by_test_id("stDataFrame").first
    expect(editor).to_be_visible()
    return editor


def _marker(app: Page, test_id: str) -> Locator:
    return app.locator(f"[data-testid='{test_id}']")


def _add_row_button(editor: Locator) -> Locator:
    return (
        editor.get_by_test_id("stElementToolbar")
        .get_by_test_id("stElementToolbarButton")
        .get_by_label("Add row")
    )


def _delete_row_button(editor: Locator) -> Locator:
    return (
        editor.get_by_test_id("stElementToolbar")
        .get_by_test_id("stElementToolbarButton")
        .get_by_label("Delete row(s)")
    )


def _rerun(app: Page) -> None:
    """Trigger an unrelated full-script rerun via the app's "Rerun app" button."""
    unfocus_dataframe(app)
    app.get_by_role("button", name="Rerun app").click()
    wait_for_app_run(app)


def test_editors_render_without_error(app: Page) -> None:
    """All commit_edits editors render and no commit runs on initial load."""
    expect(app.get_by_test_id("stDataFrame")).to_have_count(6)
    # No pending edits on load, so no callback runs and no exception is shown.
    expect_no_exception(app)


def test_commit_success_transforms_persists_and_clears_edits(app: Page) -> None:
    """A successful commit transforms + persists the batch and clears the edits."""
    editor = _get_editor(app, "success_editor")
    expect_canvas_to_be_visible(editor)
    expect(_marker(app, "success-committed")).to_have_text("alpha")

    click_on_cell(editor, 1, 0, column_width="small", double_click=True)
    edit_cell_value(app, "beta")

    # The callback uppercased the edited value and persisted it.
    expect(_marker(app, "success-committed")).to_have_text("BETA")
    # A clean commit must not surface an exception.
    expect_no_exception(app)

    # A second consecutive commit on the same fixed-schema editor (no
    # intervening non-commit rerun) must also clear its edits. This guards the
    # regression where the clear-edits signal was dropped on the 2nd+ commit,
    # leaving a stale edit overlaid on the committed data.
    editor = _get_editor(app, "success_editor")
    click_on_cell(editor, 1, 0, column_width="small", double_click=True)
    edit_cell_value(app, "gamma")
    expect(_marker(app, "success-committed")).to_have_text("GAMMA")
    expect_no_exception(app)

    # The pending edits are cleared on the frontend; an unrelated rerun makes the
    # cleared backend state observable while the committed value stays put.
    _rerun(app)
    expect(_marker(app, "success-editor-state")).to_have_text(EMPTY_STATE)
    expect(_marker(app, "success-committed")).to_have_text("GAMMA")


def test_commit_revert_keeps_baseline_and_clears_edits(app: Page) -> None:
    """Returning the source dataframe rejects the batch but still clears edits."""
    editor = _get_editor(app, "revert_editor")
    expect_canvas_to_be_visible(editor)
    expect(_marker(app, "revert-calls")).to_have_text("0")

    click_on_cell(editor, 1, 0, column_width="small", double_click=True)
    edit_cell_value(app, "changed")

    # The callback ran, surfaced feedback, and returned the untouched baseline.
    expect(_marker(app, "revert-calls")).to_have_text("1")
    expect_warning(app, "Edit reverted")
    expect(_marker(app, "revert-source")).to_have_text("baseline")

    # A rejecting-by-return is a successful return, so the edits still clear and
    # the callback is not re-invoked on an unrelated rerun.
    _rerun(app)
    expect(_marker(app, "revert-editor-state")).to_have_text(EMPTY_STATE)
    expect(_marker(app, "revert-calls")).to_have_text("1")


def test_commit_failure_preserves_edit_and_shows_exception(app: Page) -> None:
    """A raising callback preserves the edit, shows the exception, and does not retry."""
    editor = _get_editor(app, "fail_editor")
    expect_canvas_to_be_visible(editor)
    expect(_marker(app, "fail-calls")).to_have_text("0")

    click_on_cell(editor, 1, 0, column_width="small", double_click=True)
    edit_cell_value(app, "edited-fail")

    # The standard exception UI is shown and the pending edit is preserved.
    expect_exception(app, "commit boom")
    expect(_marker(app, "fail-calls")).to_have_text("1")
    expect(_marker(app, "fail-editor-state")).to_contain_text("edited-fail")

    # The editor is re-enabled after the failed run: a fresh edit re-invokes the
    # commit callback (which fails again). This also confirms that retrying
    # requires a new edit rather than happening automatically.
    click_on_cell(editor, 1, 0, column_width="small", double_click=True)
    edit_cell_value(app, "edited-again")
    expect(_marker(app, "fail-calls")).to_have_text("2")
    expect(_marker(app, "fail-editor-state")).to_contain_text("edited-again")

    # An unrelated rerun must not retry the commit: the edit stays preserved, the
    # callback is not called again, and the exception clears (no auto-retry).
    _rerun(app)
    expect(_marker(app, "fail-editor-state")).to_contain_text("edited-again")
    expect(_marker(app, "fail-calls")).to_have_text("2")
    expect_no_exception(app)


def test_commit_dynamic_add_and_delete_rows(app: Page) -> None:
    """Adding and deleting rows commits through the callback for num_rows='dynamic'."""
    editor = _get_editor(app, "orders_editor")
    expect_canvas_to_be_visible(editor)
    expect(_marker(app, "orders-count")).to_have_text("2")

    # Delete a row from the pristine editor: select it, then use the delete hotkey.
    # Wait deterministically for the selection to register -- the "Delete row(s)"
    # toolbar action only appears once a row is selected -- instead of a fixed
    # timeout, so the delete keypress is not timing-dependent in CI.
    select_row(editor, 1)
    expect(_delete_row_button(editor)).to_be_visible()
    editor.press("Delete")
    wait_for_app_run(app)
    expect(_marker(app, "orders-count")).to_have_text("1")

    # A commit that changes the row count must NOT churn the editor's identity:
    # commit_edits editors key their identity on the schema only. So the next
    # edit lands on the same widget and commits directly -- add a row back via
    # the toolbar right after the delete, with no intervening rerun.
    editor.hover()
    _add_row_button(editor).click()
    wait_for_app_run(app)
    expect(_marker(app, "orders-count")).to_have_text("2")
    expect_no_exception(app)


def test_commit_disables_editor_while_in_flight(app: Page) -> None:
    """The editor is disabled while a commit run is in flight and re-enabled after."""
    editor = _get_editor(app, "slow_editor")
    expect_canvas_to_be_visible(editor)
    expect(_marker(app, "slow-count")).to_have_text("2")

    editor.hover()
    add_button = _add_row_button(editor)
    expect(add_button).to_be_attached()

    # Adding a row submits an edit batch and starts the deliberately slow commit.
    add_button.click()

    # While the run is in flight the editing affordances are removed (disabled).
    expect(_add_row_button(editor)).not_to_be_attached()

    wait_for_app_run(app)

    # Once the run finishes the row was committed and the editor is re-enabled.
    # Returning `edited_df` directly after a row addition must commit cleanly
    # (the null new cell stays editing-compatible), so no exception is shown.
    expect(_marker(app, "slow-count")).to_have_text("3")
    expect_no_exception(app)
    editor.hover()
    expect(_add_row_button(editor)).to_be_attached()


def test_commit_in_fragment_commits_and_reenables(app: Page) -> None:
    """A commit_edits editor inside a fragment commits and re-enables on completion."""
    editor = _get_editor(app, "frag_editor")
    expect_canvas_to_be_visible(editor)
    expect(_marker(app, "frag-first-value")).to_have_text("f1")

    editor.hover()
    expect(_add_row_button(editor)).to_be_attached()

    # Editing a cell starts a slow fragment commit run.
    click_on_cell(
        editor, 1, 1, column_width="small", has_row_marker_col=True, double_click=True
    )
    edit_cell_value(app, "committed-frag", wait_for_run=False)

    # During the in-flight fragment run the editor is disabled.
    expect(_add_row_button(editor)).not_to_be_attached()

    wait_for_app_run(app)

    # The fragment committed the value and re-enabled the editor afterwards.
    expect(_marker(app, "frag-first-value")).to_have_text("committed-frag")
    expect_no_exception(app)
    editor.hover()
    expect(_add_row_button(editor)).to_be_attached()
