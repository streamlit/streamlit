import streamlit as st
import numpy as np

img = np.repeat(0, 10000).reshape(100, 100)
st.image(img, caption='Black Square')
