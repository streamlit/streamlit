import streamlit as st
from time import sleep

with st.spinner():
    for i in range(5, 0, -1):
        st.text(i)
        sleep(1)

st.text('done')
