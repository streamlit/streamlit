# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

st.write(f"Streamlit version = {st.__version__}")

df1 = pd.DataFrame(
    np.random.randn(10, 2) / [50, 50] + [37.76, -122.4], columns=["lat", "lon"]
)

df2 = pd.DataFrame(
    np.random.randn(10, 2) / [50, 50] + [-37.76, 122.4], columns=["lat", "lon"]
)

option = st.selectbox("which dataframe to use?", ("1", "2"))

st.write("You selected:", option)

df = df1 if option == "1" else df2

st.map(df)
st.write(df)

st.write("df1")
st.map(df1)

st.write("2")
st.map(df2)
