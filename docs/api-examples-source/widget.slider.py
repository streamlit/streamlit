import streamlit as st

w = st.slider('Age', 18, min=0, max=100, step=1)
if w > 20:
    print('You can drink now!')
