# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

sidebar = st.sidebar.expander("Sidebar collapsed")
sidebar.write("I am in the sidebar")

expander = st.expander("Normal expanded", expanded=True)
expander.write("I can collapse")
expander.slider("I don't get cut off")
expander.button("I'm also not cut off (while focused)")

collapsed = st.expander("Normal collapsed")
collapsed.write("I am already collapsed")

with st.expander("With number input", expanded=True):
    # We deliberately use a list to implement this for the screenshot
    st.write("* Example list item")
    value = st.number_input("number", value=1.0, key="number")


def update_value():
    st.session_state.number = 0


update_button = st.button("Update Num Input", on_click=update_value)

st.text(st.session_state.get("number"))

if st.button("Print State Value"):
    st.text(st.session_state.get("number"))

expander_long = st.expander(
    "Long expanded: "
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum arcu nisl, tincidunt id "
    "orci id, condimentum cursus nunc. Nullam sed sodales ipsum, vel tincidunt dui. Etiam diam "
    "dolor, eleifend sit amet purus id, dictum aliquam quam.",
    expanded=True,
)
expander_long.write(
    "Integer et justo orci. In euismod posuere nulla ac maximus. Mauris tristique hendrerit "
    "placerat. Integer eu imperdiet ipsum. Praesent maximus pharetra est, ut ultrices ante "
    "molestie id. Nulla sollicitudin arcu orci, eget lobortis lacus ultricies eu. Ut suscipit est "
    "eget tellus laoreet faucibus. Nullam nec blandit felis. Nulla ullamcorper, justo eget "
    "consequat ultricies, nisi dolor lacinia mauris, eu lacinia ante nisi sit amet tortor."
)

collapsed_long = st.expander(
    "Long collapsed: "
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum arcu nisl, tincidunt id "
    "orci id, condimentum cursus nunc. Nullam sed sodales ipsum, vel tincidunt dui. Etiam diam "
    "dolor, eleifend sit amet purus id, dictum aliquam quam."
)
collapsed_long.write("I am already collapsed")

expander_material_icon = st.expander("Material icon", icon=":material/bolt:").write(
    "This is an expander with a material icon."
)

expander_emoji_icon = st.expander("Emoji icon", icon="🎈").write(
    "This is an expander with an emoji icon."
)

st.expander(
    "Markdown -> :material/check: :rainbow[Fancy] _**markdown** `label` _support_"
).write("Content")


level1 = st.expander("Nested", expanded=True)
level1.write("First level expander")

level2 = level1.expander("Inner expander")
level2.write("Second level expander")

with st.expander("Fixed width", width=200):
    st.write("Hello")

with st.expander("Stretch width", width="stretch"):
    st.write("Hello")

st.expander("Empty", expanded=True)
