import streamlit as st
import pandas as pd
import numpy as np

st.header("Empty list")
st.write([])

st.header("Empty dataframes")
st.write(np.array(0))
st.write(pd.DataFrame([]))
st._legacy_dataframe()
st._legacy_dataframe([])
st._legacy_dataframe(np.array(0))
st._legacy_dataframe(pd.DataFrame([]))

st.header("Empty one-column dataframes")
st.write(np.array([]))
st._legacy_dataframe(np.array([]))

st.header("Empty two-column dataframes (only shows 1)")
st.write(pd.DataFrame({"lat": [], "lon": []}))
st._legacy_dataframe(pd.DataFrame({"lat": [], "lon": []}))

st.header("Empty tables")
st._legacy_table()
st._legacy_table([])
st._legacy_table(np.array(0))
st._legacy_table(pd.DataFrame([]))

st.header("Empty one-column table")
st._legacy_table(np.array([]))

st.header("Empty two-column table")
st._legacy_table(pd.DataFrame({"lat": [], "lon": []}))
