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
    layout="wide",
)

# --- App Title and Introduction ---
st.title("📄 `st.pdf` Prototype Demo")
st.markdown(
    """
This app is a **prototype** demonstrating a proposed `st.pdf` element. This feature would allow
developers to natively display PDF documents from a URL or uploaded file directly within a Streamlit app.

This prototype allows testing two different rendering methods:
1.  **Browser's Built-in Renderer**: The default, fast, and reliable option that
    uses your browser's own PDF viewing capabilities.
2.  **External `react-pdf` Module**: A JavaScript library that renders the PDF pages
    as images, offering a consistent look across all platforms.
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
        index=0,
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
    "Width type:", options=["stretch", "custom"], index=0, horizontal=True
)
width_value = (
    "stretch"
    if width_type == "stretch"
    else st.sidebar.slider(
        "Width (pixels):", min_value=300, max_value=1200, value=700, step=50
    )
)

# Height control
height_value = st.sidebar.slider(
    "Height (pixels):", min_value=300, max_value=1500, value=800, step=50
)

# --- Renderer Specific Options ---
st.sidebar.markdown("---")
st.sidebar.subheader("Renderer Options")


use_ext_module = st.sidebar.checkbox(
    "Use External Module",
    value=False,
    help="Use the external module to render the PDF",
)


# --- PDF Display Area ---
if pdf_to_display:
    st.subheader(f"Displaying: {selected_option}")

    try:
        # The core of the demo: calling the prototype st.pdf function
        st.pdf(
            pdf_to_display,
            width=width_value,
            height=height_value,
            use_ext_module=use_ext_module,
        )

    except Exception as e:
        st.error(f"An error occurred while loading the PDF: {e}")
        if pdf_source_type == "Sample URLs":
            st.write(f"Attempted to load from URL: {pdf_to_display}")
        else:
            st.write(f"Attempted to load uploaded file: {selected_option}")
elif pdf_source_type == "Sample URLs":
    st.info("Select a sample PDF or enter a custom URL in the sidebar to get started.")
else:
    st.info("Upload a PDF file in the sidebar to get started.")
