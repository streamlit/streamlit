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

"""Caching app for load testing.

Validates cache effectiveness under concurrent access (cache hit ratio).
"""

import time

import streamlit as st


@st.cache_data
def expensive_computation(n: int) -> list[int]:
    time.sleep(0.05)  # Simulate work
    return list(range(n))


st.title("Load Test - Caching")

n = st.slider("N", 100, 10000, 1000)
data = expensive_computation(n)
st.write(f"Computed {len(data)} items")

st.button("Rerun")
