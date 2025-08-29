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

st.title("Per-option disabled demo")

st.pills(
    "Pick one",
options=["A", "B", "C", "D"],
    disabled=("B","D"),
    key="p1",
)

st.segmented_control(
    "Pick a number",
    options=[1,2,3,4],
    disabled=(2,4),
    key="s1",
)
