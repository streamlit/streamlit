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

"""Simple baseline app for load testing.

This minimal app establishes the baseline server overhead with minimal processing.
Used to measure fundamental server performance without app-specific complexity.
"""

import streamlit as st

st.title("Load Test - Simple")
st.write("Hello, World!")

if st.button("Click me"):
    st.write("Clicked!")
