import streamlit as st
import time

number = st.number_input("test", value=100)
st.write(number)

time.sleep(1)
