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

"""App script for parallel fragment layout & rendering E2E tests (E3, E13, E15)."""

import time

import streamlit as st

# --- E3: Source-order layout preservation ---
st.subheader("E3: Source-order layout")


@st.fragment(parallel=True)
def e3_section_a():
    time.sleep(2.0)
    st.write("e3_section_a")


@st.fragment(parallel=True)
def e3_section_b():
    time.sleep(1.5)
    st.write("e3_section_b")


@st.fragment(parallel=True)
def e3_section_c():
    time.sleep(1.0)
    st.write("e3_section_c")


@st.fragment(parallel=True)
def e3_section_d():
    time.sleep(0.5)
    st.write("e3_section_d")


e3_section_a()
e3_section_b()
e3_section_c()
e3_section_d()

# --- E13: Return value is None ---
st.subheader("E13: Return value")


@st.fragment(parallel=True)
def e13_fragment():
    st.write("e13 content")


result = e13_fragment()
st.write(f"e13_result: {result}")

# --- E15: Stress test — 10 parallel fragments ---
st.subheader("E15: Stress test")

e15_start = time.perf_counter()


for i in range(10):

    @st.fragment(parallel=True)
    def e15_frag(idx: int = i):
        time.sleep(0.5)
        st.write(f"e15_frag_{idx}")

    e15_frag()

e15_elapsed = time.perf_counter() - e15_start
st.write(f"e15_dispatch_time: {e15_elapsed:.2f}")
