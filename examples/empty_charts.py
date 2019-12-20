# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

import streamlit as st
import pandas as pd

import time

st.title("Empty charts")

st.write(
    """
    This file tests what happens when you pass an empty dataframe or `None` into
    a chart.

    In some cases, we handle it nicely. In others, we show an error. The reason
    for the latter is because some chart types derive their configuration from
    the dataframe you pass in at the start. So when there's no dataframe we
    cannot detect that configuration.
"""
)

data = pd.DataFrame({"a": [1, 2, 3, 4], "b": [1, 3, 2, 4]})

spec = {
    "mark": "line",
    "encoding": {
        "x": {"field": "a", "type": "quantitative"},
        "y": {"field": "b", "type": "quantitative"},
    },
}

st.subheader("Here are 4 empty charts")
st.vega_lite_chart(spec)
st.line_chart()
st.area_chart()
st.bar_chart()

st.write("Below is an empty pyplot chart (i.e. just a blank image)")
st.pyplot()
st.write("...and that was it.")

st.subheader("Here are 5 filled charts")
x = st.vega_lite_chart(spec)
x.vega_lite_chart(data, spec)

x = st.vega_lite_chart(spec)
time.sleep(0.2)  # Sleep a little so the add_rows gets sent separately.
x.add_rows(data)

x = st.line_chart()
x.add_rows(data)

x = st.area_chart()
x.add_rows(data)

x = st.bar_chart()
x.add_rows(data)

st.subheader("Here is 1 empty map")
st.deck_gl_chart()

# TODO: Implement add_rows on DeckGL
# st.subheader('1 filled map')
# x = st.deck_gl_chart()
# x.add_rows({'lat': 0, 'lon': 0})

# TODO: write Python tests for these:
# (This manual test doesn't work anymore since errors break execution now)
# st.subheader('Here are 10 errors')
# st.write(1)
# st.vega_lite_chart({})
# st.write(2)
# st.vega_lite_chart(data, {})
# st.write(3)
# st.vega_lite_chart(data)
# st.write(4)
# st.vega_lite_chart()
# st.write(5)
# st.altair_chart()
# st.write(6)
# st.line_chart()
# st.write(7)
# st.area_chart()
# st.write(8)
# st.bar_chart()
# st.write(9)
# st._native_chart()
# st.write(10)
# st.map()
