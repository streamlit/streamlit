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


import numpy as np
import pandas as pd

import streamlit as st

# Create random dataframe:
np.random.seed(0)
df = pd.DataFrame(np.random.randn(50, 5), columns=["a", "b", "c", "d", "e"])

st.popover("popover 1 (empty)")

with st.popover("popover 2 (use_container_width)", use_container_width=True):
    st.markdown("Hello")

with st.popover(
    "popover 3 (with widgets)",
):
    st.markdown("Hello World 👋")
    text = st.text_input("Text input")
    col1, col2, col3 = st.columns(3)
    col1.text_input("Column 1")
    col2.text_input("Column 2")
    col3.text_input("Column 3")
    st.selectbox("Selectbox", ["a", "b", "c"])

with st.popover("popover 4 (with dataframe)", help="help text"):
    st.markdown("Popover with dataframe")
    st.dataframe(df, use_container_width=False)
    st.image(np.repeat(0, 100).reshape(10, 10))

with st.sidebar.popover("popover 5 (in sidebar)"):
    st.markdown("Popover in sidebar with dataframe")
    st.dataframe(df, use_container_width=True)

with st.popover("popover 6 (disabled)", disabled=True):
    st.markdown("Hello World 👋")

with st.popover("popover 7 (emoji)", icon="🦄"):
    st.markdown("Hello unicorn")

with st.popover("popover 8 (material icon)", icon=":material/thumb_up:"):
    st.markdown("Hello thumb up")

with st.expander("Output"):
    st.markdown(text)
