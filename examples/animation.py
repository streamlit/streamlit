"""This script demonstrates animation in streamlit."""

import streamlit as st
import numpy as np
import time
import pandas as pd

# import shapefile

st.empty()
my_bar = st.progress(0)
for i in range(100):
    my_bar.progress(i + 1)
    time.sleep(0.1)
n_elts = int(time.time() * 10) % 5 + 3
for i in range(n_elts):
    st.text("." * i)
st.write(n_elts)
for i in range(n_elts):
    st.text("." * i)
st.success("done")
