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

from uuid import uuid4

import streamlit as st

if "counter" not in st.session_state:
    st.session_state.counter = 0

c = st.empty()


@st.fragment
def outer_fragment():
    with st.container(border=True):
        st.session_state.counter += 1
        st.write(f"outer fragment: {uuid4()}")
        st.button("rerun outer fragment")
        inner_fragment()


@st.fragment
def inner_fragment():
    with st.container(border=True):
        st.write(f"inner fragment: {uuid4()}")
        st.button("rerun inner fragment")

        if 5 < st.session_state.counter < 10:
            st.write("FOO!")
            c.write("BAR!")


st.write(f"outside all fragments: {uuid4()}")
st.button("rerun whole app")
outer_fragment()
