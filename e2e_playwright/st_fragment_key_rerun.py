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

"""E2E app for @st.fragment(key=...) and st.rerun(scope=<key>) scenarios."""

from time import monotonic, sleep
from uuid import uuid4

import streamlit as st
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.scriptrunner_utils.script_requests import ScriptRequestType

# ------------------------------------------------------------------ #
# Scenario 1: Widget outside a keyed fragment triggers a fragment-only rerun.
# ------------------------------------------------------------------ #
st.header("Scenario 1: single-key rerun")

if "outside_counter" not in st.session_state:
    st.session_state.outside_counter = 0

st.session_state.outside_counter += 1
with st.container(key="outside_counter"):
    st.write(f"Outside counter: {st.session_state.outside_counter}")


@st.fragment(key="charts")
def charts_fragment() -> None:
    with st.container(key="fragment_uuid"):
        st.write(f"Fragment uuid: {uuid4()}")


charts_fragment()

st.button(
    "Rerun charts fragment",
    key="rerun_charts_btn",
    on_click=lambda: st.rerun("charts"),
)

# ------------------------------------------------------------------ #
# Scenario 2: Targeting a list of two fragment keys from one callback.
# ------------------------------------------------------------------ #
st.header("Scenario 2: multi-key rerun")


@st.fragment(key="frag_alpha")
def alpha_fragment() -> None:
    with st.container(key="alpha_uuid"):
        st.write(f"Alpha uuid: {uuid4()}")


@st.fragment(key="frag_beta")
def beta_fragment() -> None:
    with st.container(key="beta_uuid"):
        st.write(f"Beta uuid: {uuid4()}")


alpha_fragment()
beta_fragment()

with st.container(key="stable_text"):
    st.write(f"Stable text outside: {st.session_state.outside_counter}")

st.button(
    "Rerun alpha and beta",
    key="rerun_multi_btn",
    on_click=lambda: st.rerun(["frag_alpha", "frag_beta"]),
)

# ------------------------------------------------------------------ #
# Scenario 3: Fragment-to-fragment — widget inside fragment A targets B.
# Only the target fragment should rerun; source and outside stay stable.
# ------------------------------------------------------------------ #
st.header("Scenario 3: fragment-to-fragment targeting")


@st.fragment(key="source_frag")
def source_fragment() -> None:
    with st.container(key="source_uuid"):
        st.write(f"Source uuid: {uuid4()}")
    st.button(
        "Rerun target from source",
        key="rerun_target_btn",
        on_click=lambda: st.rerun("target_frag"),
    )


@st.fragment(key="target_frag")
def target_fragment() -> None:
    with st.container(key="target_uuid"):
        st.write(f"Target uuid: {uuid4()}")


source_fragment()
target_fragment()

with st.container(key="compose_stable_text"):
    st.write(f"Compose stable text: {st.session_state.outside_counter}")

# ------------------------------------------------------------------ #
# Scenario 4: Unknown key raises a visible exception.
# ------------------------------------------------------------------ #
st.header("Scenario 4: unknown key raises")

st.button(
    "Rerun unknown fragment",
    key="rerun_unknown_btn",
    on_click=lambda: st.rerun("nonexistent_key"),
)

# ------------------------------------------------------------------ #
# Scenario 5: Fragment interaction coalesces with a callback-generated replay.
# ------------------------------------------------------------------ #
st.header("Scenario 5: fragment callback replay coalescing")

for key in (
    "source_callbacks",
    "fresh_callbacks",
    "coalescing_source_runs",
    "coalescing_fresh_runs",
    "coalescing_result_runs",
):
    if key not in st.session_state:
        st.session_state[key] = 0


def record_fresh_callback() -> None:
    st.session_state.fresh_callbacks += 1


@st.fragment(key="source_fragment")
def coalescing_source_fragment() -> None:
    st.session_state.coalescing_source_runs += 1
    with st.container(key="coalescing_source_uuid"):
        st.write(str(uuid4()))
    with st.container(key="coalescing_source_runs"):
        st.write(f"Source runs: {st.session_state.coalescing_source_runs}")
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

    with st.form("coalescing_source_form"):
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
def coalescing_fresh_fragment() -> None:
    st.session_state.coalescing_fresh_runs += 1
    with st.container(key="coalescing_fresh_uuid"):
        st.write(str(uuid4()))
    with st.container(key="coalescing_fresh_runs"):
        st.write(f"Fresh runs: {st.session_state.coalescing_fresh_runs}")
    st.button(
        "Fresh fragment interaction",
        key="fresh_fragment_button",
        on_click=record_fresh_callback,
    )


@st.fragment(key="result_fragment")
def coalescing_result_fragment() -> None:
    st.session_state.coalescing_result_runs += 1
    with st.container(key="coalescing_result_uuid"):
        st.write(str(uuid4()))
    with st.container(key="coalescing_result_runs"):
        st.write(f"Result runs: {st.session_state.coalescing_result_runs}")
    with st.container(key="coalescing_results"):
        st.write(f"Source callbacks: {st.session_state.source_callbacks}")
        st.write(f"Fresh callbacks: {st.session_state.fresh_callbacks}")
        st.write(f"Normalized value: {st.session_state.get('normalized_value', '')}")
        st.write(f"Result saw submit: {st.session_state.get('source_submit', False)}")


coalescing_source_fragment()
coalescing_fresh_fragment()
coalescing_result_fragment()
