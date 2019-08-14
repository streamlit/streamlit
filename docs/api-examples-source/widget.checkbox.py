import streamlit as st

with st.echo():
    agree = st.checkbox('I agree', False)
    if agree:
      st.write('Great!')
