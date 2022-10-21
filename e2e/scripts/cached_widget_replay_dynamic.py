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
"""
A script with cached widget replay, where the set of widgets called by the function
depend on the values of the widgets.
"""

import streamlit as st

irrelevant_value = 0
if st.button("click to rerun"):
    irrelevant_value = 1


@st.experimental_memo(experimental_allow_widgets=True)
def cached(irrelevant):
    options = ["foo", "bar", "baz"]
    if st.checkbox("custom filters"):
        selected = st.multiselect("filters", options)
    else:
        selected = ["foo"]
    return selected


st.text(cached(irrelevant_value))
