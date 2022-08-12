import streamlit as st
from datetime import datetime
from datetime import time

w1 = st.time_input("Label 1", time(8, 45))
st.write("Value 1:", w1)

w2 = st.time_input("Label 2", datetime(2019, 7, 6, 21, 15))
st.write("Value 2:", w2)

w3 = st.time_input("Label 3", time(8, 45), disabled=True)
st.write("Value 3:", w3)

w4 = st.time_input("Label 4", time(8, 45), label_visibility="hidden")
st.write("Value 4:", w4)

w5 = st.time_input("Label 5", time(8, 45), label_visibility="collapsed")
st.write("Value 5:", w5)

if st._is_running_with_streamlit:

    def on_change():
        st.session_state.time_input_changed = True

    st.time_input("Label 6", key="time_input6", on_change=on_change)

    st.write("Value 6:", st.session_state.time_input6)
    st.write("time input changed:", "time_input_changed" in st.session_state)
