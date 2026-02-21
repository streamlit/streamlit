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
clicked_basic = st.breadcrumbs(
    ["Home", "Electronics", "Phones", "iPhone 15"], key="basic"
)
st.write(f"Basic clicked: {clicked_basic}")

st.header("With Icons")
clicked_icons = st.breadcrumbs(
    ["home", "folder", "settings"],
    format_func=lambda x: f":material/{x}: {x.title()}",
    key="icons",
)
st.write(f"Icons clicked: {clicked_icons}")

st.header("Disabled")
clicked_disabled = st.breadcrumbs(
    ["Home", "Products", "Details"],
    disabled=True,
    key="disabled",
)
st.write(f"Disabled clicked: {clicked_disabled}")

st.header("Single Item")
clicked_single = st.breadcrumbs(["Home"], key="single")
st.write(f"Single clicked: {clicked_single}")

st.header("With Help")
clicked_help = st.breadcrumbs(
    ["Home", "Settings", "Profile"],
    help="Click on a breadcrumb to navigate back",
    key="help",
)
st.write(f"Help clicked: {clicked_help}")

st.header("Custom Objects")
pages = [
    {"id": "home", "title": "Home", "path": "home.py"},
    {"id": "users", "title": "Users", "path": "users.py"},
    {"id": "detail", "title": "User Detail", "path": "detail.py"},
]
clicked_objects = st.breadcrumbs(
    pages, format_func=operator.itemgetter("title"), key="objects"
)
if clicked_objects:
    st.write(f"Navigate to: {clicked_objects['path']}")
else:
    st.write("Objects clicked: None")

st.header("Custom Text Separator")
clicked_text_sep = st.breadcrumbs(
    ["Home", "Section", "Page"],
    separator=" > ",
    key="text_separator",
)
st.write(f"Text separator clicked: {clicked_text_sep}")

st.header("Material Icon Separator")
clicked_icon_sep = st.breadcrumbs(
    ["Home", "Section", "Page"],
    separator=":material/chevron_right:",
    key="icon_separator",
)
st.write(f"Icon separator clicked: {clicked_icon_sep}")
