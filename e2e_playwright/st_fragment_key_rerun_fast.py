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

"""E2E app for same-run fragment coalescing with fast reruns enabled."""

from time import monotonic, sleep
from uuid import uuid4

import streamlit as st
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.scriptrunner_utils.script_requests import ScriptRequestType

for key in ("source_callbacks", "fresh_callbacks"):
    if key not in st.session_state:
        st.session_state[key] = 0


def record_fresh_callback() -> None:
    st.session_state.fresh_callbacks += 1


@st.fragment(key="source_fragment")
def source_fragment() -> None:
    with st.container(key="fast_source_uuid"):
        st.write(str(uuid4()))
    callback_marker = st.empty()

    def wait_for_fresh_fragment_request() -> None:
        st.session_state.source_callbacks += 1
        st.session_state.normalized_value = st.session_state.source_value.strip()
        callback_marker.write("Source callback waiting for fresh fragment input")
        ctx = get_script_run_ctx()
        assert ctx is not None
        assert ctx.script_requests is not None
        deadline = monotonic() + 10
        while ctx.script_requests._state is ScriptRequestType.CONTINUE:
            if monotonic() >= deadline:
                raise RuntimeError("Fresh fragment interaction did not arrive")
            sleep(0.01)
        st.rerun("result_fragment")

    with st.form("fast_source_form"):
        st.text_input(
            "Source value",
            key="source_value",
        )
        st.form_submit_button(
            "Submit source",
            key="source_submit",
            on_click=wait_for_fresh_fragment_request,
        )


@st.fragment(key="fresh_fragment")
def fresh_fragment() -> None:
    with st.container(key="fast_fresh_uuid"):
        st.write(str(uuid4()))
    st.button(
        "Fresh fragment interaction",
        key="fresh_fragment_button",
        on_click=record_fresh_callback,
    )


@st.fragment(key="result_fragment")
def result_fragment() -> None:
    with st.container(key="fast_result_uuid"):
        st.write(str(uuid4()))
    with st.container(key="fast_results"):
        st.write(f"Source callbacks: {st.session_state.source_callbacks}")
        st.write(f"Fresh callbacks: {st.session_state.fresh_callbacks}")
        st.write(f"Normalized value: {st.session_state.get('normalized_value', '')}")
        st.write(f"Result saw submit: {st.session_state.get('source_submit', False)}")


source_fragment()
fresh_fragment()
result_fragment()
