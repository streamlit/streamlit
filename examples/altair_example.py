import streamlit as st
import numpy as np
import pandas as pd
import altair as alt

df = pd.DataFrame(
    np.random.randn(200, 3),
    columns=['a', 'b', 'c'])

c = (alt.Chart(df)
        .mark_circle()
        .encode(x='a', y='b', size='c', color='c')
        .interactive())

st.title('These two should look exactly the same')

st.write('Altair chart using `st.altair_chart`:')
st.altair_chart(c)

st.write('And the same chart using `st.write`:')
st.write(c)
