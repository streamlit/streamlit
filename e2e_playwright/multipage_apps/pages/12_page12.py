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

st.header("Page 12")

layout_mode = st.segmented_control(
    "layout mode",
    ["layout1", "layout2"],
    selection_mode="single",
    default="layout1",
    key="layout_mode",
)

if layout_mode == "layout1":
    st.write("layout1")
    r = st.radio("Select a value", ["A", "B", "C"], horizontal=True, key="_radio")
    st.write(f"radio value: {r}, state value: {st.session_state['_radio']}")
elif layout_mode == "layout2":
    st.write("layout2")
