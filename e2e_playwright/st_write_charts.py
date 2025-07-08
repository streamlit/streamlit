# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
import graphviz
import numpy as np
import pandas as pd
import plotly.express as px
import pydeck as pdk

import streamlit as st

np.random.seed(0)


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
