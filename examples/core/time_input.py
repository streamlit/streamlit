import streamlit as st
from datetime import datetime
from datetime import time

w1 = st.time_input('Label 1', time(8, 45))
st.write('Value 1:', w1)

w2 = st.time_input('Label 2', datetime(2019, 7, 6, 21, 15))
st.write('Value 2:', w2)
