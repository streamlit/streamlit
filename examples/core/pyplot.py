import streamlit as st
import numpy as np
from matplotlib import pyplot

np.random.seed(0xDEADBEEF)
data = np.random.normal(1, 1, size=100)
plot = pyplot.plot(data)
st.pyplot()
