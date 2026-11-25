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

st.session_state.setdefault("log", [])
st.session_state.setdefault("body_runs", 0)


def on_click() -> None:
    # Record entry and exit so tests can detect interleaved or repeated callbacks.
    callback_index = len(st.session_state.log) // 2
    st.session_state.log.append(f"start{callback_index}")
    time.sleep(st.session_state.get("callback_sleep", 0))
    st.session_state.log.append(f"end{callback_index}")
    st.session_state.body_spins = 0


st.button("click", on_click=on_click)

for _ in range(st.session_state.get("body_spins", 0)):
    time.sleep(0.01)
    st.empty()

st.session_state.body_runs += 1
