# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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


def on_click_1():
    st.session_state.add_tab = True


def on_click_2():
    st.session_state.remove_1 = True


def on_click_3():
    st.session_state.remove_2 = True


def on_click_4():
    st.session_state.change = True
    on_click_1()
    on_click_2()
    on_click_3()


def on_click_5():
    on_click_4()


def reset():
    st.session_state.clear()


col1, col2, col3, col4, col5 = st.columns([0.8, 1, 1, 1.2, 1], gap="small")
with col1:
    add_tab = st.button(
        "Add Tab 3",
        on_click=on_click_1,
        disabled=st.session_state.add_tab,
        use_container_width=True,
    )
with col2:
    remove_1 = st.button(
        "Remove Tab 1",
        on_click=on_click_2,
        disabled=st.session_state.remove_1,
        use_container_width=True,
    )
with col3:
    remove_2 = st.button(
        "Remove Tab 2",
        on_click=on_click_3,
        disabled=st.session_state.remove_2,
        use_container_width=True,
    )
with col4:
    change_some = st.button(
        "Change Tab 1 & 3",
        on_click=on_click_4,
        disabled=st.session_state.change,
        use_container_width=True,
    )
    change = st.button(
        "Change All Tabs",
        on_click=on_click_5,
        disabled=st.session_state.change,
        use_container_width=True,
    )
with col5:
    st.button("**Reset Tabs**", on_click=reset)

st.subheader("Tabs Example", divider="green")

if add_tab:
    st.session_state.tabs.append("Tab 3")

if remove_1:
    index = st.session_state.tabs.index("Tab 1")
    st.session_state.tabs.pop(index)

if remove_2:
    index = st.session_state.tabs.index("Tab 2")
    st.session_state.tabs.pop(index)

if change:
    if "Tab 1" in st.session_state.tabs:
        st.session_state.tabs[st.session_state.tabs.index("Tab 1")] = "Tab A"
    if "Tab 2" in st.session_state.tabs:
        st.session_state.tabs[st.session_state.tabs.index("Tab 2")] = "Tab B"
    if "Tab 3" in st.session_state.tabs:
        st.session_state.tabs[st.session_state.tabs.index("Tab 3")] = "Tab C"

if change_some:
    if "Tab 1" in st.session_state.tabs:
        st.session_state.tabs[st.session_state.tabs.index("Tab 1")] = "Tab A"
    if "Tab 3" in st.session_state.tabs:
        st.session_state.tabs[st.session_state.tabs.index("Tab 3")] = "Tab C"


tabs = st.tabs(st.session_state.tabs)

for tabs_index, tab in enumerate(tabs):
    with tab:
        st.write(f"You are in Tab {tabs_index + 1}")
        st.slider(f"Slider {tabs_index + 1}", 0, 10, 5, key=tab)
