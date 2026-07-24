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

"""E2E app for @st.fragment(key=...) and st.rerun(scope=<key>) scenarios."""

from uuid import uuid4

import streamlit as st

# ------------------------------------------------------------------ #
# Scenario 1: Widget outside a keyed fragment triggers a fragment-only rerun.
# ------------------------------------------------------------------ #
st.header("Scenario 1: single-key rerun")

if "outside_counter" not in st.session_state:
    st.session_state.outside_counter = 0

st.session_state.outside_counter += 1
st.write(f"Outside counter: {st.session_state.outside_counter}", key="outside_counter")


@st.fragment(key="charts")
def charts_fragment() -> None:
    st.write(f"Fragment uuid: {uuid4()}", key="fragment_uuid")


charts_fragment()

st.button(
    "Rerun charts fragment",
    key="rerun_charts_btn",
    on_click=lambda: st.rerun("charts"),
)

# ------------------------------------------------------------------ #
# Scenario 2: Targeting a list of two fragment keys from one callback.
# ------------------------------------------------------------------ #
st.header("Scenario 2: multi-key rerun")


@st.fragment(key="frag_alpha")
def alpha_fragment() -> None:
    st.write(f"Alpha uuid: {uuid4()}", key="alpha_uuid")


@st.fragment(key="frag_beta")
def beta_fragment() -> None:
    st.write(f"Beta uuid: {uuid4()}", key="beta_uuid")


alpha_fragment()
beta_fragment()

st.write(f"Stable text outside: {st.session_state.outside_counter}", key="stable_text")

st.button(
    "Rerun alpha and beta",
    key="rerun_multi_btn",
    on_click=lambda: st.rerun(["frag_alpha", "frag_beta"]),
)

# ------------------------------------------------------------------ #
# Scenario 3: Unknown key raises a visible exception.
# ------------------------------------------------------------------ #
st.header("Scenario 3: unknown key raises")

st.button(
    "Rerun unknown fragment",
    key="rerun_unknown_btn",
    on_click=lambda: st.rerun("nonexistent_key"),
)
