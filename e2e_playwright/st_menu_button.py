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
from streamlit import runtime

# st.session_state can only be used in streamlit
if runtime.exists():

    def on_click(x: int, y: int) -> None:
        if "click_count" not in st.session_state:
            st.session_state.click_count = 0

        st.session_state.click_count += 1
        st.session_state.x = x
        st.session_state.y = y

    selected = st.menu_button(
        "Actions",
        options=["Edit", "Delete", "Copy"],
        key="menu_button",
        on_click=on_click,
        args=(1,),
        kwargs={"y": 2},
    )
    st.write("value:", selected)

    button_was_clicked = "click_count" in st.session_state
    st.write("Button was clicked:", button_was_clicked)

    if button_was_clicked:
        st.write("times clicked:", st.session_state.click_count)
        st.write("arg value:", st.session_state.x)
        st.write("kwarg value:", st.session_state.y)

# Checkbox to trigger a rerun without clicking the menu button
st.checkbox("trigger rerun", key="trigger_rerun")

# Different button types
st.menu_button(
    "Secondary Button",
    options=["Option A", "Option B"],
    type="secondary",
    key="secondary_button",
)

st.menu_button(
    "Primary Button",
    options=["Option A", "Option B"],
    type="primary",
    key="primary_button",
)

st.menu_button(
    "Tertiary Button",
    options=["Option A", "Option B"],
    type="tertiary",
    key="tertiary_button",
)

# Disabled state
st.menu_button(
    "Disabled Button",
    options=["Option A", "Option B"],
    disabled=True,
    key="disabled_button",
)

# With icons
st.menu_button(
    "With Material Icon",
    options=["Download", "Share", "Print"],
    icon=":material/more_vert:",
    key="material_icon_button",
)

# With help tooltip
with st.container(key="help_button_container"):
    st.menu_button(
        "Button with Help",
        options=["Help Option 1", "Help Option 2"],
        help="This is helpful text",
        key="help_button",
    )

# Width variations
with st.container(key="stretch_width_container"):
    st.menu_button(
        "Stretch Width",
        options=["Short", "Medium", "Long option"],
        width="stretch",
        key="stretch_width",
    )
st.menu_button(
    "200px Width",
    options=["Short", "Medium", "Long option"],
    width=200,
    key="fixed_width",
)

# format_func example
options = [
    {"id": 1, "name": "First Option"},
    {"id": 2, "name": "Second Option"},
    {"id": 3, "name": "Third Option"},
]
format_selected = st.menu_button(
    "With Format Func",
    options=options,
    format_func=lambda x: f"ID {x['id']}: {x['name']}",
    key="format_func_button",
)
if format_selected:
    st.write("format_func selected id:", format_selected["id"])

# In columns
with st.container(key="columns_container"):
    col1, col2 = st.columns(2)
    with col1:
        st.menu_button(
            "Column 1 Menu",
            options=["Col1 A", "Col1 B"],
            width="stretch",
            key="col1_menu",
        )
    with col2:
        st.menu_button(
            "Column 2 Menu",
            options=["Col2 A", "Col2 B"],
            key="col2_menu",
        )

# In sidebar
st.sidebar.menu_button(
    "Sidebar Menu",
    options=["Sidebar A", "Sidebar B", "Sidebar C"],
    key="sidebar_menu",
)

# Options with markdown (material icons)
markdown_selected = st.menu_button(
    "Markdown Options",
    options=[
        ":material/edit: Edit",
        ":material/delete: Delete",
        ":material/content_copy: Copy",
        ":material/share: Share",
    ],
    key="markdown_options_button",
)
if markdown_selected:
    st.write("markdown_selected:", markdown_selected)

# Short options (to test menu width adaptation)
st.menu_button(
    "Short",
    options=["A", "B", "C"],
    key="short_options_button",
)


# Fragment test
@st.fragment
def test_fragment():
    selection = st.menu_button(
        "Fragment Menu",
        options=["Fragment A", "Fragment B", "Fragment C"],
        key="fragment_menu_button",
    )
    st.write("menu_button-in-fragment selection:", str(selection))


test_fragment()
