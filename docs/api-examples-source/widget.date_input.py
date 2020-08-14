import streamlit as st
import datetime

d = st.date_input("When's your birthday", datetime.date(2020, 8, 11))
st.write("Your birthday is:", d)
