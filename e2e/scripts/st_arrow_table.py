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

import pandas as pd

import streamlit as st
from tests.streamlit import pyspark_mocks

# NOTE: DO NOT CHANGE the order of elements.
# Otherwise, snapshots will fail.

"## CategoricalIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.CategoricalIndex([1, 2]),
)
st._arrow_table(df)

"## DatetimeIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.Series(pd.date_range("2021-01-01", periods=2, freq="Y")),
)
st._arrow_table(df)

"## Float64Index"
df = pd.DataFrame([["foo", 100], ["bar", 200]], index=[1.23, 2.34])
st._arrow_table(df)

"## Int64Index"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=[1, 2],
)
st._arrow_table(df)

"## IntervalIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.interval_range(start=0, end=2),
)
st._arrow_table(df)

"## MultiIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=[["a", "b"], [1, 2]],
)
st._arrow_table(df)

"## PeriodIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.PeriodIndex(year=[2000, 2002], quarter=[1, 3]),
)
st._arrow_table(df)

"## RangeIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
)
st._arrow_table(df)

"## UInt64Index"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.Index([1, 2], dtype="uint64"),
)
st._arrow_table(df)

"## UnicodeIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=["a", "b"],
)
st._arrow_table(df)

"## PySpark DataFrame"
st._arrow_table(pyspark_mocks.DataFrame())
