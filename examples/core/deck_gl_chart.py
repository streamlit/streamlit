import streamlit as st
import numpy as np
import pandas as pd

data = np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4]
df = pd.DataFrame(data, columns=['lat', 'lon'])
viewport = {
    'latitude': 37.76,
    'longitude': -122.4,
    'zoom': 11,
    'pitch': 50,
}
st.deck_gl_chart(df, viewport=viewport)
