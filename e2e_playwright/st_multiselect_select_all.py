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

"""App for testing st.multiselect(select_all=...)."""

from __future__ import annotations

import streamlit as st

selected_false = st.multiselect(
    "select_all False",
    ["apple", "apricot", "banana"],
    select_all=False,
    key="select_all_false",
)
st.text(f"select_all False: {selected_false}")

selected_true = st.multiselect(
    "select_all True",
    [f"item {i}" for i in range(8)],
    select_all=True,
    key="select_all_true",
)
st.text(f"select_all True: {selected_true}")

selected_threshold = st.multiselect(
    "select_all threshold",
    [
        "alpha",
        "alpine",
        "alta",
        "beta",
        "gamma",
        "delta",
        "epsilon",
        "zeta",
        "eta",
        "theta",
    ],
    select_all=3,
    filter_mode="contains",
    key="select_all_threshold",
)
st.text(f"select_all threshold: {selected_threshold}")

selected_max = st.multiselect(
    "select_all with max_selections",
    ["red", "green", "blue", "yellow", "purple"],
    select_all=True,
    max_selections=2,
    key="select_all_max",
)
st.text(f"select_all with max_selections: {selected_max}")

selected_chips = st.multiselect(
    "select_all custom chips",
    ["one", "two", "three"],
    select_all=2,
    accept_new_options=True,
    key="select_all_chips",
)
st.text(f"select_all custom chips: {selected_chips}")
