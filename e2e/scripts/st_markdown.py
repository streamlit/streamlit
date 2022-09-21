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
import numpy as np

st.markdown("This **markdown** is awesome! :sunglasses:")

st.markdown("This <b>HTML tag</b> is escaped!")

st.markdown("This <b>HTML tag</b> is not escaped!", unsafe_allow_html=True)

st.markdown("[text]")

st.markdown("[link](href)")

st.markdown("[][]")

st.markdown("Inline math with $\KaTeX$")

st.markdown(
    """
$$
ax^2 + bx + c = 0
$$
"""
)

st.markdown("# Some header 1")
st.markdown("## Some header 2")
st.markdown("### Some header 3")

st.markdown(
    """
| Col1      | Col2        |
| --------- | ----------- |
| Some      | Data        |
"""
)

with st.container():
    st.markdown("# some really long header " + " ".join(["lol"] * 10))
    np.random.seed(0)
    st.table(np.random.randn(10, 20))
