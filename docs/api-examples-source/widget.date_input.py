import streamlit as st
import datetime

with st.echo():
    d = st.date_input('When\'s your birthday', datetime.date(2019, 7, 6))
    st.write('Your birhtday is:', d)
