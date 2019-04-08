import altair as alt
import numpy as np
import pandas as pd
import streamlit as st
import time

num_rows = 3

df = pd.DataFrame(
    np.abs(np.random.randn(num_rows, 3)),
    columns=['a', 'b', 'c'])

df1 = df.iloc[0:1, :]

st.title('st.add_rows()')
st.write('Everything below should have', num_rows, 'rows or datapoints')

st.header('Tables')
table_el = st.table(df1)
dataframe_el = st.dataframe(df1)

st.header('1 chart')
chart_el = st.line_chart(df1)

st.header('4 identical charts')
vega_el1 = st.vega_lite_chart(df1, {
    'mark': {'type': 'line', 'point': True},
    'encoding': {
        'x': {'field': 'a', 'type': 'quantitative'},
        'y': {'field': 'b', 'type': 'quantitative'},
    },
})
vega_el2 = st.vega_lite_chart({
    'datasets': {
        'foo': df1,
    },
    'data': {'name': 'foo'},
    'mark': {'type': 'line', 'point': True},
    'encoding': {
        'x': {'field': 'a', 'type': 'quantitative'},
        'y': {'field': 'b', 'type': 'quantitative'},
    },
})
vega_el3 = st.vega_lite_chart({
    'datasets': {
        'foo': df1,
    },
    'data': {'name': 'foo'},
    'mark': {'type': 'line', 'point': True},
    'encoding': {
        'x': {'field': 'a', 'type': 'quantitative'},
        'y': {'field': 'b', 'type': 'quantitative'},
    },
})
altair_el = st.altair_chart(alt.Chart(df)
    .mark_line(point=True)
    .encode(x='a', y='b')
    .interactive())


for i in range(1, num_rows):

    # Make rows get merged in JS rather than Python.
    # (The Python side is already well tested in unit tests)
    time.sleep(0.2)

    df2 = df.iloc[i:i+1, :]
    table_el.add_rows(df2)
    dataframe_el.add_rows(df2)
    chart_el.add_rows(df2)
    vega_el1.add_rows(df2)
    vega_el2.add_rows(df2)
    vega_el3.add_rows(foo=df2)
    altair_el.add_rows(df2)

st.header('You should see an error below')
st.write(
    'The error below is caught in the Proxy, so this is a good test for that!')
dataframe_el.add_rows(np.abs(np.random.randn(num_rows, 6)))
