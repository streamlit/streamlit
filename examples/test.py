import streamlit as st


@st.cache
def foo():
    st.write("hi")


foo()
