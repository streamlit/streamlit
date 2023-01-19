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

"""
# Example 2
https://discuss.streamlit.io/t/column-layout/28937

---
"""

LOREM_IPSUM = "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. "

col1, col2 = st.columns(2, gap="large")
with col1:
    subcol1, subcol2 = st.columns(2, gap="medium")
    subcol1.write(LOREM_IPSUM)
    subcol2.write(LOREM_IPSUM)
    st.write("")
    st.write(LOREM_IPSUM)

with col2:
    subcol1, subcol2 = st.columns(2, gap="medium")
    subcol1.write(LOREM_IPSUM)
    subcol2.write(LOREM_IPSUM)

    st.write("")
    subcol1, subcol2 = st.columns(2, gap="medium")
    subcol1.write(LOREM_IPSUM)
    subcol2.write(LOREM_IPSUM)
