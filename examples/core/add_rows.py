import altair as alt
import numpy as np
import pandas as pd
import streamlit as st
import time

# Test add_rows for everything that supports it.
# We test twice: once with coalescing in Python, and once in JS.
# What to expect, visually:
# * 1 table
# * 1 dataframe
# * 1 line chart
# * 4 vega-lite charts
# * And then all of the above once again.
# * Also, all of the above should have 3 rows or datapoints.

num_rows = 3

df = pd.DataFrame({'a': [1, 2, 3], 'b': [10, 0, 30], 'c': [100, 200, -100]})

df1 = df.iloc[0:1, :]

for coalesce_in_js in [False, True]:

    table_el = st.table(df1)
    dataframe_el = st.dataframe(df1)
    chart_el = st.line_chart(df1)

    # 4 identical charts, built in different ways.
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
        if coalesce_in_js:
            time.sleep(0.2)

        df2 = df.iloc[i:i+1, :]

        table_el.add_rows(df2)
        dataframe_el.add_rows(df2)
        chart_el.add_rows(df2)
        vega_el1.add_rows(df2)
        vega_el2.add_rows(df2)
        vega_el3.add_rows(foo=df2)
        altair_el.add_rows(df2)

# Test that add_rows errors out when the dataframe dimensions don't
# match. Should show an error.
dataframe_el.add_rows(np.abs(np.random.randn(num_rows, 6)))
