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

"""Exercises the persistent script-thread event loop.

Records the current event loop at the start of each run, then calls
``asyncio.run()``. Calls ``st.rerun()`` once so the script runs twice in a
single start/join cycle: the second run captures the loop *after* the first
run's ``asyncio.run()`` unset the thread's current loop, proving the loop is
re-asserted at the start of every run.
"""

import asyncio

import streamlit as st

captured_loops = st.session_state.setdefault("captured_loops", [])
captured_loops.append(asyncio.get_event_loop())
st.session_state["loop_running"] = asyncio.get_event_loop().is_running()


async def _double(value: int) -> int:
    return value * 2


st.session_state["asyncio_run_result"] = asyncio.run(_double(21))

# asyncio.run() runs on its own temporary loop and closes that loop, not ours.
st.session_state["persistent_loop_closed_mid_run"] = captured_loops[-1].is_closed()

if len(captured_loops) == 1:
    st.rerun()
