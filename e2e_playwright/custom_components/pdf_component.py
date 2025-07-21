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
import sys
from typing import Callable

import streamlit as st


def _create_sample_pdf_bytes() -> bytes:
    """Create a simple PDF as bytes for testing."""
    pdf_content = """%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Hello PDF World!) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
0000000373 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
446
%%EOF"""
    return pdf_content.encode("latin-1")


def use_st_pdf_basic():
    """Test basic st.pdf component usage."""
    pdf_bytes = _create_sample_pdf_bytes()
    st.pdf(pdf_bytes, height=400)
    st.success("st.pdf component loaded successfully!")


def use_st_pdf_file_upload():
    """Test st.pdf with file upload functionality."""
    uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")

    if uploaded_file is not None:
        st.pdf(uploaded_file, height=400)
        st.success("Uploaded PDF displayed successfully!")
    else:
        st.info("Showing sample PDF")
        pdf_bytes = _create_sample_pdf_bytes()
        st.pdf(pdf_bytes, height=300)


def use_st_pdf_custom_size():
    """Test st.pdf with custom height."""
    height = st.slider("Select PDF height", min_value=200, max_value=800, value=500)
    pdf_bytes = _create_sample_pdf_bytes()
    st.pdf(pdf_bytes, height=height)
    st.success("PDF displayed with custom height")


def use_st_pdf_base64():
    """Test st.pdf with base64 encoded data."""
    pdf_bytes = _create_sample_pdf_bytes()
    encoded_pdf = base64.b64encode(pdf_bytes)

    st.write(f"**Base64 PDF length:** {len(encoded_pdf)} characters")
    st.code(encoded_pdf[:100].decode() + "...", language="text")

    decoded_pdf = base64.b64decode(encoded_pdf)
    st.pdf(decoded_pdf, height=400)
    st.success("Base64 PDF displayed successfully!")


def use_st_pdf_bytes_io():
    """Test st.pdf with BytesIO object."""
    pdf_bytes = _create_sample_pdf_bytes()
    bytes_io = io.BytesIO(pdf_bytes)
    st.pdf(bytes_io, height=400)
    st.success("BytesIO PDF displayed successfully!")


def use_st_pdf_error_handling():
    """Test st.pdf error handling with invalid data."""
    st.warning("Attempting to display invalid PDF data")

    # Display invalid PDF data - component handles it gracefully
    invalid_pdf = b"This is not a valid PDF file"
    st.pdf(invalid_pdf, height=300)

    st.error("Expected error with invalid PDF data")
    st.info("This demonstrates error handling for invalid PDF content.")


def use_st_pdf_multiple_files():
    """Test st.pdf with multiple files."""
    st.markdown("### Multiple PDF Display")

    for i in range(1, 4):
        st.write(f"**PDF #{i}**")
        pdf_bytes = _create_sample_pdf_bytes()
        st.pdf(pdf_bytes, height=250, key=f"pdf_multiple_{i}")

    st.success("Multiple PDFs displayed successfully!")


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

    st.success("PDFs displayed in columns successfully!")


def use_st_pdf_interactive():
    """Test interactive PDF features."""
    st.markdown("### Interactive PDF Test")

    height = st.slider("Adjust PDF height", min_value=200, max_value=800, value=400)

    if st.button("Reset Height"):
        st.rerun()

    pdf_bytes = _create_sample_pdf_bytes()
    st.pdf(pdf_bytes, height=height)
    st.success("Interactive PDF features working!")


def use_st_pdf_accessibility():
    """Test st.pdf accessibility features."""
    st.markdown("### PDF Accessibility Test")

    heights = [200, 350, 500]
    for _, height in enumerate(heights, 1):
        st.write(f"**PDF with height {height}px**")
        pdf_bytes = _create_sample_pdf_bytes()
        st.pdf(pdf_bytes, height=height, key=f"pdf_accessibility_{height}")

    st.success("PDF accessibility features tested!")


options: dict[str, Callable[[], None]] = {
    "basic": use_st_pdf_basic,
    "fileUpload": use_st_pdf_file_upload,
    "customSize": use_st_pdf_custom_size,
    "base64": use_st_pdf_base64,
    "bytesIO": use_st_pdf_bytes_io,
    "errorHandling": use_st_pdf_error_handling,
    "multipleFiles": use_st_pdf_multiple_files,
    "columns": use_st_pdf_in_columns,
    "accessibility": use_st_pdf_accessibility,
    "interactive": use_st_pdf_interactive,
}

st.markdown("# st.pdf Component Tests")
st.write("Select a PDF test scenario to run:")

# Debug information
st.write("**Debug Information:**")
st.write(f"- Python version: {sys.version}")
st.write(f"- Streamlit version: {st.__version__}")

# Check if streamlit_pdf is available
try:
    import streamlit_pdf

    st.success("✅ streamlit_pdf module is available")
    st.write(f"- streamlit_pdf location: {streamlit_pdf.__file__}")
except ImportError as e:
    st.error(f"❌ streamlit_pdf module not available: {e}")

# Check if PDF component is available
try:
    from streamlit.elements.pdf import _is_pdf_component_available

    if _is_pdf_component_available():
        st.success("✅ PDF component is available")
    else:
        st.error("❌ PDF component is not available")
except Exception as e:
    st.error(f"❌ Error checking PDF component: {e}")

st.divider()

component_selection = st.selectbox("PDF Test Scenarios", options=options.keys())

if component_selection:
    st.markdown(f"### Running: {component_selection}")
    try:
        options[component_selection]()
    except Exception as e:
        st.error(f"Error running {component_selection}: {e}")
        import traceback

        st.text(traceback.format_exc())
