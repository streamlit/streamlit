# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import altair as alt
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

import streamlit as st
from tests.streamlit import pyspark_mocks

np.random.seed(0)

st.subheader("st.write(markdown)")

st.write("Hello", "World")

st.write("This **markdown** is awesome! :sunglasses:")

st.write("This <b>HTML tag</b> is escaped!")

st.write("This <b>HTML tag</b> is not escaped!", unsafe_allow_html=True)

st.subheader("st.write(dataframe-like)")

st.write(pyspark_mocks.DataFrame())

st.write(pd.DataFrame([1, 2, 3]))

st.subheader("st.write(json-like)")

st.write(["foo", "bar"])

st.write({"foo": "bar"})

st.subheader("st.write(help)")

st.write(st.data_editor)

st.subheader("st.write(exception)")

st.write(Exception("This is an exception!"))

st.subheader("st.write(matplotlib)")

fig, ax = plt.subplots()
ax.hist(np.random.normal(1, 1, size=100), bins=20)

st.write(fig)

st.subheader("st.write(altair)")

df = pd.DataFrame(np.random.randn(200, 3), columns=["a", "b", "c"])
chart = alt.Chart(df).mark_circle().encode(x="a", y="b", size="c", color="c")
st.write(chart)
