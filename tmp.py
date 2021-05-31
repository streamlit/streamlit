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

import pandas as pd

import streamlit as st

"## UnicodeIndex"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=["a", "b"],
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=["c", "d"],
)
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## RangeIndex"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
)
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## CategoricalIndex"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.CategoricalIndex([1, 2]),
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=pd.CategoricalIndex([3, 4]),
)
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## MultiIndex"
a1 = [["a", "b"], [1, 2]]
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.MultiIndex.from_arrays(a1, names=("letter", "number")),
)
a2 = [["c", "d"], [3, 4]]
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=pd.MultiIndex.from_arrays(a2, names=("letter", "number")),
)
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## IntervalIndex"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.interval_range(start=0, end=2),
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=pd.interval_range(start=2, end=4),
)
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## DatetimeIndex"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.Series(pd.date_range("2021-01-01", periods=2, freq="Y")),
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=pd.Series(pd.date_range("2021-01-01", periods=2, freq="Y")),
)
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## PeriodIndex"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.PeriodIndex(year=[2000, 2002], quarter=[1, 3]),
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=pd.PeriodIndex(year=[2000, 2002], quarter=[1, 3]),
)
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## Int64Index"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=[1, 2],
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=[3, 4],
)
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## UInt64Index"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.UInt64Index([1, 2]),
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=pd.UInt64Index([3, 4]),
)
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## Float64Index"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.Float64Index([1.23, 2.34]),
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=pd.Float64Index([3.45, 4.56]),
)
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## df1 - has 1 column, df2 - has 2 columns"
df1 = pd.DataFrame([["foo"], ["bar"]], columns=["c1"])
df2 = pd.DataFrame([["baz", 100], ["qux", 200]], columns=["c1", "c2"])
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## df1 and df2 have same size but different columns"
df1 = pd.DataFrame([["foo", 100], ["bar", 200]], columns=["c1", "c2"])
df2 = pd.DataFrame([["baz", 300], ["qux", 400]], columns=[1, 2])
t = st.beta_table(df1)
t.beta_add_rows(df2)


"## df1 is empty"
df1 = pd.DataFrame()
df2 = pd.DataFrame([["foo", 100], ["bar", 200]], columns=["c1", "c2"])
t = st.beta_table(df1)
t.beta_add_rows(df2)
