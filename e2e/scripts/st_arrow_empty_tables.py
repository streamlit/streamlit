import streamlit as st
import pandas as pd
import numpy as np

st.header("Empty tables")
st._arrow_table()
st._arrow_table([])
st._arrow_table(np.array(0))
st._arrow_table(pd.DataFrame([]))

st.header("Empty one-column table")
st._arrow_table(np.array([]))

st.header("Empty two-column table")
st._arrow_table(pd.DataFrame({"lat": [], "lon": []}))
