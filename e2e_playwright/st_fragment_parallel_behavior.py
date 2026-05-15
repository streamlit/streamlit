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

"""App script for parallel fragment behavior E2E tests (E7, E8, E9, E11, E12).

Covers: API restrictions, fragment-scoped rerun, and run_every timer.
These scenarios do NOT cancel the coordinator, so they can coexist safely.
"""

import time

import streamlit as st

# --- E7: @st.dialog prohibited during parallel execution ---
st.subheader("E7: Dialog prohibited")


@st.dialog("e7_dialog")
def e7_my_dialog():
    st.write("e7_dialog_content")


@st.fragment(parallel=True)
def e7_dialog_fragment():
    e7_my_dialog()


e7_dialog_fragment()

# --- E8: st.switch_page prohibited during parallel execution ---
st.subheader("E8: switch_page prohibited")


@st.fragment(parallel=True)
def e8_switch_page_fragment():
    st.switch_page("nonexistent_page.py")


e8_switch_page_fragment()

# --- E9: Dialog works from sequential fragment rerun ---
st.subheader("E9: Dialog on rerun")


@st.dialog("e9_dialog")
def e9_dialog_fn():
    st.write("e9_dialog_opened")


@st.fragment(parallel=True)
def e9_dialog_rerun_fragment():
    st.write("e9_fragment_loaded")
    if st.button("e9_open_dialog", key="e9_btn"):
        e9_dialog_fn()


e9_dialog_rerun_fragment()

# --- E11: st.rerun(scope="fragment") local to calling fragment ---
st.subheader("E11: Fragment-scoped rerun")

if "e11_a_runs" not in st.session_state:
    st.session_state.e11_a_runs = 0
if "e11_b_runs" not in st.session_state:
    st.session_state.e11_b_runs = 0


@st.fragment(parallel=True)
def e11_fragment_a():
    st.session_state.e11_a_runs += 1
    if st.session_state.e11_a_runs == 1:
        st.rerun(scope="fragment")
    st.write(f"e11_a_runs: {st.session_state.e11_a_runs}")
    st.write("e11_a_rerun_done")


@st.fragment(parallel=True)
def e11_fragment_b():
    st.session_state.e11_b_runs += 1
    st.write(f"e11_b_runs: {st.session_state.e11_b_runs}")


e11_fragment_a()
e11_fragment_b()

# --- E12: run_every with parallel=True ---
st.subheader("E12: run_every")


@st.fragment(parallel=True, run_every="2s")
def e12_periodic_fragment():
    ts = time.perf_counter()
    st.write(f"e12_ts: {ts:.4f}")


e12_periodic_fragment()
