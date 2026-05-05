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

"""App script for parallel fragment widget / error E2E tests (E4, E5, E6)."""

import time

import streamlit as st

# --- E4: Widget interaction during parallel execution ---
st.subheader("E4: Widget during parallel")


@st.fragment(parallel=True)
def e4_fast_interactive():
    if "e4_count" not in st.session_state:
        st.session_state.e4_count = 0
    if st.button("e4_increment", key="e4_btn"):
        st.session_state.e4_count += 1
    st.write(f"e4_count: {st.session_state.e4_count}")


@st.fragment(parallel=True)
def e4_slow():
    time.sleep(5)
    st.write("e4_slow_done")


e4_fast_interactive()
e4_slow()

# --- E5: Fragment rerun isolation ---
st.subheader("E5: Rerun isolation")


@st.fragment(parallel=True)
def e5_fragment_a():
    ts = time.perf_counter()
    if "e5_a_click" not in st.session_state:
        st.session_state.e5_a_click = 0
    if st.button("e5_click_a", key="e5_btn_a"):
        st.session_state.e5_a_click += 1
    st.write(f"e5_a_ts: {ts:.4f}")
    st.write(f"e5_a_clicks: {st.session_state.e5_a_click}")


@st.fragment(parallel=True)
def e5_fragment_b():
    ts = time.perf_counter()
    if "e5_b_runs" not in st.session_state:
        st.session_state.e5_b_runs = 0
    st.session_state.e5_b_runs += 1
    st.write(f"e5_b_ts: {ts:.4f}")
    st.write(f"e5_b_runs: {st.session_state.e5_b_runs}")


e5_fragment_a()
e5_fragment_b()

# --- E6: Error renders inline in failing fragment ---
st.subheader("E6: Error inline")


@st.fragment(parallel=True)
def e6_error_fragment():
    raise ValueError("e6_deliberate_error")


@st.fragment(parallel=True)
def e6_success_fragment():
    st.write("e6_success")


e6_error_fragment()
e6_success_fragment()
