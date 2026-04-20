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
from typing import cast

import streamlit as st
from streamlit.errors import StreamlitSecretNotFoundError

st.title("st.App Secrets Test")


def _get_secret(key: str, default: str = "NOT SET") -> str:
    """Helper to safely get a secret, handling missing secrets file in bare mode."""
    try:
        return cast("str", st.secrets.get(key, default))
    except StreamlitSecretNotFoundError:
        return default


def _get_nested_secret(
    section: str, key: str, default: str = "NOT SET"
) -> str | int | float:
    """Helper to safely get a nested secret."""
    try:
        section_data = st.secrets.get(section, {})
        if isinstance(section_data, dict):
            return cast("str | int | float", section_data.get(key, default))
        return cast("str | int | float", getattr(section_data, key, default))
    except StreamlitSecretNotFoundError:
        return default


# Display programmatic secrets
st.subheader("Programmatic Secrets")

st.write(f"API Key: {_get_secret('api_key')}")
st.write(f"Database Host: {_get_nested_secret('database', 'host')}")
st.write(f"Database Port: {_get_nested_secret('database', 'port')}")

# Display environment variable promotion
st.subheader("Environment Variables")
st.write(f"API Key from environ: {os.environ.get('api_key', 'NOT SET')}")  # noqa: SIM112

# Display nested secrets via attribute access
st.subheader("Nested Secrets")
try:
    st.write(f"Auth Client ID: {st.secrets.auth.client_id}")
except (AttributeError, StreamlitSecretNotFoundError):
    st.write("Auth Client ID: NOT SET")

# Display hybrid secret (should come from file if file exists, otherwise NOT SET)
st.subheader("Hybrid Secrets Test")
file_secret = _get_secret("from_file")
st.write(f"From File: {file_secret}")
