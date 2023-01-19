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

import numpy as np

import streamlit as st

st.set_page_config(layout="wide", initial_sidebar_state="collapsed")

"""
# Example 3
https://discuss.streamlit.io/t/support-for-nested-columns/28810

This is a super complex layout. It requires 2 levels of nesting and I even left out
a few details of the original request. We shouldn't support this!

---
"""
np.random.seed(0)
left_banner, main_area = st.columns([0.05, 0.95])
with left_banner:
    for emoji in ["⚒️", "❌", "♻️", "🗑️", "🔌"]:
        st.write(emoji)
with main_area:
    st.info("Some banner at the top of the page", icon="📣")
    col1, col2, col3 = st.columns([3, 3, 1], gap="medium")
    with col1:
        st.line_chart(np.random.rand(10))
        subcol1, subcol2 = st.columns([1, 5])
        subcol1.write(
            "Lorem Ipsum is simply dummy text of the printing and typesetting industry. "
        )
        subcol2.dataframe(np.random.rand(10, 10), use_container_width=True, height=150)
        subcol2.dataframe(np.random.rand(10, 10), use_container_width=True, height=150)

    with col2:
        st.bar_chart(np.random.rand(10))
        st.dataframe(np.random.rand(10, 10), use_container_width=True, height=250)
        st.write(
            "Lorem Ipsum is simply dummy text of the printing and typesetting industry. "
        )
        st.write("Lorem Ipsum is simply dummy text. ")

    with col3:
        for _ in range(5):
            st.image(
                "https://static.streamlit.io/examples/dice.jpg",
                use_column_width=True,
            )
