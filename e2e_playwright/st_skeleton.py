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

# Static skeleton for snapshot test
st.subheader("Static Skeleton (for snapshot)")
st.skeleton(height=100)

# Default skeleton (height=None) uses the standard element height.
st.subheader("Default Skeleton")
with st.container(key="default_skeleton"):
    st.skeleton()

# Skeleton with different width configurations
st.subheader("Width Configurations")
with st.container(key="fixed_width_skeleton"):
    st.skeleton(height=50, width=200)
with st.container(key="stretch_width_skeleton"):
    st.skeleton(height=50, width="stretch")

# Context manager - instant (skeleton clears immediately)
if st.button("Run skeleton context manager (instant)"):
    with st.skeleton(height=100):
        pass
    st.success("Context manager completed!")

# Context manager - with delay. Wrapped in a keyed container so the e2e test can
# scope its skeleton-count assertion to this block instead of depending on the
# total number of static skeletons rendered elsewhere in the app.
with st.container(key="delay_cm_container"):
    if st.button("Run skeleton context manager (with delay)"):
        with st.skeleton(height=150):
            # Sleep well beyond the 0.5s delay threshold so the transient
            # skeleton stays visible long enough for slower browsers (e.g.
            # webkit on CI) to reliably observe it, mirroring st_spinner.py.
            time.sleep(2)
        st.success("Data loaded after delay!")

# Context manager - with exception
if st.button("Run skeleton context manager (with exception)"):
    try:
        with st.skeleton(height=100):
            time.sleep(0.7)  # Sleep longer than 0.5s delay to ensure skeleton shows
            raise ValueError("Test exception")
    except ValueError:
        st.error("Exception caught - skeleton was cleared")

# Standalone mode - replaces skeleton with dataframe
if st.button("Run skeleton standalone mode"):
    placeholder = st.skeleton(height=200)
    time.sleep(1)
    placeholder.dataframe({"col1": [1, 2, 3], "col2": [4, 5, 6]})

# Standalone mode - clears skeleton with empty()
if st.button("Run skeleton standalone clear"):
    placeholder = st.skeleton(height=100)
    time.sleep(0.5)
    placeholder.empty()
    st.info("Skeleton was cleared with empty()")

# Fragment with skeleton
if st.button("Test skeleton in fragment"):

    @st.fragment
    def skeleton_fragment():
        with st.skeleton(height=100):
            time.sleep(1)  # Sleep longer than 0.5s delay so skeleton shows
        st.write("Fragment completed!")
        st.button("Rerun fragment")

    skeleton_fragment()

# Skeleton in form
st.subheader("Skeleton in Form")
with st.form("skeleton_form"):
    st.write("Form with skeleton placeholder")
    placeholder = st.skeleton(height=80)
    submitted = st.form_submit_button("Submit")
    if submitted:
        placeholder.success("Form submitted!")
