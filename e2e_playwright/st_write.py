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

import io
from collections import namedtuple
from dataclasses import dataclass
from datetime import datetime

import altair as alt
import graphviz
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import plotly.express as px
import pydeck as pdk
from PIL import Image

import streamlit as st

np.random.seed(0)

st.subheader("st.write(markdown)")

st.write("Hello", "World")

st.write("This **markdown** is awesome! :sunglasses:")

st.write("This <b>HTML tag</b> is escaped!")

st.write("This <b>HTML tag</b> is not escaped!", unsafe_allow_html=True)


class ClassWithReprHtml:
    def _repr_html_(self):
        return "This <b>HTML tag</b> is also not escaped!"


st.write(ClassWithReprHtml())

st.write(100)

st.write(None)

st.write(datetime(2021, 1, 1))

st.write(np.float64(1.0))

string_io = io.StringIO()
string_io.write("This is a string IO object!")

st.write(string_io)


def stream_text():
    yield "This is "
    yield "streamed text"


st.subheader("st.write(generator)")

st.write(stream_text)

st.write(stream_text())


st.subheader("st.write(dataframe-like)")

st.write(pd.DataFrame(np.random.randn(25, 3), columns=["a", "b", "c"]))

st.write(pd.Series([1, 2, 3]))

st.write(
    pd.DataFrame(np.random.randn(25, 3), columns=["a", "b", "c"]).style.format("{:.2%}")
)

st.write(np.arange(25).reshape(5, 5))

st.subheader("st.write(json-like)")

st.write(["foo", "bar"])

st.write({"foo": "bar"})

st.write(st.session_state)
st.write(st.experimental_user)
st.write(st.query_params)

Point = namedtuple("Point", ["x", "y"])
st.write(Point(1, 2))

st.subheader("st.write(help)")

st.write(st.dataframe)


@dataclass
class ExampleClass:
    name: str
    age: int


st.write(ExampleClass)

st.subheader("st.write(exception)")

st.write(Exception("This is an exception!"))

st.subheader("st.write(matplotlib)")

fig, ax = plt.subplots()
ax.hist(np.random.normal(1, 1, size=100), bins=20)

st.write(fig)

st.subheader("st.write(altair)")

df = pd.DataFrame(np.random.randn(50, 3), columns=["a", "b", "c"])
chart = alt.Chart(df).mark_circle().encode(x="a", y="b", size="c", color="c")
st.write(chart)

st.subheader("st.write(plotly)")

fig = px.scatter(df, x="a", y="b")
st.write(fig)

st.subheader("st.write(graphviz)")

graph = graphviz.Digraph()
graph.edge("run", "intr")
graph.edge("intr", "runbl")
graph.edge("runbl", "run")

st.write(graph)

# Simple pydeck chart:

st.subheader("st.write(pydeck)")

st.write(
    pdk.Deck(
        map_style=None,
        initial_view_state=pdk.ViewState(
            latitude=37.76,
            longitude=-122.4,
            zoom=11,
            pitch=50,
        ),
    )
)

st.subheader("st.write(Image)")

st.write(Image.new("L", (10, 10), "black"))
