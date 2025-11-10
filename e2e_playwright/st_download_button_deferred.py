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

"""Test app for deferred download button functionality."""

import time

import streamlit as st

st.header("Deferred Download Button Tests")

st.subheader("1. Regular Download Button (for comparison)")
st.download_button(
    "Download Regular String",
    data="This is regular string data",
    file_name="regular.txt",
    mime="text/plain",
)

st.subheader("2. Deferred Download with Callable")


def generate_csv_data() -> str:
    """Generate CSV data when download is clicked."""
    return "Name,Age,City\nAlice,30,NYC\nBob,25,LA\nCharlie,35,Chicago"


st.download_button(
    "Download CSV (Deferred)",
    data=generate_csv_data,
    file_name="data.csv",
    mime="text/csv",
    on_click="ignore",
)

st.subheader("3. Deferred Download with Lambda")
st.download_button(
    "Download Lambda Text",
    data=lambda: f"Generated at {time.time()}\nThis is dynamically generated text",
    file_name="lambda_output.txt",
    mime="text/plain",
    on_click="ignore",
)

st.subheader("4. Deferred Download Returning Bytes")


def generate_binary_data() -> bytes:
    """Generate binary data."""
    return b"Binary data: \x00\x01\x02\x03\x04\x05"


st.download_button(
    "Download Binary (Deferred)",
    data=generate_binary_data,
    file_name="binary.dat",
    mime="application/octet-stream",
    on_click="ignore",
)

st.subheader("5. Deferred Download that Raises Error")


def failing_callable() -> str:
    """Callable that always raises an error."""
    raise ValueError("This callable intentionally fails!")


st.download_button(
    "Download Error (Should Fail)",
    data=failing_callable,
    file_name="error.txt",
    mime="text/plain",
    on_click="ignore",
)

st.subheader("6. Large Deferred Download")


def generate_large_data() -> str:
    """Generate a larger dataset."""
    lines = []
    for i in range(1000):
        lines.append(f"Row {i}: " + "x" * 100)
    return "\n".join(lines)


st.download_button(
    "Download Large File (Deferred)",
    data=generate_large_data,
    file_name="large.txt",
    mime="text/plain",
    on_click="ignore",
)

st.subheader("7. Deferred Download with on_click='ignore'")
st.download_button(
    "Download (No Rerun)",
    data=lambda: "No rerun content",
    file_name="no_rerun.txt",
    mime="text/plain",
    on_click="ignore",
)
