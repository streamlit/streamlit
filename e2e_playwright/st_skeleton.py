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
            # Sleep long enough for slower browsers (e.g. webkit on CI) to
            # observe the skeleton, which a new block shows right away.
            time.sleep(2)
        st.success("Data loaded after delay!")

# Context manager - with exception
if st.button("Run skeleton context manager (with exception)"):
    try:
        with st.skeleton(height=100):
            time.sleep(0.7)  # Keep the skeleton visible before raising
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
            time.sleep(1)  # Keep the skeleton visible
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


st.subheader("Skeleton keeps previous content")


@st.cache_data(show_spinner="Loading report...")
def load_report(version: int) -> str:
    time.sleep(2.5)
    return f"Report version {version}"


# The cache is shared by every test run on the same server, so clear it to make
# the first load and the next version cache misses in each run.
if st.toggle("Show cached report", on_change=load_report.clear):
    if st.button("Load next report version"):
        st.session_state.report_version = st.session_state.get("report_version", 0) + 1
    st.button("Rerun skeleton report")
    with st.container(key="cached_skeleton_container"):
        with st.skeleton(height=80):
            st.write(load_report(st.session_state.get("report_version", 0)))


# The main script sends the skeleton, which holds the slot until the fragment draws.
st.subheader("Parallel fragment in a skeleton")


@st.fragment(parallel=True)
def parallel_report_body() -> None:
    time.sleep(2)
    st.write("Parallel report loaded")


if st.toggle("Show parallel report"):
    with st.container(key="parallel_skeleton_container"):
        with st.skeleton(height=120):
            parallel_report_body()


# Standalone skeleton over a cached report: on a cache miss, it covers the
# previous version instead of replacing it.
st.subheader("Standalone skeleton keeps previous content")


@st.cache_data(show_spinner=False)
def load_standalone_report(version: int) -> str:
    time.sleep(2.5)
    return f"Standalone report version {version}"


# The cache is shared by every test run on the same server, so clear it to make
# the first load and the next version cache misses in each run.
if st.toggle("Show standalone report", on_change=load_standalone_report.clear):
    if st.button("Load next standalone report"):
        st.session_state.standalone_report_version = (
            st.session_state.get("standalone_report_version", 0) + 1
        )
    st.button("Rerun standalone report")
    with st.container(key="standalone_skeleton_container"):
        report_slot = st.skeleton(height=80)
        report_slot.write(
            load_standalone_report(st.session_state.get("standalone_report_version", 0))
        )


# Elements inside a skeleton stack vertically, even in a horizontal container.
st.subheader("Skeleton in a horizontal container")
with st.container(horizontal=True, key="horizontal_skeleton_container"):
    with st.skeleton(height=40):
        st.button("Top button")
        st.button("Bottom button")
    st.button("Next to the skeleton")
