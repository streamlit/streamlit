import streamlit as st
import numpy as np
import pandas as pd

with st.container():
    st.write("This is inside the container")

    # You can call any Streamlit command, including custom components:
    st.bar_chart(np.random.randn(50, 3))
st.write("This is outside the container")
