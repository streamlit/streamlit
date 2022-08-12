import streamlit as st

x = st.camera_input("Label1", help="help1")

if x is not None:
    st.image(x)

y = st.camera_input("Label2", help="help2", disabled=True)
