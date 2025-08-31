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


import pandas as pd

import streamlit as st


def run_theme_tester_app():
    st.set_page_config(initial_sidebar_state="expanded", layout="wide")

    st.header("Custom Themed :primary[App]")

    def page1():
        pass

    def page2():
        pass

    st.navigation(
        [
            st.Page(page1, title="Page 1", icon=":material/home:"),
            st.Page(page2, title="Page 2", icon=":material/settings:"),
        ]
    )

    @st.dialog("My Dialog")
    def my_dialog():
        st.write("Hello World")

    col1, col2, col3 = st.columns(3)

    with col1:
        if st.button("Open Dialog", use_container_width=True):
            my_dialog()
        st.segmented_control(
            "Segmented Control",
            options=["Option 1", "Option 2"],
            default="Option 1",
            label_visibility="collapsed",
        )
        st.button("Primary Button", type="primary")
        st.divider()
        st.code("# st.code\na = 1234")
        st.chat_input("Chat Input")
        st.multiselect(
            "Multiselect",
            options=["Option 1", "Option 2", "Option 3"],
            default=["Option 1"],
            label_visibility="collapsed",
        )
    with col2:
        with st.expander("Expander", expanded=True):
            st.text_area(
                "Text Area",
                placeholder="Placeholder",
                height=68,
                label_visibility="collapsed",
            )
            checkbox_col, toggle_col = st.columns(2)
            with checkbox_col:
                st.checkbox("Check", value=True)
            with toggle_col:
                st.toggle("Toggle", value=True)
            st.radio(
                "Radio",
                options=["Option 1", "Option 2"],
                index=0,
                horizontal=True,
                label_visibility="collapsed",
            )
            st.number_input(
                "Number Input",
                min_value=0,
                max_value=100,
                value=50,
                label_visibility="collapsed",
            )
            st.slider(
                "Slider",
                min_value=0,
                max_value=100,
                value=50,
                label_visibility="collapsed",
            )

    with col3:
        tab1, _, _ = st.tabs(["Tab 1", "Tab 2", "Tab 3"])
        with tab1:
            st.caption("Dataframe :primary[&] Table:")
            st.progress(0.6, "Processing data...")
            st.dataframe(
                pd.DataFrame({"A": [1, 2], "B": ["streamlit.io", "snowflake.com"]}),
                column_config={"B": st.column_config.LinkColumn()},
                use_container_width=True,
            )
            st.table(
                pd.DataFrame(
                    {
                        "A": [1, 2],
                        "B": [
                            "[streamlit](streamlit.io)",
                            "[snowflake](snowflake.com)",
                        ],
                    }
                )
            )

    with st.sidebar:
        st.markdown(
            "## Welcome\n"
            ":rainbow-background[:rainbow[Hello World]] :material/waving_hand: **This** "
            "`is` [Streamlit](https://streamlit.io).",
            help="Tooltip",
        )
        st.success("Wohooo!")
        st.divider()
        st.text_input(
            "Text Input in Sidebar", value="Some Text", help="Tooltip", max_chars=10
        )
        st.file_uploader("File :primary[Uploader]", type=["png", "gif"])
