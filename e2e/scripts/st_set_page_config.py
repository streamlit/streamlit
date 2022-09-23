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

st.set_page_config(
    page_title="Heya, world?",
    page_icon=":shark:",
    layout="wide",
    initial_sidebar_state="collapsed",
)
st.sidebar.button("Sidebar!")
st.markdown("Main!")


def show_balloons():
    st.balloons()


st.button("Balloons", on_click=show_balloons)


def double_set_page_config():
    st.set_page_config(
        page_title="Change 1",
        page_icon=":shark:",
        layout="wide",
        initial_sidebar_state="collapsed",
    )

    st.set_page_config(
        page_title="Change 2",
        page_icon=":shark:",
        layout="wide",
        initial_sidebar_state="collapsed",
    )


st.button("Double Set Page Config", on_click=double_set_page_config)


def single_set_page_config():
    st.set_page_config(
        page_title="Change 3",
        page_icon=":shark:",
        layout="wide",
        initial_sidebar_state="collapsed",
    )


st.button("Single Set Page Config", on_click=single_set_page_config)
