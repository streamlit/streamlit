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
When running in parallel, the total main thread time should be short since
parallel fragments run in background threads.
"""

import time

import streamlit as st

# Sleep duration for each fragment (in seconds)
FRAGMENT_SLEEP_TIME = 0.3

# Record when the script starts
script_start_time = time.time()


@st.fragment(parallel=True)
def parallel_chart_1():
    """First parallel fragment - simulates slow data load."""
    time.sleep(FRAGMENT_SLEEP_TIME)
    st.write("parallel_chart_1_complete")


@st.fragment(parallel=True)
def parallel_chart_2():
    """Second parallel fragment - simulates slow data load."""
    time.sleep(FRAGMENT_SLEEP_TIME)
    st.write("parallel_chart_2_complete")


@st.fragment(parallel=True)
def parallel_chart_3():
    """Third parallel fragment - simulates slow data load."""
    time.sleep(FRAGMENT_SLEEP_TIME)
    st.write("parallel_chart_3_complete")


st.header("Parallel Fragments Demo")

# Call all parallel fragments - they should start executing in background
col1, col2, col3 = st.columns(3)

with col1:
    parallel_chart_1()

with col2:
    parallel_chart_2()

with col3:
    parallel_chart_3()

# Record when the main script finishes (before waiting for threads)
script_end_time = time.time()
main_thread_duration = script_end_time - script_start_time

st.divider()

st.write(f"main_thread_time: {main_thread_duration:.3f}")

# The main thread should complete quickly since parallel fragments run in background
# Each fragment sleeps for FRAGMENT_SLEEP_TIME, but since they're parallel,
# the main thread should NOT be blocked by those sleeps
if main_thread_duration < FRAGMENT_SLEEP_TIME * 2:
    st.write("parallel_execution_verified")
