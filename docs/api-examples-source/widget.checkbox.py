import streamlit as st

agree = st.checkbox("I agree")
if agree:
    st.write("Great!")
