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

import streamlit as st


@st.cache_resource
def execution_counts() -> dict[str, int]:
    return {}


@st.cache_data(max_size="1200B", show_spinner=False)
def lru_value(key: str) -> bytes:
    counts = execution_counts()
    counts[key] = counts.get(key, 0) + 1
    return bytes(400)


@st.cache_data(max_size="1B", show_spinner=False)
def oversized_value() -> bytes:
    counts = execution_counts()
    counts["oversized"] = counts.get("oversized", 0) + 1
    return bytes(400)


lru_value("a")
lru_value("b")
lru_value("a")
lru_value("c")
lru_value("b")

oversized_value()
oversized_value()

counts = execution_counts()
st.write(
    "LRU executions:",
    f"a={counts.get('a', 0)}, b={counts.get('b', 0)}, c={counts.get('c', 0)}",
)
st.write("Oversized executions:", counts.get("oversized", 0))
