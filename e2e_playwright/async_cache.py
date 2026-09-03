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


@st.cache_data(show_spinner="Computing async data...")
async def load_data() -> dict[str, int]:
    st.session_state.data_executions = st.session_state.get("data_executions", 0) + 1
    st.markdown(f"Inside cache_data: {st.session_state.data_executions}")
    await asyncio.sleep(1)
    return {"execution": st.session_state.data_executions}


@st.cache_resource(show_spinner="Computing async resource...")
async def load_resource() -> dict[str, int]:
    st.session_state.resource_executions = (
        st.session_state.get("resource_executions", 0) + 1
    )
    st.markdown(f"Inside cache_resource: {st.session_state.resource_executions}")
    await asyncio.sleep(1)
    return {"execution": st.session_state.resource_executions}


async def render_cached_values() -> None:
    data = await load_data()
    resource = await load_resource()
    st.markdown(f"cache_data result: {data['execution']}")
    st.markdown(f"cache_resource result: {resource['execution']}")


if st.button("Run async caches"):
    st.session_state.run_async_caches = True

if st.session_state.get("run_async_caches", False):
    asyncio.run(render_cached_values())
