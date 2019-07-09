import streamlit as st
import pandas as pd
import numpy as np

st.header('Empty list')
st.write([])

st.header('Empty dataframes')
st.write(np.array(0))
st.write(pd.DataFrame([]))
st.dataframe()
st.dataframe([])
st.dataframe(np.array(0))
st.dataframe(pd.DataFrame([]))

st.header('Empty one-column dataframes')
st.write(np.array([]))
st.dataframe(np.array([]))

st.header('Empty two-column dataframes')
st.write(pd.DataFrame({'lat': [], 'lon': []}))
st.dataframe(pd.DataFrame({'lat': [], 'lon': []}))

st.header('Empty tables')
st.table()
st.table([])
st.table(np.array(0))
st.table(pd.DataFrame([]))

st.header('Empty one-column table')
st.table(np.array([]))

st.header('Empty two-column table')
st.table(pd.DataFrame({'lat': [], 'lon': []}))
