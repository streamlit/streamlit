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


import streamlit as st

# --- App Configuration ---
st.set_page_config(
    page_title="st.pdf Prototype",
    page_icon="📄",
)

# --- App Title and Introduction ---
st.title("📄 `st.pdf` Prototype Demo")
st.markdown(
    """
This app is a **prototype** demonstrating a proposed `st.pdf` element. This feature would allow
developers to natively display PDF documents from a URL or uploaded file directly within a Streamlit app.

The PDF viewer uses a React-based PDF rendering library that displays PDF pages as interactive elements
with full text selection and link support, offering a consistent experience across all browsers and platforms.
"""
)

# --- Project Context and Documentation ---
with st.expander("📘 Project Background & Justification"):
    st.header("Problem Statement")
    st.markdown(
        """
        - **High Demand for PDF Integration**: Many popular Streamlit apps, especially in the LLM
          space (e.g., "Ask my PDF"), revolve around processing and displaying PDF documents.
          Developers frequently need a simple, built-in way to show the PDF being analyzed.
        - **Developer Friction**: While workarounds using HTML or custom components exist, they are
          often complex, especially for handling local files, and present a hurdle for beginner
          Streamlit developers.
        - **Strong Community Interest**: This feature has been highly requested.
            - GitHub Issue [#7235](https://github.com/streamlit/streamlit/issues/7235) has over 23 👍.
            - A related forum post on rendering PDFs has over 12,000 views.
            - "streamlit pdf viewer" is a top 250 search keyword on Google, with a clear upward trend.
    """
    )


with st.expander("⚙️ Proposed API for `st.pdf`"):
    st.header("API")
    st.code('st.pdf(data, *, width="stretch", height=500)', language="python")

# --- Sidebar Controls ---
st.sidebar.header("PDF Viewer Controls")

# PDF Source Selection
st.sidebar.subheader("PDF Source")
pdf_source_type = st.sidebar.radio(
    "Choose PDF source:",
    options=["Sample URLs", "Upload File"],
    index=0,
    help="Select whether to use a sample URL or upload your own PDF file.",
)

pdf_to_display = None
selected_option = ""

if pdf_source_type == "Sample URLs":
    # Dictionary of sample URLs for easy testing
    TEST_URLS = {
        "Mary Meeker's AI Report (340 pages)": "https://www.bondcap.com/report/pdf/trends_artificial_intelligence.pdf",
        "DoD Data & AI Security": "https://media.defense.gov/2025/May/22/2003720601/-1/-1/0/CSI_AI_DATA_SECURITY.PDF",
        "Skateboards": "https://www.dso.ufl.edu/documents/nsfp/Campus_Safety_-_Getting_Around_Campus.pdf",
        "Mozilla PDF.js Test": "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf",
        "Custom URL": None,  # Placeholder for custom input
    }

    # Dropdown to select a sample PDF or enter a custom URL
    selected_option = st.sidebar.selectbox(
        "Select a sample PDF to test:",
        options=list(TEST_URLS.keys()),
        index=1,
        help="Choose a pre-selected PDF or enter your own URL below.",
    )

    if selected_option == "Custom URL":
        pdf_url = st.sidebar.text_input(
            "Enter PDF URL:",
            placeholder="https://example.com/sample.pdf",
        )
        pdf_to_display = pdf_url if pdf_url else None
    else:
        pdf_to_display = TEST_URLS[selected_option]

elif pdf_source_type == "Upload File":
    uploaded_file = st.sidebar.file_uploader(
        "Upload a PDF file:",
        type=["pdf"],
        help="Upload a PDF file from your computer to display in the viewer.",
    )

    if uploaded_file is not None:
        pdf_to_display = uploaded_file
        selected_option = f"Uploaded: {uploaded_file.name}"
    else:
        pdf_to_display = None
        selected_option = "No file uploaded"

# --- Layout and Display Options ---
st.sidebar.markdown("---")
st.sidebar.subheader("Display Options")

# Width options
width_type = st.sidebar.radio(
    "Width type:", options=["custom", "stretch"], index=0, horizontal=True
)

if width_type == "stretch":
    width = "stretch"
else:
    width = st.sidebar.number_input(
        "Width (pixels):",
        min_value=100,
        max_value=2000,
        value=700,
        step=50,
    )

# Height options
height_type = st.sidebar.radio(
    "Height type:", options=["custom", "stretch"], index=0, horizontal=True
)

if height_type == "stretch":
    height = "stretch"
else:
    height = st.sidebar.number_input(
        "Height (pixels):",
        min_value=100,
        max_value=2000,
        value=700,
        step=50,
    )

# --- Main Content ---
if pdf_source_type and pdf_to_display:
    st.markdown(f"### {selected_option}")

    # Display the PDF
    st.pdf(
        pdf_to_display,
        width=width,
        height=height,
    )

    # --- Code Example ---
    st.markdown("---")
    st.subheader("Code Example")
    st.markdown("Here's how you can display this PDF in your Streamlit app:")

    if pdf_source_type == "Sample URLs":
        code_example = f"""
```python
import streamlit as st

# Display a PDF from a URL
st.pdf(
    "{pdf_to_display}",
    width={width},
    height={height}
)
```
"""
    else:  # Upload File
        code_example = f"""
```python
import streamlit as st

# Upload a PDF file
uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")

if uploaded_file is not None:
    # Display the uploaded PDF
    st.pdf(
        uploaded_file,
        width={width},
        height={height}
    )
```
"""

    st.markdown(code_example)

    # Add information about the viewer
    with st.expander("About the PDF Viewer"):
        st.markdown(
            """
            The `st.pdf` element provides a modern PDF viewing experience with:

            - **Text Selection**: Select and copy text from the PDF
            - **Clickable Links**: Links in the PDF are interactive
            - **Multi-page Support**: All pages are displayed in a scrollable view
            - **Responsive Design**: Adapts to different screen sizes
            - **Cross-browser Compatibility**: Works consistently across all modern browsers

            The viewer uses React PDF technology to render PDFs directly in the browser,
            ensuring a consistent experience regardless of the user's device or browser.
            """
        )

else:
    st.info("👈 Select a PDF source type and choose a file to display in the sidebar.")
