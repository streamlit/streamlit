import streamlit as st
import pandas as pd

df = pd.DataFrame({"a": [1, 2, 3], "b": [10, 0, 30], "c": [100, 200, -100]})

# chart = st.line_chart(df)

st.write(df.reindex(pd.RangeIndex(0, 2)))

st.write(df)

melted = data = pd.melt(df.reset_index(), id_vars=['index'])

dataframer = st.dataframe(melted)

st.write(melted.loc[:, ['index', 'variable']].groupby('variable').last())

chart.add_rows({"a": [4], "b": [40], "c": [150]})


df.reindex()
