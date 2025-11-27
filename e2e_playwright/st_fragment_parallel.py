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

"""E2E test app demonstrating parallel fragment execution.

This app creates multiple parallel fragments that each sleep for a short time.
When running in parallel, the total load time should be approximately equal to
the longest sleep time, not the sum of all sleep times.
"""

import time

import streamlit as st

# Record when the script starts
script_start_time = time.time()
st.write(f"Script started at: {script_start_time:.3f}")

# Sleep duration for each fragment (in seconds)
FRAGMENT_SLEEP_TIME = 10


@st.fragment(parallel=True)
def parallel_fragment_1():
    """First parallel fragment - sleeps then displays content."""
    with st.spinner("Parallel fragment 1 is running..."):
        fragment_start = time.time()
        time.sleep(FRAGMENT_SLEEP_TIME)
        fragment_end = time.time()

    st.markdown("**Fragment 1** (parallel=True)")
    st.write(f"Duration: {fragment_end - fragment_start:.3f}s")
    st.metric("Fragment 1", "✓ Complete")


@st.fragment(parallel=True)
def parallel_fragment_2():
    """Second parallel fragment - sleeps then displays content."""
    with st.spinner("Parallel fragment 2 is running..."):
        fragment_start = time.time()
        time.sleep(FRAGMENT_SLEEP_TIME)
        fragment_end = time.time()

    st.markdown("**Fragment 2** (parallel=True)")
    st.write(f"Duration: {fragment_end - fragment_start:.3f}s")
    st.metric("Fragment 2", "✓ Complete")


@st.fragment(parallel=True)
def parallel_fragment_3():
    """Third parallel fragment - sleeps then displays content."""
    with st.spinner("Parallel fragment 3 is running..."):
        fragment_start = time.time()
        time.sleep(FRAGMENT_SLEEP_TIME)
        fragment_end = time.time()

    st.markdown("**Fragment 3** (parallel=True)")
    st.write(f"Duration: {fragment_end - fragment_start:.3f}s")
    st.metric("Fragment 3", "✓ Complete")


# Non-parallel fragment for comparison
@st.fragment
def sequential_fragment():
    """Regular (non-parallel) fragment for comparison."""
    fragment_start = time.time()
    time.sleep(FRAGMENT_SLEEP_TIME)
    fragment_end = time.time()

    st.markdown("**Sequential Fragment** (parallel=False)")
    st.write(f"Duration: {fragment_end - fragment_start:.3f}s")
    st.metric("Sequential", "✓ Complete")


st.header("Parallel Fragments Demo")

# Create columns to show parallel fragments side by side
col1, col2, col3 = st.columns(3)

with col1:
    parallel_fragment_1()

with col2:
    parallel_fragment_2()

with col3:
    parallel_fragment_3()

st.divider()

st.header("Sequential Fragment (for comparison)")
sequential_fragment()
sequential_fragment()

# Record when the main script finishes (before waiting for threads)
script_end_time = time.time()
main_thread_duration = script_end_time - script_start_time

st.divider()
st.header("Timing Summary")
st.write(f"Main thread execution time: {main_thread_duration:.3f}s")
st.write(
    f"Expected sequential time (3 parallel + 1 sequential): {FRAGMENT_SLEEP_TIME * 4:.3f}s"
)
st.write(
    f"Expected parallel time (max of 3 parallel + 1 sequential): {FRAGMENT_SLEEP_TIME * 2:.3f}s"
)

# The main thread should complete quickly since parallel fragments run in background
# Only the sequential fragment blocks the main thread
if main_thread_duration < FRAGMENT_SLEEP_TIME * 3:
    st.success(
        "✓ Main thread completed quickly - parallel fragments are running in background!"
    )
else:
    st.error("✗ Main thread took too long - parallel execution may not be working")
