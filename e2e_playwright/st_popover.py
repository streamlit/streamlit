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
df = pd.DataFrame(np.random.randn(100, 6), columns=["a", "b", "c", "d", "e", "f"])

placeholder = st.empty()
col11, col12, col13 = st.columns(3)

with st.popover(
    "Popover this is a test and another test and another one and more",
    help="Help text",
    use_container_width=True,
):
    st.write(
        "Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello Hello "
    )
    st.number_input("Number input")
    foo = st.text_input("Text input")
    col1, col2, col3 = st.columns(3)
    col1.text_area("Column 1")
    st.selectbox("Selectbox", ["a", "b", "c"])
    col2.text_input("Column 2")
    col3.text_input("Column 3")
    st.dataframe(df, use_container_width=True)
    st.dataframe(df)

placeholder.write(foo)
