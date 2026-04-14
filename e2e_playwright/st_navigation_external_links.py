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

"""Test app for st.navigation with external links."""

from typing import Literal

import streamlit as st


def home():
    st.header("Home Page")


def about():
    st.header("About Page")


position: Literal["sidebar", "top"] = st.radio("Position", ["sidebar", "top"])

pages = {
    "Internal": [
        st.Page(home, title="Home", icon="🏠"),
        st.Page(about, title="About", icon="📄"),
    ],
    "External": [
        st.Page("https://docs.streamlit.io", title="Docs", icon="📚"),
        st.Page("https://streamlit.io", title="Streamlit"),
    ],
}

st.navigation(pages, position=position).run()
