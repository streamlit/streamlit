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

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run


def _select_pdf_scenario(app: Page, scenario: str):
    """Select a PDF test scenario from the dropdown."""
    selectbox_input = app.get_by_test_id("stSelectbox").locator("input")
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
    _expect_iframe_attached(app)
    _expect_success_message(app, "st.pdf component loaded successfully!")


def test_st_pdf_file_upload_no_file(app: Page):
    """Test st.pdf with file upload when no file is uploaded."""
    _select_pdf_scenario(app, "fileUpload")
    _expect_no_exception(app)

    file_uploader = app.get_by_test_id("stFileUploader")
    expect(file_uploader).to_be_visible()

    _expect_iframe_attached(app)
    expect(
        app.get_by_test_id("stAlert").filter(has_text="Showing sample PDF")
    ).to_be_visible()


def test_st_pdf_custom_size(app: Page):
    """Test st.pdf with custom height."""
    _select_pdf_scenario(app, "customSize")
    _expect_no_exception(app)

    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    _expect_iframe_attached(app)
    _expect_success_message(app, "PDF displayed with custom height")


def test_st_pdf_base64_encoding(app: Page):
    """Test st.pdf with base64 encoded data."""
    _select_pdf_scenario(app, "base64")
    _expect_no_exception(app)

    base64_info = app.get_by_test_id("stMarkdown").filter(has_text="Base64 PDF length:")
    expect(base64_info).to_be_visible()

    code_block = app.get_by_test_id("stCode")
    expect(code_block).to_be_visible()

    _expect_iframe_attached(app)
    _expect_success_message(app, "Base64 PDF displayed successfully!")


def test_st_pdf_bytes_io(app: Page):
    """Test st.pdf with BytesIO object."""
    _select_pdf_scenario(app, "bytesIO")
    _expect_no_exception(app)
    _expect_iframe_attached(app)
    _expect_success_message(app, "BytesIO PDF displayed successfully!")


def test_st_pdf_error_handling(app: Page):
    """Test st.pdf error handling with invalid data."""
    _select_pdf_scenario(app, "errorHandling")
    _expect_no_exception(app)

    warning_message = app.get_by_test_id("stAlert").filter(
        has_text="Attempting to display invalid PDF data"
    )
    expect(warning_message).to_be_visible()

    error_message = app.get_by_test_id("stAlert").filter(
        has_text="Expected error with invalid PDF data"
    )
    expect(error_message).to_be_visible()


def test_st_pdf_multiple_files(app: Page):
    """Test displaying multiple PDF files."""
    _select_pdf_scenario(app, "multipleFiles")
    _expect_no_exception(app)

    subheader = app.get_by_test_id("stMarkdown").filter(has_text="Multiple PDF Display")
    expect(subheader).to_be_visible()

    pdf_labels = app.get_by_test_id("stMarkdown").filter(
        has_text=re.compile(r"PDF #[1-3]")
    )
    expect(pdf_labels.first).to_be_visible()

    iframes = app.locator("iframe")
    expect(iframes.first).to_be_attached()
    _expect_success_message(app, "Multiple PDFs displayed successfully!")


def test_st_pdf_in_columns(app: Page):
    """Test st.pdf in columns layout."""
    _select_pdf_scenario(app, "columns")
    _expect_no_exception(app)

    description = app.get_by_test_id("stMarkdown").filter(
        has_text="PDFs in Columns Layout"
    )
    expect(description).to_be_visible()

    col1_header = app.get_by_test_id("stMarkdown").filter(has_text="PDF in Column 1")
    col2_header = app.get_by_test_id("stMarkdown").filter(has_text="PDF in Column 2")

    expect(col1_header).to_be_visible()
    expect(col2_header).to_be_visible()

    _expect_success_message(app, "PDFs displayed in columns successfully!")


def test_st_pdf_interactive(app: Page):
    """Test interactive PDF features."""
    _select_pdf_scenario(app, "interactive")
    _expect_no_exception(app)

    subheader = app.get_by_test_id("stMarkdown").filter(has_text="Interactive PDF Test")
    expect(subheader).to_be_visible()

    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    reset_button = app.get_by_test_id("stButton").filter(has_text="Reset Height")
    expect(reset_button).to_be_visible()

    _expect_success_message(app, "Interactive PDF features working!")


def test_st_pdf_accessibility(app: Page):
    """Test st.pdf accessibility features."""
    _select_pdf_scenario(app, "accessibility")
    _expect_no_exception(app)

    subheader = app.get_by_test_id("stMarkdown").filter(
        has_text="PDF Accessibility Test"
    )
    expect(subheader).to_be_visible()

    height_labels = app.get_by_test_id("stMarkdown").filter(
        has_text=re.compile(r"PDF with height \d+px")
    )
    expect(height_labels.first).to_be_visible()

    _expect_iframe_attached(app)
    _expect_success_message(app, "PDF accessibility features tested!")


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


@pytest.mark.parametrize(
    "scenario",
    [
        "basic",
        "fileUpload",
        "customSize",
        "base64",
        "bytesIO",
        "multipleFiles",
        "columns",
        "accessibility",
        "interactive",
    ],
)
def test_all_st_pdf_scenarios_load_without_exception(app: Page, scenario: str):
    """Test that all st.pdf scenarios load without throwing exceptions (except errorHandling)."""
    _select_pdf_scenario(app, scenario)
    _expect_no_exception(app)

    subheader = app.get_by_test_id("stMarkdown").filter(has_text=f"Running: {scenario}")
    expect(subheader).to_be_visible()


def test_st_pdf_component_iframe_behavior(app: Page):
    """Test that st.pdf component creates proper iframe elements."""
    _select_pdf_scenario(app, "basic")
    _expect_no_exception(app)

    _expect_success_message(app, "st.pdf component loaded successfully!")

    iframe = app.locator("iframe").first
    expect(iframe).to_be_attached()
    expect(iframe).to_have_attribute("src", re.compile(r".*"))
    expect(iframe).to_have_attribute("height", re.compile(r".*"))


def test_st_pdf_widget_interactions(app: Page):
    """Test interactions with st.pdf widget controls."""
    _select_pdf_scenario(app, "customSize")
    _expect_no_exception(app)

    height_slider = app.get_by_test_id("stSlider")
    expect(height_slider).to_be_visible()

    slider_thumb = height_slider.locator("[role='slider']")
    expect(slider_thumb).to_be_visible()
    expect(slider_thumb).to_have_attribute("aria-valuenow", re.compile(r".*"))


def test_pdf_component_availability_in_app(app: Page):
    """Test that the app correctly reports PDF component availability."""
    expect(
        app.get_by_test_id("stMarkdown").filter(has_text="Debug Information")
    ).to_be_visible()

    success_msg = app.get_by_test_id("stAlert").filter(
        has_text="✅ PDF component is available"
    )
    error_msg = app.get_by_test_id("stAlert").filter(
        has_text="❌ PDF component is not available"
    )

    expect(success_msg.or_(error_msg)).to_be_visible()
