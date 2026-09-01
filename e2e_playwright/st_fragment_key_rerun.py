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
# Scenario 5: Fresh input coalesces with a callback-generated replay.
# ------------------------------------------------------------------ #
st.header("Scenario 5: callback replay coalescing")

for key in ("form_callbacks", "fresh_callbacks"):
    if key not in st.session_state:
        st.session_state[key] = 0


def wait_for_fresh_request() -> None:
    st.session_state.form_callbacks += 1
    st.session_state.normalized_name = st.session_state.race_name.strip()
    st.write("Form callback waiting for fresh input")
    ctx = get_script_run_ctx()
    assert ctx is not None
    assert ctx.script_requests is not None
    deadline = monotonic() + 10
    while ctx.script_requests._state is ScriptRequestType.CONTINUE:
        if monotonic() >= deadline:
            raise RuntimeError("Fresh browser interaction did not arrive")
        sleep(0.01)
    st.rerun("race_target")


def record_fresh_callback() -> None:
    st.session_state.fresh_callbacks += 1


@st.fragment(key="race_target")
def race_target() -> None:
    st.write("Race target")


race_target()

with st.form("race_form"):
    st.text_input("Race name", key="race_name")
    race_submitted = st.form_submit_button(
        "Submit race form", on_click=wait_for_fresh_request
    )

st.button("Fresh interaction", key="fresh_interaction", on_click=record_fresh_callback)

with st.container(key="race_results"):
    st.write(f"Form callbacks: {st.session_state.form_callbacks}")
    st.write(f"Fresh callbacks: {st.session_state.fresh_callbacks}")
    st.write(f"Normalized name: {st.session_state.get('normalized_name', '')}")
    st.write(f"Body saw submit: {race_submitted}")
