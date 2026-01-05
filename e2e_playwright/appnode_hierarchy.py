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

"""
An app that exercises AppNode hierarchy changes.

- Swap an element with a different element in-place
- Insert an element between two others
- Simulate a long computation (with elements turning stale)
- Use st.empty() placeholder to update content in place

The paired Playwright test ensures only expected elements are visible and
no stale duplicates remain after updates/reruns.
"""

from __future__ import annotations

import time

import streamlit as st

mode = st.selectbox(
    "Choose scenario",
    [
        "none",
        "swap_element",
        "insert_between",
        "long_compute",
        "placeholder_updates",
        "simple_transient_spinner",
        "complex_transient_spinner",
        "chat_transient_spinner",
    ],
    key="scenario_mode",
)


def render_swap_element() -> None:
    # Swap: previously a text becomes a markdown (different element type)
    element = st.markdown("initial element")
    element.text("swapped element")


def render_insert_between() -> None:
    # Insert an element in between two others
    st.markdown("top")
    element_2 = st.markdown("between")
    st.markdown("bottom")
    element_2.markdown("inserted element")


def render_long_compute() -> None:
    st.markdown("top")
    st.markdown("second")
    if st.button("run long compute"):
        time.sleep(5)
    else:
        st.markdown("second to last")
    st.markdown("bottom")


def render_placeholder_updates() -> None:
    st.markdown("placeholder-top")
    ph = st.empty()
    st.markdown("placeholder-bottom")
    if st.button("update placeholder"):
        ph.markdown("placeholder-filled")


def render_simple_transient_spinner() -> None:
    st.button("Rerun")
    if "has_ran" not in st.session_state:
        with st.spinner("Spinner (delta path 0 0)"):
            time.sleep(5)  # Just to make the bug easier to see.
            st.write("Hello world 1! (delta path 0 1)")

        st.session_state.has_ran = True

    else:
        st.write("Hello world 2! (delta path 0 0)")
        time.sleep(5)  # Just to make the bug easier to see.

        del st.session_state.has_ran


def render_complex_transient_spinner() -> None:
    if st.button("Rerun with spinners"):
        st.session_state.has_ran = True
    if st.button("Rerun without spinners"):
        st.session_state.has_ran = False

    if st.session_state.get("has_ran", True):
        with st.spinner("Loading..."):
            time.sleep(0.5)
            for i in range(2):
                time.sleep(1)
                st.write(i)
            "some text"
        st.button("Rerun 1")
        with st.spinner("Loading..."):
            time.sleep(0.5)
            for i in range(2):
                time.sleep(0.3)
                st.write(i)
            "some text"
        st.button("Rerun 2")
    else:
        for i in range(2):
            time.sleep(1)
            st.write(i)
        "some text"
        st.button("Rerun 1")
        for i in range(2):
            time.sleep(1)
            st.write(i)
        "some text"
        st.button("Rerun 2")


def render_chat_transient_spinner() -> None:
    if "messages" not in st.session_state:
        st.session_state.messages = []

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    if prompt := st.chat_input("Say something"):
        st.session_state.messages.append({"role": "user", "content": prompt})
        st.chat_message("user").write(prompt)
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                time.sleep(3)
                st.session_state.messages.append(
                    {"role": "assistant", "content": f"Echo: {prompt}"}
                )

                st.write(f"Echo: {prompt}")


if mode == "swap_element":
    render_swap_element()
elif mode == "insert_between":
    render_insert_between()
elif mode == "long_compute":
    render_long_compute()
elif mode == "placeholder_updates":
    render_placeholder_updates()
elif mode == "simple_transient_spinner":
    render_simple_transient_spinner()
elif mode == "complex_transient_spinner":
    render_complex_transient_spinner()
elif mode == "chat_transient_spinner":
    render_chat_transient_spinner()
