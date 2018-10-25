"""The crypt of top secret undocumented Streamlit API calls."""

import streamlit as st
import numpy as np
import pandas as pd
from datetime import datetime

st.title('Tables with different sizes')

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
