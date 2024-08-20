# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import os

import streamlit as st

# Construct test assets path relative to this script file to
# allow its execution with different working directories.
TEST_ASSETS_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "test_assets"
)

st.sidebar.button("Sidebar!")
st.markdown("Main!")


def preceding_command_in_callback():
    st.balloons()
    st.set_page_config(page_title="Allows preceding command in callback")


st.button("Preceding Command in Callback", on_click=preceding_command_in_callback)


def collapsed_sidebar():
    st.set_page_config(
        page_title="Collapsed Sidebar", initial_sidebar_state="collapsed"
    )


st.button("Collapsed Sidebar", on_click=collapsed_sidebar)


def expanded_sidebar():
    st.set_page_config(page_title="Expanded Sidebar", initial_sidebar_state="expanded")


st.button("Expanded Sidebar", on_click=expanded_sidebar)


def wide_layout():
    st.set_page_config(page_title="Wide Layout", layout="wide")


st.button("Wide Layout", on_click=wide_layout)


def centered_layout():
    st.set_page_config(page_title="Centered Layout", layout="centered")


st.button("Centered Layout", on_click=centered_layout)


def double_set_page_config():
    st.set_page_config(page_title="Page Config 1")
    st.set_page_config(page_title="Page Config 2")


st.button("Double Set Page Config", on_click=double_set_page_config)


def page_config_with_emoji_shortcode():
    st.set_page_config(
        page_title="With Emoji Shortcode",
        page_icon=":shark:",
    )


st.button("Page Config With Emoji Shortcode", on_click=page_config_with_emoji_shortcode)


def page_config_with_emoji_symbol():
    st.set_page_config(
        page_title="With Emoji Symbol",
        page_icon="🐙",
    )


st.button("Page Config With Emoji Symbol", on_click=page_config_with_emoji_symbol)


def page_config_with_local_icon():
    ICON_PATH = os.path.join(TEST_ASSETS_DIR, "favicon.ico")

    st.set_page_config(
        page_title="With Local Icon",
        page_icon=ICON_PATH,
    )


st.button("Page Config With Local Icon", on_click=page_config_with_local_icon)


def page_config_with_material_icon():
    st.set_page_config(
        page_title="With Material Icon",
        page_icon=":material/thumb_up:",
    )


st.button("Page Config With Material Icon", on_click=page_config_with_material_icon)

# The menu_items parameter is covered by the `main_menu.py` script
# initial_sidebar_state = auto is covered by the `st_sidebar.py` script
