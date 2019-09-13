import streamlit as st
import pandas as pd
import numpy as np

df = pd.DataFrame(
    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4], columns=["lat", "lon"]
)

# TODO: Use this instead of the example below. Need to autodetect viewport
# first, thought.
# st.deck_gl_chart(df)

st.deck_gl_chart(
    viewport={"latitude": 37.76, "longitude": -122.4, "zoom": 11, "pitch": 50},
    layers=[{"type": "ScatterplotLayer", "data": df}],
)
