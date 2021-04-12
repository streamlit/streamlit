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

import numpy as np
import pandas as pd

import streamlit as st

# # UnicodeIndex
# df = pd.DataFrame(
#     [["foo", 0], ["bar", 1]],
#     columns=["c1", "c2"],
#     index=["c1", "c2"],
# )
# st.beta_table(df)

# RangeIndex
df = pd.DataFrame(
    [["foo", 0], ["bar", 1], ["bar", 1]],
    columns=["c1", "c2"],
)
df2 = pd.DataFrame(
    [["baz", 2], ["bam", 3], ["bar", 1]],
    columns=["c1", "c2"],
)
a = st.beta_table(df)
a.beta_add_rows(df2)

# b = st.table(df)
# b.add_rows(df2)
# # CategoricalIndex
# df = pd.DataFrame(
#     [["foo", 0], ["bar", 1]],
#     index=pd.CategoricalIndex([1, 2]),
#     columns=["c1", "c2"],
# )
# st.beta_table(df)

# # MultiIndex
# arrays = [[1, 2], ["red", "blue"]]
# df = pd.DataFrame(
#     [["foo", 0], ["bar", 1]],
#     index=pd.MultiIndex.from_arrays(arrays, names=("number", "color")),
#     columns=["c1", "c2"],
# )
# st.beta_table(df)
# # IntervalIndex
# df = pd.DataFrame(
#     [["foo", 0], ["bar", 1]],
#     index=pd.interval_range(start=0, end=2),
#     columns=["c1", "c2"],
# )
# st.beta_table(df)

# # DatetimeIndex
# df = pd.DataFrame(
#     [["foo", 0], ["bar", 1]],
#     index=pd.Series(pd.date_range("2000-01-01", periods=2, freq="Y")),
#     columns=pd.Series(pd.date_range("2000-01-01", periods=2, freq="Y")),
# )
# st.beta_table(df)

# # PeriodIndex
# df = pd.DataFrame(
#     [["foo", 0], ["bar", 1]],
#     index=pd.PeriodIndex(year=[2000, 2002], quarter=[1, 3]),
#     columns=["c1", "c2"],
# )
# st.beta_table(df)

# # Int64Index
# df = pd.DataFrame(
#     [["foo", 0], ["bar", 1]],
#     index=[1, 2],
#     columns=["c1", "c2"],
# )
# st.beta_table(df)

# # UInt64Index
# df = pd.DataFrame(
#     [["foo", 0], ["bar", 1]],
#     index=pd.UInt64Index([1, 2]),
#     columns=["c1", "c2"],
# )
# st.beta_table(df)

# # Float64Index
# df = pd.DataFrame(
#     [["foo", 0], ["bar", 1]],
#     index=pd.Float64Index([1.24, 2.35]),
#     columns=["c1", "c2"],
# )
# st.beta_table(df)