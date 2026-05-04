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

"""Test app for element hash memo optimization regression tests.

This app provides scenarios to verify that the element hash memo optimization
doesn't break expected behavior when identical content is sent on consecutive reruns.
"""

import time

import streamlit as st

st.header("Element Hash Memo Regression Tests")

# =============================================================================
# Test 1: setValue one-shot guard (text_input)
# =============================================================================
st.subheader("Test 1: setValue one-shot (text_input)")

if "counter" not in st.session_state:
    st.session_state.counter = 0

st.session_state.counter += 1

# Set the same value programmatically on every rerun
# The setValue one-shot should ensure this is delivered even with hash matching
st.text_input("Programmatic value input", value="fixed_value", key="test_input")
st.write(f"Text input counter: {st.session_state.counter}")

if st.button("Trigger rerun"):
    pass  # Button click triggers rerun

# =============================================================================
# Test 2: setValue one-shot guard (slider)
# =============================================================================
st.subheader("Test 2: setValue one-shot (slider)")

if "slider_counter" not in st.session_state:
    st.session_state.slider_counter = 0

st.session_state.slider_counter += 1

# Set the same value programmatically on every rerun
st.slider(
    "Programmatic slider", min_value=0, max_value=100, value=50, key="test_slider"
)
st.write(f"Slider counter: {st.session_state.slider_counter}")

if st.button("Trigger slider rerun"):
    pass  # Button click triggers rerun

# =============================================================================
# Test 3: Per-run identity (balloons)
# =============================================================================
st.subheader("Test 3: Balloons per-run identity")

if "balloons_count" not in st.session_state:
    st.session_state.balloons_count = 0

if st.button("Show balloons"):
    st.session_state.balloons_count += 1
    st.balloons()
    st.write(f"Balloons shown: {st.session_state.balloons_count}")

# =============================================================================
# Test 4: spinner showTime resets on rerun
# =============================================================================
st.subheader("Test 4: Spinner showTime")

if st.button("Run spinner with time"):
    with st.spinner("Loading with time...", show_time=True):
        # Sleep long enough for the test to observe the spinner
        time.sleep(2)
