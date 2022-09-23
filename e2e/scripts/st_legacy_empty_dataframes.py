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
import pandas as pd
import numpy as np

st.header("Empty list")
st.write([])

st.header("Empty dataframes")
st.write(np.array(0))
st.write(pd.DataFrame([]))
st._legacy_dataframe()
st._legacy_dataframe([])
st._legacy_dataframe(np.array(0))
st._legacy_dataframe(pd.DataFrame([]))

st.header("Empty one-column dataframes")
st.write(np.array([]))
st._legacy_dataframe(np.array([]))

st.header("Empty two-column dataframes (only shows 1)")
st.write(pd.DataFrame({"lat": [], "lon": []}))
st._legacy_dataframe(pd.DataFrame({"lat": [], "lon": []}))

st.header("Empty tables")
st._legacy_table()
st._legacy_table([])
st._legacy_table(np.array(0))
st._legacy_table(pd.DataFrame([]))

st.header("Empty one-column table")
st._legacy_table(np.array([]))

st.header("Empty two-column table")
st._legacy_table(pd.DataFrame({"lat": [], "lon": []}))
