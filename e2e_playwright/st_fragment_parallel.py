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

"""Test app for parallel fragments feature."""

import time

import streamlit as st

if "fragment_a_count" not in st.session_state:
    st.session_state.fragment_a_count = 0
if "fragment_b_count" not in st.session_state:
    st.session_state.fragment_b_count = 0
if "counter" not in st.session_state:
    st.session_state.counter = 0
if "start_time" not in st.session_state:
    st.session_state.start_time = time.time()


@st.fragment(parallel=True)
def slow_fragment_1():
    time.sleep(0.3)
    st.write("Fragment 1 done")


@st.fragment(parallel=True)
def slow_fragment_2():
    time.sleep(0.2)
    st.write("Fragment 2 done")


@st.fragment(parallel=True)
def slow_fragment_3():
    time.sleep(0.1)
    st.write("Fragment 3 done")


@st.fragment(parallel=True)
def fragment_with_button():
    if st.button("Click me", key="parallel_btn"):
        st.session_state.counter += 1
    st.write(f"Counter: {st.session_state.counter}")


@st.fragment(parallel=True)
def fragment_a():
    st.session_state.fragment_a_count += 1
    st.button("Rerun A", key="btn_a")
    st.write(f"Fragment A ran {st.session_state.fragment_a_count} times")


@st.fragment(parallel=True)
def fragment_b():
    st.session_state.fragment_b_count += 1
    st.button("Rerun B", key="btn_b")
    st.write(f"Fragment B ran {st.session_state.fragment_b_count} times")


@st.fragment(parallel=True)
def container_test_fragment():
    """Fragment for container inspection - uses key for targeting."""
    st.write("Container test content")


st.header("Parallel Fragments Test App")

st.subheader("Concurrent Rendering Test")
st.session_state.start_time = time.time()
# Invocation order deliberately not 1 → 2 → 3 so ordering tests prove DOM follows
# call order (pre-allocated placeholders), not definition or label numbering.
slow_fragment_3()
slow_fragment_1()
slow_fragment_2()
elapsed = time.time() - st.session_state.start_time
st.write("All fragments dispatched")
st.write(f"Dispatch time: {elapsed:.2f}s")

st.subheader("Widget Interaction Test")
fragment_with_button()
st.write(f"Outside counter: {st.session_state.counter}")

st.subheader("Fragment Rerun Test")
fragment_a()
fragment_b()

st.subheader("Container Test")
with st.container(key="container_test_section"):
    container_test_fragment()
