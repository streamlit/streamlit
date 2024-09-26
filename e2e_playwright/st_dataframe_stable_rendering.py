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

"""This test checks that the dataframe component renders without crashing
when used in different containers.

This mainly addresses this issue: https://github.com/streamlit/streamlit/issues/7949
"""

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)
df = pd.DataFrame(np.random.randn(20, 5), columns=["a", "b", "c", "d", "e"])

use_container_width = st.toggle("use_container_width", True)

with st.popover("popover"):
    st.dataframe(df, use_container_width=use_container_width)

with st.sidebar:
    st.dataframe(df, use_container_width=use_container_width)

tab1, tab2 = st.tabs(["Tab 1", "Tab 2"])

col1, col2, col3 = tab1.columns([1, 2, 3])
col1.dataframe(df, use_container_width=use_container_width, height=100)
col2.dataframe(df, use_container_width=use_container_width, height=100)
col3.dataframe(df, use_container_width=use_container_width, height=100)

tab1.dataframe(df, use_container_width=use_container_width, height=100)
tab2.dataframe(df, use_container_width=use_container_width, height=100)
