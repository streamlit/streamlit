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

import operator

import streamlit as st

st.header("Basic Breadcrumbs")
selected_basic = st.breadcrumbs(
    ["Home", "Electronics", "Phones", "iPhone 15"], key="basic"
)
st.write(f"Basic selected: {selected_basic}")

st.header("With Icons")
selected_icons = st.breadcrumbs(
    ["home", "folder", "settings"],
    format_func=lambda x: f":material/{x}: {x.title()}",
    key="icons",
)
st.write(f"Icons selected: {selected_icons}")

st.header("Disabled")
selected_disabled = st.breadcrumbs(
    ["Home", "Products", "Details"],
    disabled=True,
    key="disabled",
)
st.write(f"Disabled selected: {selected_disabled}")

st.header("Single Item")
selected_single = st.breadcrumbs(["Home"], key="single")
st.write(f"Single selected: {selected_single}")

st.header("With Help")
selected_help = st.breadcrumbs(
    ["Home", "Settings", "Profile"],
    help="Click on a breadcrumb to navigate back",
    key="help",
)
st.write(f"Help selected: {selected_help}")

st.header("Custom Objects")
pages = [
    {"id": "home", "title": "Home", "path": "home.py"},
    {"id": "users", "title": "Users", "path": "users.py"},
    {"id": "detail", "title": "User Detail", "path": "detail.py"},
]
selected_objects = st.breadcrumbs(
    pages, format_func=operator.itemgetter("title"), key="objects"
)
# For custom objects, show the currently selected item's path
st.write(f"Navigate to: {selected_objects['path']}")

st.header("Custom Text Separator")
selected_text_sep = st.breadcrumbs(
    ["Home", "Section", "Page"],
    separator=" > ",
    key="text_separator",
)
st.write(f"Text separator selected: {selected_text_sep}")

st.header("Material Icon Separator")
selected_icon_sep = st.breadcrumbs(
    ["Home", "Section", "Page"],
    separator=":material/chevron_right:",
    key="icon_separator",
)
st.write(f"Icon separator selected: {selected_icon_sep}")

st.header("Selection Parameter")
# Test explicit selection by value
selected_by_value = st.breadcrumbs(
    ["Home", "Electronics", "Phones", "iPhone 15"],
    selection="Electronics",
    key="selection_by_value",
)
st.write(f"Selection by value: {selected_by_value}")

# Test explicit selection by index
selected_by_index = st.breadcrumbs(
    ["Home", "Electronics", "Phones", "iPhone 15"],
    selection=0,
    key="selection_by_index",
)
st.write(f"Selection by index: {selected_by_index}")

st.header("Auto-truncate on Selection")
# Initialize breadcrumb path in session state
if "breadcrumb_path" not in st.session_state:
    st.session_state.breadcrumb_path = ["Home", "Electronics", "Phones", "iPhone 15"]


def on_breadcrumb_change():
    """Truncate path to selected item when changed."""
    selected = st.session_state.truncate_breadcrumbs
    if selected is not None:
        # Find index of selected item and truncate
        try:
            idx = st.session_state.breadcrumb_path.index(selected)
            st.session_state.breadcrumb_path = st.session_state.breadcrumb_path[
                : idx + 1
            ]
        except ValueError:
            pass


selected_truncate = st.breadcrumbs(
    st.session_state.breadcrumb_path,
    key="truncate_breadcrumbs",
    on_change=on_breadcrumb_change,
)
st.write(f"Truncate path: {st.session_state.breadcrumb_path}")
st.write(f"Truncate selected: {selected_truncate}")
