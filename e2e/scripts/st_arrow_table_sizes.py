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
import pandas as pd

import streamlit as st

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

st.title("Tables with different sizes")

st.header("Long cells that overflow")

st.write(
    """
    Long text should show an ellipsis. All cells should have a tooltip
    with their entire un-ellipsized contents.
    """
)

ROWS = 2

st.header("Using st._arrow_table")

for cols in [4, 5, 6, 20]:
    df = pd.DataFrame(
        np.random.randn(ROWS, cols), index=range(ROWS), columns=range(cols)
    )
    st._arrow_table(df)

st.header("Overriding st._arrow_table")

for cols in [4, 5, 6, 20]:
    df = pd.DataFrame(
        np.random.randn(ROWS, cols), index=range(ROWS), columns=range(cols)
    )
    df_elt = st._arrow_table(np.random.randn(200, 200))
    df_elt._arrow_table(df)
