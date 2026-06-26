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

st.header("Cache background refresh")


@st.cache_resource
def _computation_counts() -> dict[str, int]:
    """A global, persistent counter of how often each function actually executed."""
    return {"data": 0, "resource": 0}


@st.cache_data(ttl=2, refresh_type="background")
def get_data_value() -> str:
    counts = _computation_counts()
    counts["data"] += 1
    # Simulate a slow function so a background refresh is meaningful.
    time.sleep(0.2)
    return f"data-v{counts['data']}"


@st.cache_resource(ttl=2, refresh_type="background")
def get_resource_value() -> str:
    counts = _computation_counts()
    counts["resource"] += 1
    time.sleep(0.2)
    return f"resource-v{counts['resource']}"


with st.container(key="data_value"):
    st.text(get_data_value())

with st.container(key="resource_value"):
    st.text(get_resource_value())

st.button("Rerun")
