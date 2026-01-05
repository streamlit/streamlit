# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Streamlit app for testing server endpoints and behavior."""

import base64

import streamlit as st

st.header("Server Endpoint Tests")

# Basic content to verify app loads
st.markdown("App loaded successfully.")

# File uploader for testing upload endpoint
st.subheader("File Upload")
uploaded_file = st.file_uploader("Upload a file", key="test_uploader")
if uploaded_file is not None:
    st.text(f"Uploaded: {uploaded_file.name}")
    st.text(f"Size: {uploaded_file.size} bytes")

# Image for testing media endpoint - using bytes triggers the media endpoint.
st.subheader("Image (Media Endpoint)")
# Create a simple 1x1 red pixel PNG for testing.
RED_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
)
st.image(RED_PIXEL_PNG, caption="Test image")

# Download button for testing downloadable media
st.subheader("Download Button")
st.download_button(
    label="Download test file",
    data=b"Test content for download",
    file_name="test_download.txt",
    mime="text/plain",
    key="test_download",
)

# Display session info.
# Setting session state here also ensures cache_memory_bytes metrics are available
# for the metrics endpoint tests to verify filtering works correctly.
st.subheader("Session Info")
if "counter" not in st.session_state:
    st.session_state.counter = 0

if st.button("Increment counter"):
    st.session_state.counter += 1

st.markdown(f"Counter: {st.session_state.counter}")
