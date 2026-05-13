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

st.header("Skeleton Tests")

# Context manager - instant (skeleton clears immediately)
if st.button("Run skeleton context manager (instant)"):
    with st.skeleton(height=100):
        pass
    st.success("Context manager completed!")

# Context manager - with delay
if st.button("Run skeleton context manager (with delay)"):
    with st.skeleton(height=150):
        time.sleep(1)
    st.success("Data loaded after delay!")

# Context manager - with exception
if st.button("Run skeleton context manager (with exception)"):
    try:
        with st.skeleton(height=100):
            time.sleep(0.5)
            raise ValueError("Test exception")
    except ValueError:
        st.error("Exception caught - skeleton was cleared")

# Standalone mode - replaces skeleton with dataframe
if st.button("Run skeleton standalone mode"):
    placeholder = st.skeleton(height=200)
    time.sleep(1)
    placeholder.dataframe({"col1": [1, 2, 3], "col2": [4, 5, 6]})  # type: ignore[operator]

# Standalone mode - clears skeleton with empty()
if st.button("Run skeleton standalone clear"):
    placeholder = st.skeleton(height=100)
    time.sleep(0.5)
    placeholder.empty()  # type: ignore[operator]
    st.info("Skeleton was cleared with empty()")

# Fragment with skeleton
if st.button("Test skeleton in fragment"):

    @st.fragment
    def skeleton_fragment():
        with st.skeleton(height=100):
            time.sleep(0.5)
        st.write("Fragment completed!")
        st.button("Rerun fragment")

    skeleton_fragment()
