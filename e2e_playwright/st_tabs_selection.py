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

import streamlit as st

st.subheader("Control Panel", divider="blue")

if "tabs" not in st.session_state:
    st.session_state["tabs"] = ["Tab 1", "Tab 2"]
if "add_tab" not in st.session_state:
    st.session_state["add_tab"] = False
if "remove_1" not in st.session_state:
    st.session_state["remove_1"] = False
if "remove_2" not in st.session_state:
    st.session_state["remove_2"] = False
if "change" not in st.session_state:
    st.session_state["change"] = False


# The tab mutations happen inside the on_click callbacks (not from the button
# return values) because every button disables itself via its own callback
# (e.g. disabled=st.session_state.add_tab). With server-side enforcement of the
# `disabled` parameter, a self-disabling button's trigger value is discarded on
# the run it becomes disabled, so its return value can no longer drive the
# mutation. The callback runs before re-registration (while the button was still
# enabled last run), so it fires exactly once per click and is the reliable place
# to apply the change.
def _append_tab(label: str) -> None:
    if label not in st.session_state.tabs:
        st.session_state.tabs.append(label)


def _remove_tab(label: str) -> None:
    if label in st.session_state.tabs:
        st.session_state.tabs.pop(st.session_state.tabs.index(label))


def _rename_tab(old_label: str, new_label: str) -> None:
    if old_label in st.session_state.tabs:
        st.session_state.tabs[st.session_state.tabs.index(old_label)] = new_label


def on_click_1():
    st.session_state.add_tab = True
    _append_tab("Tab 3")


def on_click_2():
    st.session_state.remove_1 = True
    _remove_tab("Tab 1")


def on_click_3():
    st.session_state.remove_2 = True
    _remove_tab("Tab 2")


def on_click_4():
    st.session_state.change = True
    st.session_state.add_tab = True
    st.session_state.remove_1 = True
    st.session_state.remove_2 = True
    _rename_tab("Tab 1", "Tab A")
    _rename_tab("Tab 3", "Tab C")


def on_click_5():
    st.session_state.change = True
    st.session_state.add_tab = True
    st.session_state.remove_1 = True
    st.session_state.remove_2 = True
    _rename_tab("Tab 1", "Tab A")
    _rename_tab("Tab 2", "Tab B")
    _rename_tab("Tab 3", "Tab C")


def reset():
    st.session_state.clear()


col1, col2, col3, col4, col5 = st.columns([0.8, 1, 1, 1.2, 1], gap="small")
with col1:
    st.button(
        "Add Tab 3",
        on_click=on_click_1,
        disabled=st.session_state.add_tab,
        width="stretch",
    )
with col2:
    st.button(
        "Remove Tab 1",
        on_click=on_click_2,
        disabled=st.session_state.remove_1,
        width="stretch",
    )
with col3:
    st.button(
        "Remove Tab 2",
        on_click=on_click_3,
        disabled=st.session_state.remove_2,
        width="stretch",
    )
with col4:
    st.button(
        "Change Tab 1 & 3",
        on_click=on_click_4,
        disabled=st.session_state.change,
        width="stretch",
    )
    st.button(
        "Change All Tabs",
        on_click=on_click_5,
        disabled=st.session_state.change,
        width="stretch",
    )
with col5:
    st.button("**Reset Tabs**", on_click=reset)

st.subheader("Tabs Example", divider="green")


tabs = st.tabs(st.session_state.tabs)

for tabs_index, tab in enumerate(tabs):
    with tab:
        st.write(f"You are in Tab {tabs_index + 1}")
        st.slider(
            f"Slider {tabs_index + 1}",
            min_value=0,
            max_value=10,
            value=5,
            key=f"slider_tab_{tabs_index}",
        )
