import streamlit as st

with st.echo():
    options = st.selectbox('How would you like to be contacted?', ('Email', 'Home phone', 'Mobile phone'), 0)
    st.write(options)
