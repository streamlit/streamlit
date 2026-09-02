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

import pandas as pd

import streamlit as st

_CHART_COLORS = [
    "#7c3aed",
    "#0ea5e9",
    "#f59e0b",
    "#ef4444",
    "#22c55e",
    "#ec4899",
    "#64748b",
]


def page_overrides() -> None:
    overlay = st.segmented_control(
        "Page overlay",
        options=["Keep", "Purple", "Clear"],
        key="page_overlay",
    )
    if overlay == "Purple":
        st.set_page_config(
            theme={
                "primary_color": "#7C3AED",
                "background_color": "#FAFAFF",
                "text_color": "#1F1733",
            }
        )
    elif overlay == "Clear":
        st.set_page_config(theme={})

    st.button("Page primary", type="primary", key="page_primary")
    st.sidebar.button("Sidebar primary", type="primary", key="sidebar_primary")

    with st.container(
        theme={
            "light": {"primary_color": "#0969da"},
            "dark": {"primary_color": "#58a6ff"},
        },
        key="inherited_base",
    ):
        st.button("Inherited primary", type="primary", key="inherited_primary")

    with st.container(horizontal=True, key="scoped_row"):
        with st.container(theme={"primary_color": "green"}, key="green_scope"):
            st.button("Green", type="primary", key="green_btn")
        with st.container(theme={"primary_color": "red"}, key="red_scope"):
            st.button("Red", type="primary", key="red_btn")
        st.button("Sibling", type="primary", key="sibling_btn")

    with st.container(
        theme={
            "primary_color": "#7C3AED",
            "chart_categorical_colors": _CHART_COLORS,
        },
        key="popover_chart_scope",
    ):
        with st.popover("Themed popover"):
            st.selectbox("Flavor", ["vanilla", "chocolate", "strawberry"])
        st.bar_chart(pd.DataFrame({"a": [1, 2, 3], "b": [3, 2, 1]}))

    with st.container(
        theme={"primary_color": "green", "text_color": "purple"},
        key="explicit_base_outer",
    ):
        st.write("Outer copy")
        with st.container(theme={"base": "dark"}, key="explicit_base_inner"):
            st.write("Inner copy")
            st.button("Inner dark-base", type="primary", key="explicit_base_btn")

    with st.container(key="keyed_state_value"):
        st.write(f"retained: {st.session_state.get('retained_input', '')}")

    use_green = st.toggle("Green scoped theme", key="toggle_theme")
    with st.container(
        theme={"primary_color": "green" if use_green else "red"},
        key="keyed_scope",
    ):
        st.text_input("Retained name", key="retained_input")


def page_green() -> None:
    st.set_page_config(
        theme={
            "primary_color": "green",
            "background_color": "#e8f5e9",
            "text_color": "#1b5e20",
        }
    )
    st.write("Green page")
    st.button("Green page primary", type="primary", key="green_page_btn")


def page_red() -> None:
    st.set_page_config(
        theme={
            "primary_color": "red",
            "background_color": "#ffebee",
            "text_color": "#b71c1c",
        }
    )
    st.write("Red page")
    st.button("Red page primary", type="primary", key="red_page_btn")


def page_clear() -> None:
    st.set_page_config(theme={})
    st.write("Cleared page")
    st.button("Cleared page primary", type="primary", key="clear_page_btn")


pg = st.navigation(
    [
        st.Page(page_overrides, title="Overrides", default=True),
        st.Page(page_green, title="Green", url_path="green"),
        st.Page(page_red, title="Red", url_path="red"),
        st.Page(page_clear, title="Clear", url_path="clear"),
    ]
)
pg.run()
