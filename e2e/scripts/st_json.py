import streamlit as st

data = {"foo": "bar"}
st.json(data)
st.json(data, expanded=False)
