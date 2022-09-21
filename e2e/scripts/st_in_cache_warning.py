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


@st.cache
def cached_write(value):
    st.write(value)


@st.cache(suppress_st_warning=True)
def cached_write_nowarn(value):
    st.write(value)


@st.cache
def cached_widget(name):
    st.button(name)


cached_write("I'm in a cached function!")
cached_widget("Wadjet!")
cached_write_nowarn("Me too!")

st.write(
    """
    If this is failing locally, it could be because you have a browser with
    Streamlit open. Close it and the test should pass.
"""
)
