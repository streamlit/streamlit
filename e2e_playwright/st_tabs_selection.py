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


# Apply tab mutations inside on_click callbacks, not from button return
# values. Each button disables itself (disabled=st.session_state.add_tab),
# so its trigger value is discarded on the run it becomes disabled.
# Callbacks fire before re-registration — the reliable place to mutate.
def _append_tab(label: str) -> None:
    if label not in st.session_state.tabs:
        st.session_state.tabs.append(label)


def _remove_tab(label: str) -> None:
    if label in st.session_state.tabs:
        st.session_state.tabs.pop(st.session_state.tabs.index(label))


def _rename_tab(old_label: str, new_label: str) -> None:
    if old_label in st.session_state.tabs:
        st.session_state.tabs[st.session_state.tabs.index(old_label)] = new_label


def _on_add_tab_3_click():
    st.session_state.add_tab = True
    _append_tab("Tab 3")


def _on_remove_tab_1_click():
    st.session_state.remove_1 = True
    _remove_tab("Tab 1")


def _on_remove_tab_2_click():
    st.session_state.remove_2 = True
    _remove_tab("Tab 2")


def _on_change_tabs_1_and_3_click():
    st.session_state.change = True
    st.session_state.add_tab = True
    st.session_state.remove_1 = True
    st.session_state.remove_2 = True
    _rename_tab("Tab 1", "Tab A")
    _rename_tab("Tab 3", "Tab C")


def _on_change_all_tabs_click():
    st.session_state.change = True
    st.session_state.add_tab = True
    st.session_state.remove_1 = True
    st.session_state.remove_2 = True
    _rename_tab("Tab 1", "Tab A")
    _rename_tab("Tab 2", "Tab B")
    _rename_tab("Tab 3", "Tab C")


def _on_reset_click():
    st.session_state.clear()


col1, col2, col3, col4, col5 = st.columns([0.8, 1, 1, 1.2, 1], gap="small")
with col1:
    st.button(
        "Add Tab 3",
        on_click=_on_add_tab_3_click,
        disabled=st.session_state.add_tab,
        width="stretch",
    )
with col2:
    st.button(
        "Remove Tab 1",
        on_click=_on_remove_tab_1_click,
        disabled=st.session_state.remove_1,
        width="stretch",
    )
with col3:
    st.button(
        "Remove Tab 2",
        on_click=_on_remove_tab_2_click,
        disabled=st.session_state.remove_2,
        width="stretch",
    )
with col4:
    st.button(
        "Change Tab 1 & 3",
        on_click=_on_change_tabs_1_and_3_click,
        disabled=st.session_state.change,
        width="stretch",
    )
    st.button(
        "Change All Tabs",
        on_click=_on_change_all_tabs_click,
        disabled=st.session_state.change,
        width="stretch",
    )
with col5:
    st.button("**Reset Tabs**", on_click=_on_reset_click)

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
