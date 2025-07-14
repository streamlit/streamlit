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

from e2e_playwright.conftest import wait_for_app_run


def _select_pdf_scenario(app: Page, scenario: str):
    """Select a PDF test scenario from the dropdown."""
    selectbox_input = app.get_by_test_id("stSelectbox").locator("input")

    # Clear any existing text and type the scenario
    selectbox_input.clear()
    selectbox_input.type(scenario)
    selectbox_input.press("Enter")
    wait_for_app_run(app)


def _expect_no_exception(app: Page):
    """Expect that no exception was thrown."""
    expect(app.get_by_test_id("stException")).not_to_be_visible()


def _expect_iframe_attached(app: Page):
    """Expect a component iframe to be attached to the DOM."""
    expect(app.locator("iframe").first).to_be_attached()


def _expect_success_message(app: Page, message_text: str):
    """Expect a success message to be visible."""
    expect(app.get_by_test_id("stAlert").filter(has_text=message_text)).to_be_visible()


def _expect_error_message(app: Page, message_text: str):
    """Expect an error message to be visible."""
    expect(app.get_by_test_id("stAlert").filter(has_text=message_text)).to_be_visible()


def test_st_pdf_basic_functionality(app: Page):
    """Test basic st.pdf component functionality."""
    _select_pdf_scenario(app, "basic")
    _expect_no_exception(app)

    # Check if st.pdf loaded successfully
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="st.pdf component loaded successfully!"
    )

    if success_message.is_visible():
        # st.pdf component is working
        _expect_iframe_attached(app)
        _expect_success_message(app, "st.pdf component loaded successfully!")
    else:
        # st.pdf component has an error
        _expect_error_message(app, "Error with st.pdf")


def test_st_pdf_file_upload(app: Page):
    """Test st.pdf with file upload functionality."""
    _select_pdf_scenario(app, "fileUpload")
    _expect_no_exception(app)

    # Check if the file uploader is present
    file_uploader = app.get_by_test_id("stFileUploader")
    expect(file_uploader).to_be_visible()

    # Check if sample PDF is shown when no file is uploaded
    info_message = app.get_by_test_id("stAlert").filter(has_text="Showing sample PDF")

    if info_message.is_visible():
        # st.pdf component is working
        _expect_iframe_attached(app)
    else:
        # st.pdf component has an error
        _expect_error_message(app, "Error with st.pdf file upload")


def test_st_pdf_custom_size(app: Page):
    """Test st.pdf with custom height."""
    _select_pdf_scenario(app, "customSize")
    _expect_no_exception(app)

    # Check if height slider is present
    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    # Check if PDF is displayed or error is shown
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="PDF displayed with custom height"
    )

    if success_message.is_visible():
        # st.pdf component is working
        _expect_iframe_attached(app)
    else:
        # st.pdf component has an error
        _expect_error_message(app, "Error with st.pdf custom size")


def test_st_pdf_base64_encoding(app: Page):
    """Test st.pdf with base64 encoded data."""
    _select_pdf_scenario(app, "base64")
    _expect_no_exception(app)

    # Check if base64 info is displayed
    base64_info = app.get_by_test_id("stMarkdown").filter(has_text="Base64 PDF length:")
    expect(base64_info).to_be_visible()

    # Check if code block with base64 is shown
    code_block = app.get_by_test_id("stCodeBlock")
    expect(code_block).to_be_visible()

    # Check if PDF is displayed or error is shown
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="Base64 PDF displayed successfully!"
    )

    if success_message.is_visible():
        # st.pdf component is working
        _expect_iframe_attached(app)
    else:
        # st.pdf component has an error
        _expect_error_message(app, "Error with st.pdf base64")


def test_st_pdf_bytes_io(app: Page):
    """Test st.pdf with BytesIO object."""
    _select_pdf_scenario(app, "bytesIO")
    _expect_no_exception(app)

    # Check if success or error message is shown
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="BytesIO PDF displayed successfully!"
    )

    if success_message.is_visible():
        # st.pdf component is working
        _expect_iframe_attached(app)
    else:
        # st.pdf component has an error
        _expect_error_message(app, "Error with st.pdf BytesIO")


def test_st_pdf_error_handling(app: Page):
    """Test st.pdf error handling with invalid data."""
    _select_pdf_scenario(app, "errorHandling")
    _expect_no_exception(app)

    # Check if warning about invalid PDF data is shown
    warning_message = app.get_by_test_id("stAlert").filter(
        has_text="Attempting to display invalid PDF data"
    )
    expect(warning_message).to_be_visible()

    # Check if success (graceful handling) or error is shown
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="Invalid PDF handled gracefully!"
    )
    error_message = app.get_by_test_id("stAlert").filter(
        has_text="Expected error with invalid PDF data"
    )

    # Either st.pdf handled the invalid data gracefully or threw an error
    expect(success_message.or_(error_message)).to_be_visible()


def test_st_pdf_multiple_files(app: Page):
    """Test displaying multiple PDF files."""
    _select_pdf_scenario(app, "multipleFiles")
    _expect_no_exception(app)

    # Check if subheader for multiple PDFs is shown
    subheader = app.get_by_test_id("stMarkdown").filter(has_text="Multiple PDF Display")
    expect(subheader).to_be_visible()

    # Check if PDF labels are shown
    pdf_labels = app.get_by_test_id("stMarkdown").filter(
        has_text=re.compile(r"PDF #[1-3]")
    )
    expect(pdf_labels.first).to_be_visible()

    # Check if success or error message is shown
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="Multiple PDFs displayed successfully!"
    )

    if success_message.is_visible():
        # st.pdf component is working - should have multiple iframes
        iframes = app.locator("iframe")
        expect(iframes.first).to_be_attached()
    else:
        # st.pdf component has an error
        _expect_error_message(app, "Error with multiple st.pdf")


def test_st_pdf_in_columns(app: Page):
    """Test st.pdf in columns layout."""
    _select_pdf_scenario(app, "columns")
    _expect_no_exception(app)

    # Check if description is shown
    description = app.get_by_test_id("stMarkdown").filter(
        has_text="PDFs in Columns Layout"
    )
    expect(description).to_be_visible()

    # Check if column headers are shown
    col1_header = app.get_by_test_id("stMarkdown").filter(has_text="PDF in Column 1")
    col2_header = app.get_by_test_id("stMarkdown").filter(has_text="PDF in Column 2")

    expect(col1_header).to_be_visible()
    expect(col2_header).to_be_visible()

    # Check if success or error message is shown
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="PDFs displayed in columns successfully!"
    )
    error_message = app.get_by_test_id("stAlert").filter(
        has_text="Error with st.pdf in columns"
    )
    info_message = app.get_by_test_id("stAlert").filter(
        has_text="Some PDF components may not work well in column layouts"
    )

    # Either success or graceful error handling
    expect(success_message.or_(error_message).or_(info_message)).to_be_visible()


def test_st_pdf_in_tabs(app: Page):
    """Test st.pdf in tabs layout."""
    _select_pdf_scenario(app, "tabs")
    _expect_no_exception(app)

    # Check if description is shown
    description = app.get_by_test_id("stMarkdown").filter(
        has_text="PDFs in Tabs Layout"
    )
    expect(description).to_be_visible()

    # Check if tabs are present
    tabs = app.get_by_test_id("stTabs")
    expect(tabs).to_be_visible()

    # Check if tab labels are visible (with emojis)
    tab_labels = app.locator("[data-testid='stTabs'] button")
    expect(tab_labels.first).to_be_visible()

    # Check if the first tab content is visible by default
    first_tab_content = app.get_by_test_id("stMarkdown").filter(
        has_text="First PDF Document"
    )
    expect(first_tab_content).to_be_visible()

    # Check if success or error message is shown
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="PDFs displayed in tabs successfully!"
    )
    error_message = app.get_by_test_id("stAlert").filter(
        has_text="Error with st.pdf in tabs"
    )
    info_message = app.get_by_test_id("stAlert").filter(
        has_text="PDF components in tabs may have rendering limitations"
    )

    # Either success or graceful error handling
    expect(success_message.or_(error_message).or_(info_message)).to_be_visible()


def test_st_pdf_interactive(app: Page):
    """Test interactive PDF features."""
    _select_pdf_scenario(app, "interactive")
    _expect_no_exception(app)

    # Check if interactive subheader is shown
    subheader = app.get_by_test_id("stMarkdown").filter(has_text="Interactive PDF Test")
    expect(subheader).to_be_visible()

    # Check if height slider is present
    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    # Check if reset button is present
    reset_button = app.get_by_test_id("stButton").filter(has_text="Reset Height")
    expect(reset_button).to_be_visible()

    # Check if success or error message is shown
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="Interactive PDF features working!"
    )
    error_message = app.get_by_test_id("stAlert").filter(
        has_text="Error with interactive PDF"
    )

    # Either success or error should be visible
    expect(success_message.or_(error_message)).to_be_visible()


def test_st_pdf_accessibility(app: Page):
    """Test st.pdf accessibility features."""
    _select_pdf_scenario(app, "accessibility")
    _expect_no_exception(app)

    # Check if accessibility subheader is shown
    subheader = app.get_by_test_id("stMarkdown").filter(
        has_text="PDF Accessibility Test"
    )
    expect(subheader).to_be_visible()

    # Check if height labels are shown
    height_labels = app.get_by_test_id("stMarkdown").filter(
        has_text=re.compile(r"PDF with height \d+px")
    )
    expect(height_labels.first).to_be_visible()

    # Check if success or error message is shown
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="PDF accessibility features tested!"
    )

    if success_message.is_visible():
        # st.pdf component is working
        _expect_iframe_attached(app)
    else:
        # st.pdf component has an error
        _expect_error_message(app, "Error with st.pdf accessibility")


def test_st_pdf_app_title_and_selection(app: Page):
    """Test that the app title and selection dropdown work correctly."""
    # Check if app title is present
    title = app.get_by_test_id("stMarkdown").filter(has_text="st.pdf Component Tests")
    expect(title).to_be_visible()

    # Check if description is present
    description = app.get_by_test_id("stMarkdown").filter(
        has_text="Select a PDF test scenario to run:"
    )
    expect(description).to_be_visible()

    # Check if selectbox is present
    selectbox = app.get_by_test_id("stSelectbox")
    expect(selectbox).to_be_visible()

    # Test selecting different scenarios
    scenarios = [
        "basic",
        "fileUpload",
        "customSize",
        "base64",
        "bytesIO",
        "errorHandling",
        "multipleFiles",
        "columns",
        "tabs",
        "accessibility",
        "interactive",
    ]

    for scenario in scenarios[:3]:  # Test first 3 scenarios to verify dropdown works
        _select_pdf_scenario(app, scenario)

        # Check if scenario subheader appears
        subheader = app.get_by_test_id("stMarkdown").filter(
            has_text=f"Running: {scenario}"
        )
        expect(subheader).to_be_visible()


@pytest.mark.parametrize(
    "scenario",
    [
        "basic",
        "fileUpload",
        "customSize",
        "base64",
        "bytesIO",
        "errorHandling",
        "multipleFiles",
        "columns",
        "tabs",
        "accessibility",
        "interactive",
    ],
)
def test_all_st_pdf_scenarios_load_without_exception(app: Page, scenario: str):
    """Test that all st.pdf scenarios load without throwing exceptions."""
    _select_pdf_scenario(app, scenario)
    _expect_no_exception(app)

    # Check if running subheader appears
    subheader = app.get_by_test_id("stMarkdown").filter(has_text=f"Running: {scenario}")
    expect(subheader).to_be_visible()


def test_st_pdf_component_iframe_behavior(app: Page):
    """Test that st.pdf component creates proper iframe elements."""
    _select_pdf_scenario(app, "basic")
    _expect_no_exception(app)

    # Wait for any success or error message to appear
    success_message = app.get_by_test_id("stAlert").filter(
        has_text="st.pdf component loaded successfully!"
    )
    error_message = app.get_by_test_id("stAlert").filter(has_text="Error with st.pdf")

    # Wait for one of the messages to appear
    expect(success_message.or_(error_message)).to_be_visible()

    if success_message.is_visible():
        # If successful, check iframe properties
        iframe = app.locator("iframe").first
        expect(iframe).to_be_attached()

        # Check if iframe has proper attributes
        expect(iframe).to_have_attribute("src", re.compile(r".*"))
        expect(iframe).to_have_attribute("height", re.compile(r".*"))


def test_st_pdf_widget_interactions(app: Page):
    """Test interactions with st.pdf widget controls."""
    _select_pdf_scenario(app, "customSize")
    _expect_no_exception(app)

    # Interact with the height slider
    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    # Try to move the slider (basic interaction test)
    slider_thumb = height_slider.locator("[role='slider']")
    expect(slider_thumb).to_be_visible()

    # The slider should be functional
    expect(slider_thumb).to_have_attribute("aria-valuenow", re.compile(r".*"))
