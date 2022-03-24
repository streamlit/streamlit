# Copyright 2018-2022 Streamlit Inc.
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

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

st.header("Test datetime handling:")
df = pd.DataFrame({"str": ["2020-04-14 00:00:00"]})
df["notz"] = pd.to_datetime(df["str"])
df["yaytz"] = pd.to_datetime(df["str"]).dt.tz_localize("Europe/Moscow")
st.experimental_data_grid(df)

st.header("Test value formatting via Pandas Styler:")
df = pd.DataFrame({"test": [3.14, 3.1]})
st.experimental_data_grid(df.style.format({"test": "{:.2f}"}))

st.header("Empty dataframes")
st.experimental_data_grid(pd.DataFrame([]))
st.experimental_data_grid(np.array(0))
st.experimental_data_grid()
st.experimental_data_grid([])

st.header("Empty one-column dataframes")
st.experimental_data_grid(np.array([]))

st.header("Empty two-column dataframes")
st.experimental_data_grid(pd.DataFrame({"lat": [], "lon": []}))

st.header("Custom index: dates")
df = pd.DataFrame(
    np.random.randn(8, 4),
    index=pd.date_range("1/1/2000", periods=8),
    columns=["A", "B", "C", "D"],
)
st.experimental_data_grid(df)

st.header("Custom index: strings")
df = pd.DataFrame(np.random.randn(6, 4), index=list("abcdef"), columns=list("ABCD"))
st.experimental_data_grid(df)

st.header("Multi Index")
df = pd.DataFrame(
    np.random.randn(8, 4),
    index=[
        np.array(["bar", "bar", "baz", "baz", "foo", "foo", "qux", "qux"]),
        np.array(["one", "two", "one", "two", "one", "two", "one", "two"]),
    ],
)
st.experimental_data_grid(df)

st.header("Index in Place")
df = pd.DataFrame(np.random.randn(6, 4), columns=list("ABCD"))
df.set_index("C", inplace=True)
st.experimental_data_grid(df)
