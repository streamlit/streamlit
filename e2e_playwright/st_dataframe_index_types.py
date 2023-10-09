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

import random

import numpy as np

import streamlit as st
from tests.streamlit.data_mocks import (
    BASE_TYPES_DF,
    DATETIME_TYPES_DF,
    INTERVAL_TYPES_DF,
    LIST_TYPES_DF,
    NUMBER_TYPES_DF,
    PERIOD_TYPES_DF,
    SPECIAL_TYPES_DF,
)

np.random.seed(0)
random.seed(0)

st.set_page_config(layout="wide")

st.header("Index types")

st.subheader("String Index (pd.Index)")
st.dataframe(BASE_TYPES_DF.set_index("string"), use_container_width=True)

st.subheader("Float64 Index (pd.Float64Index)")
st.dataframe(NUMBER_TYPES_DF.set_index("float64"), use_container_width=True)

st.subheader("Int64 Index (pd.Int64Index)")
st.dataframe(NUMBER_TYPES_DF.set_index("int64"), use_container_width=True)

st.subheader("Uint64 Index (pd.UInt64Index)")
st.dataframe(NUMBER_TYPES_DF.set_index("uint64"), use_container_width=True)

st.subheader("Datetime Index (pd.DatetimeIndex)")
st.dataframe(DATETIME_TYPES_DF.set_index("datetime"), use_container_width=True)

st.subheader("Date Index (pd.Index)")
st.dataframe(DATETIME_TYPES_DF.set_index("date"), use_container_width=True)

st.subheader("Time Index (pd.Index)")
st.dataframe(DATETIME_TYPES_DF.set_index("time"), use_container_width=True)

st.subheader("Interval Index (pd.IntervalIndex)")
st.dataframe(INTERVAL_TYPES_DF.set_index("int64_both"), use_container_width=True)

st.subheader("List Index (pd.Index)")
st.dataframe(LIST_TYPES_DF.set_index("string_list"), use_container_width=True)

st.subheader("Multi Index (pd.MultiIndex)")
st.dataframe(BASE_TYPES_DF.set_index(["string", "int64"]), use_container_width=True)

st.subheader("Categorical Index (pd.CategoricalIndex)")
st.dataframe(SPECIAL_TYPES_DF.set_index("categorical"), use_container_width=True)

st.subheader("Period Index (pd.PeriodIndex)")
st.dataframe(PERIOD_TYPES_DF.set_index("L"), use_container_width=True)

# TODO(lukasmasuch): Add timedelta index once the type is supported
