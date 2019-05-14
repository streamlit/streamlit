import streamlit as st
import numpy as np
import pandas as pd
from datetime import datetime

st.title('Tables with different sizes')

st.header('Long cells that overflow')

st.write('''
    Long text should show an ellipsis. All cells should have a tooltip
    with their entire un-ellipsized contents.
    ''')

st.dataframe({
    'foo': ['hello', 'world', 'foo '*30],
    'bar': ['hello', 'world', 'bar'*30],
    'baz': [1, 2, 3],
    'boz': [1, 2, 3],
    'buz': [1, 2, 3],
    'biz'*30: [1, 2, 3],
    'bim': [1, 2, 3],
})

st.dataframe({
    'foo': ['hello', 'world', 'foo '*30],
})

st.header('Using st.write')

for c in [1, 2, 5, 20]:
    for r in [1, 2, 3, 4, 5, 6, 7, 8, 20]:
        df = pd.DataFrame(np.random.randn(c, r), index=range(c),
            columns=range(r))
        st.dataframe(df)

st.header('Overriding st.write')

for c in [1, 2, 5, 20]:
    for r in [1, 2, 3, 4, 5, 6, 7, 8, 20]:
        df = pd.DataFrame(np.random.randn(c, r), index=range(c),
            columns=range(r))
        df_elt = st.dataframe(np.random.randn(200, 200))
        df_elt.dataframe(df)

st.header('Using st.table')

for c in [1, 2, 5, 20]:
    for r in [1, 2, 3, 4, 5, 6, 7, 8, 20]:
        df = pd.DataFrame(np.random.randn(c, r), index=range(c),
            columns=range(r))
        st.table(df)

st.header('Overriding st.table')

for c in [1, 2, 5, 20]:
    for r in [1, 2, 3, 4, 5, 6, 7, 8, 20]:
        df = pd.DataFrame(np.random.randn(c, r), index=range(c),
            columns=range(r))
        df_elt = st.table(np.random.randn(200, 200))
        df_elt.table(df)
