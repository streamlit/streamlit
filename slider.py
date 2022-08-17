import streamlit as st
import numpy as np
import pandas as pd
from datetime import time

# import plost


# Slider improvement -----------------


st.select_slider(
    label="Select slider of floats",
    options=np.arange(0.0, 0.25, 0.05),
    value=(0.1, 0.2),
)

st.slider("How old are you?", 0, 130, 25)
st.slider("Select a range of values", 0.0, 100.0, (25.0, 75.0))
st.slider("Schedule your appointment:", value=(time(11, 30), time(12, 45)))
