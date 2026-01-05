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

from typing import Literal

import streamlit as st


def a():
    st.header("Header A")


def b():
    st.header("Header B")


position: Literal["sidebar", "top", "hidden"] = st.radio(
    "Position", ["sidebar", "top", "hidden"]
)

st.sidebar.header("Sidebar Header")

st.navigation((a, b), position=position).run()
