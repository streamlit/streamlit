import streamlit as st

st.write("This **markdown** is awesome! :sunglasses:")

st.write("This <b>HTML tag</b> is escaped!")

st.write("This <b>HTML tag</b> is not escaped!", unsafe_allow_html=True)
