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

import time

import streamlit as st

st.header("Parallel Fragments")


@st.fragment(parallel=True)
def slow_section(label: str, delay: float):
    time.sleep(delay)
    st.write(f"{label} loaded")


@st.fragment(parallel=True)
def fast_section():
    st.write("fast section loaded")


start = time.perf_counter()

slow_section("section_a", 1.0)
st.write("after section_a dispatched")

fast_section()
st.write("after fast_section dispatched")

slow_section("section_b", 1.0)
st.write("after section_b dispatched")

elapsed = time.perf_counter() - start
st.write(f"main_thread_time: {elapsed:.1f}")
