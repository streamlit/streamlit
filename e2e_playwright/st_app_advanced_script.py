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
"""

import streamlit as st

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
