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

import random
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

st.header("Pandas Styler: value formatting")
df = pd.DataFrame({"test": [3.1423424, 3.1]})
st.experimental_data_grid(df.style.format({"test": "{:.2f}"}))

st.header("Pandas Styler: Background and font styling")

df = pd.DataFrame(np.random.randn(20, 4), columns=["A", "B", "C", "D"])


def style_negative(v, props=""):
    return props if v < 0 else None


def highlight_max(s, props=""):
    return np.where(s == np.nanmax(s.values), props, "")


styled_df = df.style.applymap(style_negative, props="color:red;").applymap(
    lambda v: "opacity: 20%;" if (v < 0.3) and (v > -0.3) else None
)

styled_df.apply(highlight_max, props="color:white;background-color:darkblue", axis=0)

styled_df.apply(
    highlight_max, props="color:white;background-color:pink;", axis=1
).apply(highlight_max, props="color:white;background-color:purple", axis=None)

st.experimental_data_grid(styled_df)

st.header("Pandas Styler: Gradient Styling")

weather_df = pd.DataFrame(
    np.random.rand(10, 2) * 5,
    index=pd.date_range(start="2021-01-01", periods=10),
    columns=["Tokyo", "Beijing"],
)


def rain_condition(v):
    if v < 1.75:
        return "Dry"
    elif v < 2.75:
        return "Rain"
    return "Heavy Rain"


def make_pretty(styler):
    styler.set_caption("Weather Conditions")
    styler.format(rain_condition)
    # styler.format_index(lambda v: v.strftime("%A"))
    styler.background_gradient(axis=None, vmin=1, vmax=5, cmap="YlGnBu")
    return styler


styled_df = weather_df.style.pipe(make_pretty)

st.experimental_data_grid(styled_df)
