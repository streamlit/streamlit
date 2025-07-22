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

import re

import pytest
from playwright.sync_api import Page, expect
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    COMMAND_KEY,
    check_top_level_class,
    click_button,
    expect_exception,
    expect_markdown,
    expect_no_exception,
    get_button,
    get_markdown,
    is_child_bounding_box_inside_parent,
)
from e2e_playwright.shared.dataframe_utils import (
    open_column_menu,
)

modal_test_id = "stDialog"


def open_dialog_with_images(app: Page):
    click_button(app, "Open Dialog with Images")


def open_dialog_without_images(app: Page):
    click_button(app, "Open Dialog without Images")


def open_largewidth_dialog(app: Page):
    click_button(app, "Open large-width Dialog")


def open_headings_dialogs(app: Page):
    click_button(app, "Open headings Dialog")


def open_sidebar_dialog(app: Page):
    click_button(app, "Open Sidebar-Dialog")


def open_dialog_with_internal_error(app: Page):
    click_button(app, "Open Dialog with Key Error")


def open_nested_dialogs(app: Page):
    click_button(app, "Open Nested Dialogs")


def open_submit_button_dialog(app: Page):
    click_button(app, "Open submit-button Dialog")


def open_dialog_with_copy_buttons(app: Page):
    click_button(app, "Open Dialog with Copy Buttons")


def open_dialog_with_deprecation_warning(app: Page):
    click_button(app, "Open Dialog with deprecation warning")


def open_dialog_with_chart(app: Page):
    click_button(app, "Open Chart Dialog")


def open_dialog_with_rerun(app: Page):
    click_button(app, "Open Dialog with rerun")


def open_dialog_with_long_title(app: Page):
    click_button(app, "Open Dialog with long title")


def click_to_dismiss(app: Page):
    # Click somewhere outside the close popover container:
    app.keyboard.press("Escape")


def test_displays_dialog_properly(app: Page):
    """Test that dialog is displayed properly."""
    open_dialog_with_images(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)

    # Verify that we don't print a deprecation warning for usage of @st.dialog. We check
    # that a warning is printed for @st.experimental_dialog in a later test.
    expect(app.get_by_test_id("stAlert")).not_to_be_attached()


def _test_dialog_closes_properly(app: Page):
    """Test that dialog closes after clicking on action button."""
    open_dialog_with_images(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)
    close_button = main_dialog.get_by_test_id("stButton").locator("button").first
    close_button.scroll_into_view_if_needed()
    close_button.click()
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(0)


def test_dialog_closes_properly(app: Page):
    """Test that dialog closes after clicking on action button."""
    _test_dialog_closes_properly(app)


@pytest.mark.performance
def test_dialog_open_and_close_performance(app: Page):
    _test_dialog_closes_properly(app)


def test_dialog_dismisses_properly(app: Page):
    """Test that dialog is dismissed properly after clicking on close (= dismiss)."""
    open_dialog_with_images(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)

    click_to_dismiss(app)
    expect(main_dialog).not_to_be_visible()
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(0)


def test_dialog_reopens_properly_after_dismiss(app: Page):
    """Test that dialog reopens after dismiss."""

    # open and close the dialog multiple times
    for _ in range(10):
        open_dialog_without_images(app)
        wait_for_app_run(app)

        main_dialog = app.get_by_test_id(modal_test_id)
        expect(main_dialog).to_have_count(1)

        click_to_dismiss(app)
        expect(main_dialog).not_to_be_attached()

        main_dialog = app.get_by_test_id(modal_test_id)
        expect(main_dialog).to_have_count(0)


def test_dialog_reopens_properly_after_close(app: Page):
    """Test that dialog reopens properly after closing by action button click."""
    # open and close the dialog multiple times
    for _ in range(5):
        open_dialog_with_images(app)

        wait_for_app_run(app, wait_delay=250)
        main_dialog = app.get_by_test_id(modal_test_id)

        expect(main_dialog).to_have_count(1)
        close_button = main_dialog.get_by_test_id("stButton").locator("button").first
        close_button.scroll_into_view_if_needed()
        close_button.click()
        wait_for_app_run(app, wait_delay=250)
        main_dialog = app.get_by_test_id(modal_test_id)
        expect(main_dialog).to_have_count(0)


def test_dialog_stays_dismissed_when_interacting_with_different_fragment(app: Page):
    """Dismissing a dialog is a UI-only interaction as of today (the Python backend does
    not know about this). We use a deltaMsgReceivedAt to differentiate React renders
    for dialogs triggered via a new backend message which changes the id vs. other
    interactions. This test ensures that the dialog stays dismissed when interacting
    with a different fragment.
    """

    open_dialog_without_images(app)
    wait_for_app_run(app)

    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)

    click_to_dismiss(app)
    expect(main_dialog).not_to_be_attached()

    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(0)

    # interact with unrelated fragment
    click_button(app, "Fragment Button")
    expect_markdown(app, "Fragment Button clicked")

    # dialog is still closed and did not reopen
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(0)

    # reopen dialog
    open_dialog_without_images(app)
    wait_for_app_run(app)

    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)


def test_dialog_is_scrollable(app: Page):
    """Test that the dialog is scrollable."""
    open_dialog_with_images(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    close_button = main_dialog.get_by_test_id("stButton")
    expect(close_button).not_to_be_in_viewport()
    close_button.scroll_into_view_if_needed()
    expect(close_button).to_be_in_viewport()


def test_fullscreen_is_disabled_for_dialog_elements(app: Page):
    """Test that elements within the dialog do not show the fullscreen option."""
    open_dialog_with_images(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)

    # check that the dataframe does not have the fullscreen button
    dataframe_toolbar = app.get_by_test_id("stElementToolbarButton")
    # 2 elements are in the toolbar as of today: download, search
    expect(dataframe_toolbar).to_have_count(2)


def test_actions_for_dialog_headings(app: Page):
    """Test that dialog headings show the tooltip icon but not the link icon."""
    open_headings_dialogs(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)

    # check that the actions-element is there
    action_elements = app.get_by_test_id("stHeaderActionElements")
    expect(action_elements).to_have_count(1)

    # check that the tooltip icon is there and hoverable
    tooltip_element = action_elements.get_by_test_id("stTooltipIcon")
    expect(tooltip_element).to_have_count(1)
    tooltip_element.hover()
    expect(app.get_by_text("Some tooltip!")).to_be_visible()

    # check that the link-icon does not exist
    expect(tooltip_element.locator("a")).not_to_be_attached()


def test_dialog_displays_correctly(app: Page, assert_snapshot: ImageCompareFunction):
    open_dialog_without_images(app)
    wait_for_app_run(app)
    dialog = app.get_by_role("dialog")
    # click on the dialog title to take away focus of all elements and make the
    # screenshot stable. Then hover over the button for visual effect.
    dialog.get_by_test_id("stMarkdownContainer").filter(
        has_text="Simple Dialog"
    ).click()
    submit_button = get_button(dialog, "Submit")
    submit_button.hover()
    assert_snapshot(dialog, name="st_dialog-default")


def test_largewidth_dialog_displays_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    open_largewidth_dialog(app)
    wait_for_app_run(app)
    dialog = app.get_by_role("dialog")
    # click on the dialog title to take away focus of all elements and make the
    # screenshot stable. Then hover over the button for visual effect.
    dialog.get_by_test_id("stMarkdownContainer").filter(
        has_text="Large-width Dialog"
    ).click()
    submit_button = get_button(dialog, "Submit")
    submit_button.hover()
    assert_snapshot(dialog, name="st_dialog-with_large_width")


# its enough to test this on one browser as showing the error inline is more a backend
# functionality than a frontend one
@pytest.mark.only_browser("chromium")
def test_dialog_shows_error_inline(app: Page, assert_snapshot: ImageCompareFunction):
    """Additional check to the unittests we have to ensure errors thrown during the main
    script execution (not a fragment-only rerun) are rendered within the dialog.
    """
    open_dialog_with_internal_error(app)
    wait_for_app_run(app)
    dialog = app.get_by_role("dialog")
    # click on the dialog title to take away focus of all elements and make the
    # screenshot stable. Then hover over the button for visual effect.
    dialog.get_by_test_id("stMarkdownContainer").filter(
        has_text="Dialog with error"
    ).click()
    expect(dialog.get_by_text("TypeError")).to_be_visible()
    assert_snapshot(dialog, name="st_dialog-with_inline_error")


def test_sidebar_dialog_displays_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    open_sidebar_dialog(app)
    wait_for_app_run(app, wait_delay=200)
    dialog = app.get_by_role("dialog")
    submit_button = get_button(dialog, "Submit")
    submit_button.hover()
    assert_snapshot(dialog, name="st_dialog-in_sidebar")


def test_nested_dialogs(app: Page):
    """Test that st.dialog may not be nested inside other dialogs."""
    open_nested_dialogs(app)
    wait_for_app_run(app)
    expect_exception(
        app, "StreamlitAPIException: Dialogs may not be nested inside other dialogs."
    )


# on webkit this test was flaky and manually reproducing the flaky error did not work,
# so we skip it for now
@pytest.mark.skip_browser("webkit")
def test_dialogs_have_different_fragment_ids(app: Page):
    """Test that st.dialog may not be nested inside other dialogs."""
    open_submit_button_dialog(app)
    wait_for_app_run(app)
    large_width_dialog_fragment_id = get_markdown(app, "Fragment Id:").text_content()
    dialog = app.get_by_role("dialog")
    submit_button = get_button(dialog, "Submit")
    submit_button.click()
    wait_for_app_run(app)

    open_nested_dialogs(app)
    wait_for_app_run(app)
    nested_dialog_fragment_id = get_markdown(app, "Fragment Id:").text_content()
    expect_exception(
        app, "StreamlitAPIException: Dialogs may not be nested inside other dialogs."
    )

    click_to_dismiss(app)
    # wait after dismiss so that we can open the next dialog
    app.wait_for_timeout(1000)
    expect(app.get_by_test_id(modal_test_id)).not_to_be_attached()
    open_submit_button_dialog(app)
    wait_for_app_run(app)
    dialog = app.get_by_role("dialog")

    submit_button = get_button(dialog, "Submit")
    submit_button.click()
    wait_for_app_run(app)

    expect_no_exception(app)

    assert large_width_dialog_fragment_id != nested_dialog_fragment_id


def test_dialog_copy_buttons_work(app: Page):
    """Test that the copy buttons in the dialog work as expected.

    We paste the copied content into an input field. We could use
    playwright's app.evaluate("navigator.clipboard.readText()") to get
    the copied text, but then we have to grant permission to the user
    agent to allow accessing the clipboard.
    """

    open_dialog_with_copy_buttons(app)
    wait_for_app_run(app)

    expect(app.get_by_test_id("stMarkdown")).to_have_text("")

    # click icon button
    json_element = app.get_by_test_id("stJson")
    json_element.hover()
    json_element.locator(".copy-icon").first.click()

    # paste the copied content into the input field
    app.get_by_test_id("stTextInput").locator("input").click()
    app.keyboard.press(f"{COMMAND_KEY}+V")
    app.keyboard.press("Enter")

    # we should see the pasted content written to the dialog
    expect(app.get_by_test_id("stMarkdown")).to_have_text("[1,2,3]")


def test_experimental_dialog_deprecation_warning(app: Page):
    """Test that using @st.experimental_dialog instead of @st.dialog results in a
    deprecation warning being displayed in the dialog.
    """
    expect(app.get_by_test_id("stAlert")).not_to_be_attached()

    open_dialog_with_deprecation_warning(app)

    expect(app.get_by_test_id("stAlert")).to_have_text(
        re.compile("Please replace st.experimental_dialog with st.dialog.\n.*")
    )


def test_dialog_with_chart(app: Page):
    open_dialog_with_chart(app)
    wait_for_app_run(app)
    main_dialog = app.get_by_test_id(modal_test_id)
    expect(main_dialog).to_have_count(1)

    # Check for the chart & tooltip
    chart = main_dialog.get_by_test_id("stVegaLiteChart")
    chart.hover(position={"x": 60, "y": 220})
    tooltip = app.locator("#vg-tooltip-element")
    expect(tooltip).to_be_visible()


def test_dialog_with_dataframe_shows_toolbar(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Check that the dataframe toolbar is fully visible when hovering over
    the dataframe.
    """
    click_button(app, "Open Dialog with dataframe")
    dialog = app.get_by_role("dialog")
    expect(dialog).to_be_visible()
    df_element = dialog.get_by_test_id("stDataFrame")
    expect(df_element).to_be_visible()
    df_element.hover(force=True)
    df_toolbar = df_element.get_by_test_id("stElementToolbar")
    expect(df_toolbar).to_have_css("opacity", "1")
    expect(df_toolbar).to_be_visible()
    assert_snapshot(df_toolbar, name="st_dialog-shows_full_dataframe_toolbar")


def test_dialog_with_dataframe_shows_column_menu_correctly(app: Page):
    """Check that the dataframe column menu is fully visible and positioned correctly."""
    click_button(app, "Open Dialog with dataframe")
    dialog = app.get_by_role("dialog")
    expect(dialog).to_be_visible()
    df_element = dialog.get_by_test_id("stDataFrame")
    expect(df_element).to_be_visible()

    open_column_menu(df_element, 1, "small")

    column_menu = app.get_by_test_id("stDataFrameColumnMenu")
    expect(column_menu).to_be_visible()
    expect(column_menu).to_be_in_viewport()
    assert is_child_bounding_box_inside_parent(column_menu, df_element)


def test_dialog_with_rerun_closes_even_if_button_is_clicked_multiple_times(app: Page):
    """Check that the dialog closes even if the button that calls st.rerun is clicked
    multiple times in fast succession. We want to test this since the button click and
    the st.rerun trigger fragment reruns and full app reruns, respectively. We want
    to ensure that the dialog closes in both cases and fragment-rerun messages do not
    interfere with the full app rerun (finished messages). If they would, we have
    observed the dialog to stay open and never closer again. So this test is more about
    sanity-checking the interplay of fragment runs and full app reruns rather than
    testing something dialog-specific, but with the dialog we have a visual way of
    seeing the issue.

    Important: The behavior is not deterministic as it relies on a race condition.
    This means that the test can succeed even though the underlying issue exists.
    However, the test will not always succeed if the issue exists. So if the test
    sometimes fails, it might point to an underlying issue.
    Performing this test manually triggers the issue much more often.
    """
    import time

    for _ in range(10):
        open_dialog_with_rerun(app)
        dialog = app.get_by_role("dialog")
        expect(dialog).to_be_visible()
        button = (
            app.get_by_test_id("stButton")
            .filter(has_text="Close Dialog")
            .locator("button")
        )
        counter = 0
        # simulate clicking the button multiple times in fast succession
        for _ in range(5):
            counter += 1
            try:
                button.click(timeout=1000, no_wait_after=True)
            except PlaywrightTimeoutError:
                # the dialog closed and the button does not exist anymore, so
                # do not try to click it again
                break

            # sleep to mimic human behavior. If the sleep time is too small or too high,
            # I was not able to trigger the behavior; which makes sense given that the
            # original issue that prompted this test to be written was rooted in timing
            # the outgoing message queue flushing / replace behavior in
            # forward_msg_queue.py.
            time.sleep(0.2)

        # ensure that the button was clicked at least twice, otherwise the whole test
        # does not make sense
        assert counter >= 2
        expect(dialog).not_to_be_attached()


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    open_dialog_with_images(app)
    check_top_level_class(app, "stDialog")


def test_dialog_with_long_title_displays_correctly(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that a dialog with a very long title displays correctly without overlapping the close button."""
    open_dialog_with_long_title(app)
    wait_for_app_run(app)
    dialog = app.get_by_role("dialog")
    # Take a snapshot to verify the long title doesn't overlap with the close button
    assert_snapshot(dialog, name="st_dialog-with_long_title")
