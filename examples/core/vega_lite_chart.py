import streamlit as st
import pandas as pd
import numpy as np

data = np.random.randn(200, 3)
df = pd.DataFrame(data, columns=['a', 'b', 'c'])
spec = {
    'mark': 'circle',
    'encoding': {
        'x': {'field': 'a', 'type': 'quantitative'},
        'y': {'field': 'b', 'type': 'quantitative'},
        'size': {'field': 'c', 'type': 'quantitative'},
        'color': {'field': 'c', 'type': 'quantitative'},
    }
}
st.vega_lite_chart(df, spec)
st.vega_lite_chart(df, spec, width=0)
st.vega_lite_chart(df, spec, width=-1)
st.vega_lite_chart(df, spec, width=500)
