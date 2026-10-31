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

import asyncio

import streamlit as st

if "async_cache_calls" not in st.session_state:
    st.session_state.async_cache_calls = 0


@st.cache_data(scope="session")
async def load_value() -> int:
    st.session_state.async_cache_calls += 1
    await asyncio.sleep(0)
    return 42


result = asyncio.run(load_value())
st.text(f"result: {result}")
st.text(f"calls: {st.session_state.async_cache_calls}")
