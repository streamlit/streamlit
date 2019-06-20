import streamlit as st
import pandas as pd
import numpy as np

coords = np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4]
df = pd.DataFrame(coords, columns=['lat', 'lon'])
st.map(df)
