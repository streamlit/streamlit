import streamlit as st
import numpy as np
from matplotlib import pyplot

np.random.seed(0xDEADBEEF)
data = np.random.normal(1, 1, size=100)
plot = pyplot.plot(data)
st.pyplot()
pyplot.clf()

st.set_option("deprecation.showPyplotGlobalUse", False)
plot = pyplot.plot(data)
st.pyplot()
st.set_option("deprecation.showPyplotGlobalUse", True)

fig, ax = pyplot.subplots()
ax.plot(data)
st.pyplot(fig)
