import streamlit as st

w = st.radio('Gender', ('female', 'male'))
if w == 0:
    print('female')
