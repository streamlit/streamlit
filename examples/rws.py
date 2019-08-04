import streamlit as st

default_text = 'hello'
if st.checkbox('Change default text'):
    default_text = 'goodbye'

text = st.text_input('Text:', default_text)
st.write(text)
