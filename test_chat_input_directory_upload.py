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

"""
Test application for st.chat_input directory upload functionality.

This script tests the new directory upload feature for st.chat_input with:
1. Basic directory upload without file type restrictions
2. Directory upload with specific file type filters (images only)
3. Directory upload with specific file type filters (text files only)
4. Comparison with regular file upload modes
"""

import streamlit as st

# Set up the page configuration
st.set_page_config(
    page_title="Chat Input Directory Upload Test",
    page_icon="📁",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Title and description
st.title("🧪 Chat Input Directory Upload Test")
st.markdown("Testing directory upload functionality for `st.chat_input`")

# Create columns for different test scenarios
col1, col2 = st.columns(2)

with col1:
    st.header("📁 Directory Upload Tests")

    # Test 1: Basic directory upload (no file type restrictions)
    st.subheader("1. Basic Directory Upload")
    st.caption("Upload any directory with any file types")

    prompt1 = st.chat_input(
        "Send a message and/or upload a directory",
        accept_file="directory",
        key="directory_basic",
    )

    if prompt1:
        st.write("**Received:**")
        st.write(f"- Text: `{prompt1.text}`")
        st.write(f"- Files: {len(prompt1.files)} files")

        if prompt1.files:
            st.write("**Files received:**")
            for file in prompt1.files:
                st.write(f"  - {file.name} ({file.size} bytes)")

    st.divider()

    # Test 2: Directory upload with image file type restrictions
    st.subheader("2. Directory Upload (Images Only)")
    st.caption("Upload directory containing only image files")

    prompt2 = st.chat_input(
        "Send a message and/or upload an image directory",
        accept_file="directory",
        file_type=["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"],
        key="directory_images",
    )

    if prompt2:
        st.write("**Received:**")
        st.write(f"- Text: `{prompt2.text}`")
        st.write(f"- Files: {len(prompt2.files)} files")

        if prompt2.files:
            st.write("**Image files received:**")
            for file in prompt2.files:
                st.write(f"  - {file.name} ({file.size} bytes)")
                if file.type and file.type.startswith("image/"):
                    st.image(file, caption=file.name, width=200)

    st.divider()

    # Test 3: Directory upload with text file type restrictions
    st.subheader("3. Directory Upload (Text Files Only)")
    st.caption("Upload directory containing only text files")

    prompt3 = st.chat_input(
        "Send a message and/or upload a text directory",
        accept_file="directory",
        file_type=["txt", "md", "py", "js", "json", "xml", "csv"],
        key="directory_text",
    )

    if prompt3:
        st.write("**Received:**")
        st.write(f"- Text: `{prompt3.text}`")
        st.write(f"- Files: {len(prompt3.files)} files")

        if prompt3.files:
            st.write("**Text files received:**")
            for file in prompt3.files:
                st.write(f"  - {file.name} ({file.size} bytes)")
                if file.type and file.type.startswith("text/"):
                    with st.expander(f"View content of {file.name}"):
                        try:
                            content = file.getvalue().decode("utf-8")
                            st.code(content, language="text")
                        except (UnicodeDecodeError, AttributeError):
                            st.write("Could not decode file content")

with col2:
    st.header("📄 Regular File Upload Comparison")

    # Test 4: Single file upload for comparison
    st.subheader("4. Single File Upload")
    st.caption("Upload a single file for comparison")

    prompt4 = st.chat_input(
        "Send a message and/or upload a single file",
        accept_file=True,
        key="single_file",
    )

    if prompt4:
        st.write("**Received:**")
        st.write(f"- Text: `{prompt4.text}`")
        st.write(f"- Files: {len(prompt4.files)} files")

        if prompt4.files:
            st.write("**Single file received:**")
            file = prompt4.files[0]
            st.write(f"  - {file.name} ({file.size} bytes)")

    st.divider()

    # Test 5: Multiple files upload for comparison
    st.subheader("5. Multiple Files Upload")
    st.caption("Upload multiple files for comparison")

    prompt5 = st.chat_input(
        "Send a message and/or upload multiple files",
        accept_file="multiple",
        key="multiple_files",
    )

    if prompt5:
        st.write("**Received:**")
        st.write(f"- Text: `{prompt5.text}`")
        st.write(f"- Files: {len(prompt5.files)} files")

        if prompt5.files:
            st.write("**Multiple files received:**")
            for file in prompt5.files:
                st.write(f"  - {file.name} ({file.size} bytes)")

    st.divider()

    # Test 6: No file upload for comparison
    st.subheader("6. Text Only (No Files)")
    st.caption("Text-only chat input for comparison")

    prompt6 = st.chat_input(
        "Send a text message only", accept_file=False, key="text_only"
    )

    if prompt6:
        st.write("**Received:**")
        st.write(f"- Text: `{prompt6}`")
        st.write("- Files: Not applicable")

# Sidebar with implementation details
st.sidebar.header("🔧 Implementation Details")

st.sidebar.subheader("API Usage Examples")
st.sidebar.code(
    """
# Basic directory upload
prompt = st.chat_input(
    "Upload directory",
    accept_file="directory"
)

# Directory with file type filter
prompt = st.chat_input(
    "Upload image directory",
    accept_file="directory",
    file_type=["png", "jpg", "jpeg"]
)
""",
    language="python",
)

st.sidebar.subheader("Key Features")
st.sidebar.markdown("""
- **Directory Structure**: Preserves relative paths
- **File Type Filtering**: Pre-upload validation
- **Consistent API**: Same return format as multiple files
- **Browser Support**: Works on desktop browsers
- **Mobile Limitation**: Not supported on mobile browsers
""")

st.sidebar.subheader("Implementation Status")
st.sidebar.success("✅ Python API updated")
st.sidebar.success("✅ Protobuf schema updated")
st.sidebar.success("✅ Frontend components updated")
st.sidebar.success("✅ File type filtering implemented")
st.sidebar.success("✅ Directory structure preserved")

# Footer
st.divider()
st.caption(
    "💡 **Note**: Directory upload requires a desktop browser. "
    "The feature is not supported on mobile browsers due to platform limitations."
)
