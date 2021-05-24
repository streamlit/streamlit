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


"## UnicodeIndex"
df1 = pd.DataFrame(
    [["foo", 1], ["bar", 2]],
    index=["i1", "i2"],
)
df2 = pd.DataFrame(
    [["baz", 3], ["qux", 4]],
    index=["i3", "i4"],
)

a = st.beta_table(df1)
a.beta_add_rows(df2)


"## RangeIndex"
df1 = pd.DataFrame(
    [["foo", 1], ["bar", 2]],
)
df2 = pd.DataFrame(
    [["baz", 3], ["qux", 4]],
)

a = st.beta_table(df1)
a.beta_add_rows(df2)


"## CategoricalIndex"
df1 = pd.DataFrame(
    [["foo", 1], ["bar", 2]],
    index=pd.CategoricalIndex([1, 2]),
)
df2 = pd.DataFrame(
    [["baz", 3], ["qux", 4]],
    index=pd.CategoricalIndex([3, 4]),
)

a = st.beta_table(df1)
a.beta_add_rows(df2)

"## MultiIndex"
arrays1 = [[1, 2], ["red", "blue"]]
df1 = pd.DataFrame(
    [["foo", 1], ["bar", 2]],
    index=pd.MultiIndex.from_arrays(arrays1, names=("number", "color")),
)
arrays2 = [[3, 4], ["yellow", "green"]]
df2 = pd.DataFrame(
    [["baz", 3], ["qux", 4]],
    index=pd.MultiIndex.from_arrays(arrays2, names=("number", "color")),
)

a = st.beta_table(df1)
a.beta_add_rows(df2)


"## IntervalIndex"
df1 = pd.DataFrame(
    [["foo", 1], ["bar", 2]],
    index=pd.interval_range(start=0, end=2),
)
df2 = pd.DataFrame(
    [["baz", 3], ["qux", 4]],
    index=pd.interval_range(start=2, end=4),
)

a = st.beta_table(df1)
a.beta_add_rows(df2)


"## DatetimeIndex"
df1 = pd.DataFrame(
    [["foo", 1], ["bar", 2]],
    index=pd.Series(pd.date_range("2000-01-01", periods=2, freq="Y")),
)
df2 = pd.DataFrame(
    [["baz", 3], ["qux", 4]],
    index=pd.Series(pd.date_range("2000-01-01", periods=2, freq="Y")),
)

a = st.beta_table(df1)
a.beta_add_rows(df2)


"## PeriodIndex"
df1 = pd.DataFrame(
    [["foo", 1], ["bar", 2]],
    index=pd.PeriodIndex(year=[2000, 2002], quarter=[1, 3]),
)
df2 = pd.DataFrame(
    [["baz", 3], ["qux", 4]],
    index=pd.PeriodIndex(year=[2000, 2002], quarter=[1, 3]),
)

a = st.beta_table(df1)
a.beta_add_rows(df2)

"## Int64Index"
df1 = pd.DataFrame(
    [["foo", 1], ["bar", 2]],
    index=[1, 2],
)
df2 = pd.DataFrame(
    [["baz", 3], ["qux", 4]],
    index=[3, 4],
)

a = st.beta_table(df1)
a.beta_add_rows(df2)

"## UInt64Index"
df1 = pd.DataFrame(
    [["foo", 1], ["bar", 2]],
    index=pd.UInt64Index([1, 2]),
)
df2 = pd.DataFrame(
    [["baz", 3], ["qux", 4]],
    index=pd.UInt64Index([3, 4]),
)

a = st.beta_table(df1)
a.beta_add_rows(df2)

"## Float64Index"
df1 = pd.DataFrame(
    [["foo", 1], ["bar", 2]],
    index=pd.Float64Index([1.24, 2.35]),
)
df2 = pd.DataFrame(
    [["baz", 3], ["qux", 4]],
    index=pd.Float64Index([3.24, 4.35]),
)

a = st.beta_table(df1)
a.beta_add_rows(df2)

"## df1 - has 1 column, df2 - has 2 columns"
df1 = pd.DataFrame([["foo"], ["bar"]], columns=["c1"])
df2 = pd.DataFrame([["baz", 1], ["qux", 2]], columns=["c1", "c2"])

a = st.beta_table(df1)
a.beta_add_rows(df2)

"## df1 and df2 have same size but different columns"
df1 = pd.DataFrame([["foo", 1], ["bar", 2]], columns=["c1", "c2"])
df2 = pd.DataFrame([["baz", 1], ["qux", 2]], columns=[1, 2])

a = st.beta_table(df1)
a.beta_add_rows(df2)

"## df1 is empty"
df1 = pd.DataFrame()
df2 = pd.DataFrame([["baz", 1], ["qux", 2]], columns=["c1", "c2"])

a = st.beta_table(df1)
a.beta_add_rows(df2)
