import streamlit as st

st.write('''# Crossfilter in Altair''')

st.write('First, we import Altair.')

with st.echo():
    import altair as alt
    from vega_datasets import data

st.write('Then we can create the chart.')

with st.echo():
    source = alt.UrlData(
        data.flights_2k.url,
        format={'parse': {'date': 'date'}}
    )

    brush = alt.selection(type='interval', encodings=['x'])

    # Define the base chart, with the common parts of the
    # background and highlights
    base = alt.Chart().mark_bar().encode(
        x=alt.X(alt.repeat('column'), type='quantitative', bin=alt.Bin(maxbins=20)),
        y='count()'
    ).properties(
        width=160,
        height=130
    )

    # grey background with selection
    background = base.encode(
        color=alt.value('#ddd')
    ).add_selection(brush)

    # blue highlights on the transformed data
    highlight = base.transform_filter(brush)

    # layer the two charts & repeat
    chart = alt.layer(
        background,
        highlight,
        data=source
    ).transform_calculate(
        "time",
        "hours(datum.date)"
    ).repeat(column=["distance", "delay", "time"])

st.write('And display it')

st.altair_chart(chart, width=-1)
