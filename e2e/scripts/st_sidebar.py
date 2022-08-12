import streamlit as st
from datetime import datetime
from datetime import date

w1 = st.sidebar.date_input("Label 1", date(1970, 1, 1))
st.write("Value 1:", w1)

w2 = st.sidebar.date_input("Label 2", datetime(2019, 7, 6, 21, 15))
st.write("Value 2:", w2)

x = st.sidebar.text("overwrite me")
x.text("overwritten")

y = st.sidebar.text_input("type here")
