import streamlit as st

e = RuntimeError("This exception message is awesome!")
st.exception(e)
