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

"## Table Caption"
df = pd.DataFrame([["foo", 100], ["bar", 200]])
styler = df.style.set_caption("The caption")
st._arrow_table(styler)

"## CategoricalIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.CategoricalIndex([1, 2]),
)
st._arrow_table(df)

"## IntervalIndex"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=pd.interval_range(start=0, end=2),
)
st._arrow_table(df)

"## MultiIndex Styler"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=[["a", "b"], [1, 2]],
)
styler = df.style.highlight_max()
st._arrow_table(styler)

"## MultiIndex `add_rows()`"
df1 = pd.DataFrame(
    [["foo", 100], ["bar", 200]],
    index=[["a", "b"], [1, 2]],
)
df2 = pd.DataFrame(
    [["baz", 300], ["qux", 400]],
    index=[["c", "d"], [3, 4]],
)
table = st._arrow_table(df1)
table._arrow_add_rows(df2)

"## RangeIndex `step`"
df = pd.DataFrame(
    [["foo", 100], ["bar", 200]], index=pd.RangeIndex(start=10, stop=30, step=10)
)
st._arrow_table(df)

"## `Pandas.NaT`"
df = pd.DataFrame([[pd.NaT, 100], [pd.NaT, 200]])
st._arrow_table(df)
