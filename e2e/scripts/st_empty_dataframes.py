# Copyright 2018-2020 Streamlit Inc.
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
st.dataframe()
st.dataframe([])
st.dataframe(np.array(0))
st.dataframe(pd.DataFrame([]))

st.header("Empty one-column dataframes")
st.write(np.array([]))
st.dataframe(np.array([]))

st.header("Empty two-column dataframes (only shows 1)")
st.write(pd.DataFrame({"lat": [], "lon": []}))
st.dataframe(pd.DataFrame({"lat": [], "lon": []}))

st.header("Empty tables")
st.table()
st.table([])
st.table(np.array(0))
st.table(pd.DataFrame([]))

st.header("Empty one-column table")
st.table(np.array([]))

st.header("Empty two-column table")
st.table(pd.DataFrame({"lat": [], "lon": []}))
