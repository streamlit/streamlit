import streamlit as st
import numpy as np
import matplotlib.pyplot as plt

arr = np.random.normal(1, 1, size=100)
plt.hist(arr, bins=20)

st.pyplot()
