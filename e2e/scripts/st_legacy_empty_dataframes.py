# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
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
st.legacy_dataframe()
st.legacy_dataframe([])
st.legacy_dataframe(np.array(0))
st.legacy_dataframe(pd.DataFrame([]))

st.header("Empty one-column dataframes")
st.write(np.array([]))
st.legacy_dataframe(np.array([]))

st.header("Empty two-column dataframes (only shows 1)")
st.write(pd.DataFrame({"lat": [], "lon": []}))
st.legacy_dataframe(pd.DataFrame({"lat": [], "lon": []}))

st.header("Empty tables")
st.table()
st.legacy_table([])
st.legacy_table(np.array(0))
st.legacy_table(pd.DataFrame([]))

st.header("Empty one-column table")
st.legacy_table(np.array([]))

st.header("Empty two-column table")
st.legacy_table(pd.DataFrame({"lat": [], "lon": []}))
