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

from __future__ import annotations

import streamlit as st

options = ["Apple", "Apricot", "Banana", "Blueberry", "Pineapple"]

i1 = st.multiselect("fuzzy search", options, search_type="fuzzy")
st.text(f"value 1: {i1}")

i2 = st.multiselect("exact search", options, search_type="exact")
st.text(f"value 2: {i2}")

i3 = st.multiselect("contains search", options, search_type="contains")
st.text(f"value 3: {i3}")

i4 = st.multiselect("startswith search", options, search_type="startswith")
st.text(f"value 4: {i4}")
