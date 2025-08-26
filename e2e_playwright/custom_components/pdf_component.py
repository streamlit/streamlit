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

"""Test app for st.pdf component functionality.

This test app includes various PDF component scenarios using st.pdf.
Each scenario tests different aspects of the native PDF component.
If the component has issues, an exception is shown.
"""

from __future__ import annotations

import base64
import io
from typing import Callable

import streamlit as st

# Compact dummy PDF for testing
_DUMMY_PDF_CONTENT = (
    "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n"
    "2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n"
    "3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n"
    "/Contents 4 0 R\n/Resources <<\n/Font <<\n/F1 5 0 R\n>>\n>>\n>>\nendobj\n"
    "4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n"
    "(Hello PDF World!) Tj\nET\nendstream\nendobj\n"
    "5 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\nendobj\n"
    "xref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n"
    "0000000115 00000 n\n0000000274 00000 n\n0000000373 00000 n\ntrailer\n"
    "<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n446\n%%EOF"
)


def _create_sample_pdf_bytes() -> bytes:
    """Create a simple PDF as bytes for testing."""
    return _DUMMY_PDF_CONTENT.encode("latin-1")


def use_st_pdf_basic():
    """Test basic st.pdf component usage."""
    pdf_bytes = _create_sample_pdf_bytes()
    st.pdf(pdf_bytes, height=400)


def use_st_pdf_file_upload():
    """Test st.pdf with file upload functionality."""
    uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")

    if uploaded_file is not None:
        st.pdf(uploaded_file, height=400)


def use_st_pdf_custom_size():
    """Test st.pdf with custom height."""
    height = st.slider("Select PDF height", min_value=200, max_value=800, value=500)
    pdf_bytes = _create_sample_pdf_bytes()
    st.pdf(pdf_bytes, height=height)


def use_st_pdf_base64():
    """Test st.pdf with base64 encoded data."""
    pdf_bytes = _create_sample_pdf_bytes()
    encoded_pdf = base64.b64encode(pdf_bytes)

    st.write(f"**Base64 PDF length:** {len(encoded_pdf)} characters")
    st.code(encoded_pdf[:100].decode() + "...", language="text")

    decoded_pdf = base64.b64decode(encoded_pdf)
    st.pdf(decoded_pdf, height=400)


def use_st_pdf_bytes_io():
    """Test st.pdf with BytesIO object."""
    pdf_bytes = _create_sample_pdf_bytes()
    bytes_io = io.BytesIO(pdf_bytes)
    st.pdf(bytes_io, height=400)


def use_st_pdf_error_handling():
    """Test st.pdf error handling with invalid data."""
    st.warning("Attempting to display invalid PDF data")

    # Display invalid PDF data - component handles it gracefully
    invalid_pdf = b"This is not a valid PDF file"
    st.pdf(invalid_pdf, height=300)


def use_st_pdf_in_columns():
    """Test st.pdf in columns layout."""
    st.write("**PDFs in Columns Layout**")
    col1, col2 = st.columns(2)

    with col1:
        st.write("**PDF in Column 1**")
        pdf_bytes = _create_sample_pdf_bytes()
        st.pdf(pdf_bytes, height=300, key="pdf_column_1")

    with col2:
        st.write("**PDF in Column 2**")
        pdf_bytes = _create_sample_pdf_bytes()
        st.pdf(pdf_bytes, height=300, key="pdf_column_2")


def use_st_pdf_interactive():
    """Test interactive PDF features."""
    st.markdown("### Interactive PDF Test")

    # Initialize height in session state if not present
    if "pdf_height" not in st.session_state:
        st.session_state.pdf_height = 400

    height = st.slider(
        "Adjust PDF height",
        min_value=200,
        max_value=800,
        value=st.session_state.pdf_height,
        key="height_slider",
    )

    if st.button("Reset Height"):
        st.session_state.pdf_height = 400
        st.rerun()

    pdf_bytes = _create_sample_pdf_bytes()
    st.pdf(pdf_bytes, height=height)


options: dict[str, Callable[[], None]] = {
    "basic": use_st_pdf_basic,
    "fileUpload": use_st_pdf_file_upload,
    "customSize": use_st_pdf_custom_size,
    "base64": use_st_pdf_base64,
    "bytesIO": use_st_pdf_bytes_io,
    "errorHandling": use_st_pdf_error_handling,
    "columns": use_st_pdf_in_columns,
    "interactive": use_st_pdf_interactive,
}

st.markdown("# st.pdf Component Tests")
st.write("Select a PDF test scenario to run:")

st.divider()

component_selection = st.selectbox("PDF Test Scenarios", options=options.keys())

if component_selection:
    st.markdown(f"### Running: {component_selection}")
    options[component_selection]()
