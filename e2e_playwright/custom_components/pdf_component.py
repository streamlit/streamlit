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

"""Test the PDF component logic and various PDF scenarios.

This test app includes various PDF component actions and scenarios using st.pdf.
The function for each scenario tests different aspects of the native PDF component.
If the component has issues, an exception is shown.

Following PDF scenarios are tested:
- st.pdf basic usage
- st.pdf with file upload
- st.pdf with byte data
- st.pdf with custom height
- st.pdf error handling with invalid data
- st.pdf with multiple files
- st.pdf in columns layout
- st.pdf with base64 encoded data
"""

from __future__ import annotations

import base64
import io
import sys
from typing import Callable

import streamlit as st


def _create_sample_pdf_bytes() -> bytes:
    """Create a simple PDF as bytes for testing."""
    # This is a minimal PDF content in bytes
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
    """Test basic st.pdf usage."""
    try:
        pdf_bytes = _create_sample_pdf_bytes()
        st.pdf(pdf_bytes, height=400)
        st.success("st.pdf component loaded successfully!")

    except Exception as e:
        st.error(f"Error with st.pdf: {e}")
        st.info("st.pdf is a native Streamlit component")


def use_st_pdf_file_upload():
    """Test st.pdf with file upload."""
    try:
        uploaded_file = st.file_uploader("Upload a PDF", type="pdf")

        if uploaded_file is not None:
            st.pdf(uploaded_file.read(), height=600)
            st.success("Uploaded PDF displayed successfully!")
        else:
            # Show sample PDF if no file uploaded
            pdf_bytes = _create_sample_pdf_bytes()
            st.pdf(pdf_bytes, height=300)
            st.info("Showing sample PDF. Upload your own PDF above.")

    except Exception as e:
        st.error(f"Error with st.pdf file upload: {e}")


def use_st_pdf_custom_size():
    """Test st.pdf with custom height."""
    try:
        height = st.slider("Height", 200, 800, 500)

        pdf_bytes = _create_sample_pdf_bytes()
        st.pdf(pdf_bytes, height=height)
        st.success(f"PDF displayed with custom height: {height}")

    except Exception as e:
        st.error(f"Error with st.pdf custom size: {e}")


def use_st_pdf_base64():
    """Test st.pdf with base64 encoded data."""
    try:
        pdf_bytes = _create_sample_pdf_bytes()
        base64_pdf = base64.b64encode(pdf_bytes).decode("utf-8")

        # Display base64 string info
        st.write(f"Base64 PDF length: {len(base64_pdf)} characters")
        st.code(base64_pdf[:100] + "..." if len(base64_pdf) > 100 else base64_pdf)

        # Display PDF from base64
        st.pdf(base64.b64decode(base64_pdf), height=400)
        st.success("Base64 PDF displayed successfully!")

    except Exception as e:
        st.error(f"Error with st.pdf base64: {e}")


def use_st_pdf_bytes_io():
    """Test st.pdf with BytesIO object."""
    try:
        pdf_bytes = _create_sample_pdf_bytes()
        pdf_io = io.BytesIO(pdf_bytes)

        st.pdf(pdf_io, height=400)
        st.success("BytesIO PDF displayed successfully!")

    except Exception as e:
        st.error(f"Error with st.pdf BytesIO: {e}")


def use_st_pdf_error_handling():
    """Test st.pdf error handling with invalid data."""
    try:
        # Try to display invalid PDF data
        invalid_pdf = b"This is not a valid PDF file"

        st.warning("Attempting to display invalid PDF data...")
        st.pdf(invalid_pdf, height=300)
        st.success("Invalid PDF handled gracefully!")

    except Exception as e:
        st.error(f"Expected error with invalid PDF data: {e}")
        st.info("This demonstrates error handling for invalid PDF content.")


def use_st_pdf_multiple_files():
    """Test displaying multiple PDF files."""
    try:
        st.subheader("Multiple PDF Display")

        # Create multiple sample PDFs
        for i in range(3):
            st.write(f"PDF #{i + 1}")
            pdf_bytes = _create_sample_pdf_bytes()
            st.pdf(pdf_bytes, height=250, key=f"pdf_{i}")

        st.success("Multiple PDFs displayed successfully!")

    except Exception as e:
        st.error(f"Error with multiple st.pdf: {e}")


def use_st_pdf_in_columns():
    """Test st.pdf in columns layout."""
    try:
        st.write("PDFs in Columns Layout")
        col1, col2 = st.columns(2)

        with col1:
            st.subheader("PDF in Column 1")
            pdf_bytes = _create_sample_pdf_bytes()
            # Use container to ensure proper rendering
            with st.container():
                st.pdf(pdf_bytes, height=300, key="pdf_column_1")

        with col2:
            st.subheader("PDF in Column 2")
            pdf_bytes = _create_sample_pdf_bytes()
            # Use container to ensure proper rendering
            with st.container():
                st.pdf(pdf_bytes, height=300, key="pdf_column_2")

        st.success("PDFs displayed in columns successfully!")

    except Exception as e:
        st.error(f"Error with st.pdf in columns: {e}")
        st.info("Some PDF components may not work well in column layouts.")


def use_st_pdf_with_tabs():
    """Test st.pdf in tabs layout."""
    try:
        st.write("PDFs in Tabs Layout")

        # Create tabs
        tab1, tab2, tab3 = st.tabs(["📄 PDF 1", "📋 PDF 2", "📊 PDF 3"])

        with tab1:
            st.write("**First PDF Document**")
            st.info("This tab contains the first PDF")
            pdf_bytes = _create_sample_pdf_bytes()
            # Use expander to test nested rendering
            with st.expander("Show PDF", expanded=True):
                st.pdf(pdf_bytes, height=400, key="pdf_in_tab_1")

        with tab2:
            st.write("**Second PDF Document**")
            st.info("This tab contains the second PDF")
            pdf_bytes = _create_sample_pdf_bytes()
            st.pdf(pdf_bytes, height=400, key="pdf_in_tab_2")

        with tab3:
            st.write("**Third PDF Document**")
            st.info("This tab contains the third PDF")

            # Add some controls to test interactivity
            show_pdf = st.checkbox(
                "Show PDF in this tab", value=True, key="show_pdf_tab3"
            )

            if show_pdf:
                pdf_bytes = _create_sample_pdf_bytes()
                st.pdf(pdf_bytes, height=400, key="pdf_in_tab_3")
            else:
                st.write("PDF hidden - check the box above to show it")

        st.success("PDFs displayed in tabs successfully!")

    except Exception as e:
        st.error(f"Error with st.pdf in tabs: {e}")
        st.info("PDF components in tabs may have rendering limitations.")


def use_st_pdf_accessibility():
    """Test st.pdf accessibility features."""
    try:
        st.subheader("PDF Accessibility and Sizing Test")

        # Test different heights with descriptive labels
        st.write("**Testing Different PDF Heights:**")

        heights = [200, 350, 500]
        for i, height in enumerate(heights, 1):
            st.write(f"**PDF {i} - Height: {height}px**")

            # Add some spacing and context
            with st.container():
                pdf_bytes = _create_sample_pdf_bytes()
                st.pdf(pdf_bytes, height=height, key=f"pdf_accessibility_{height}")

                # Add description below each PDF
                st.caption(f"This PDF is rendered at {height} pixels height")

            # Add separator between PDFs
            if i < len(heights):
                st.divider()

        st.success("PDF accessibility features tested successfully!")

    except Exception as e:
        st.error(f"Error with st.pdf accessibility: {e}")
        st.info("Testing different PDF heights and layouts.")


def use_st_pdf_interactive():
    """Test interactive PDF features with dynamic controls."""
    try:
        st.subheader("Interactive PDF Test")

        # Dynamic height control
        st.write("**Dynamic PDF Height Control:**")
        height = st.slider(
            "Adjust PDF Height", 200, 800, 400, step=50, key="interactive_height"
        )

        # PDF display options
        col1, col2 = st.columns([3, 1])

        with col1:
            st.write(f"**PDF with height: {height}px**")
            pdf_bytes = _create_sample_pdf_bytes()
            st.pdf(pdf_bytes, height=height, key=f"interactive_pdf_{height}")

        with col2:
            st.write("**Controls:**")
            if st.button("Reset Height", key="reset_height"):
                st.rerun()

            st.write(f"Current height: {height}px")

        st.success("Interactive PDF features working!")

    except Exception as e:
        st.error(f"Error with interactive PDF: {e}")


# Dictionary of all PDF test scenarios
options: dict[str, Callable[[], None]] = {
    "basic": use_st_pdf_basic,
    "fileUpload": use_st_pdf_file_upload,
    "customSize": use_st_pdf_custom_size,
    "base64": use_st_pdf_base64,
    "bytesIO": use_st_pdf_bytes_io,
    "errorHandling": use_st_pdf_error_handling,
    "multipleFiles": use_st_pdf_multiple_files,
    "columns": use_st_pdf_in_columns,
    "tabs": use_st_pdf_with_tabs,
    "accessibility": use_st_pdf_accessibility,
    "interactive": use_st_pdf_interactive,
}

st.title("st.pdf Component Tests")
st.write("Select a PDF test scenario to run:")

# Add debug information
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

# Component selection
component_selection = st.selectbox("PDF Test Scenarios", options=options.keys())

if component_selection:
    st.subheader(f"Running: {component_selection}")
    try:
        options[component_selection]()
    except Exception as e:
        st.error(f"Error running {component_selection}: {e}")
        import traceback

        st.text(traceback.format_exc())
