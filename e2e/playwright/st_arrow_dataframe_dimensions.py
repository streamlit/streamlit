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
from tests.streamlit import snowpark_mocks

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

data = np.random.randn(100, 100)

df = pd.DataFrame(data)
st._arrow_dataframe(df)
st._arrow_dataframe(df, 250, 150)
st._arrow_dataframe(df, width=250)
st._arrow_dataframe(df, height=150)
st._arrow_dataframe(df, 5000, 5000)
st._arrow_dataframe(df, use_container_width=True)

small_df = pd.DataFrame(np.random.randn(100, 3))
st._arrow_dataframe(small_df, width=500)
st._arrow_dataframe(small_df, use_container_width=True)
st._arrow_dataframe(small_df, width=200, use_container_width=True)
st._arrow_dataframe(small_df, width=200, use_container_width=False)

one_col_df = pd.DataFrame(np.random.randn(100, 1))
st._arrow_dataframe(one_col_df, use_container_width=True)

st._arrow_dataframe(snowpark_mocks.DataFrame(), use_container_width=True)
