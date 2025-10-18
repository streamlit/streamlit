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

"""Test app for pyplot/image width regression in v1.50.0.

Reproduces issues:
- #12678: Plots shown tiny in fragments
- #12763: Images shown tiny with expanders

These tests verify the width calculation bug is fixed.
"""

import matplotlib.pyplot as plt

import streamlit as st

st.title("Width Regression Tests")

# Test 1: pyplot in fragment (from #12678 minimal example)
st.header("Test 1: st.pyplot in fragment")


@st.fragment
def pyplot_in_fragment():
    fig, ax = plt.subplots(figsize=(10, 3))
    ax.bar([1, 2, 3], [1, 2, 3])
    ax.set_title("In Fragment - Should be full width")
    st.pyplot(fig)


pyplot_in_fragment()

# Test 2: pyplot in fragment with workaround
st.header("Test 2: st.pyplot in fragment with width='content'")


@st.fragment
def pyplot_in_fragment_workaround():
    fig, ax = plt.subplots(figsize=(10, 3))
    ax.bar([1, 2, 3], [1, 2, 3])
    ax.set_title("In Fragment with workaround")
    st.pyplot(fig, width="content")


pyplot_in_fragment_workaround()

# Test 3: image in expander
st.header("Test 3: st.image in expander")

with st.expander("Expander with image", expanded=True):
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot([1, 2, 3, 4], [1, 4, 2, 3])
    ax.set_title("In Expander - Should be full width")
    st.pyplot(fig)

# Test 4: image in expander with workaround
st.header("Test 4: st.image in expander with width='content'")

with st.expander("Expander with workaround", expanded=True):
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot([1, 2, 3, 4], [1, 4, 2, 3])
    ax.set_title("In Expander with workaround")
    st.pyplot(fig, width="content")

# Test 5: pyplot in container
st.header("Test 5: st.pyplot in container")

with st.container(border=True):
    fig, ax = plt.subplots(figsize=(10, 3))
    ax.scatter([1, 2, 3], [3, 1, 2])
    ax.set_title("In Container - Should be full width")
    st.pyplot(fig)
