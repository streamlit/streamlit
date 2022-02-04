import streamlit as st

b0 = st.button("b0")
b1 = st.button("b1")

if b0:
    with st.expander("b0_expander", expanded=False):
        st.write("b0_write")

if b1:
    with st.expander("b1_expander", expanded=False):
        st.write("b1_write")
