import streamlit as st
import pandas as pd

import time
import random

st.title('Empty charts')

st.write('''
    This file tests what happens when you pass an empty dataframe or `None` into
    a chart.

    In some cases, we handle it nicely. In others, we show an error. The reason
    for the latter is because some chart types derive their configuration from
    the dataframe you pass in at the start. So when there's no dataframe we
    cannot detect that configuration.
''')

data = {
    'a': [1, 2, 3, 4],
    'b': [1, 3, 2, 4],
}

spec = {
    'mark': 'line',
    'encoding': {
        'x': {'field': 'a', 'type': 'quantitative'},
        'y': {'field': 'b', 'type': 'quantitative'},
    },
}

st.subheader('Here are 2 empty charts')
st.vega_lite_chart(spec)
st.pyplot()

st.subheader('Here are 2 filled charts')
x = st.vega_lite_chart(spec)
x.vega_lite_chart(data, spec)

x = st.vega_lite_chart(spec)
time.sleep(0.2)  # Sleep a little so the add_rows gets sent separately.
x.add_rows(data)

st.subheader('Here is 1 empty map')
st.deck_gl_chart()

# TODO: Implement add_rows on DeckGL
# st.subheader('1 filled map')
# x = st.deck_gl_chart()
# x.add_rows({'lat': 0, 'lon': 0})

st.subheader('Here are 10 errors')
st.write(1)
st.vega_lite_chart({})
st.write(2)
st.vega_lite_chart(data, {})
st.write(3)
st.vega_lite_chart(data)
st.write(4)
st.vega_lite_chart()
st.write(5)
st.altair_chart()
st.write(6)
st.line_chart()
st.write(7)
st.area_chart()
st.write(8)
st.bar_chart()
st.write(9)
st._native_chart()
st.write(10)
st.map()
