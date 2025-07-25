# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    expect_markdown,
    get_button,
)


def test_dialog_on_dismiss_rerun(app: Page):
    """Test that dismissing dialog with on_dismiss='rerun' triggers rerun"""
    # Initial rerun count should be 1 (initial page load)
    expect_markdown(app, "Rerun count: 1")

    # Open the rerun dialog
    click_button(app, "Open Rerun Dialog")
    wait_for_app_run(app)

    # Dialog should be visible
    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text("Dialog content for rerun test")

    # Rerun count should be 2 after opening dialog
    expect_markdown(app, "Rerun count: 2")

    # Dismiss the dialog by pressing Escape
    app.keyboard.press("Escape")
    wait_for_app_run(app)

    # Dialog should be closed
    expect(dialog).not_to_be_attached()

    # Rerun count should be 3 after dismiss triggered rerun
    expect_markdown(app, "Rerun count: 3")


def test_dialog_on_dismiss_callback(app: Page):
    """Test that dismissing dialog with callback executes callback and triggers rerun"""
    # Open the callback dialog
    click_button(app, "Open Callback Dialog")
    wait_for_app_run(app)

    # Dialog should be visible
    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text("Dialog content for callback test")

    # Callback should not be executed yet
    expect(app.get_by_text("Callback executed")).not_to_be_attached()

    # Dismiss the dialog by clicking outside
    app.locator("body").click(position={"x": 50, "y": 50}, force=True)
    wait_for_app_run(app)

    # Dialog should be closed
    expect(dialog).not_to_be_attached()

    # Callback should have been executed
    expect(app.get_by_text("Callback executed 1 times!")).to_be_visible()


def test_dialog_on_dismiss_ignore(app: Page):
    """Test that dismissing dialog with on_dismiss='ignore' does not trigger rerun"""
    # Get initial rerun count
    rerun_text = app.get_by_text(text=lambda t: t.startswith("Rerun count:"))
    initial_count = int(rerun_text.text_content().split(": ")[1])

    # Open the ignore dialog
    click_button(app, "Open Ignore Dialog")
    wait_for_app_run(app)

    # Dialog should be visible
    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text("Dialog content for ignore test")

    # Get rerun count after opening dialog
    after_open_count = int(
        app.get_by_text(text=lambda t: t.startswith("Rerun count:"))
        .text_content()
        .split(": ")[1]
    )

    # Dismiss the dialog by pressing Escape
    app.keyboard.press("Escape")

    # Dialog should be closed (but without triggering rerun)
    expect(dialog).not_to_be_attached()

    # Wait a bit to ensure no rerun was triggered
    app.wait_for_timeout(1000)

    # Rerun count should not have changed after dismiss
    final_count = int(
        app.get_by_text(text=lambda t: t.startswith("Rerun count:"))
        .text_content()
        .split(": ")[1]
    )
    assert final_count == after_open_count


def test_non_dismissible_dialog_with_on_dismiss(app: Page):
    """Test that non-dismissible dialogs don't trigger on_dismiss when trying to dismiss"""
    # Open the non-dismissible dialog
    click_button(app, "Open Non-dismissible Dialog")
    wait_for_app_run(app)

    # Dialog should be visible
    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text("This dialog cannot be dismissed")

    # There should be no close button (X)
    expect(dialog.get_by_label("Close")).not_to_be_attached()

    # Get rerun count before attempting to dismiss
    before_count = int(
        app.get_by_text(text=lambda t: t.startswith("Rerun count:"))
        .text_content()
        .split(": ")[1]
    )

    # Try to dismiss by pressing Escape (should not work)
    app.keyboard.press("Escape")

    # Wait a bit
    app.wait_for_timeout(1000)

    # Dialog should still be visible
    expect(dialog).to_be_visible()

    # Rerun count should not have changed
    after_count = int(
        app.get_by_text(text=lambda t: t.startswith("Rerun count:"))
        .text_content()
        .split(": ")[1]
    )
    assert after_count == before_count

    # Close the dialog properly using the button
    get_button(dialog, "Close").click()
    wait_for_app_run(app)

    # Dialog should now be closed
    expect(dialog).not_to_be_attached()


def test_dialog_multiple_dismissals(app: Page):
    """Test that multiple dismissals of callback dialog work correctly"""
    # Open and dismiss callback dialog multiple times
    for i in range(3):
        # Open the callback dialog
        click_button(app, "Open Callback Dialog")
        wait_for_app_run(app)

        # Dialog should be visible
        dialog = app.get_by_test_id("stDialog")
        expect(dialog).to_be_visible()

        # Dismiss the dialog by pressing Escape
        app.keyboard.press("Escape")
        wait_for_app_run(app)

        # Dialog should be closed
        expect(dialog).not_to_be_attached()

    # Check that callback was executed 3 times
    expect(app.get_by_text("Callback executed 3 times!")).to_be_visible()


def test_dialog_reopen_after_dismiss(app: Page):
    """Test that dialog can be reopened after being dismissed"""
    # Open rerun dialog
    click_button(app, "Open Rerun Dialog")
    wait_for_app_run(app)

    # Dialog should be visible
    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()

    # Dismiss by pressing Escape
    app.keyboard.press("Escape")
    wait_for_app_run(app)

    # Dialog should be closed
    expect(dialog).not_to_be_attached()

    # Reopen the dialog
    click_button(app, "Open Rerun Dialog")
    wait_for_app_run(app)

    # Dialog should be visible again
    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(dialog).to_contain_text("Dialog content for rerun test")

    # Close it properly this time
    get_button(dialog, "Close with button").click()
    wait_for_app_run(app)

    # Dialog should be closed
    expect(dialog).not_to_be_attached()
