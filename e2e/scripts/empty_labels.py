import streamlit as st

a, b = st.columns(2)
a.selectbox("With label", [])
b.selectbox("", [])  # No label
