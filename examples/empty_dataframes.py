import streamlit as st
import pandas as pd
import numpy as np

st.title('Empty dataframes')


st.header('Using st.write')

st.write('These should look like empty tables')
st.write(np.array(0))
st.write(pd.DataFrame([]))

st.write('This one should be empty, but have a column called `0`')
st.write(np.array([]))

st.write('This one should be empty, but have two columns: `lat` and `lon`')
st.write(pd.DataFrame({'lat': [], 'lon': []}))


st.header('Using st.table')

st.write('These should look like empty tables')
st.write('_TODO: Make these look nicer!_')
st.table([])
st.table(np.array(0))
st.table(pd.DataFrame([]))

st.write('This one should be empty, but have a column called `0`')
st.table(np.array([]))

st.write('This one should be empty, but have two columns: `lat` and `lon`')
st.table(pd.DataFrame({'lat': [], 'lon': []}))
