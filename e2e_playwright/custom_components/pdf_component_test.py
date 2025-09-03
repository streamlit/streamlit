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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run, wait_until


def _select_pdf_scenario(app: Page, scenario: str):
    """Select a PDF test scenario from the dropdown."""
    selectbox_input = app.get_by_test_id("stSelectbox").locator("input")
    selectbox_input.clear()
    selectbox_input.type(scenario)
    selectbox_input.press("Enter")
    wait_for_app_run(app)


def _expect_iframe_attached(app: Page):
    """Expect a component iframe to be attached to the DOM."""
    expect(app.locator("iframe").first).to_be_attached()


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


def _wait_for_pdf_to_load(app: Page, timeout: int = 15000):
    """Wait for PDF content to finish loading inside the iframe.

    We can't directly access iframe content due to cross-origin restrictions,
    but we can use Playwright's frame locator to wait for elements inside the iframe.

    Parameters
    ----------
    app : Page
        The page containing the PDF component
    timeout : int
        Maximum time to wait in milliseconds
    """
    iframe = app.locator("iframe").first

    # First ensure the iframe is attached and visible
    expect(iframe).to_be_visible(timeout=timeout)

    # Wait for the iframe to have a src attribute
    expect(iframe).to_have_attribute("src", re.compile(r".+"), timeout=timeout)

    # Get the frame locator to access content inside the iframe
    # This works even with cross-origin iframes in Playwright
    frame = app.frame_locator("iframe").first

    # Wait for the loading indicator to disappear
    # The PDF component shows a div with data-testid="pdf-loading" while loading
    loading_indicator = frame.get_by_test_id("pdf-loading")

    # Wait for the loading indicator to be hidden (not visible)
    # This means the PDF has finished loading
    expect(loading_indicator).to_be_hidden(timeout=timeout)

    # Wait for the first page to actually render in the DOM
    # The PDF component uses a virtualized list with data-index attributes for pages
    first_page = frame.locator('[data-index="0"]')
    expect(first_page).to_be_visible(timeout=timeout)


def _reset_pdf_zoom(app: Page):
    """Reset PDF zoom to fit width by clicking zoom out button until disabled.

    This ensures consistent snapshot testing by normalizing the zoom level.
    """
    # Try to click zoom out button until it's disabled
    # The button is within the iframe's document
    try:
        # Use JavaScript to interact with the iframe content
        app.evaluate("""
            () => {
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        if (iframeDoc) {
                            // Look for zoom out button and click it until disabled
                            let clickCount = 0;
                            const maxClicks = 10; // Safety limit

                            const clickZoomOut = () => {
                                const zoomOutBtn = iframeDoc.querySelector('button[title="Zoom Out"]');
                                if (zoomOutBtn && !zoomOutBtn.disabled && clickCount < maxClicks) {
                                    zoomOutBtn.click();
                                    clickCount++;
                                    setTimeout(clickZoomOut, 100); // Wait a bit between clicks
                                }
                            };

                            clickZoomOut();
                        }
                    } catch (e) {
                        console.log('Could not access iframe content for zoom reset:', e);
                    }
                });
            }
        """)

        # Give it a moment to settle after zoom changes
        app.wait_for_timeout(500)
    except Exception as e:
        # If we can't reset zoom, continue anyway - test might still work
        print(f"Warning: Could not reset PDF zoom: {e}")


def test_st_pdf_basic_functionality(app: Page, assert_snapshot: ImageCompareFunction):
    """Test basic st.pdf component functionality with snapshot."""
    _select_pdf_scenario(app, "basic")
    _expect_iframe_attached(app)

    # Verify iframe has proper attributes for PDF rendering
    iframe = app.locator("iframe").first
    expect(iframe).to_have_attribute("src", re.compile(r".*"))
    expect(iframe).to_have_attribute("height", "400")

    # Wait for PDF to be fully loaded before taking snapshot
    _wait_for_pdf_to_load(app)
    assert_snapshot(iframe, name="st_pdf-basic_functionality")


def test_st_pdf_file_upload_no_file(app: Page):
    """Test st.pdf with file upload when no file is uploaded."""
    _select_pdf_scenario(app, "fileUpload")

    file_uploader = app.get_by_test_id("stFileUploader")
    expect(file_uploader).to_be_visible()

    # Should not display any PDF when no file is uploaded
    expect(app.locator("iframe")).not_to_be_attached()


def test_st_pdf_custom_size(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.pdf with custom height."""
    _select_pdf_scenario(app, "customSize")

    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    # Wait for slider to be ready for interaction
    _wait_for_slider_to_be_ready(app)

    _expect_iframe_attached(app)

    # Wait for PDF to be fully loaded
    _wait_for_pdf_to_load(app)

    # Capture just the PDF iframe to focus on the height setting
    iframe = app.locator("iframe").first
    assert_snapshot(iframe, name="st_pdf-custom_size")


def test_st_pdf_base64_encoding(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.pdf with base64 encoded data."""
    _select_pdf_scenario(app, "base64")

    base64_info = app.get_by_test_id("stMarkdown").filter(has_text="Base64 PDF length:")
    expect(base64_info).to_be_visible()

    code_block = app.get_by_test_id("stCode")
    expect(code_block).to_be_visible()

    _expect_iframe_attached(app)

    # Wait for PDF to be fully loaded
    _wait_for_pdf_to_load(app)

    # Take snapshot of just the PDF iframe, following the good example from bytes_io test
    iframe = app.locator("iframe").first
    assert_snapshot(iframe, name="st_pdf-base64_encoding")


def test_st_pdf_bytes_io(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.pdf with BytesIO object."""
    _select_pdf_scenario(app, "bytesIO")
    _expect_iframe_attached(app)

    # Wait for PDF to be fully loaded before taking snapshot
    _wait_for_pdf_to_load(app)

    iframe = app.locator("iframe").first
    assert_snapshot(iframe, name="st_pdf-bytes_io")


def test_st_pdf_error_handling(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.pdf error handling with invalid data."""
    _select_pdf_scenario(app, "errorHandling")

    warning_message = app.get_by_test_id("stAlert").filter(
        has_text="Attempting to display invalid PDF data"
    )
    expect(warning_message).to_be_visible()

    # Even with invalid data, the component should still render an iframe
    _expect_iframe_attached(app)

    # For error cases, we still need to wait for the component to finish loading
    # even if it shows an error state
    iframe = app.locator("iframe").first
    expect(iframe).to_be_visible()

    # Wait for the error state to render using wait_until instead of timeout
    wait_until(
        app,
        lambda: iframe.evaluate(
            """
            (iframe) => {
                try {
                    // Check if error state has rendered by ensuring the iframe has content
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    return doc && doc.body && doc.body.children.length > 0;
                } catch (e) {
                    // If we can't access the iframe content, assume it's still loading
                    return false;
                }
            }
            """,
            iframe,
        ),
        timeout=3000,
    )

    # Capture just the warning message - the error state in the iframe isn't visually meaningful
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
    iframes = app.locator("iframe")
    expect(iframes).to_have_count(2)

    # Wait for both iframes to be visible
    expect(iframes.first).to_be_visible()
    expect(iframes.last).to_be_visible()

    # Wait for both PDFs to load
    _wait_for_pdf_to_load(app)

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

    _expect_iframe_attached(app)

    # Wait for PDF to be fully loaded
    _wait_for_pdf_to_load(app)

    # Take snapshot of just the PDF iframe in initial state
    iframe = app.locator("iframe").first
    assert_snapshot(iframe, name="st_pdf-interactive_initial")

    # Test that the reset button actually works
    reset_button.click()
    wait_for_app_run(app)

    # After reset, the PDF should still be visible
    _expect_iframe_attached(app)

    # Wait for PDF to load again after reset
    _wait_for_pdf_to_load(app)

    # Take snapshot after reset to verify state
    assert_snapshot(iframe, name="st_pdf-interactive_after_reset")


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


def test_st_pdf_component_iframe_behavior(app: Page):
    """Test that st.pdf component creates proper iframe elements."""
    _select_pdf_scenario(app, "basic")

    iframe = app.locator("iframe").first
    expect(iframe).to_be_attached()
    expect(iframe).to_have_attribute("src", re.compile(r".*"))
    expect(iframe).to_have_attribute("height", re.compile(r".*"))


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
    _expect_iframe_attached(app)


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
    _expect_iframe_attached(app)
    _wait_for_pdf_to_load(app, timeout=30000)

    iframe = app.locator("iframe").first

    # Take snapshot at default height (500px)
    assert_snapshot(iframe, name="st_pdf-height_default")

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

    # Verify we actually reached a low height value (around 200px)
    wait_until(
        app,
        lambda: (height := iframe.get_attribute("height")) is not None
        and int(height) <= 250,
        timeout=7000,
    )

    assert_snapshot(iframe, name="st_pdf-height_minimum")

    # Move slider to maximum (800px) using proper e2e slider interaction
    slider_element.hover()
    app.mouse.down()

    # Move mouse far to the right to reach maximum value
    app.mouse.move(1000, 0)  # Move to far right of screen

    app.mouse.up()
    wait_for_app_run(app)

    # Wait for PDF to adjust to new height and fully load
    _wait_for_pdf_to_load(app, timeout=30000)

    # Verify we actually reached a high height value (should be much larger than minimum)
    wait_until(
        app,
        lambda: (height := iframe.get_attribute("height")) is not None
        and int(height) >= 280,
        timeout=7000,
    )

    assert_snapshot(iframe, name="st_pdf-height_maximum")
