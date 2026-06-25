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


import numpy as np
import pandas as pd

import streamlit as st

# Create random dataframe:
np.random.seed(0)
df = pd.DataFrame(np.random.randn(50, 5), columns=["a", "b", "c", "d", "e"])

st.popover("popover 1 (empty)")

with st.popover(
    "popover 3 (with widgets)",
):
    st.markdown("Hello World 👋")
    text = st.text_input("Text input")
    col1, col2, col3 = st.columns(3)
    col1.text_input("Column 1")
    col2.text_input("Column 2")
    col3.text_input("Column 3")
    st.selectbox("Selectbox", ["a", "b", "c"])

with st.popover("popover 4 (with dataframe)", help="help text"):
    st.markdown("Popover with dataframe")
    st.dataframe(df, width="stretch")
    st.image(np.repeat(0, 100).reshape(10, 10))

with st.sidebar.popover("popover 5 (in sidebar)"):
    st.markdown("Popover in sidebar with dataframe")
    st.dataframe(df, width="stretch")

with st.popover("popover 6 (disabled)", disabled=True):
    st.markdown("Hello World 👋")

with st.popover("popover 7 (emoji)", icon="🦄"):
    st.markdown("Hello unicorn")

with st.popover("popover 8 (material icon)", icon=":material/thumb_up:"):
    st.markdown("Hello thumb up")

with st.container(border=True, key="test_width=content", height=160):
    with st.popover("popover 10 (width=content)", width="content"):
        st.markdown("Content width")

with st.container(border=True, key="test_width=stretch", height=160):
    with st.popover("popover 11 (width=stretch)", width="stretch"):
        st.markdown("Stretch width")

with st.container(border=True, key="test_width=500px", height=160):
    with st.popover("popover 12 (width=500px)", width=500):
        st.markdown("500px width")


with st.container(border=True, key="test_columns", height=160):
    col1, col2 = st.columns(2)
    with col1:
        with st.popover("popover 16 (in column 1)", width="stretch"):
            st.markdown("Popover in column 1")
    with col2:
        with st.popover("popover 17 (in column 2)"):
            st.markdown("Popover in column 2")

with st.expander("Output"):
    st.markdown(text)

with st.popover("popover 18 (primary)", type="primary"):
    st.markdown("Dummy content")

with st.popover("popover 19 (tertiary)", type="tertiary"):
    st.markdown("Dummy content")

# Menu-style icons (chevron should be hidden)
with st.container(key="menu_style_icons_container"):
    col1, col2, col3 = st.columns(3)
    with col1:
        with st.popover(":material/menu:", key="menu_icon_popover"):
            st.markdown("Menu popover content")
    with col2:
        with st.popover(":material/more_vert:", key="more_vert_icon_popover"):
            st.markdown("More vert popover content")
    with col3:
        with st.popover(":material/more_horiz:", key="more_horiz_icon_popover"):
            st.markdown("More horiz popover content")

# ============================================================================
# Dynamic Popover Tests (on_change="rerun")
# ============================================================================

if "pop_exec_count" not in st.session_state:
    st.session_state.pop_exec_count = 0

pop_dyn = st.popover("Dynamic popover", on_change="rerun")

if pop_dyn.open:
    with pop_dyn:
        st.session_state.pop_exec_count += 1
        st.write(f"Popover content executed {st.session_state.pop_exec_count} times")

st.write(f"Popover execution count: {st.session_state.pop_exec_count}")


def open_pop() -> None:
    st.session_state.prog_pop = True


def close_pop() -> None:
    st.session_state.prog_pop = False


col1, col2 = st.columns(2)
with col1:
    st.button("Open Popover", on_click=open_pop, key="open_pop_btn")
with col2:
    st.button("Close Popover", on_click=close_pop, key="close_pop_btn")

pop_prog = st.popover("Programmatic popover", key="prog_pop", on_change="rerun")

if pop_prog.open:
    with pop_prog:
        st.write("Programmatically controlled popover")

# ============================================================================
# Key-only (no on_change) — should NOT trigger reruns on toggle
# ============================================================================

if "key_only_rerun_count" not in st.session_state:
    st.session_state.key_only_rerun_count = 0
st.session_state.key_only_rerun_count += 1

with st.popover("Key-only popover", key="key_only_pop"):
    st.write("This popover has a key but no on_change")

st.write(f"Key-only rerun count: {st.session_state.key_only_rerun_count}")

# ============================================================================
# Fragment Test — dynamic popover inside a fragment
# ============================================================================

if "frag_exec_count" not in st.session_state:
    st.session_state.frag_exec_count = 0


@st.fragment
def popover_fragment() -> None:
    pop_frag = st.popover("Fragment popover", on_change="rerun")
    if pop_frag.open:
        with pop_frag:
            st.session_state.frag_exec_count += 1
            st.write(
                f"Fragment popover content executed {st.session_state.frag_exec_count} times"
            )

    st.write(f"Fragment popover exec count: {st.session_state.frag_exec_count}")


popover_fragment()

# ============================================================================
# Callback Tests — on_change with callable
# ============================================================================

if "cb_pop_count" not in st.session_state:
    st.session_state.cb_pop_count = 0


def popover_callback() -> None:
    st.session_state.cb_pop_count += 1


pop_cb = st.popover("Basic callback popover", key="cb_pop", on_change=popover_callback)
if pop_cb.open:
    with pop_cb:
        st.write("Callback popover content")

st.write(f"Callback count: {st.session_state.cb_pop_count}")


def popover_args_callback(prefix: str, suffix: str = "") -> None:
    st.session_state.cb_pop_args_result = f"{prefix}-toggled-{suffix}"


pop_args = st.popover(
    "Callback args popover",
    key="cb_args_pop",
    on_change=popover_args_callback,
    args=("my_prefix",),
    kwargs={"suffix": "my_suffix"},
)
if pop_args.open:
    with pop_args:
        st.write("Callback args popover content")

st.write(
    f"Callback args result: {st.session_state.get('cb_pop_args_result', 'not called')}"
)


# Callback inside a fragment
if "frag_cb_count" not in st.session_state:
    st.session_state.frag_cb_count = 0


def frag_popover_callback() -> None:
    st.session_state.frag_cb_count += 1


@st.fragment
def callback_popover_fragment() -> None:
    pop = st.popover(
        "Fragment callback popover",
        key="frag_cb_pop",
        on_change=frag_popover_callback,
    )
    if pop.open:
        with pop:
            st.write("Fragment callback popover content")
    st.write(f"Fragment callback count: {st.session_state.frag_cb_count}")


callback_popover_fragment()

if st.session_state.get("persist_popover_shift"):
    st.write("Extra text above popover")

with st.popover("Persist popover", key="persist_popover"):
    st.write("Persist popover content")
    st.checkbox("Shift delta path", key="persist_popover_shift")

# ============================================================================
# Multiple Stateful Popovers — programmatic close regression test
# https://github.com/streamlit/streamlit/issues/14943
# ============================================================================


def close_multi_pop_a() -> None:
    st.session_state.multi_pop_a = False


def close_multi_pop_b() -> None:
    st.session_state.multi_pop_b = False


with st.popover("Multi pop A", key="multi_pop_a", on_change="rerun"):
    st.button("Close A", on_click=close_multi_pop_a, key="close_multi_a_btn")

with st.popover("Multi pop B", key="multi_pop_b", on_change="rerun"):
    st.button("Close B", on_click=close_multi_pop_b, key="close_multi_b_btn")
