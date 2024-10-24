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

import streamlit as st


@st.fragment(run_every="0.25s")
def rerun():
    count = 0
    for i in range(100):
        count += i


def a():
    st.header("Page A: default")


def b():
    st.set_page_config(layout="wide")
    st.header("Page B: wide")


def c():
    st.set_page_config(layout="centered")
    st.header("Page C: centered")


def d():
    st.header("Page D: dynamic")
    st.button("wide button", on_click=lambda: st.set_page_config(layout="wide"))
    st.button("centered button", on_click=lambda: st.set_page_config(layout="centered"))


def e():
    st.header("Page E: fragment")
    st.button("wide button", on_click=lambda: st.set_page_config(layout="wide"))
    st.button("centered button", on_click=lambda: st.set_page_config(layout="centered"))
    rerun()


st.navigation(
    [
        st.Page(a, title="Page A: default"),
        st.Page(b, title="Page B: wide"),
        st.Page(c, title="Page C: centered"),
        st.Page(d, title="Page D: dynamic"),
        st.Page(e, title="Page E: fragment"),
    ]
).run()
