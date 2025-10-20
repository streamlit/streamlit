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

from e2e_playwright.conftest import ImageCompareFunction
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


def test_spinner_on_locked_cursor_error(app: Page):
    """Test that running a spinner on a locked cursor (st.empty) raises an error."""
    get_button(app, "Run empty with spinner").click()
    expect(app.get_by_test_id("stException")).to_contain_text(
        "Unable to update an existing element with st.spinner."
    )


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
