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

Models a synchronous library that captures the current event loop and drives
an async operation with ``run_until_complete()``, then calls ``asyncio.run()``.
Calls ``st.rerun()`` once so the script runs twice in a single start/join
cycle: the second run captures the loop *after* the first run's
``asyncio.run()`` unset the thread's current loop, proving the loop is
re-asserted at the start of every run.
"""

import asyncio

import streamlit as st


async def _double(value: int) -> int:
    return value * 2


class _SyncLibraryClient:
    def __init__(self) -> None:
        self.event_loop = asyncio.get_event_loop()

    def double(self, value: int) -> int:
        return self.event_loop.run_until_complete(_double(value))


client = _SyncLibraryClient()
captured_loops = st.session_state.setdefault("captured_loops", [])
captured_loops.append(client.event_loop)
st.session_state["loop_running"] = client.event_loop.is_running()
st.session_state["sync_library_result"] = client.double(21)

st.session_state["asyncio_run_result"] = asyncio.run(_double(21))

# asyncio.run() runs on its own temporary loop and closes that loop, not ours.
st.session_state["persistent_loop_closed_mid_run"] = captured_loops[-1].is_closed()

if len(captured_loops) == 1:
    st.rerun()
