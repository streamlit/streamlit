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

import altair as alt
import numpy as np
import pandas as pd

import streamlit as st

# Set to default vega lite theme
alt.themes.enable("none")

np.random.seed(0)

data = np.random.randn(200, 3)
df = pd.DataFrame(data, columns=["a", "b", "c"])
chart = alt.Chart(df).mark_circle().encode(x="a", y="b", size="c", color="c")
st._arrow_altair_chart(chart)

with alt.themes.enable("none"):
    st.write("Show default vega lite theme:")
    st._arrow_altair_chart(chart)

with alt.themes.enable("streamlit"):
    st.write("Show streamlit theme:")
    st._arrow_altair_chart(chart)

with alt.themes.enable("streamlit"):
    st.write("Overwrite theme config:")
    chart = (
        alt.Chart(df, usermeta={"embedOptions": {"theme": None}})
        .mark_circle()
        .encode(x="a", y="b", size="c", color="c")
    )
    st._arrow_altair_chart(chart)

data = pd.DataFrame(
    {
        "a": ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        "b": [28, 55, 43, 91, 81, 53, 19, 87, 52],
    }
)

chart = alt.Chart(data).mark_bar().encode(x="a", y="b")

st.write("Bar chart with default theme:")
st._arrow_altair_chart(chart)

with alt.themes.enable("streamlit"):
    st.write("Bar chart with streamlit theme:")
    st._arrow_altair_chart(chart)

with alt.themes.enable("streamlit"):
    st.write("Bar chart with overwritten theme props:")
    st._arrow_altair_chart(chart.configure_mark(color="black"))
