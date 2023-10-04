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

# TODO(lukasmasuch): Add timedelta index once the type is supported
# TODO(lukasmasuch): Add period index once the type is supported
# TODO(lukasmasuch): Fix support for categorical index:
# st.subheader("Categorical Index (pd.CategoricalIndex)")
# st.dataframe(SPECIAL_TYPES_DF.set_index("categorical"), use_container_width=True)

import pandas as pd

df = pd.DataFrame(
    index=[0, 1],
    columns=[[2, 3, 4], ["c1", "c2", "c3"]],
    data=np.arange(0, 6, 1).reshape(2, 3),
)
df.columns = df.columns.get_level_values(0)

st.write(isinstance(df.columns, pd.MultiIndex))
st.dataframe(df)


import pandas as pd

import streamlit as st

labels = [
    ["Aiyana", "Aiyana", "Anisha", "Anisha"],
    ["Mathematics", "Science", "Mathematics", "Science"],
]
tuples = list(zip(*labels))
index = pd.MultiIndex.from_tuples(tuples, names=["Students", "Subjects"])
df = pd.DataFrame(
    [[98, 95, 99], [95, 93, 96], [92, 99, 95], [99, 95, 97]],
    index=index,
    columns=["1st term", "2nd term", "Final"],
)

# works as expected for a dataframe
st.dataframe(df)

df2 = df.T
# df2.columns = df2.columns.to_flat_index()
# transposing..... shows weird results
st.data_editor(df2)

# import pandas as pd

# import streamlit as st

# pd.set_option("styler.render.max_elements", 50000)
# max_elements = pd.get_option("styler.render.max_elements")  # default: 262144
# st.write(max_elements)

# # big example with default styler.render.max_elements

# df = pd.DataFrame(list(range(max_elements + 1)))
# # This next line always works
# st.dataframe(df)
# # Applying formatting fails based on dataframe size. Try commenting out for running smaller example below.
# st.dataframe(df.style.format("{:03d}"))


# # small example with small custom styler.render.max_elements
# # pd.set_option("styler.render.max_elements", 2)

# df2 = pd.DataFrame([1, 2, 3])
# # This next line always works
# st.dataframe(df2)
# # Applying formatting fails based on dataframe size
# st.dataframe(df2.style.format("{:03d}").set_properties(**{"background-color": "red"}))
