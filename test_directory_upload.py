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

st.title("🗂️ Directory Upload Test App")

st.markdown("""
This app demonstrates the new **directory upload functionality** for `st.file_uploader`.

Select a directory and upload all files within it, including files in subdirectories!
""")

# Test 1: Regular file upload (existing functionality)
st.header("1. 📄 Regular File Upload")
uploaded_file = st.file_uploader("Choose a single file", key="single")
if uploaded_file is not None:
    st.success("✅ File uploaded successfully!")
    st.write(f"**File name:** {uploaded_file.name}")
    st.write(f"**File size:** {uploaded_file.size} bytes")

# Test 2: Multiple files upload (existing functionality)
st.header("2. 📁 Multiple Files Upload")
uploaded_files = st.file_uploader(
    "Choose multiple files", accept_multiple_files=True, key="multiple"
)
if uploaded_files:
    st.success(f"✅ {len(uploaded_files)} files uploaded successfully!")
    for i, file in enumerate(uploaded_files):
        st.write(f"{i + 1}. **{file.name}** ({file.size} bytes)")

# Test 3: Directory upload (new functionality)
st.header("3. 🗂️ Directory Upload (NEW!)")
st.info(
    "**This feature allows you to select an entire directory and upload all "
    "files within it, preserving the folder structure.**"
)

try:
    uploaded_directory = st.file_uploader(
        "Choose a directory to upload all files from",
        accept_multiple_files="directory",
        key="directory",
    )

    if uploaded_directory:
        st.success(f"✅ Directory uploaded with {len(uploaded_directory)} files!")

        # Group files by directory
        directories = {}
        for file in uploaded_directory:
            # Extract directory path
            path_parts = file.name.split("/")
            if len(path_parts) > 1:
                dir_path = "/".join(path_parts[:-1])
                file_name = path_parts[-1]
            else:
                dir_path = "📁 Root"
                file_name = file.name

            if dir_path not in directories:
                directories[dir_path] = []
            directories[dir_path].append((file_name, file.size))

        # Display directory structure
        st.subheader("📂 Directory Structure:")
        for dir_path, files in sorted(directories.items()):
            with st.expander(f"📁 {dir_path} ({len(files)} files)"):
                for file_name, file_size in files:
                    st.write(f"  📄 {file_name} - {file_size} bytes")

        # Show total statistics
        total_size = sum(file.size for file in uploaded_directory)
        st.metric("Total Files", len(uploaded_directory))
        st.metric("Total Size", f"{total_size:,} bytes")

except Exception as e:
    st.error(f"Error: {e}")
    st.warning(
        "The directory upload feature requires the protobuf to be compiled. The API changes are ready!"
    )

# Test 4: Directory upload with file type restrictions
st.header("4. 🖼️ Directory Upload with File Type Filter")
st.info("**Upload only specific file types from a directory (e.g., only images)**")

try:
    uploaded_images = st.file_uploader(
        "Choose a directory (images only)",
        accept_multiple_files="directory",
        type=["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"],
        key="images",
    )

    if uploaded_images:
        st.success(f"✅ Found {len(uploaded_images)} image files!")

        # Display images in a grid
        cols = st.columns(3)
        for i, file in enumerate(uploaded_images):
            with cols[i % 3]:
                if file.type and file.type.startswith("image/"):
                    st.image(file, caption=file.name, use_container_width=True)
                else:
                    st.write(f"📄 {file.name}")

except Exception as e:
    st.error(f"Error: {e}")

# Implementation status
st.header("🚧 Implementation Status")

col1, col2 = st.columns(2)

with col1:
    st.subheader("✅ Completed")
    st.markdown("""
    - Python API supports `accept_multiple_files="directory"`
    - Protobuf schema updated with `accept_directory` field
    - Frontend FileDropzone supports `webkitdirectory` attribute
    - Frontend handles relative file paths from directories
    - Directory structure preservation
    - File type filtering works with directories
    """)

with col2:
    st.subheader("⏳ Remaining Work")
    st.markdown("""
    - Protobuf compilation to generate TypeScript types
    - Mobile browser fallback (not supported by browsers)
    - Documentation updates
    - Additional testing and edge cases
    - Integration with st.chat_input
    """)

# Browser compatibility notice
st.header("🌐 Browser Compatibility")
st.markdown("""
| Browser | Desktop Support | Mobile Support |
|---------|----------------|----------------|
| Chrome  | ✅ Yes         | ❌ No          |
| Firefox | ✅ Yes         | ❌ No          |
| Safari  | ✅ Yes         | ❌ No          |
| Edge    | ✅ Yes         | ❌ No          |

**Note:** Directory upload is not supported on mobile browsers due to platform limitations.
On mobile, the file uploader will fall back to regular multiple file selection.
""")

st.header("💡 How to Test")
st.markdown("""
1. **Create a test directory** with some files and subdirectories
2. **Try the "Directory Upload" section** above
3. **Select the entire directory** when the file picker opens
4. **Watch the directory structure** be preserved in the upload

**Example directory structure to try:**
```
test_folder/
├── document.txt
├── image.jpg
└── subfolder/
    ├── data.csv
    └── nested/
        └── deep_file.pdf
```
""")

if st.button("🔄 Refresh Page"):
    st.rerun()
