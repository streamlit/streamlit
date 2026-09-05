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

"""E2E app for callback replay coalescing with fast reruns disabled."""

from time import monotonic, sleep

import streamlit as st
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.scriptrunner_utils.script_requests import ScriptRequestType

for key in ("form_callbacks", "fresh_callbacks", "body_runs"):
    if key not in st.session_state:
        st.session_state[key] = 0

st.session_state.body_runs += 1


def wait_for_fresh_request() -> None:
    st.session_state.form_callbacks += 1
    st.session_state.normalized_name = st.session_state.submitted_name.strip()
    st.write("Form callback waiting for fresh input")
    ctx = get_script_run_ctx()
    assert ctx is not None
    assert ctx.script_requests is not None
    deadline = monotonic() + 10
    while ctx.script_requests._state is ScriptRequestType.CONTINUE:
        if monotonic() >= deadline:
            raise RuntimeError("Fresh browser interaction did not arrive")
        sleep(0.01)
    st.rerun("replay_target")


def record_fresh_callback() -> None:
    st.session_state.fresh_callbacks += 1


@st.fragment(key="replay_target")
def replay_target() -> None:
    st.write("Replay target")


replay_target()

with st.form("coalescing_form"):
    st.text_input("Submitted name", key="submitted_name")
    form_submitted = st.form_submit_button(
        "Submit coalescing form", on_click=wait_for_fresh_request
    )

st.button("Fresh interaction", key="fresh_interaction", on_click=record_fresh_callback)

with st.container(key="coalescing_results"):
    st.write(f"Body runs: {st.session_state.body_runs}")
    st.write(f"Form callbacks: {st.session_state.form_callbacks}")
    st.write(f"Fresh callbacks: {st.session_state.fresh_callbacks}")
    st.write(f"Normalized name: {st.session_state.get('normalized_name', '')}")
    st.write(f"Body saw submit: {form_submitted}")
