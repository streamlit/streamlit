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

"""Streamlit script for testing st.App secrets parameter.

This script displays secrets that were set programmatically via st.App.
"""

from __future__ import annotations

import os

import streamlit as st

st.title("st.App Secrets Test")

# Display programmatic secrets
st.subheader("Programmatic Secrets")

st.write(f"API Key: {st.secrets.get('api_key', 'NOT SET')}")
st.write(f"Database Host: {st.secrets.get('database', {}).get('host', 'NOT SET')}")
st.write(f"Database Port: {st.secrets.get('database', {}).get('port', 'NOT SET')}")

# Display environment variable promotion
st.subheader("Environment Variables")
st.write(f"API Key from environ: {os.environ.get('api_key', 'NOT SET')}")  # noqa: SIM112

# Display nested secrets via attribute access
st.subheader("Nested Secrets")
try:
    st.write(f"Auth Client ID: {st.secrets.auth.client_id}")
except AttributeError:
    st.write("Auth Client ID: NOT SET")

# Display hybrid secret (should come from file if file exists, otherwise NOT SET)
st.subheader("Hybrid Secrets Test")
file_secret = st.secrets.get("from_file", "NOT SET")
st.write(f"From File: {file_secret}")
