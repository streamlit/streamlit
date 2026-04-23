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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import check_top_level_class, get_button


def test_spinner_execution(app: Page):
    # Can't use `click_button` here because that waits until the app finishes running,
    # which makes the spinner disappear.
    get_button(app, "Run spinner basic").click()
    expect(app.get_by_test_id("stSpinner")).to_have_text("Loading...")
    check_top_level_class(app, "stSpinner")


def test_spinner_time(app: Page):
    # Can't use `click_button` here because that waits until the app finishes running,
    # which makes the spinner disappear.
    get_button(app, "Run spinner with time").click()
    expect(app.get_by_test_id("stSpinner")).to_contain_text("Loading...")
    expect(app.get_by_test_id("stSpinner")).to_contain_text("seconds")
    check_top_level_class(app, "stSpinner")

    # Check that the timer text changes.
    # We're not doing any exact text matching of the time here since that might be flaky.
    initial_text = app.get_by_test_id("stSpinner").text_content()
    app.wait_for_timeout(200)
    updated_text = app.get_by_test_id("stSpinner").text_content()
    assert initial_text != updated_text


def test_double_spinner(app: Page):
    """Test that nested spinners appear in the correct order."""
    get_button(app, "Run double spinner").click()

    spinners = app.get_by_test_id("stSpinner")
    expect(spinners).to_have_count(2)
    expect(spinners.nth(0)).to_have_text("Loading...")
    expect(spinners.nth(1)).to_have_text("Also loading...")


def test_spinner_on_markdown(app: Page):
    """Test that running a spinner on a locked cursor (st.markdown) updates correctly."""
    get_button(app, "Run markdown updated with spinner").click()

    spinners = app.get_by_test_id("stSpinner")
    expect(spinners).to_have_count(1)
    expect(spinners.nth(0)).to_have_text("something")
    # Expect markdown to still be visible
    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(1)
    expect(markdown_elements.nth(0)).to_have_text("Some Text")

    wait_for_app_run(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    # markdown remains visible
    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(1)
    expect(markdown_elements.nth(0)).to_have_text("Some Text")


def test_spinner_in_empty_block(app: Page):
    """Test that running a spinner in a st.empty block updates correctly."""
    get_button(app, "Run spinner in with st.empty block").click()

    spinners = app.get_by_test_id("stSpinner")
    expect(spinners).to_have_count(1)
    expect(spinners.nth(0)).to_have_text("spinner in empty block")
    # Expect empty block to still be visible
    empty_elements = app.get_by_test_id("stEmpty")
    expect(empty_elements).to_have_count(1)

    wait_for_app_run(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    # empty block is cleared (and replaced with markdown)
    empty_elements = app.get_by_test_id("stEmpty")
    expect(empty_elements).to_have_count(0)

    markdown_elements = app.get_by_test_id("stMarkdown")
    expect(markdown_elements).to_have_count(1)
    expect(markdown_elements.nth(0)).to_have_text("Some More Text")


def test_spinner_in_fragment(app: Page):
    """Test that running a spinner in a fragment updates correctly."""
    get_button(app, "Run spinner in fragment").click()

    spinners = app.get_by_test_id("stSpinner")
    expect(spinners).to_have_count(1)
    expect(spinners.nth(0)).to_have_text("Loading...")

    wait_for_app_run(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(app.get_by_text("Run fragment")).to_be_visible()

    get_button(app, "Run fragment").click()
    expect(app.get_by_test_id("stSpinner")).to_have_count(1)
    expect(app.get_by_test_id("stSpinner").nth(0)).to_have_text("Loading...")

    wait_for_app_run(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(app.get_by_text("Run fragment")).to_be_visible()


def test_spinner_before_fragment(app: Page):
    """Test that running a spinner before a fragment does not make the spinner re-appear."""
    get_button(app, "Run spinner before fragment").click()

    spinners = app.get_by_test_id("stSpinner")
    expect(spinners).to_have_count(1)
    expect(spinners.nth(0)).to_have_text("Loading...")

    wait_for_app_run(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(app.get_by_text("Run fragment")).to_be_visible()

    get_button(app, "Run fragment").click()
    # spinners eventually disappear, so we shorten the timeout
    expect(app.get_by_test_id("stSpinner")).to_have_count(0, timeout=1000)

    wait_for_app_run(app)

    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(app.get_by_text("Run fragment")).to_be_visible()


def test_spinner_width_content(app: Page):
    """Test spinner with content width."""
    get_button(app, "Run spinner with content width (default)").click()
    expect(app.get_by_test_id("stSpinner")).to_contain_text(
        "Loading with content width..."
    )


def test_spinner_width_stretch(app: Page):
    """Test spinner with stretch width."""
    get_button(app, "Run spinner with stretch width").click()
    expect(app.get_by_test_id("stSpinner")).to_contain_text(
        "Loading with stretch width..."
    )


def test_spinner_width_300px(app: Page):
    """Test spinner with 300px width."""
    get_button(app, "Run spinner with 300px width").click()
    expect(app.get_by_test_id("stSpinner")).to_contain_text(
        "Loading with 300px width..."
    )


def test_spinner_width_content_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test spinner with content width snapshot."""
    get_button(app, "Run spinner with content width (default)").click()
    spinner_element = app.get_by_test_id("stSpinner")
    expect(spinner_element).to_be_visible()
    assert_snapshot(spinner_element, name="st_spinner-width_content")


def test_spinner_width_stretch_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test spinner with stretch width snapshot."""
    get_button(app, "Run spinner with stretch width").click()
    spinner_element = app.get_by_test_id("stSpinner")
    expect(spinner_element).to_be_visible()
    assert_snapshot(spinner_element, name="st_spinner-width_stretch")


def test_spinner_width_300px_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test spinner with 300px width snapshot."""
    get_button(app, "Run spinner with 300px width").click()
    spinner_element = app.get_by_test_id("stSpinner")
    expect(spinner_element).to_be_visible()
    assert_snapshot(spinner_element, name="st_spinner-width_300px")


def test_spinner_with_container_elements(app: Page):
    """Test that container elements (columns) can be created inside a spinner context.

    Regression test for issue #13658: App crash when creating container elements
    (st.columns, st.tabs) inside a container within a st.spinner context.
    """
    get_button(app, "Run spinner with container").click()

    # The spinner should appear first
    expect(app.get_by_test_id("stSpinner")).to_be_visible()

    # Wait for the app to finish running
    wait_for_app_run(app)

    # After the spinner completes, the columns should be visible with their content
    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(app.get_by_text("Column 1")).to_be_visible()
    expect(app.get_by_text("Column 2")).to_be_visible()


def test_spinner_with_delayed_container_write(app: Page):
    """Test that writing to a container after a delay inside spinner context works.

    This tests the scenario where a container is created inside a spinner,
    exists empty when the spinner first renders, and then content is added.
    The fix ensures the TransientNode properly captures the BlockNode as its
    anchor when replacing it.
    """
    get_button(app, "Run spinner with delayed container write").click()

    # The spinner should appear while processing
    expect(app.get_by_test_id("stSpinner")).to_be_visible()

    # Wait for the app to finish running
    wait_for_app_run(app)

    # After the spinner completes, the container content should be visible
    expect(app.get_by_test_id("stSpinner")).to_have_count(0)
    expect(app.get_by_text("Hello World")).to_be_visible()


def test_spinner_before_tabs_preserves_active_tab_and_increments_number_input(
    app: Page,
):
    """Test that tab selection and number input interaction survive reruns.

    Regression test for issue #14018: widgets in tabs should not reset tab
    selection when rendered after a spinner context.
    """
    get_button(app, "Enable spinner before tabs scenario").click()

    # Spinner appears while the scenario is initializing.
    expect(app.get_by_test_id("stSpinner")).to_be_visible()
    wait_for_app_run(app)

    tab_one = app.get_by_role("tab", name="tab_one")
    tab_two = app.get_by_role("tab", name="tab_two")
    number_input = app.get_by_role("spinbutton", name="number in tab")

    tab_two.click()
    expect(tab_two).to_have_attribute("aria-selected", "true")
    expect(tab_one).to_have_attribute("aria-selected", "false")

    initial_value = float(number_input.input_value())
    number_input.click()
    number_input.press("ArrowUp")
    wait_for_app_run(app)

    # Tab selection should not jump back to the first tab after rerun.
    expect(tab_two).to_have_attribute("aria-selected", "true")
    expect(tab_one).to_have_attribute("aria-selected", "false")
    updated_value = float(number_input.input_value())
    assert updated_value > initial_value
