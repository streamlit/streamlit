import streamlit as st

default_text = 'i iz input'
if st.checkbox('Change default text'):
    default_text = 'r u input 2??'
st.text_input('Text input widget', default_text)
