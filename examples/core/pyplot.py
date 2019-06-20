import streamlit as st
import numpy as np
from matplotlib import pyplot

data = np.random.normal(1, 1, size=100)
plot = pyplot.hist(data, bins=20)
st.pyplot()
pyplot.clf()
