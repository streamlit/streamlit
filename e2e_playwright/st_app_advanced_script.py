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

"""Streamlit script for st_app_advanced E2E test.

This script is loaded by the st.App in st_app_advanced.py.
It tests custom routes, middleware, lifespan hooks, and programmatic secrets.
"""

from __future__ import annotations

import os
from typing import cast

import streamlit as st
from streamlit.errors import StreamlitSecretNotFoundError


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


st.title("Advanced st.App Test")

st.markdown("This app tests custom routes, middleware, and lifespan hooks.")

# Counter to verify reruns work
if "counter" not in st.session_state:
    st.session_state.counter = 0

st.write(f"Counter: {st.session_state.counter}")

if st.button("Increment"):
    st.session_state.counter += 1
    st.rerun()

# Text input to verify widget state
user_input = st.text_input("Enter text", key="test_input")
if user_input:
    st.write(f"You entered: {user_input}")

st.divider()

st.subheader("Custom Routes Available")
st.code(
    """
GET /api/data - Returns test data
GET /api/lifespan - Returns lifespan events
""",
    language="text",
)

st.divider()

# === Programmatic Secrets Section ===
st.subheader("Programmatic Secrets")
st.write(f"API Key: {_get_secret('api_key')}")
st.write(f"Database Host: {_get_nested_secret('database', 'host')}")
st.write(f"Database Port: {_get_nested_secret('database', 'port')}")

st.subheader("Environment Variables")
st.write(f"API Key from environ: {os.environ.get('api_key', 'NOT SET')}")  # noqa: SIM112

st.subheader("Nested Secrets")
try:
    st.write(f"Auth Client ID: {st.secrets.auth.client_id}")
except (AttributeError, StreamlitSecretNotFoundError):
    st.write("Auth Client ID: NOT SET")
