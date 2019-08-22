import streamlit as st

@st.cache
def func(x):
    x[0] = 2
    return x

arr = [1,2,3]
v = func(arr)

st.write(v)
