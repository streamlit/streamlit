import streamlit as st
import pandas as pd
import numpy as np

st.title('Empty dataframes')


st.header('Using st.write and st.dataframe')

st.subheader('An empty list (looks like `[]`)')
st.write([])

st.subheader('6 empty interactive tables')
st.write(1)
st.write(np.array(0))
st.write(2)
st.write(pd.DataFrame([]))
st.write(3)
st.dataframe()
st.write(4)
st.dataframe([])
st.write(5)
st.dataframe(np.array(0))
st.write(6)
st.dataframe(pd.DataFrame([]))

st.subheader('2 empty interactive tables with a column called `0`')
st.write(1)
st.write(np.array([]))
st.write(2)
st.dataframe(np.array([]))

st.subheader('2 empty interactive tables with columns `lat` and `lon`')
st.write(1)
st.write(pd.DataFrame({'lat': [], 'lon': []}))
st.write(2)
st.dataframe(pd.DataFrame({'lat': [], 'lon': []}))


st.header('Using st.table')

st.subheader('4 empty static tables, with weird empty headers')
st.write(1)
st.table()
st.write(2)
st.table([])
st.write(3)
st.table(np.array(0))
st.write(4)
st.table(pd.DataFrame([]))

st.subheader('1 empty static table with a column called `0`')
st.table(np.array([]))

st.subheader('1 empty static table with columns `lat` and `lon`')
st.table(pd.DataFrame({'lat': [], 'lon': []}))
