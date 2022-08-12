import streamlit as st
from datetime import time
from datetime import date

options = ("female", "male")

w1 = st.checkbox("I am human", True)

w2 = st.slider("Age", 0, 100, 25, 1)
st.write("Value 1:", w2)

w3 = st.text_area("Comments", "Streamlit is awesomeness!")

w4 = st.button("Click me")

w5 = st.radio("Gender", options, 1)

w6 = st.text_input("Text input widget", "i iz input")

w7 = st.selectbox("Options", options, 1)

w8 = st.time_input("Set an alarm for", time(8, 45))

w9 = st.date_input("A date to celebrate", date(2019, 7, 6))
