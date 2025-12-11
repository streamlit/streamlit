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

"""Test app for st.pdf component functionality and various PDF scenarios."""

import re

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run, wait_until
from e2e_playwright.shared.app_utils import reset_hovering, select_selectbox_option


def _select_pdf_scenario(app: Page, scenario: str):
    """Select a PDF test scenario from the dropdown."""
    select_selectbox_option(app, "PDF Test Scenarios", scenario)
    # reset hovering to avoid some flakiness:
    reset_hovering(app)


def _expect_pdf_container_attached(app: Page):
    """Expect the PDF component container to be attached to the DOM."""
    pdf_container = app.get_by_test_id("pdf-container")
    expect(pdf_container).to_be_attached()


def _wait_for_slider_to_be_ready(app: Page, timeout: int = 5000):
    """Wait for the slider to be ready for interaction.

    Parameters
    ----------
    app : Page
        The page containing the slider
    timeout : int
        Maximum time to wait in milliseconds
    """
    slider = app.get_by_test_id("stSlider")
    if slider.count() > 0:
        # If there's a slider on the page, wait for it to be ready
        expect(slider).to_be_visible(timeout=timeout)
        expect(slider.get_by_role("slider")).to_be_enabled(timeout=timeout)


def _wait_for_pdf_to_load(
    app: Page, timeout: int = 15000, pdf_container: Locator | None = None
):
    """Wait for PDF content to finish loading inside the DOM container.

    The PDF component renders directly in the DOM (no iframe) and exposes
    a container with data-testid="pdf-container".

    Parameters
    ----------
    app : Page
        The page containing the PDF component
    timeout : int
        Maximum time to wait in milliseconds
    pdf_container : Locator | None
        Optional locator for a specific PDF container. If not provided,
        the default container test id is used.
    """
    if pdf_container is None:
        pdf_container = app.get_by_test_id("pdf-container")

    # First ensure the container is attached and visible
    expect(pdf_container).to_be_visible(timeout=timeout)

    # While loading, the component may render an element with data-testid="pdf-loading".
    # We wait for that loading indicator to be hidden or gone.
    loading_indicator = pdf_container.get_by_test_id("pdf-loading")
    expect(loading_indicator).to_be_hidden(timeout=timeout)

    # Wait for the first page to actually render in the DOM.
    # The PDF component uses a virtualized list with data-index attributes for pages.
    first_page = pdf_container.locator('[data-index="0"]')
    expect(first_page).to_be_visible(timeout=timeout)


def test_st_pdf_basic_functionality(app: Page, assert_snapshot: ImageCompareFunction):
    """Test basic st.pdf component functionality with snapshot."""
    _select_pdf_scenario(app, "basic")
    _expect_pdf_container_attached(app)

    # Wait for PDF to be fully loaded before taking snapshot
    _wait_for_pdf_to_load(app)
    pdf_container = app.get_by_test_id("pdf-container")
    assert_snapshot(pdf_container, name="st_pdf-basic_functionality")


def test_st_pdf_file_upload_no_file(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.pdf with file upload when no file is uploaded."""
    _select_pdf_scenario(app, "fileUpload")

    file_uploader = app.get_by_test_id("stFileUploader")
    expect(file_uploader).to_be_visible()

    # Should not display any PDF when no file is uploaded
    expect(app.get_by_test_id("pdf-container")).not_to_be_attached()

    # Take snapshot of just the file uploader state
    file_uploader = app.get_by_test_id("stFileUploader")
    assert_snapshot(file_uploader, name="st_pdf-file_upload_no_file")


def test_st_pdf_custom_size(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.pdf with custom height."""
    _select_pdf_scenario(app, "customSize")

    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    # Wait for slider to be ready for interaction
    _wait_for_slider_to_be_ready(app)

    _expect_pdf_container_attached(app)

    # Wait for PDF to be fully loaded
    _wait_for_pdf_to_load(app)

    # Capture just the PDF container to focus on the height setting
    pdf_container = app.get_by_test_id("pdf-container")
    assert_snapshot(pdf_container, name="st_pdf-custom_size")


def test_st_pdf_base64_encoding(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.pdf with base64 encoded data."""
    _select_pdf_scenario(app, "base64")

    base64_info = app.get_by_test_id("stMarkdown").filter(has_text="Base64 PDF length:")
    expect(base64_info).to_be_visible()

    code_block = app.get_by_test_id("stCode")
    expect(code_block).to_be_visible()

    _expect_pdf_container_attached(app)

    # Wait for PDF to be fully loaded
    _wait_for_pdf_to_load(app)

    # Take snapshot of just the PDF container, following the good example from bytes_io test
    pdf_container = app.get_by_test_id("pdf-container")
    assert_snapshot(pdf_container, name="st_pdf-base64_encoding")


def test_st_pdf_bytes_io(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.pdf with BytesIO object."""
    _select_pdf_scenario(app, "bytesIO")
    _expect_pdf_container_attached(app)

    # Wait for PDF to be fully loaded before taking snapshot
    _wait_for_pdf_to_load(app)

    pdf_container = app.get_by_test_id("pdf-container")
    assert_snapshot(pdf_container, name="st_pdf-bytes_io")


def test_st_pdf_error_handling(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.pdf error handling with invalid data."""
    _select_pdf_scenario(app, "errorHandling")

    warning_message = app.get_by_test_id("stAlert").filter(
        has_text="Attempting to display invalid PDF data"
    )
    expect(warning_message).to_be_visible()

    # Even with invalid data, the component should still render the PDF container
    pdf_container = app.get_by_test_id("pdf-container")
    expect(pdf_container).to_be_visible()

    # Capture just the warning message - the error state in the PDF viewer isn't visually meaningful
    warning_message = app.get_by_test_id("stAlert")
    assert_snapshot(warning_message, name="st_pdf-error_handling")


def test_st_pdf_in_columns(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.pdf in columns layout."""
    _select_pdf_scenario(app, "columns")

    description = app.get_by_test_id("stMarkdown").filter(
        has_text="PDFs in Columns Layout"
    )
    expect(description).to_be_visible()

    col1_header = app.get_by_test_id("stMarkdown").filter(has_text="PDF in Column 1")
    col2_header = app.get_by_test_id("stMarkdown").filter(has_text="PDF in Column 2")

    expect(col1_header).to_be_visible()
    expect(col2_header).to_be_visible()

    # Verify multiple PDFs are rendered in columns
    pdf_containers = app.get_by_test_id("pdf-container")
    expect(pdf_containers).to_have_count(2)

    # Wait for both containers to be visible
    first_container = pdf_containers.nth(0)
    second_container = pdf_containers.nth(1)
    expect(first_container).to_be_visible()
    expect(second_container).to_be_visible()

    # Wait for both PDFs to load
    _wait_for_pdf_to_load(app, pdf_container=first_container)
    _wait_for_pdf_to_load(app, pdf_container=second_container)

    # Take snapshot focusing on the column layout with PDFs
    columns_container = app.get_by_test_id("stHorizontalBlock")
    assert_snapshot(columns_container, name="st_pdf-in_columns")


def test_st_pdf_interactive(app: Page, assert_snapshot: ImageCompareFunction):
    """Test interactive PDF features."""
    _select_pdf_scenario(app, "interactive")

    subheader = app.get_by_test_id("stMarkdown").filter(has_text="Interactive PDF Test")
    expect(subheader).to_be_visible()

    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    # Wait for slider to be ready for interaction
    _wait_for_slider_to_be_ready(app)

    reset_button = app.get_by_test_id("stButton").filter(has_text="Reset Height")
    expect(reset_button).to_be_visible()

    _expect_pdf_container_attached(app)

    # Wait for PDF to be fully loaded
    _wait_for_pdf_to_load(app)

    # Take snapshot of just the PDF container in initial state
    pdf_container = app.get_by_test_id("pdf-container")
    assert_snapshot(pdf_container, name="st_pdf-interactive_initial")

    # Test that the reset button actually works
    reset_button.click()
    wait_for_app_run(app)

    # After reset, the PDF should still be visible
    _expect_pdf_container_attached(app)

    # Wait for PDF to load again after reset
    _wait_for_pdf_to_load(app)

    # Take snapshot after reset to verify state
    assert_snapshot(pdf_container, name="st_pdf-interactive_after_reset")


def test_st_pdf_app_title_and_selection(app: Page):
    """Test that the app title and selection dropdown work correctly."""
    title = app.get_by_test_id("stMarkdown").filter(has_text="st.pdf Component Tests")
    expect(title).to_be_visible()

    description = app.get_by_test_id("stMarkdown").filter(
        has_text="Select a PDF test scenario to run:"
    )
    expect(description).to_be_visible()

    selectbox = app.get_by_test_id("stSelectbox")
    expect(selectbox).to_be_visible()

    scenarios = [
        "basic",
        "fileUpload",
        "customSize",
    ]

    for scenario in scenarios:
        _select_pdf_scenario(app, scenario)

        subheader = app.get_by_test_id("stMarkdown").filter(
            has_text=f"Running: {scenario}"
        )
        expect(subheader).to_be_visible()


def test_st_pdf_component_container_behavior(app: Page):
    """Test that st.pdf component creates a proper DOM container."""
    _select_pdf_scenario(app, "basic")

    pdf_container = app.get_by_test_id("pdf-container")
    expect(pdf_container).to_be_attached()
    expect(pdf_container).to_be_visible()


def test_st_pdf_widget_interactions(app: Page):
    """Test interactions with st.pdf widget controls."""
    _select_pdf_scenario(app, "customSize")

    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    # Wait for slider to be ready for interaction
    _wait_for_slider_to_be_ready(app)

    slider_thumb = height_slider.locator("[role='slider']")
    expect(slider_thumb).to_be_visible()
    expect(slider_thumb).to_have_attribute("aria-valuenow", re.compile(r".*"))

    # Verify that the PDF renders with the current slider value
    _expect_pdf_container_attached(app)


def test_st_pdf_different_heights_snapshots(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test PDF component with different height values for visual comparison."""
    # Set a taller viewport to accommodate the maximum PDF height (800px)
    app.set_viewport_size({"width": 1280, "height": 1000})

    _select_pdf_scenario(app, "customSize")

    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    # Wait for slider to be ready for interaction
    _wait_for_slider_to_be_ready(app)

    # Wait for initial PDF to load
    _expect_pdf_container_attached(app)
    _wait_for_pdf_to_load(app, timeout=30000)

    pdf_container = app.get_by_test_id("pdf-container")

    # Record initial height and take snapshot at default height (500px)
    initial_box = pdf_container.bounding_box()
    assert initial_box is not None
    initial_height = initial_box["height"]
    assert_snapshot(pdf_container, name="st_pdf-height_default")

    # Get the actual slider element
    slider_element = height_slider.get_by_role("slider")
    expect(slider_element).to_be_visible()

    # Move slider to minimum (200px) using proper e2e slider interaction
    slider_element.hover()
    app.mouse.down()

    # Move mouse far to the left to reach minimum value
    app.mouse.move(0, 0)  # Move to far left of screen
    app.mouse.up()
    wait_for_app_run(app)
    # Wait for PDF to adjust to new height and fully load
    _wait_for_pdf_to_load(app, timeout=30000)

    # Verify we actually reached a noticeably lower height than the initial one
    def _is_min_height_reached() -> bool:
        box = pdf_container.bounding_box()
        return box is not None and box["height"] < initial_height - 10

    wait_until(app, _is_min_height_reached, timeout=7000)

    min_box = pdf_container.bounding_box()
    assert min_box is not None
    min_height = min_box["height"]

    assert_snapshot(pdf_container, name="st_pdf-height_minimum")

    # Move slider to maximum (800px) using proper e2e slider interaction
    slider_element.hover()
    app.mouse.down()

    # Move mouse far to the right to reach maximum value
    app.mouse.move(1000, 0)  # Move to far right of screen

    app.mouse.up()
    wait_for_app_run(app)

    # Wait for PDF to adjust to new height and fully load
    _wait_for_pdf_to_load(app, timeout=30000)

    # Verify we actually reached a higher height than the minimum one
    def _is_max_height_reached() -> bool:
        box = pdf_container.bounding_box()
        return box is not None and box["height"] > min_height + 10

    wait_until(app, _is_max_height_reached, timeout=7000)

    assert_snapshot(pdf_container, name="st_pdf-height_maximum")
